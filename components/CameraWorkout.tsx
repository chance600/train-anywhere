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
import { EXERCISE_CATALOG, detectExercise } from '../utils/exerciseLogic'; // [RESTORED]
import { Camera, Mic, Square, Play, Save, CheckCircle, RefreshCw, Activity, Terminal, Settings, Scan, EyeOff, Coffee, Sparkles, Zap, Ruler, FileVideo, MessageCircle, Palette, CircleX, Minus, Plus } from 'lucide-react';
import { useToast } from './Toast';
import '../styles/workout-skins.css';
import SkinSelector from './workout/SkinSelector';
import AnalysisModal from './workout/AnalysisModal';
import { supabase } from '../services/supabaseClient';

// [REMOVED] Live Tool Definitions (workoutTool, getWorkoutHistoryTool, etc.) - Unified into 'Ask Coach' chat.

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
  const streamRef = useRef<MediaStream | null>(null); // [NEW] Robust cleanup ref
  // [REMOVED] connectionState - Live mode removed
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
  const [restDuration, setRestDuration] = useState(60); // [NEW] User Setting
  const [restTimer, setRestTimer] = useState(60); // [NEW] Countdown State
  const [isPaused, setIsPaused] = useState(false); // [NEW] Manual Pause
  const isPausedRef = useRef(false); // Ref sync
  const [isSendingFrame, setIsSendingFrame] = useState(false);
  // [REMOVED] Logs state (mostly used for Live debugging)
  // const [logs, setLogs] = useState<string[]>([]);
  const addLog = (msg: string) => { console.log(msg); }; // Dummy for compatibility if needed or just remove calls

  // Settings State
  const [showSettings, setShowSettings] = useState(false);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [currentSkin, setCurrentSkin] = useState('default');
  const [showSkins, setShowSkins] = useState(false); // [NEW] User toggle for skins UI
  const [showCelebrate, setShowCelebrate] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9); // [NEW] Dynamic Aspect Ratio
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 }); // [NEW] Sync Overlay Resolution
  const [sensitivity, setSensitivity] = useState(0); // -20 to +20 degrees

  // [NEW] Exercise Locking State
  const [isExerciseLocked, setIsExerciseLocked] = useState(false); // Default false (Auto-detect enabled initially?)

  // [NEW] Vision & Analytics State
  // const [visionData, setVisionData] = useState<VisionData | null>(null); // REMOVED for Performance
  const visionDataRef = useRef<VisionData | null>(null); // [NEW] Ref-based (No Re-renders)

  const [showVelocity, setShowVelocity] = useState(false); // Velocity Toggle
  const showVelocityRef = useRef(false); // Sync Ref for Loop

  const [isCalibrated, setIsCalibrated] = useState(false); // Shoulder width calibration
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  // Analytics Refs
  const velocityCalcRef = useRef(new VelocityCalculator());
  const lastMetricsRef = useRef<{ velocity: number, power: number }>({ velocity: 0, power: 0 });

  // Countdown State
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isTrackingActive, setIsTrackingActive] = useState(false);

  const { playDing, initializeAudio } = useAudio(); // Kept mainly for Ding/Start sound

  // Refs for loop management to avoid stale closures
  const frameIntervalRef = useRef<number | undefined>(undefined);
  // [REMOVED] isConnectedRef

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
  const isCalibratedRef = useRef(isCalibrated);
  const isExerciseLockedRef = useRef(isExerciseLocked);

  // [NEW] Circuit Breaker Refs
  const sessionStartTimeRef = useRef<number | null>(null);
  const lastRepTimeRef = useRef<number>(Date.now());

  // Sync state to refs
  useEffect(() => { repsRef.current = reps; }, [reps]);
  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);
  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);
  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);

  // [NEW] Analysis State (Restored)
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // [NEW] Manual Weight Input State
  const [isWeightInputOpen, setIsWeightInputOpen] = useState(false);

  // [NEW] Smart Weight Logic
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);

  // [NEW] Virtual Cover Sizing
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const [containerDim, setContainerDim] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerElement) return;

    const obs = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerDim({ width, height });
      }
    });

    obs.observe(containerElement);
    return () => obs.disconnect();
  }, [containerElement]);

  const weightedFramesRef = useRef(0);
  useEffect(() => { isTrackingActiveRef.current = isTrackingActive; }, [isTrackingActive]);
  useEffect(() => { isCalibratedRef.current = isCalibrated; }, [isCalibrated]);
  useEffect(() => { isCalibratedRef.current = isCalibrated; }, [isCalibrated]);
  useEffect(() => { isExerciseLockedRef.current = isExerciseLocked; }, [isExerciseLocked]);
  useEffect(() => { showVelocityRef.current = showVelocity; }, [showVelocity]); // [NEW] Sync
  useEffect(() => { weightRef.current = weight; }, [weight]); // [NEW] Sync

  const weightRef = useRef(weight); // Initial ref

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]); // Sync Pause

  // Rest Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => setRestTimer(t => t - 1), 1000);
    } else if (restTimer === 0) {
      setIsResting(false);
      setRestTimer(restDuration); // Reset to default
      playDing(); // Alert user rest is over
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer, playDing, restDuration]);

  // Countdown Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCountingDown && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(c => {
          if (c === 1) {
            playDingRef.current?.(); // Final beep
            setIsCountingDown(false);
            setIsTrackingActive(true);
            setFeedback('GO! Start your reps!');
            addLog("Tracking Started");

            // Auto-dismiss "GO!" after 1 second
            setTimeout(() => setCountdown(-1), 1000);
            return 0;
          }
          playDingRef.current?.(); // Countdown beep
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCountingDown, countdown]);

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
    setRestTimer(restDuration); // Initialize countdown
  };



  // Fetch Devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      setMics(devices.filter(d => d.kind === 'audioinput'));
    });
  }, []);

  // [REMOVED] Circuit Breaker (No longer needed without Live Session)

  // Sync unstable dependencies to refs to avoid restarting the effect
  const playDingRef = useRef(playDing);
  useEffect(() => { playDingRef.current = playDing; }, [playDing]);

  // ... (Skipping logic to get to useEffect)

  // Initialize Vision Service & Start Loop
  useEffect(() => {
    let animationFrameId: number;
    let isActive = true;

    const startVision = async () => {
      try {
        // Initialize Models (Lazy load object detection if Pro/Velocity enabled - Logic in Loop)
        // Actually, we should initialize mainly here.
        // Initialize Models (Lazy load object detection if Pro/Velocity enabled - Logic in Loop)
        // Actually, we should initialize mainly here.
        await visionService.initialize(showVelocityRef.current); // Pass showVelocity hint from Ref
        // Let's init basic first.
        // Note: initialize is idempotent.

        // Setup Camera
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

        // Force HD (16:9) for better alignment with full-screen containers
        // This prevents object-fit cropping mismatches
        const constraints = {
          video: {
            width: { ideal: isMobile ? 480 : 1280 },
            height: { ideal: isMobile ? 360 : 720 },
            aspectRatio: { ideal: 1.7777777778 }, // 16:9
            deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
            facingMode: isMobile ? 'user' : undefined
          },
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : false
        };

        const ms = await navigator.mediaDevices.getUserMedia(constraints);

        setStream(ms);

        if (videoRef.current) {
          videoRef.current.srcObject = ms;
          streamRef.current = ms; // Capture for cleanup
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              const vWidth = videoRef.current.videoWidth;
              const vHeight = videoRef.current.videoHeight;
              setVideoAspectRatio(vWidth / vHeight);
              setVideoDimensions({ width: vWidth, height: vHeight });
              videoRef.current.play();
            }
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

      if ('requestVideoFrameCallback' in videoRef.current) {
        videoRef.current.requestVideoFrameCallback((now, metadata) => {
          processFrame(now);
          requestVideoFrameCallbackLoop();
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
      const useVel = showVelocityRef.current;
      const data = await visionService.detect(videoRef.current, timestamp, useVel);

      // 2. Run Analytics (Velocity)
      let velocityMetrics = undefined;
      if (useVel && data.objects.length > 0) {
        const obj = data.objects[0];
        const cx = obj.bbox[0] + obj.bbox[2] / 2;
        const cy = obj.bbox[1] + obj.bbox[3] / 2;
        velocityMetrics = velocityCalcRef.current.calculate({ x: cx, y: cy }, timestamp);

        if (velocityMetrics.isExplosive) {
          lastMetricsRef.current.velocity = velocityMetrics.velocity;
        }

        const currentWeight = weightRef.current;
        const massKg = currentWeight * 0.453592;
        if (massKg > 0) {
          velocityMetrics.powerWatts = massKg * 9.81 * velocityMetrics.velocity;
          lastMetricsRef.current.power = velocityMetrics.powerWatts;
        }
      } else {
        velocityCalcRef.current.reset();
      }

      data.velocity = velocityMetrics;
      visionDataRef.current = data;

      // 3. Pose-based Logic (Exercise Counting)
      if (data.pose && data.pose.landmarks && data.pose.landmarks.length > 0) {
        const landmarks = data.pose.landmarks[0];

        // SMART CALIBRATION
        if (!isCalibratedRef.current && landmarks[11] && landmarks[12]) {
          const dx = landmarks[11].x - landmarks[12].x;
          const dy = landmarks[11].y - landmarks[12].y;
          const widthRaw = Math.sqrt(dx * dx + dy * dy);

          if (widthRaw > 0.1) {
            const widthPx = widthRaw * videoRef.current.videoWidth;
            const scale = 0.4 / widthPx;
            velocityCalcRef.current.setScale(scale);
            setIsCalibrated(true);
            showToast("Calibrated to your body!", "success");
          }
        }

        // WEIGHT DETECTION
        if (weightRef.current === 0 && data.objects.length > 0) {
          const { isWeighted } = detectWeight(data.objects, landmarks[15], landmarks[16], videoRef.current.videoWidth, videoRef.current.videoHeight);
          if (isWeighted) {
            weightedFramesRef.current += 1;
            if (weightedFramesRef.current > 45 && !showWeightPrompt) {
              setShowWeightPrompt(true);
              playDingRef.current();
              weightedFramesRef.current = 0;
            }
          } else {
            weightedFramesRef.current = Math.max(0, weightedFramesRef.current - 1);
          }
        }

        // EXERCISE LOGIC
        const currentExercise = exerciseRef.current;
        let config = EXERCISE_CATALOG[currentExercise];

        // AUTO-DETECT
        const rawDetection = detectExercise(landmarks);
        if (rawDetection) {
          detectionBufferRef.current.push(rawDetection);
          if (detectionBufferRef.current.length > DETECTION_BUFFER_SIZE) {
            detectionBufferRef.current.shift();
          }
        }

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

          if (!isExerciseLockedRef.current && majorityExercise && majorityExercise !== currentExercise && stabilityRatio > 0.8) {
            setExercise(majorityExercise);
            detectionBufferRef.current = [];
            config = EXERCISE_CATALOG[majorityExercise];
            addLog(`Switched to: ${majorityExercise} (Stable)`);
            playDingRef.current();
          }
        }

        if (!config) return;

        // VISIBILITY CHECK
        const isLegExercise = ['Squats', 'Lunges', 'Jumping Jacks'].includes(config.name);

        if (isLegExercise && isTrackingActiveRef.current) {
          const leftAnkle = landmarks[27];
          const rightAnkle = landmarks[28];
          const feetVisible = (leftAnkle && leftAnkle.visibility > 0.5) || (rightAnkle && rightAnkle.visibility > 0.5);

          if (!feetVisible) {
            if (lastVisibilityCheckRef.current) {
              lastVisibilityCheckRef.current = false;
              setFeedback("Back up! I can't see your feet.");
            }
            return;
          } else {
            if (!lastVisibilityCheckRef.current) {
              lastVisibilityCheckRef.current = true;
              setFeedback("");
            }
          }
        }

        // ONLY COUNT REPS IF TRACKING ACTIVE & NOT PAUSED
        if (config && isTrackingActiveRef.current) {

          // GESTURE: Pause (Crossed Arms "X")
          const lw = landmarks[15]; // Left Wrist
          const rw = landmarks[16]; // Right Wrist
          const ls = landmarks[11]; // Left Shoulder
          const rs = landmarks[12]; // Right Shoulder

          if (lw && rw && ls && rs) {
            // Calculate distances crossing the body
            // Left Wrist to Right Shoulder
            const dL = Math.hypot(lw.x - rs.x, lw.y - rs.y);
            // Right Wrist to Left Shoulder
            const dR = Math.hypot(rw.x - ls.x, rw.y - ls.y);

            // Approx "Touch Shoulders" or "Cross Chest"
            if (dL < 0.25 && dR < 0.25) {
              // Toggle Pause if not recently toggled (Debounce via Ref?)
              // Let's rely on User Holding it? No, toggle is better.
              // BUT, triggering constantly in a loop is bad.
              // We need a Pause Toggle Debounce.
              // Using `isPausedRef` to check current state.
              // Only toggle if we have consistent frames?
              // Let's keep it simple: "If Crossed and NOT Paused, Pause."
              // "If Crossed and Paused, Resume?" -> Maybe harder to detect if user relaxes.
              // Let's just implement Pause for "Safety Stop".
              // Let's just implement Pause for "Safety Stop".
              if (!isPausedRef.current) {
                setIsPaused(true);
                playDingRef.current?.();
              }
            }
          }

          if (isPausedRef.current) return;

          const progress = config.calculateProgress(landmarks);
          const state = exerciseStateRef.current;
          const sens = sensitivityRef.current;

          if (state.stage === 'start') {
            if (progress <= config.thresholds.middle + sens) {
              state.stage = 'middle';
              state.repStartTime = Date.now();
              state.currentRepScore = config.calculateScore ? config.calculateScore(landmarks) : 100;
            }
            if (config.checkForm && Date.now() - state.lastFeedback > 5000) {
              const warning = config.checkForm(landmarks);
              if (warning) {
                state.lastFeedback = Date.now();
                setFeedback(warning);
                sessionHistoryRef.current.push({ time: new Date().toLocaleTimeString(), type: 'warning', detail: warning });
              }
            }
          } else if (state.stage === 'middle') {
            if (progress >= config.thresholds.end) {
              state.stage = 'start';
              const newReps = repsRef.current + 1;
              setReps(newReps);
              setLastRepScore(state.currentRepScore);
              lastRepTimeRef.current = Date.now();

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
            }
          }
        }
      }
    };

    startVision();

    return () => {
      isActive = false;
      // [FIX] Robust cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
      }
    };
  }, [selectedCamera, selectedMic]); // Re-init if devices change

  // [REMOVED] Live Session Connect Logic



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

      {/* Main Camera View - Centered & Fitted */}
      {/* Main Camera View - Centered & Fitted (or Covered in Focus Mode) */}
      <div
        ref={setContainerElement}
        className="flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black relative"
      >
        <div
          className={`relative bg-black group ${currentSkin !== 'default' ? `skin-${currentSkin}` : ''}`}
          style={{
            ...(() => {
              // 1. Safety Check
              if (!videoAspectRatio) return { width: '100%', height: '100%' };

              // 2. Normal Mode -> Strict Contain (No Cropping)
              if (!focusMode) {
                return {
                  aspectRatio: videoAspectRatio,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto'
                };
              }

              // 3. Focus Mode -> Virtual Cover (Explicit Calculation)
              if (containerDim.width === 0 || containerDim.height === 0) return { opacity: 0 }; // Hide until measured

              const containerAR = containerDim.width / containerDim.height;

              // If Screen is Wider than Video -> Fit Width, Crop Height (Top/Bottom)
              // Actually: If Screen is Wider (e.g. 21:9 vs 16:9), we need to ZOOM height to fill.
              // Logic: To COVER, we must be AT LEAST container width AND AT LEAST container height.

              if (containerAR > videoAspectRatio) {
                // Screen is Wider than Video. 
                // To cover width, we match width. Height will naturally be LESS if we keep AR? 
                // No, if screen is wider (2.3) than video (1.7), matching width makes height LARGER?
                // Wait. 
                // Width = 1000, Height = 500 (AR 2). Video AR 1.
                // If we match Height (500), Width is 500. fail to cover width.
                // If we match Width (1000), Height is 1000. Covers height.
                // So if Screen AR > Video AR, we match Width.

                return {
                  width: containerDim.width,
                  height: containerDim.width / videoAspectRatio,
                };
              } else {
                // Screen is Taller/Narrower than Video. (e.g. Mobile Portait)
                // Width = 500, Height = 1000 (AR 0.5). Video AR 1.
                // If we match Width (500), Height is 500. fail to cover height.
                // If we match Height (1000), Width is 1000. Covers width.
                // So if Screen AR < Video AR, we match Height.

                return {
                  width: containerDim.height * videoAspectRatio,
                  height: containerDim.height
                };
              }
            })()
          }}
        >
          <video
            ref={videoRef}
            className="block w-full h-full object-fill transform scale-x-[-1]"
            playsInline
            muted
            autoPlay
          />
          {/* REPLACED Old Canvas with VisionOverlay */}
          {/* REPLACED Old Canvas with VisionOverlay */}
          {/* Pass Ref instead of Data */}
          <VisionOverlay
            dataRef={visionDataRef}
            width={videoDimensions.width}
            height={videoDimensions.height}
            showVelocity={showVelocity} // Props trigger internal re-config, not frame loop
            isMirrored={true}
          />


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
                <div className={`w-2 h-2 rounded-full ${isTrackingActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <p className="text-white font-mono text-sm">{isTrackingActive ? "TRACKING ACTIVE" : "READY"}</p>
              </div>
              {!EXERCISE_CATALOG[exercise] && (
                <div className="mt-1 px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[10px] text-blue-300 font-mono">
                  Universal Vision Mode
                </div>
              )}
            </div>

            {/* Standard Rep Counter (Top Right) */}
            <div className="absolute top-4 right-4 flex gap-2">
              <div
                onClick={() => setIsWeightInputOpen(true)}
                className="bg-black/60 p-2 rounded-lg backdrop-blur-sm z-10 text-center min-w-[60px] cursor-pointer hover:bg-black/80 transition-colors"
                role="button"
                aria-label="Set Weight"
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

            {/* Debug Log Removed */}
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

      {/* PAUSED OVERLAY */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30 backdrop-blur-sm">
          <div className="bg-black/80 px-8 py-6 rounded-2xl border border-yellow-500/30 flex flex-col items-center">
            <span className="font-mono text-4xl text-yellow-400 font-bold mb-2">PAUSED</span>
            <p className="text-gray-400 text-xs uppercase tracking-widest">Resume to continue</p>
          </div>
        </div>
      )}

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
                  Rest Timer Duration ({restDuration}s)
                </label>
                <input
                  type="range"
                  min="15"
                  max="180"
                  step="15"
                  value={restDuration}
                  onChange={(e) => setRestDuration(Number(e.target.value))}
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
              Current Exercise
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
            {/* [NEW] Coach's Eye Upload Button */}
            <button
              onClick={() => document.getElementById('analysis-upload')?.click()}
              className="p-4 bg-purple-600/20 text-purple-400 rounded-xl hover:bg-purple-600/30 border border-purple-600/30 transition-colors"
              title="Coach's Eye (Analyze Upload)"
            >
              <FileVideo size={24} />
            </button>
            <input
              type="file"
              id="analysis-upload"
              className="hidden"
              accept="video/*,image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setIsAnalysisOpen(true);
                  setIsAnalyzing(true);
                  try {
                    // 1. Analyze
                    const critique = await geminiService.analyzeFile(file);
                    setAnalysisResult(critique);

                    // 2. Persist to DB (User Request)
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      const { error } = await supabase.from('analysis_logs').insert({
                        user_id: user.id,
                        media_type: file.type.startsWith('video/') ? 'video' : 'image',
                        analysis_content: critique
                      });
                      if (error) console.error("Persistence Error:", error);
                      else showToast("Analysis Saved to Profile", "success");
                    }
                  } catch (err) {
                    console.error("Analysis Failed", err);
                    showToast("Analysis Failed. Try a shorter video.", "error");
                    setIsAnalysisOpen(false);
                  } finally {
                    setIsAnalyzing(false);
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Middle Row: Primary Actions (Start / Rest) */}
        <div className="flex gap-4 mb-6">
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

          {/* PAUSE BUTTON (Only while Tracking) */}
          {isTrackingActive && (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`
                 font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all min-h-[64px]
                 ${isPaused ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 animate-pulse' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}
              `}
            >
              {isPaused ? <Play size={24} fill="currentColor" /> : <span className="font-mono text-2xl font-black">||</span>}
              {isPaused ? "RESUME" : "PAUSE"}
            </button>
          )}

          {!isTrackingActive && (
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
                  <Coffee size={24} className="animate-bounce" /> {restTimer}s
                </>
              ) : (
                <>
                  <Coffee size={24} /> Rest
                </>
              )}
            </button>
          )}
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

          {/* Main Action Call To Action: Analyze Form (Coach's Eye) */}
          <button
            onClick={() => document.getElementById('analysis-upload')?.click()}
            className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border bg-purple-600/20 text-purple-400 border-purple-600/50 hover:bg-purple-600/30"
          >
            <Sparkles size={18} />
            <span className="text-sm">Analyze Form</span>
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

      {/* Smart Weight Prompt Overlay */}
      {showWeightPrompt && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-yellow-300 fill-yellow-300" />
            <div>
              <p className="font-bold text-sm">Weights Detected!</p>
              <p className="text-[10px] opacity-80">Log mass regarding this set?</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowWeightPrompt(false); setIsWeightInputOpen(true); }}
              className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-50"
            >
              Set
            </button>
            <button
              onClick={() => setShowWeightPrompt(false)}
              className="p-1 hover:bg-white/20 rounded-full"
            >
              <CircleX size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Manual Weight Input Modal */}
      {isWeightInputOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 w-full max-w-xs animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Set Weight</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setWeight(Math.max(0, weight - 5))} className="p-3 bg-gray-700 rounded-lg text-white hover:bg-gray-600"><Minus size={20} /></button>
                <div className="w-24 text-center">
                  <div className="text-4xl font-bold text-white">{weight}</div>
                  <div className="text-xs text-gray-400 uppercase">Lbs</div>
                </div>
                <button onClick={() => setWeight(weight + 5)} className="p-3 bg-gray-700 rounded-lg text-white hover:bg-gray-600"><Plus size={20} /></button>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2">
                {[0, 10, 15, 20, 25, 30, 35, 45, 50].map(w => (
                  <button
                    key={w}
                    onClick={() => setWeight(w)}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${weight === w ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    {w}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsWeightInputOpen(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl mt-2"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Result Modal */}
      <AnalysisModal
        isOpen={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
        result={analysisResult}
        isLoading={isAnalyzing}
      />
    </div>
  );
  return cameraLayer;
};

export default CameraWorkout;
