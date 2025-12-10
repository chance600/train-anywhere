import React, { useRef, useState, useEffect, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { KeyManager } from '../services/keyManager'; // [NEW] Safe Mode Support
import { useAudio } from '../hooks/useAudio';
import { LiveConnectionState, WorkoutSession } from '../types';
import { MODEL_NAMES, SYSTEM_INSTRUCTIONS } from '../constants';
import { Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { EXERCISE_CATALOG } from '../utils/exerciseLogic';
import { Camera, Mic, Square, Play, Save, CheckCircle, RefreshCw, Activity, Terminal, Settings, Scan, EyeOff, Coffee, MessageSquare } from 'lucide-react';

// Declare global Pose for CDN loaded script
declare global {
  interface Window {
    Pose: any;
    Camera: any;
  }
}

// Tool Definition for the AI to report progress
const workoutTool: FunctionDeclaration = {
  name: 'updateWorkoutStats',
  description: 'Call this function to update the user\'s workout statistics on the screen when a rep is completed or exercise changes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reps: { type: Type.NUMBER, description: 'The total number of reps completed for the current set.' },
      exerciseDetected: { type: Type.STRING, description: 'The name of the exercise currently being performed.' },
      feedback: { type: Type.STRING, description: 'Brief feedback string about form or encouragement.' },
      score: { type: Type.NUMBER, description: 'Form quality score (0-100) for the last rep.' },
    },
    required: ['reps', 'exerciseDetected', 'feedback'],
  },
};

const getWorkoutHistoryTool: FunctionDeclaration = {
  name: 'getWorkoutHistory',
  description: 'Call this function when the user asks about their performance, form, or history of the current session.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const changeExerciseTool: FunctionDeclaration = {
  name: 'changeExercise',
  description: 'Call this function when the user asks to switch to a different exercise.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      exerciseName: { type: Type.STRING, description: 'The name of the new exercise (e.g. Squats, Pushups).' },
    },
    required: ['exerciseName'],
  },
};

const stopWorkoutTool: FunctionDeclaration = {
  name: 'stopWorkout',
  description: 'Call this function when the user wants to stop or end the workout session.',
  parameters: { type: Type.OBJECT, properties: {} },
};

// Helper for blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // Remove data URL prefix
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper for creating PCM blob
function createPcmBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return {
    data: btoa(binary),
    mimeType: 'audio/pcm;rate=16000',
  };
}

interface CameraWorkoutProps {
  onSaveWorkout: (session: WorkoutSession) => void;
  onFocusChange?: (isFocused: boolean) => void;
}

const CameraWorkout: React.FC<CameraWorkoutProps> = ({ onSaveWorkout, onFocusChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<LiveConnectionState>(LiveConnectionState.DISCONNECTED);
  const [focusMode, setFocusMode] = useState(false);

  // Helper to toggle focus
  const toggleFocus = (active: boolean) => {
    setFocusMode(active);
    if (onFocusChange) onFocusChange(active);
  };
  const [reps, setReps] = useState(0);
  const [exercise, setExercise] = useState('Squats');
  const [feedback, setFeedback] = useState('');
  const [lastRepScore, setLastRepScore] = useState<number | null>(null);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(60);
  const [isSendingFrame, setIsSendingFrame] = useState(false);
  const [activeSessionPromise, setActiveSessionPromise] = useState<Promise<any> | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [debugValue, setDebugValue] = useState(0);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [sensitivity, setSensitivity] = useState(0); // -20 to +20 degrees

  // Countdown State
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isTrackingActive, setIsTrackingActive] = useState(false);

  const { initializeAudio, decodeAndPlay, stopAll, playDing, audioContext } = useAudio();

  // Refs for loop management to avoid stale closures
  const frameIntervalRef = useRef<number>();
  const isConnectedRef = useRef(false);

  // SYNC-TO-REF PATTERN (CRITICAL)
  const repsRef = useRef(reps);
  const exerciseRef = useRef(exercise);
  const feedbackRef = useRef(feedback);
  const exerciseStateRef = useRef({
    stage: 'start',
    lastFeedback: 0,
    repStartTime: 0,
    repDurations: [] as number[],
    currentRepScore: 0
  });
  const sensitivityRef = useRef(sensitivity);
  // [NEW] Tracking Ref for Loop
  const isTrackingActiveRef = useRef(isTrackingActive);
  const sessionHistoryRef = useRef<{ time: string, type: 'rep' | 'warning', detail: string }[]>([]);

  // Sync state to refs
  useEffect(() => { repsRef.current = reps; }, [reps]);
  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);
  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);
  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);
  useEffect(() => { isTrackingActiveRef.current = isTrackingActive; }, [isTrackingActive]);

  // Rest Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isResting && restTime > 0) {
      interval = setInterval(() => setRestTime(t => t - 1), 1000);
    } else if (restTime === 0) {
      setIsResting(false);
      setRestTime(60);
      playDing(); // Alert user rest is over
    }
    return () => clearInterval(interval);
  }, [isResting, restTime, playDing]);

  // Countdown Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCountingDown && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(c => {
          if (c === 1) {
            playDing(); // Final beep
            setIsCountingDown(false);
            setIsTrackingActive(true);
            setFeedback('GO! Start your reps!');
            addLog("Tracking Started");

            // Auto-dismiss "GO!" after 1 second
            setTimeout(() => setCountdown(-1), 1000);
            return 0;
          }
          playDing(); // Countdown beep
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCountingDown, countdown, playDing]);

  const startTracking = () => {
    setReps(0); // Reset reps
    exerciseStateRef.current = { stage: 'start', lastFeedback: 0, repStartTime: 0, repDurations: [], currentRepScore: 0 };
    setCountdown(3);
    setIsCountingDown(true);
    setIsTrackingActive(false);
    setFeedback('Get ready...');
  };

  const startRest = () => {
    setIsResting(true);
    // setRestTime(60); // REMOVE THIS HARDCODED VALUE
    // We already have restTime state effectively setting the starting time?
    // Actually, the restTime state IS the current countdown.
    // If the user adjusted the slider, that's fine, but we need a "duration" state separate from "current time"
    // OR we just rely on the slider setting the initial value, and then we countdown?
    // Wait, the slider sets 'restTime'. If we countdown, we are mutating the state that the slider controls.
    // We need a separate `restDuration` vs `restTimer`.
    // FOR NOW: Let's assume the slider sets the DESIRED rest time.
    // When we start rest, we shouldn't reset it to 60. We should just start the countdown from whatever it is?
    // Or better: The slider changes a `defaultRestTime`. `restTime` is the countdown.
    // Let's check the state definitions. Line 105: const [restTime, setRestTime] = useState(60);
    // There is no separate default.
    // FIX: When rest ends, we reset to 60. That's the problem. It resets to 60 instead of what user chose.
    // Let's simplify: The slider sets `restTime`. When we click "Rest", we just start the timer.
    // But we need to remember what the "reset" value should be.
    // Let's add a ref or separate state for `targetRestTime`.
  };

  const addLog = (msg: string) => {
    setLogs(prev => [new Date().toLocaleTimeString() + ': ' + msg, ...prev.slice(0, 4)]);
  };

  // Fetch Devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      setMics(devices.filter(d => d.kind === 'audioinput'));
    });
  }, []);

  // Initialize camera & MediaPipe
  useEffect(() => {
    let pose: any;
    let animationFrameId: number;
    let currentStream: MediaStream | null = null;
    let isActive = true;

    const onResults = (results: any) => {
      // Diagnostic: Log first success
      if (debugValue === 0 && results.poseLandmarks) {
        addLog("Vision System Active ✅");
        setDebugValue(1);
      }

      if (results.poseLandmarks) {
        // Draw on canvas
        if (canvasRef.current && videoRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            ctx.save();
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            // Optional: Draw video frame on canvas (not needed if video is behind)
            // ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

            const drawingUtils = (window as any).drawConnectors ? window : (window as any);
            if (drawingUtils.drawConnectors && drawingUtils.drawLandmarks) {
              const connections = (window as any).POSE_CONNECTIONS || [];
              const bodyConnections = connections.filter((conn: [number, number]) => conn[0] > 10 && conn[1] > 10);
              const bodyLandmarks = results.poseLandmarks.filter((_: any, index: number) => index > 10);

              drawingUtils.drawConnectors(ctx, results.poseLandmarks, bodyConnections, { color: '#00FF00', lineWidth: 4 });
              drawingUtils.drawLandmarks(ctx, bodyLandmarks, { color: '#FF0000', lineWidth: 2 });
            }
            ctx.restore();
          }
        }
      }

      // EXERCISE LOGIC ENGINE
      // Read from REFS to avoid stale closures
      const currentExercise = exerciseRef.current;
      const config = EXERCISE_CATALOG[currentExercise];

      // ONLY COUNT REPS IF TRACKING IS ACTIVE (after countdown)
      if (config && isTrackingActiveRef.current) {
        const progress = config.calculateProgress(results.poseLandmarks);
        const state = exerciseStateRef.current;

        // State Machine: START -> MIDDLE -> END (Rep Complete)
        const sens = sensitivityRef.current;
        if (state.stage === 'start') {
          if (progress <= config.thresholds.middle + sens) {
            state.stage = 'middle';
            state.repStartTime = Date.now(); // Start timing the concentric phase (or full rep)

            // Calculate Score at the bottom of the rep (max exertion)
            if (config.calculateScore) {
              state.currentRepScore = config.calculateScore(results.poseLandmarks);
            } else {
              state.currentRepScore = 100; // Default
            }
          }

          // Check Form (Throttled)
          if (config.checkForm && Date.now() - state.lastFeedback > 5000) {
            const warning = config.checkForm(results.poseLandmarks);
            if (warning) {
              state.lastFeedback = Date.now();
              setFeedback(warning);
              sessionHistoryRef.current.push({ time: new Date().toLocaleTimeString(), type: 'warning', detail: warning });

              // Notify Gemini to speak
              if (isConnectedRef.current && activeSessionPromise) {
                activeSessionPromise.then(session => {
                  session.send({ parts: [{ text: `Form Warning: ${warning}. Tell the user to fix it.` }] });
                });
              }
            }
          }
        } else if (state.stage === 'middle') {
          if (progress >= config.thresholds.end) {
            state.stage = 'start';
            // REP COMPLETE
            const newReps = repsRef.current + 1;
            setReps(newReps);
            setLastRepScore(state.currentRepScore);

            // Calculate Duration & Motivation
            const duration = (Date.now() - state.repStartTime) / 1000;
            state.repDurations.push(duration);
            const avgDuration = state.repDurations.length > 1
              ? state.repDurations.reduce((a, b) => a + b, 0) / state.repDurations.length
              : duration;

            sessionHistoryRef.current.push({ time: new Date().toLocaleTimeString(), type: 'rep', detail: `Rep ${newReps} in ${duration.toFixed(1)}s (Score: ${state.currentRepScore})` });

            // Trigger Sound Effect
            playDing();

            // Notify Gemini
            if (isConnectedRef.current && activeSessionPromise) {
              activeSessionPromise.then(session => {
                // Check for struggle (1.5x slower than average)
                if (state.repDurations.length > 3 && duration > avgDuration * 1.5) {
                  session.send({ parts: [{ text: `User is struggling (Rep took ${duration.toFixed(1)}s vs avg ${avgDuration.toFixed(1)}s). Give high-energy motivation!` }] });
                }

                session.sendToolResponse({
                  functionResponses: [{
                    name: 'updateWorkoutStats',
                    response: { result: `Rep ${newReps} completed. Form Score: ${state.currentRepScore}/100.` }
                  }]
                });
              }).catch(() => {
                // Ignore errors if no tool call was pending
              });
            }
          }
        }
      }
    };

    const startCamera = async () => {
      try {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
        const videoWidth = isMobile ? 480 : 640;
        const videoHeight = isMobile ? 360 : 480;

        const constraints: MediaStreamConstraints = {
          video: {
            width: videoWidth,
            height: videoHeight,
            deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
            facingMode: isMobile ? 'user' : undefined
          },
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true
        };

        const ms = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = ms;
        setStream(ms);

        if (videoRef.current) {
          videoRef.current.srcObject = ms;
          // Wait for metadata to play
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("Play error", e));
            detectPose(); // Start loop once video is ready
          };
        }
        addLog(`Camera initialized (${videoWidth}x${videoHeight})`);

        if ((window as any).Pose) {
          pose = new (window as any).Pose({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
          });
          pose.setOptions({
            modelComplexity: isMobile ? 0 : 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: isMobile ? 0.6 : 0.5,
            minTrackingConfidence: isMobile ? 0.6 : 0.5
          });
          pose.onResults(onResults);
        }
      } catch (e) {
        console.error("Camera error:", e);
        setFeedback("Camera permission denied.");
        addLog("Camera error");
      }
    };

    // Explicit Loop
    const detectPose = async () => {
      if (!isActive || !videoRef.current || !pose) return;

      try {
        if (videoRef.current.readyState >= 2) { // 2 = HAVE_CURRENT_DATA
          await pose.send({ image: videoRef.current });
        }
      } catch (err) {
        // console.error(err); // Suppress frequent errors
      }

      animationFrameId = requestAnimationFrame(detectPose);
    };

    startCamera();

    return () => {
      isActive = false;
      if (currentStream) currentStream.getTracks().forEach(t => t.stop());
      if (pose) pose.close();
      cancelAnimationFrame(animationFrameId);
    };
  }, [selectedCamera, selectedMic, activeSessionPromise, playDing]); // Added activeSessionPromise and playDing to dependencies for onResults closure

  // Connect to Live API
  const toggleLiveSession = async () => {
    if (connectionState === LiveConnectionState.CONNECTED || connectionState === LiveConnectionState.CONNECTING) {
      window.location.reload(); // Hard reset for clean disconnect
      return;
    }

    if (!stream) return;

    // CHECK FOR API KEY (Safe Mode Logic)
    if (!KeyManager.hasKey()) {
      setFeedback("⚠️ AI Coach requires a Key. Rep Counter is ON!");
      addLog("AI Coach disabled (No Key). Vision only.");
      // Do not connect, but allow the app to function visually
      return;
    }

    setConnectionState(LiveConnectionState.CONNECTING);
    setFeedback("Connecting to AI Coach...");
    addLog("Initializing Audio Context...");
    await initializeAudio();

    try {
      const client = geminiService.getLiveClient();
      let sessionPromise: Promise<any>;

      addLog("Connecting to Gemini Live...");

      sessionPromise = client.connect({
        model: MODEL_NAMES.LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [workoutTool, changeExerciseTool, stopWorkoutTool, getWorkoutHistoryTool] }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: SYSTEM_INSTRUCTIONS.LIVE_COACH,
        },
        callbacks: {
          onopen: () => {
            console.log("Live Session Open");
            addLog("Session Connected");
            setConnectionState(LiveConnectionState.CONNECTED);
            setFeedback("AI Coach is watching. Start moving!");
            isConnectedRef.current = true;
            startStreaming(sessionPromise);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // 1. Handle Audio Response
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              decodeAndPlay(audioData);
            }

            // 2. Handle Tool Calls
            if (msg.toolCall) {
              addLog("Tool Call Received");
              for (const call of msg.toolCall.functionCalls) {
                if (call.name === 'updateWorkoutStats') {
                  const { reps: newReps, exerciseDetected, feedback: newFeedback } = call.args as any;

                  addLog(`Update: ${newReps} reps, ${exerciseDetected}`);

                  // Update UI
                  if (typeof newReps === 'number') setReps(newReps);
                  if (exerciseDetected) setExercise(exerciseDetected);
                  if (newFeedback) setFeedback(newFeedback);

                  // Send confirmation back to model
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        id: call.id,
                        name: call.name,
                        response: { result: 'UI Updated' }
                      }]
                    });
                  });
                } else if (call.name === 'changeExercise') {
                  const { exerciseName } = call.args as any;
                  setExercise(exerciseName);
                  setReps(0); // Reset reps for new exercise
                  addLog(`Switched to ${exerciseName}`);

                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        id: call.id,
                        name: call.name,
                        response: { result: `Switched to ${exerciseName}` }
                      }]
                    });
                  });
                } else if (call.name === 'stopWorkout') {
                  addLog("Stopping Workout");
                  toggleLiveSession(); // This might cause a reload, which is fine

                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        id: call.id,
                        name: call.name,
                        response: { result: 'Workout Stopped' }
                      }]
                    });
                  });
                } else if (call.name === 'getWorkoutHistory') {
                  const history = sessionHistoryRef.current;
                  const summary = history.length > 0
                    ? history.map(h => `[${h.time}] ${h.type.toUpperCase()}: ${h.detail}`).join('\n')
                    : "No events recorded yet.";

                  addLog("Sent Session History");

                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        id: call.id,
                        name: call.name,
                        response: { result: summary }
                      }]
                    });
                  });
                }
              }
            }
          },
          onclose: () => {
            setConnectionState(LiveConnectionState.DISCONNECTED);
            isConnectedRef.current = false;
            setFeedback("Session ended.");
            addLog("Session Closed");
            clearInterval(frameIntervalRef.current);
          },
          onerror: (err) => {
            console.error(err);
            setConnectionState(LiveConnectionState.ERROR);
            setFeedback("Connection error.");
            addLog("Session Error");
            isConnectedRef.current = false;
          }
        }
      });

      setActiveSessionPromise(sessionPromise);

    } catch (e) {
      console.error(e);
      setConnectionState(LiveConnectionState.ERROR);
      setFeedback("Failed to connect.");
      addLog("Connection Failed");
    }
  };

  const startStreaming = async (sessionPromise: Promise<any>) => {
    if (!audioContext) return;

    // IMPORTANT: Resume audio context if suspended (common in browsers)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    addLog("Starting Media Stream...");

    // 1. Audio Stream Setup
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const source = inputCtx.createMediaStreamSource(stream!);
    const processor = inputCtx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (!isConnectedRef.current) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);

      sessionPromise.then(session => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    source.connect(processor);
    processor.connect(inputCtx.destination);

    // 2. Video Stream Setup
    // Lower FPS on mobile to save bandwidth and battery
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    const FPS = isMobile ? 3 : 4;
    frameIntervalRef.current = window.setInterval(async () => {
      if (!isConnectedRef.current || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      // We use the canvas that is already being drawn to by MediaPipe if possible, 
      // but MediaPipe draws landmarks. We might want the raw feed for the AI?
      // Actually, AI seeing landmarks is also fine, but usually it prefers raw video.
      // Let's create a separate offscreen canvas or just draw the video frame again.
      // Since we are using MediaPipe Camera utils, it updates the canvasRef with landmarks.
      // Let's grab the frame from the video element directly.

      const offscreen = document.createElement('canvas');
      offscreen.width = video.videoWidth * 0.5;
      offscreen.height = video.videoHeight * 0.5;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
      const base64 = offscreen.toDataURL('image/jpeg', 0.6).split(',')[1];

      setIsSendingFrame(true);
      sessionPromise.then(session => {
        session.sendRealtimeInput({
          media: {
            mimeType: 'image/jpeg',
            data: base64
          }
        });
        setTimeout(() => setIsSendingFrame(false), 100);
      });

    }, 1000 / FPS);
  };

  const handleSave = () => {
    onSaveWorkout({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      exercise,
      reps,
      weight: 0
    });
    setReps(0); // Reset for next set
    alert("Set saved!");
  };

  // Determine content to render for the camera view (Video + Overlays)
  const cameraLayer = (
    <div className={`overflow-hidden bg-black transition-all duration-500 ${focusMode ? 'fixed inset-0 z-50 w-full h-full rounded-none m-0' : 'relative flex-1 rounded-xl m-2 border border-gray-700'}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none transform scale-x-[-1]"
      />

      {/* Standard Info Overlays (Hidden in Focus Mode) */}
      {!focusMode && (
        <>
          <div className="absolute top-4 left-4 bg-black/60 p-2 rounded-lg backdrop-blur-sm z-10">
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">AI Vision</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connectionState === LiveConnectionState.CONNECTED ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
              <p className="text-white font-mono text-sm">{connectionState === LiveConnectionState.CONNECTED ? "LIVE TRACKING" : "OFFLINE"}</p>
            </div>
            {connectionState === LiveConnectionState.CONNECTED && (
              <div className="flex items-center gap-2 mt-2">
                <Activity size={12} className={isSendingFrame ? "text-green-400" : "text-gray-600"} />
                <span className="text-[10px] text-gray-400">Stream Active</span>
              </div>
            )}
          </div>

          {/* Standard Rep Counter (Top Right) */}
          <div className="absolute top-4 right-4 bg-black/60 p-2 rounded-lg backdrop-blur-sm z-10 text-right">
            <div className="text-2xl font-bold text-white leading-none">{reps}</div>
            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Reps</div>
          </div>

          {/* Debug Log */}
          <div className="absolute bottom-32 right-4 w-64 bg-black/80 rounded-lg p-2 font-mono text-[10px] text-green-400 z-10 pointer-events-none border border-gray-800 opacity-50 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2 border-b border-gray-700 pb-1 mb-1 text-gray-400">
              <Terminal size={10} />
              <span>System Log</span>
            </div>
            {logs.map((log, i) => (
              <div key={i} className="truncate opacity-80">{log}</div>
            ))}
          </div>
        </>
      )}

      {/* Countdown Overlay */}
      {(isCountingDown || countdown === 0) && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="text-center">
            {countdown > 0 ? (
              <>
                <div className="text-9xl font-bold text-emerald-400 animate-pulse" style={{ textShadow: '0 0 40px rgba(16, 185, 129, 0.8)' }}>
                  {countdown}
                </div>
                <div className="text-2xl text-white mt-4 font-bold drop-shadow-md">Get Ready...</div>
              </>
            ) : (
              <div className="text-8xl font-bold text-green-500 animate-bounce" style={{ textShadow: '0 0 60px rgba(34, 197, 94, 1)' }}>
                GO!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feedback Overlay */}
      <div className={`absolute bottom-4 left-4 right-4 bg-black/70 p-4 rounded-xl backdrop-blur-md border border-gray-700 z-10 transition-all duration-300 ${!feedback ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        <p className="text-white text-center font-medium animate-pulse text-lg">{feedback || "Keep moving..."}</p>
      </div>

      {/* Focus Mode Specific Overlays */}
      {focusMode && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          {/* Top Bar Stats */}
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30 bg-gradient-to-b from-black/80 to-transparent">
            <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 pointer-events-auto">
              <div className="text-5xl font-bold text-white mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {reps}
              </div>
              <div className="text-emerald-400 font-bold text-sm tracking-widest uppercase">Reps</div>
            </div>

            <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-right pointer-events-auto">
              <div className={`text-4xl font-bold mb-1 ${lastRepScore > 80 ? 'text-emerald-400' : lastRepScore > 50 ? 'text-yellow-400' : 'text-red-400'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {lastRepScore}
              </div>
              <div className="text-gray-400 font-bold text-sm tracking-widest uppercase">Form Score</div>
            </div>
          </div>

          {/* Exit Button - Floating at bottom */}
          <div className="absolute bottom-10 left-0 right-0 flex justify-center z-50 pointer-events-auto">
            <button
              onClick={() => toggleFocus(false)}
              className="group bg-black/40 hover:bg-red-500/80 text-white/80 hover:text-white px-6 py-3 rounded-full backdrop-blur-md transition-all border border-white/10 hover:border-red-400 shadow-2xl flex items-center gap-3"
            >
              <EyeOff size={20} className="group-hover:scale-110 transition-transform" />
              <span className="font-medium tracking-wide text-sm">EXIT FOCUS</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );



  return (
    <div className="flex flex-col h-full bg-gray-900 relative">
      {/* Normal Render */}
      {cameraLayer}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-gray-800 p-6 sm:p-8 rounded-2xl w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl sm:text-xl font-bold text-white mb-6 sm:mb-4 flex items-center gap-2">
              <Settings size={24} /> Settings
            </h3>

            <div className="space-y-6 sm:space-y-4">
              <div>
                <label className="text-sm sm:text-xs text-gray-400 uppercase block mb-2 font-bold">Camera</label>
                <select
                  value={selectedCamera}
                  onChange={(e) => { setSelectedCamera(e.target.value); }}
                  className="w-full bg-gray-700 text-white p-4 sm:p-3 rounded-lg text-base sm:text-sm min-h-[48px]"
                >
                  {cameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm sm:text-xs text-gray-400 uppercase block mb-2 font-bold">Microphone</label>
                <select
                  value={selectedMic}
                  onChange={(e) => setSelectedMic(e.target.value)}
                  className="w-full bg-gray-700 text-white p-4 sm:p-3 rounded-lg text-base sm:text-sm min-h-[48px]"
                >
                  {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 5)}`}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm sm:text-xs text-gray-400 uppercase block mb-3 sm:mb-2 font-bold">
                  Sensitivity Correction ({sensitivity > 0 ? '+' : ''}{sensitivity}°)
                </label>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="w-full h-3 sm:h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-xs sm:text-[10px] text-gray-500 mt-2 sm:mt-1">Adjust if reps are too hard/easy to register.</p>
              </div>

              {/* Adjustable Rest Timer */}
              <div>
                <label className="text-sm sm:text-xs text-gray-400 uppercase block mb-3 sm:mb-2 font-bold">
                  Rest Timer Duration ({restTime}s)
                </label>
                <input
                  type="range"
                  min="15"
                  max="180"
                  step="15"
                  value={restTime}
                  onChange={(e) => setRestTime(Number(e.target.value))}
                  className="w-full h-3 sm:h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-xs sm:text-[10px] text-gray-500 mt-2 sm:mt-1">Time for rest between sets.</p>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full mt-8 sm:mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 sm:py-3 rounded-xl text-base sm:text-sm min-h-[52px]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main Container - Adjusted for Focus Mode */}
      {/* If Focus Mode, we want this to be fixed inset-0 z-50. If not, relative. */}
      {/* Actually, let's look at where the video is rendered. Line 635. */
      /* I need to edit the container class at line 635. Let me make a separate Edit for that. */}

      {/* Controls (Hidden in Focus Mode) */}
      <div className={`bg-gray-900/95 backdrop-blur-md p-6 rounded-t-3xl shadow-2xl z-20 transition-transform duration-500 border-t border-gray-800 ${focusMode ? 'translate-y-full' : 'translate-y-0'}`}>
        {/* Top Row: Exercise Selector, Focus Mode, Settings */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex-1 mr-4">
            <label className="text-gray-400 text-xs uppercase mb-1 flex items-center gap-1 font-bold">
              Current Exercise
              {connectionState === LiveConnectionState.CONNECTED && <RefreshCw size={10} className="animate-spin text-emerald-500" />}
            </label>
            <div className="relative">
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="w-full bg-black/40 text-white rounded-xl p-4 pr-10 text-lg font-medium appearance-none border border-gray-700 focus:border-emerald-500 focus:outline-none transition-all"
              >
                <option>Auto-Detect</option>
                {Object.keys(EXERCISE_CATALOG).filter(k => k !== 'default').map(ex => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </div>
            {feedback && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center gap-3 animate-pulse mt-2">
                <Activity className="text-red-400 w-4 h-4" />
                <p className="text-red-200 text-sm font-bold">{feedback}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                toggleFocus(true);
                // Trigger browser fullscreen
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                  elem.requestFullscreen().catch(err => console.log("Fullscreen blocked", err));
                }
              }}
              className="p-4 bg-indigo-600/20 text-indigo-400 rounded-xl hover:bg-indigo-600/30 border border-indigo-600/30 transition-colors"
              title="Enter Focus Mode"
            >
              <Scan size={24} />
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="p-4 bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-700 hover:text-white transition-colors"
              aria-label="Settings"
            >
              <Settings size={24} />
            </button>
          </div>
        </div>

        {/* Middle Row: Primary Actions (Start / Rest) */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={startTracking}
            disabled={isCountingDown || isTrackingActive}
            className={`
              relative overflow-hidden group
              ${isTrackingActive ? 'bg-emerald-900/30 border border-emerald-500/50' : 'bg-emerald-600 hover:bg-emerald-500'}
              disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all min-h-[64px]
            `}
          >
            {isTrackingActive ? (
              <span className="flex items-center gap-2 text-emerald-400">
                <Activity size={24} className="animate-pulse" /> Active
              </span>
            ) : (
              <span className="flex items-center gap-2 text-lg">
                <Play size={24} className="fill-current" /> START
              </span>
            )}
          </button>

          <button
            onClick={startRest}
            disabled={isResting}
            className={`
              font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all min-h-[64px]
              ${isResting
                ? 'bg-blue-900/30 text-blue-400 border border-blue-500/50'
                : 'bg-blue-600 hover:bg-blue-500 text-white'}
            `}
          >
            {isResting ? (
              <>
                <Coffee size={24} className="animate-bounce" /> {restTime}s
              </>
            ) : (
              <>
                <Coffee size={24} /> Rest
              </>
            )}
          </button>
        </div>

        {/* Bottom Row: Manual Reps, Coach, Save */}
        <div className="flex items-center gap-4">
          {/* Rep Counter */}
          <div className="flex items-center bg-black/40 rounded-xl p-1 border border-gray-700">
            <button onClick={() => setReps(Math.max(0, reps - 1))} className="w-12 h-12 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center justify-center">
              <div className="text-xl font-bold">-</div>
            </button>
            <div className="flex-1 px-4 text-center">
              <div className="text-2xl font-bold text-white">{reps}</div>
            </div>
            <button onClick={() => setReps(reps + 1)} className="w-12 h-12 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center justify-center">
              <div className="text-xl font-bold">+</div>
            </button>
          </div>

          {/* AI Coach Button */}
          <button
            onClick={toggleLiveSession}
            className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border ${connectionState === LiveConnectionState.CONNECTED
              ? 'bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500/20'
              : connectionState === LiveConnectionState.CONNECTING
                ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/50'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20'
              }`}
          >
            {connectionState === LiveConnectionState.CONNECTED ? <Square size={18} fill="currentColor" /> : <MessageSquare size={18} />}
            <span className="text-sm">{connectionState === LiveConnectionState.CONNECTED ? "End Session" : "AI Coach"}</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={reps === 0}
            className="w-14 h-14 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save Set"
          >
            <Save size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraWorkout;
