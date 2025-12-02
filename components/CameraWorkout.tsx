import React, { useRef, useState, useEffect, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { useAudio } from '../hooks/useAudio';
import { LiveConnectionState, WorkoutSession } from '../types';
import { MODEL_NAMES, SYSTEM_INSTRUCTIONS } from '../constants';
import { Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { EXERCISE_CATALOG } from '../utils/exerciseLogic';
import { Camera, Mic, Square, Play, Save, CheckCircle, RefreshCw, Activity, Terminal, Settings } from 'lucide-react';

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
    },
    required: ['reps', 'exerciseDetected', 'feedback'],
  },
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
}

const CameraWorkout: React.FC<CameraWorkoutProps> = ({ onSaveWorkout }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<LiveConnectionState>(LiveConnectionState.DISCONNECTED);
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);
  const [exercise, setExercise] = useState('Auto-Detect');
  const [feedback, setFeedback] = useState("Ready to start.");
  const [isSendingFrame, setIsSendingFrame] = useState(false);
  const [activeSessionPromise, setActiveSessionPromise] = useState<Promise<any> | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [sensitivity, setSensitivity] = useState(0); // -20 to +20 degrees

  const { initializeAudio, decodeAndPlay, stopAll, playDing, audioContext } = useAudio();

  // Refs for loop management to avoid stale closures
  const frameIntervalRef = useRef<number>();
  const isConnectedRef = useRef(false);

  // SYNC-TO-REF PATTERN (CRITICAL)
  const repsRef = useRef(reps);
  const exerciseRef = useRef(exercise);
  const feedbackRef = useRef(feedback);
  const exerciseStateRef = useRef({ stage: 'start', lastFeedback: 0 }); // 'start', 'middle', 'end'
  const sensitivityRef = useRef(sensitivity);

  // Sync state to refs
  useEffect(() => { repsRef.current = reps; }, [reps]);
  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);
  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);
  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);

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
    let camera: any;

    const onResults = (results: any) => {
      if (!results.poseLandmarks) return;

      // Draw on canvas
      if (canvasRef.current && videoRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;

          ctx.save();
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

          // Draw landmarks
          const drawingUtils = (window as any).drawConnectors ? window : (window as any);
          if (drawingUtils.drawConnectors && drawingUtils.drawLandmarks) {
            drawingUtils.drawConnectors(ctx, results.poseLandmarks, (window as any).POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
            drawingUtils.drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });
          }
          ctx.restore();
        }
      }

      // EXERCISE LOGIC ENGINE
      // Read from REFS to avoid stale closures
      const currentExercise = exerciseRef.current;
      const config = EXERCISE_CATALOG[currentExercise];

      if (config) {
        const progress = config.calculateProgress(results.poseLandmarks);
        const state = exerciseStateRef.current;

        // State Machine: START -> MIDDLE -> END (Rep Complete)
        const sens = sensitivityRef.current;
        if (state.stage === 'start') {
          if (progress <= config.thresholds.middle + sens) {
            state.stage = 'middle';
            // Optional: Feedback for reaching depth
          }

          // Check Form (Throttled)
          if (config.checkForm && Date.now() - state.lastFeedback > 5000) {
            const warning = config.checkForm(results.poseLandmarks);
            if (warning) {
              state.lastFeedback = Date.now();
              setFeedback(warning);

              // Notify Gemini to speak
              if (isConnectedRef.current && activeSessionPromise) {
                activeSessionPromise.then(session => {
                  // We can send a text message to the model to prompt it to speak
                  // The Live API supports sending text parts.
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

            // Trigger Sound Effect
            playDing();

            // Notify Gemini
            if (isConnectedRef.current && activeSessionPromise) {
              activeSessionPromise.then(session => {
                session.sendToolResponse({
                  functionResponses: [{
                    name: 'updateWorkoutStats',
                    response: { result: `Rep ${newReps} completed.` }
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
        const constraints: MediaStreamConstraints = {
          video: {
            width: 640,
            height: 480,
            deviceId: selectedCamera ? { exact: selectedCamera } : undefined
          },
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true
        };

        const ms = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(ms);
        if (videoRef.current) {
          videoRef.current.srcObject = ms;
        }
        addLog("Camera initialized");

        // Initialize MediaPipe Pose
        if ((window as any).Pose) {
          pose = new (window as any).Pose({
            locateFile: (file: string) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
          });
          pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          pose.onResults(onResults);

          // Use MediaPipe Camera Utils
          if ((window as any).Camera) {
            camera = new (window as any).Camera(videoRef.current, {
              onFrame: async () => {
                if (videoRef.current) await pose.send({ image: videoRef.current });
              },
              width: 640,
              height: 480
            });
            camera.start();
          }
        }
      } catch (e) {
        console.error("Camera error:", e);
        setFeedback("Camera permission denied.");
        addLog("Camera error");
      }
    };

    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (camera) camera.stop();
      if (pose) pose.close();
    };
  }, []);

  // Connect to Live API
  const toggleLiveSession = async () => {
    if (connectionState === LiveConnectionState.CONNECTED || connectionState === LiveConnectionState.CONNECTING) {
      window.location.reload(); // Hard reset for clean disconnect
      return;
    }

    if (!stream) return;

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
          tools: [{ functionDeclarations: [workoutTool, changeExerciseTool, stopWorkoutTool] }],
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
    // 4 FPS is a good balance for motion vs bandwidth
    const FPS = 4;
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
      weight
    });
    setReps(0); // Reset for next set
    alert("Set saved!");
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 relative">
      {/* Camera Layer */}
      <div className="flex-1 relative overflow-hidden rounded-xl m-2 border border-gray-700 bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="hidden" // Hide raw video, show canvas
        />
        <canvas ref={canvasRef} className="w-full h-full object-cover" />

        {/* Overlay Info */}
        <div className="absolute top-4 left-4 bg-black/60 p-2 rounded-lg backdrop-blur-sm z-10">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">AI Vision</p>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connectionState === LiveConnectionState.CONNECTED ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <p className="text-white font-mono text-sm">{connectionState === LiveConnectionState.CONNECTED ? "LIVE TRACKING" : "OFFLINE"}</p>
          </div>
          {/* Frame Transmission Indicator */}
          {connectionState === LiveConnectionState.CONNECTED && (
            <div className="flex items-center gap-2 mt-2">
              <Activity size={12} className={isSendingFrame ? "text-green-400" : "text-gray-600"} />
              <span className="text-[10px] text-gray-400">Stream Active</span>
            </div>
          )}
        </div>

        {/* Debug Log Overlay */}
        <div className="absolute bottom-32 right-4 w-64 bg-black/80 rounded-lg p-2 font-mono text-[10px] text-green-400 z-10 pointer-events-none border border-gray-800">
          <div className="flex items-center gap-2 border-b border-gray-700 pb-1 mb-1 text-gray-400">
            <Terminal size={10} />
            <span>System Log</span>
          </div>
          {logs.map((log, i) => (
            <div key={i} className="truncate opacity-80">{log}</div>
          ))}
        </div>

        {/* Feedback Overlay */}
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 p-4 rounded-xl backdrop-blur-md border border-gray-700 z-10 transition-all duration-300">
          <p className="text-white text-center font-medium animate-pulse text-lg">{feedback}</p>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Settings size={20} /> Settings
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase block mb-2">Camera</label>
                <select
                  value={selectedCamera}
                  onChange={(e) => { setSelectedCamera(e.target.value); startCamera(); }}
                  className="w-full bg-gray-700 text-white p-3 rounded-lg text-sm"
                >
                  {cameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase block mb-2">Microphone</label>
                <select
                  value={selectedMic}
                  onChange={(e) => setSelectedMic(e.target.value)}
                  className="w-full bg-gray-700 text-white p-3 rounded-lg text-sm"
                >
                  {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 5)}`}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase block mb-2">
                  Sensitivity Correction ({sensitivity > 0 ? '+' : ''}{sensitivity}°)
                </label>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">Adjust if reps are too hard/easy to register.</p>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-gray-800 p-6 rounded-t-3xl shadow-2xl z-20">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col flex-1 mr-4">
            <label className="text-gray-400 text-xs uppercase mb-1 flex items-center gap-1">
              Exercise
              {connectionState === LiveConnectionState.CONNECTED && <RefreshCw size={10} className="animate-spin" />}
            </label>
            <div className="flex gap-2">
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="flex-1 bg-gray-700 text-white rounded-lg p-3 text-sm border-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option>Auto-Detect</option>
                <option>Squats</option>
                <option>Pushups</option>
                <option>Bicep Curls</option>
                <option>Lunges</option>
                <option>Plank</option>
                <option>Burpees</option>
                <option>Jumping Jacks</option>
                <option>Bench Press</option>
                <option>Deadlifts</option>
              </select>
              <button
                onClick={() => setShowSettings(true)}
                className="p-3 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>

          <div className="flex flex-col w-24">
            <label className="text-gray-400 text-xs uppercase mb-1">Weight (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="bg-gray-700 text-white rounded-lg p-3 text-sm border-none text-center font-bold"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Rep Counter (Manual + AI) */}
          <div className="flex items-center gap-3 bg-gray-700/50 p-2 rounded-xl">
            <button onClick={() => setReps(Math.max(0, reps - 1))} className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-xl hover:bg-gray-500 transition-colors">-</button>
            <div className="flex flex-col items-center w-20">
              <span className="text-4xl font-bold text-white tracking-tighter">{reps}</span>
              <span className="text-[10px] text-gray-400 uppercase tracking-widest">Reps</span>
            </div>
            <button onClick={() => setReps(reps + 1)} className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xl hover:bg-emerald-500 transition-colors">+</button>
          </div>

          {/* Live Button */}
          <button
            onClick={toggleLiveSession}
            className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${connectionState === LiveConnectionState.CONNECTED
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
              : connectionState === LiveConnectionState.CONNECTING
                ? 'bg-yellow-500 text-black'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
              }`}
          >
            {connectionState === LiveConnectionState.CONNECTED ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            {connectionState === LiveConnectionState.CONNECTED ? "End Coach" : "Start AI Coach"}
          </button>
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Save size={20} />
          Log Workout Set
        </button>
      </div>
    </div>
  );
};

export default CameraWorkout;
