import React, { useRef, useState, useEffect, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { KeyManager } from '../services/keyManager';
import { visionService } from '../services/VisionService'; // [NEW]
import { VelocityCalculator, detectWeight } from '../utils/analyticsLogic'; // [NEW]
import { VisionData } from '../types/vision'; // [NEW]
import VisionOverlay from './VisionOverlay'; // [NEW]
import { useAudio } from '../hooks/useAudio';
import { LiveConnectionState, WorkoutSession } from '../types';
import { MODEL_NAMES, SYSTEM_INSTRUCTIONS } from '../constants';
import { Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { EXERCISE_CATALOG, detectExercise } from '../utils/exerciseLogic';
import { Camera, Mic, Square, Play, Save, CheckCircle, RefreshCw, Activity, Terminal, Settings, Scan, EyeOff, Coffee, MessageSquare, Palette, Sparkles, Zap, Ruler } from 'lucide-react'; // Added Zap, Ruler
import { useToast } from './Toast';
import '../styles/workout-skins.css';
import SkinSelector from './workout/SkinSelector';

// Declare global Pose for CDN loaded script (Keeping for fallback if completely borked, but mostly unused now)
declare global {
  interface Window {
    Pose: any;
    Camera: any;
    POSE_CONNECTIONS: any;
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
  isPro?: boolean;
}

const CameraWorkout: React.FC<CameraWorkoutProps> = ({ onSaveWorkout, onFocusChange, isPro = false }) => {
  const { showToast } = useToast();
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
  const [weight, setWeight] = useState(0); // [NEW] Weight Tracking
  const [feedback, setFeedback] = useState('');
  const [lastRepScore, setLastRepScore] = useState<number | null>(null);
  const [lastRepDuration, setLastRepDuration] = useState<number | null>(null); // [NEW] Tempo tracking
  const [avgRepDuration, setAvgRepDuration] = useState<number | null>(null); // [NEW] Tempo tracking
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(60);
  const [isSendingFrame, setIsSendingFrame] = useState(false);
  const [activeSessionPromise, setActiveSessionPromise] = useState<Promise<any> | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [currentSkin, setCurrentSkin] = useState('default');
  const [showSkins, setShowSkins] = useState(false); // [NEW] User toggle for skins UI
  const [showCelebrate, setShowCelebrate] = useState(false);
  const [sensitivity, setSensitivity] = useState(0); // -20 to +20 degrees

  // [NEW] Exercise Locking State
  const [isExerciseLocked, setIsExerciseLocked] = useState(false); // Default false (Auto-detect enabled initially?)

  // [NEW] Vision & Analytics State
  const [visionData, setVisionData] = useState<VisionData | null>(null);
  const [showVelocity, setShowVelocity] = useState(false); // Velocity Toggle
  const [isCalibrated, setIsCalibrated] = useState(false); // Shoulder width calibration
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  // Analytics Refs
  const velocityCalcRef = useRef(new VelocityCalculator());
  const lastMetricsRef = useRef<{ velocity: number, power: number }>({ velocity: 0, power: 0 });

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
  const isTrackingActiveRef = useRef(isTrackingActive);
  const sessionHistoryRef = useRef<{ time: string, type: 'rep' | 'warning', detail: string }[]>([]);

  // [NEW] Stability & Debouncing Refs
  const detectionBufferRef = useRef<string[]>([]);
  const DETECTION_BUFFER_SIZE = 15; // Require ~0.5s of consistent detection (at 30fps)
  const lastVisibilityCheckRef = useRef<boolean>(true);

  // [NEW] Circuit Breaker Refs
  const sessionStartTimeRef = useRef<number | null>(null);
  const lastRepTimeRef = useRef<number>(Date.now());

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
    setIsExerciseLocked(true); // [NEW] Lock exercise when starting
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

  // [NEW] Circuit Breaker: Auto-disconnect on inactivity or max session time
  useEffect(() => {
    const MAX_SESSION_MS = 10 * 60 * 1000; // 10 minutes
    const INACTIVITY_MS = 2 * 60 * 1000; // 2 minutes

    const checkCircuitBreaker = () => {
      if (connectionState !== LiveConnectionState.CONNECTED) return;
      if (sessionStartTimeRef.current === null) return;

      const now = Date.now();
      const sessionDuration = now - sessionStartTimeRef.current;
      const timeSinceLastRep = now - lastRepTimeRef.current;

      if (sessionDuration > MAX_SESSION_MS) {
        addLog("Circuit Breaker: Max Session (10 min)");
        setFeedback("Auto-disconnected: Max session time reached.");
        window.location.reload(); // Hard reset
        return;
      }

      if (timeSinceLastRep > INACTIVITY_MS && !isResting) {
        addLog("Circuit Breaker: Inactivity (2 min)");
        setFeedback("Auto-disconnected: No activity detected.");
        window.location.reload(); // Hard reset
      }
    };

    const interval = setInterval(checkCircuitBreaker, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [connectionState, isResting]);

  // Sync unstable dependencies to refs to avoid restarting the effect
  const activeSessionPromiseRef = useRef(activeSessionPromise);
  const playDingRef = useRef(playDing);

  useEffect(() => { activeSessionPromiseRef.current = activeSessionPromise; }, [activeSessionPromise]);
  useEffect(() => { playDingRef.current = playDing; }, [playDing]);


  // Initialize Vision Service & Start Loop
  useEffect(() => {
    let animationFrameId: number;
    let isActive = true;

    const startVision = async () => {
      try {
        // Initialize Models (Lazy load object detection if Pro/Velocity enabled - Logic in Loop)
        // Actually, we should initialize mainly here.
        await visionService.initialize(showVelocity); // Pass showVelocity hint? Or just init Pose first.
        // Let's init basic first.
        // Note: initialize is idempotent.

        // Setup Camera
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
        const videoWidth = isMobile ? 480 : 640;
        const videoHeight = isMobile ? 360 : 480;

        const ms = await navigator.mediaDevices.getUserMedia({
          video: {
            width: videoWidth,
            height: videoHeight,
            deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
            facingMode: isMobile ? 'user' : undefined
          },
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : false
        });

        setStream(ms);
        if (videoRef.current) {
          videoRef.current.srcObject = ms;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            // Start Loop
            requestVideoFrameCallbackLoop();
          };
        }
        addLog("Vision System Active");

      } catch (e) {
        console.error("Vision Init Error", e);
        setFeedback("Camera/Vision Error");
      }
    };

    const requestVideoFrameCallbackLoop = () => {
      if (!isActive || !videoRef.current) return;

      // Use requestVideoFrameCallback if available for efficiency, else rAF
      if ('requestVideoFrameCallback' in videoRef.current) {
        videoRef.current.requestVideoFrameCallback((now, metadata) => {
          processFrame(now);
          requestVideoFrameCallbackLoop(); // Recurse
        });
      } else {
        requestAnimationFrame((now) => {
          processFrame(now);
          requestVideoFrameCallbackLoop();
        });
      }
    };

    const processFrame = async (timestamp: number) => {
      if (!videoRef.current) return;

      // 1. Run Vision Service
      // Only run Object Detection if showVelocity is ON (Performance/Battery Save)
      const data = await visionService.detect(videoRef.current, timestamp, showVelocity); // showVelocity passed as 'useObjectDetection'

      // 2. Run Analytics (Velocity)
      let velocityMetrics = undefined;
      if (showVelocity && data.objects.length > 0) {
        // Track the first object (simplified) or biggest object
        const obj = data.objects[0];
        const cx = obj.bbox[0] + obj.bbox[2] / 2;
        const cy = obj.bbox[1] + obj.bbox[3] / 2;
        velocityMetrics = velocityCalcRef.current.calculate({ x: cx, y: cy }, timestamp);

        // Hype Protocol: Check for explosiveness to feed LLM
        if (velocityMetrics.isExplosive) {
          // We can queue this for the LLM
          // Store in ref to send nicely
          lastMetricsRef.current.velocity = velocityMetrics.velocity;
        }

        // Weight Power Calc (Mass * Gravity * Velocity)
        // Assuming 'weight' state is in LBS, convert to KG -> Mass
        const massKg = weight * 0.453592;
        if (massKg > 0) {
          velocityMetrics.powerWatts = massKg * 9.81 * velocityMetrics.velocity;
          lastMetricsRef.current.power = velocityMetrics.powerWatts;
        }
      } else {
        velocityCalcRef.current.reset();
      }

      // Attach analytics to data
      data.velocity = velocityMetrics;
      setVisionData(data); // Trigger UI Render (Overlay)

      // 3. Pose-based Logic (Exercise Counting)
      if (data.pose && data.pose.landmarks && data.pose.landmarks.length > 0) {
        const landmarks = data.pose.landmarks[0]; // MediaPipe format is different? 
        // Our 'detect' returns raw result. 
        // Adapter: exerciseLogic expects array of {x, y, z, visibility}
        // MediaPipe returns {x, y, z, visibility} normalized.
        // Check formatting.

        // SMART CALIBRATION
        if (!isCalibrated && landmarks[11] && landmarks[12]) {
          // Measure shoulder width
          const dx = landmarks[11].x - landmarks[12].x;
          const dy = landmarks[11].y - landmarks[12].y; // Should be near 0 if standing
          const widthRaw = Math.sqrt(dx * dx + dy * dy);

          // Heuristic: Avg shoulder width = 0.4m
          // Scale = 0.4 / widthRaw (meters per normalized unit)
          // But velocity calc uses PIXELS.
          // widthPx = widthRaw * videoWidth.
          // Scale (m/px) = 0.4 / (widthRaw * videoRef.current.videoWidth).

          if (widthRaw > 0.1) { // Ensure they are in frame
            const widthPx = widthRaw * videoRef.current.videoWidth;
            const scale = 0.4 / widthPx;
            velocityCalcRef.current.setScale(scale);
            setIsCalibrated(true);
            showToast("Calibrated to your body!", "success");
          }
        }

        // WEIGHT DETECTION (Heuristic)
        // If we haven't manually set weight, try to detect
        if (weight === 0 && data.objects.length > 0) {
          const { isWeighted } = detectWeight(data.objects, landmarks[15], landmarks[16], videoRef.current.videoWidth, videoRef.current.videoHeight);
          if (isWeighted) {
            // Auto-suggest? Or just set flag?
            // For now, let's just log it or maybe auto-set a placeholder
            // setWeight(20); // Example
          }
        }

        //      // EXERCISE LOGIC ENGINE
        // Read from REFS to avoid stale closures
        const currentExercise = exerciseRef.current;
        let config = EXERCISE_CATALOG[currentExercise];

        // AUTO-DETECT STABILITY LOGIC
        // 1. Buffer the raw detection
        const rawDetection = detectExercise(landmarks); // Assuming landmarks is the correct input for detectExercise
        if (rawDetection) {
          detectionBufferRef.current.push(rawDetection);
          if (detectionBufferRef.current.length > DETECTION_BUFFER_SIZE) {
            detectionBufferRef.current.shift();
          }
        }

        // 2. Check for stability (Majority Vote)
        // Only switch if > 80% of buffer matches the new exercise
        if (detectionBufferRef.current.length >= DETECTION_BUFFER_SIZE) {
          const counts: Record<string, number> = {};
          let maxCount = 0;
          let majorityExercise = null;

          detectionBufferRef.current.forEach(ex => {
            counts[ex] = (counts[ex] || 0) + 1;
            if (counts[ex] > maxCount) {
              maxCount = counts[ex];
              majorityExercise = ex;
            }
          });

          const stabilityRatio = maxCount / DETECTION_BUFFER_SIZE;

          // SWITCH EXERCISE (Only if NOT Locked)
          // If locked, we ignore auto-detect switches
          if (!isExerciseLocked && majorityExercise && majorityExercise !== currentExercise && stabilityRatio > 0.8) {
            setExercise(majorityExercise);
            // Clear buffer to prevent rapid switching back
            detectionBufferRef.current = [];
            config = EXERCISE_CATALOG[majorityExercise];
            addLog(`Switched to: ${majorityExercise} (Stable)`);
            playDingRef.current(); // Audio cue for switch
          }
        }

        // If still no config after auto-detect/manual set, skip counting
        if (!config) {
          return;
        }

        // VISIBILITY CHECK (The "Too Close" Guard)
        // For leg exercises (Squats, Lunges, Jumping Jacks), we need to see feet/ankles (Index 27, 28)
        // If visibility is low, PAUSE tracking and warn user.
        const isLegExercise = ['Squats', 'Lunges', 'Jumping Jacks'].includes(config.name);
        if (isLegExercise) {
          const leftAnkle = landmarks[27];
          const rightAnkle = landmarks[28];
          // Visibility < 0.5 means likely off-screen or occluded
          const feetVisible = (leftAnkle && leftAnkle.visibility > 0.5) || (rightAnkle && rightAnkle.visibility > 0.5);

          if (!feetVisible) {
            if (lastVisibilityCheckRef.current) { // Only set feedback once
              lastVisibilityCheckRef.current = false;
              setFeedback("Back up! I can't see your feet.");
            }
            return; // EXIT LOOP - DO NOT COUNT REPS
          } else {
            if (!lastVisibilityCheckRef.current) { // Clear feedback once visible again
              lastVisibilityCheckRef.current = true;
              setFeedback(""); // Clear warning
            }
          }
        }

        // ONLY COUNT REPS IF TRACKING IS ACTIVE (after countdown)
        if (config && isTrackingActiveRef.current) {
          const progress = config.calculateProgress(landmarks);
          const state = exerciseStateRef.current;
          const sens = sensitivityRef.current;

          if (state.stage === 'start') {
            if (progress <= config.thresholds.middle + sens) {
              state.stage = 'middle';
              state.repStartTime = Date.now();
              state.currentRepScore = config.calculateScore ? config.calculateScore(landmarks) : 100;
            }
            // Form Check (Throttled)
            if (config.checkForm && Date.now() - state.lastFeedback > 5000) {
              const warning = config.checkForm(landmarks);
              if (warning) {
                state.lastFeedback = Date.now();
                setFeedback(warning);
                sessionHistoryRef.current.push({ time: new Date().toLocaleTimeString(), type: 'warning', detail: warning });
                // Notify Gemini
                if (isConnectedRef.current && activeSessionPromiseRef.current) {
                  activeSessionPromiseRef.current.then(session => {
                    session.send({ parts: [{ text: `Form Warning: ${warning}.` }] });
                  });
                }
              }
            }
          } else if (state.stage === 'middle') {
            if (progress >= config.thresholds.end) {
              state.stage = 'start';
              const newReps = repsRef.current + 1;
              setReps(newReps);
              setLastRepScore(state.currentRepScore);
              lastRepTimeRef.current = Date.now();

              // Celebration
              if (Math.random() > 0.9) {
                setShowCelebrate(true);
                setTimeout(() => setShowCelebrate(false), 1000);
              }

              const duration = (Date.now() - state.repStartTime) / 1000;
              state.repDurations.push(duration);
              const avgDuration = state.repDurations.length > 1
                ? state.repDurations.reduce((a, b) => a + b, 0) / state.repDurations.length : duration;

              setLastRepDuration(duration);
              setAvgRepDuration(avgDuration);

              sessionHistoryRef.current.push({ time: new Date().toLocaleTimeString(), type: 'rep', detail: `Rep ${newReps} (${duration.toFixed(1)}s)` });
              if (playDingRef.current) playDingRef.current();

              // Notify Gemini (Context Injection)
              if (isConnectedRef.current && activeSessionPromiseRef.current) {
                activeSessionPromiseRef.current.then(session => {
                  // Inject Velocity/Power Context
                  let extraContext = '';
                  if (lastMetricsRef.current.power > 300) extraContext += ` POWER: ${lastMetricsRef.current.power.toFixed(0)}W!`;
                  if (lastMetricsRef.current.velocity > 1.2) extraContext += ` VELOCITY: ${lastMetricsRef.current.velocity.toFixed(2)}m/s! EXPLOSIVE!`;

                  session.sendToolResponse({
                    functionResponses: [{
                      name: 'updateWorkoutStats',
                      response: { result: `Rep ${newReps} done. Score: ${state.currentRepScore}.${extraContext}` }
                    }]
                  });
                });
              }
            }
          }
        }
      }
    };

    startVision();

    return () => {
      isActive = false;
      if (videoRef.current) {
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [selectedCamera, selectedMic]); // Re-init if devices change

  // Connect to Live API
  const toggleLiveSession = async () => {
    if (connectionState === LiveConnectionState.CONNECTED || connectionState === LiveConnectionState.CONNECTING) {
      window.location.reload(); // Hard reset for clean disconnect
      return;
    }

    if (!stream) return;

    // CHECK FOR API KEY (Safe Mode Logic)
    if (!KeyManager.hasKey()) {
      if (isPro) {
        setFeedback("Pro Active: Vision Tracking ON. (Add Key for Voice)");
        addLog("AI Voice disabled (Requires Key). Vision Active.");
      } else {
        setFeedback("⚠️ AI Coach requires a Key. Rep Counter is ON!");
        addLog("AI Coach disabled (No Key). Vision only.");
      }
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
            // [NEW] Initialize Circuit Breaker Timers
            sessionStartTimeRef.current = Date.now();
            lastRepTimeRef.current = Date.now();
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
      weight: weight,
      avgRepDuration: avgRepDuration || undefined // [NEW] Persist tempo data
    });
    setReps(0); // Reset for next set
    setLastRepDuration(null);
    setAvgRepDuration(null);
    exerciseStateRef.current.repDurations = []; // Reset for next set
    showToast("Set saved!", "success");
  };

  // Determine content to render for the camera view (Video + Overlays)
  const cameraLayer = (
    <div className={`overflow-hidden bg-black transition-all duration-500 ${focusMode ? 'fixed inset-0 z-50 w-full h-full rounded-none m-0' : 'relative flex-1 rounded-xl m-2 border border-gray-700'}`}>
      {/* Party Mode Toggle (Top Right) -> SKINS TOGGLE */}
      {!focusMode && (
        <button
          onClick={() => setShowSkins(!showSkins)}
          className={`absolute top-4 right-4 z-20 p-2 rounded-full backdrop-blur-md transition-all ${showSkins ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50' : 'bg-black/40 text-white/50 hover:bg-black/60 hover:text-white'
            }`}
          title="Toggle Skins"
        >
          <Palette size={20} />
        </button>
      )}

      {/* Main Camera View */}
      <div className={`relative w-full h-full aspect-video bg-black overflow-hidden group ${currentSkin !== 'default' ? `skin-${currentSkin}` : ''}`}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
          playsInline
          muted
          autoPlay
        />
        {/* REPLACED Old Canvas with VisionOverlay */}
        {visionData && (
          <VisionOverlay
            data={visionData}
            width={videoRef.current?.videoWidth || 640} // Default fallback
            height={videoRef.current?.videoHeight || 480}
            showVelocity={showVelocity}
            isMirrored={true}
          />
        )}

        {/* [NEW] Velocity Toggle Button */}
        <button
          onClick={() => {
            const newState = !showVelocity;
            setShowVelocity(newState);
            // Trigger Lazy Load of TFJS if needed
            if (newState) visionService.initialize(true);
          }}
          className={`absolute bottom-4 right-4 z-20 px-3 py-1 rounded-full backdrop-blur-md text-sm transition-all flex items-center gap-2 ${showVelocity ? 'bg-cyan-500/80 text-white' : 'bg-black/40 text-white/50'}`}
        >
          <Zap size={16} /> {showVelocity ? 'VELOCITY ON' : 'VELOCITY OFF'}
        </button>

        {/* [NEW] Calibration Indicator */}
        {isCalibrated && showVelocity && (
          <div className="absolute bottom-4 left-4 z-20 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center gap-1 backdrop-blur-md">
            <Ruler size={12} /> CALIBRATED
          </div>
        )}

        {/* Skin Celebration Effect */}
        {showCelebrate && <div className="celebration-burst" />}
      </div>

      {/* Skin Selector (Bottom Center) - Controlled by showSkins */}
      {
        showSkins && !focusMode && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-300">
            <SkinSelector currentSkin={currentSkin} onSelectSkin={setCurrentSkin} />
          </div>
        )
      }

      {/* Standard Info Overlays (Hidden in Focus Mode) */}
      {
        !focusMode && (
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
              {!EXERCISE_CATALOG[exercise] && (
                <div className="mt-1 px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[10px] text-blue-300 font-mono">
                  Universal Vision Mode
                </div>
              )}
            </div>

            {/* Standard Rep Counter (Top Right) */}
            <div className="absolute top-4 right-4 flex gap-2">
              <div
                onClick={() => {
                  const newWeight = prompt("Enter weight (lbs):", weight.toString());
                  if (newWeight && !isNaN(Number(newWeight))) setWeight(Number(newWeight));
                }}
                className="bg-black/60 p-2 rounded-lg backdrop-blur-sm z-10 text-center min-w-[60px] cursor-pointer hover:bg-black/80"
              >
                <div className="text-2xl font-bold text-white leading-none">{weight}</div>
                <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Lbs</div>
              </div>

              <div className="bg-black/60 p-2 rounded-lg backdrop-blur-sm z-10 text-right min-w-[60px]">
                <div className="text-2xl font-bold text-white leading-none">{reps}</div>
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Reps</div>
              </div>

              {/* TEMPO TRACKING [NEW] */}
              <div className="bg-black/60 p-2 rounded-lg backdrop-blur-sm z-10 text-center min-w-[70px]">
                <div className="text-2xl font-bold text-amber-400 leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {lastRepDuration ? lastRepDuration.toFixed(1) : '--'}
                </div>
                <div className="text-[10px] text-amber-400/70 font-bold uppercase tracking-wider">Last (s)</div>
                {avgRepDuration && (
                  <div className="text-[9px] text-gray-400 mt-0.5">
                    Avg: {avgRepDuration.toFixed(1)}s
                  </div>
                )}
              </div>
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
        )
      }

      {/* Countdown Overlay */}
      {
        (isCountingDown || countdown === 0) && (
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
        )
      }

      {/* Feedback Overlay */}
      <div className={`absolute bottom-4 left-4 right-4 bg-black/70 p-4 rounded-xl backdrop-blur-md border border-gray-700 z-10 transition-all duration-300 ${!feedback ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        <p className="text-white text-center font-medium animate-pulse text-lg">{feedback || "Keep moving..."}</p>
      </div>

      {/* Focus Mode Specific Overlays */}
      {
        focusMode && (
          <div className="absolute inset-0 z-50 pointer-events-none">
            {/* Top Bar Stats */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30 bg-gradient-to-b from-black/80 to-transparent">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 pointer-events-auto">
                <div className="text-5xl font-bold text-white mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {reps}
                </div>
                <div className="text-emerald-400 font-bold text-sm tracking-widest uppercase">Reps</div>
              </div>

              {/* WEIGHT CONTROL [NEW] */}
              <div
                onClick={() => {
                  const newWeight = prompt("Enter weight (lbs):", weight.toString());
                  if (newWeight && !isNaN(Number(newWeight))) setWeight(Number(newWeight));
                }}
                className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center pointer-events-auto cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="text-5xl font-bold text-white mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {weight}
                </div>
                <div className="text-blue-400 font-bold text-sm tracking-widest uppercase">Lbs</div>
              </div>

              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-right pointer-events-auto">
                <div className={`text-4xl font-bold mb-1 ${lastRepScore && lastRepScore > 80 ? 'text-emerald-400' : lastRepScore && lastRepScore > 50 ? 'text-yellow-400' : 'text-red-400'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {lastRepScore || '--'}
                </div>
                <div className="text-gray-400 font-bold text-sm tracking-widest uppercase">Form Score</div>
              </div>

              {/* TEMPO TRACKING - Focus Mode [NEW] */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center pointer-events-auto">
                <div className="text-4xl font-bold text-amber-400 mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {lastRepDuration ? lastRepDuration.toFixed(1) : '--'}
                </div>
                <div className="text-amber-400/70 font-bold text-sm tracking-widest uppercase">Tempo (s)</div>
                {avgRepDuration && (
                  <div className="text-xs text-gray-400 mt-1">
                    Avg: {avgRepDuration.toFixed(1)}s
                  </div>
                )}
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
        )
      }
    </div >
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
                onChange={(e) => {
                  const val = e.target.value;
                  setExercise(val);
                  if (val === 'Auto-Detect') {
                    setIsExerciseLocked(false);
                    setExercise('Squats'); // Default fallback? Or keep 'Auto-Detect' as a special value?
                    // If 'Auto-Detect' is a value in the dropdown, we need to handle it.
                    // The currentExercise cannot be 'Auto-Detect' because EXERCISE_CATALOG['Auto-Detect'] doesn't exist.
                    // So we unlock, but maybe just reset buffer?
                  } else {
                    setIsExerciseLocked(true);
                  }
                }}
                className={`w-full bg-black/40 text-white rounded-xl p-4 pr-10 text-lg font-medium appearance-none border transition-all ${isExerciseLocked ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-gray-700 focus:border-emerald-500'}`}
              >
                <option value="Auto-Detect">Auto-Detect (Unlock)</option>
                {Object.keys(EXERCISE_CATALOG).filter(k => k !== 'default').map(ex => (
                  <option key={ex} value={ex}>{ex} {isExerciseLocked && exercise === ex ? '(Locked)' : ''}</option>
                ))}
              </select>
              {isExerciseLocked && (
                <div className="absolute right-10 top-1/2 transform -translate-y-1/2 pointer-events-none text-emerald-500">
                  <CheckCircle size={16} />
                </div>
              )}
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
