import React, { useRef, useState, useEffect, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { useAudio } from '../hooks/useAudio';
import { LiveConnectionState, WorkoutSession } from '../types';
import { MODEL_NAMES, SYSTEM_INSTRUCTIONS } from '../constants';
import { Modality, LiveServerMessage } from '@google/genai';
import { Camera, Mic, Square, Play, Save, CheckCircle, RefreshCw, Activity, Terminal, Eye, Settings } from 'lucide-react';

// --- MediaPipe Types ---
declare global {
  interface Window {
    Pose: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
  }
}

// --- Math Helpers ---
const calculateAngle = (a: any, b: any, c: any) => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
};

// Simple low-pass filter to smooth out jittery landmarks
const smoothValue = (newVal: number, oldVal: number, alpha: number = 0.5) => {
  return oldVal * (1 - alpha) + newVal * alpha;
};

// --- Exercise Logic Definitions ---
type ExerciseState = 'START' | 'MIDDLE' | 'COMPLETE';

interface ExerciseConfig {
  id: string;
  name: string;
  instructions: string;
  calculateProgress: (landmarks: any) => { value: number, target: number, visualPoint?: any };
  thresholds: { start: number, end: number, type: 'angle_min' | 'angle_max' | 'distance_max' | 'distance_min' };
}

const EXERCISE_CATALOG: Record<string, ExerciseConfig> = {
  'Squats': {
    id: 'Squats',
    name: 'Squats',
    instructions: "Stand sideways. Bend knees until thighs are parallel.",
    // Metric: Knee Angle
    calculateProgress: (lm) => {
      const leftKnee = calculateAngle(lm[23], lm[25], lm[27]);
      const rightKnee = calculateAngle(lm[24], lm[26], lm[28]);
      return { value: (leftKnee + rightKnee) / 2, target: 90, visualPoint: lm[25] }; // Average knee angle
    },
    thresholds: { start: 160, end: 100, type: 'angle_min' } // Start standing (180), go down (<100)
  },
  'Pushups': {
    id: 'Pushups',
    name: 'Pushups',
    instructions: "Plank position. Lower chest until elbows are 90°.",
    // Metric: Elbow Angle
    calculateProgress: (lm) => {
      const leftElbow = calculateAngle(lm[11], lm[13], lm[15]);
      const rightElbow = calculateAngle(lm[12], lm[14], lm[16]);
      return { value: (leftElbow + rightElbow) / 2, target: 90, visualPoint: lm[13] };
    },
    thresholds: { start: 160, end: 90, type: 'angle_min' }
  },
  'Jumping Jacks': {
    id: 'Jumping Jacks',
    name: 'Jumping Jacks',
    instructions: "Start feet together hands down. Jump feet apart hands up.",
    // Metric: Wrist Y position relative to shoulder (Simple 'Hands Up' check)
    calculateProgress: (lm) => {
      // 11=L_Shoulder, 15=L_Wrist. If Wrist Y < Shoulder Y, hands are up (Y increases downwards)
      const dist = (lm[11].y - lm[15].y) + (lm[12].y - lm[16].y); 
      // dist > 0 means hands above shoulders. dist < 0 means hands below.
      return { value: dist, target: 0.2, visualPoint: lm[11] }; 
    },
    thresholds: { start: -0.2, end: 0.1, type: 'distance_max' } // Start hands down, End hands up
  },
  'Lunges': {
    id: 'Lunges',
    name: 'Lunges',
    instructions: "Step forward, lower hip until back knee is near ground.",
    // Metric: Max bend of EITHER knee (since we alternate)
    calculateProgress: (lm) => {
      const leftKnee = calculateAngle(lm[23], lm[25], lm[27]);
      const rightKnee = calculateAngle(lm[24], lm[26], lm[28]);
      const activeLegAngle = Math.min(leftKnee, rightKnee);
      return { value: activeLegAngle, target: 100, visualPoint: leftKnee < rightKnee ? lm[25] : lm[26] };
    },
    thresholds: { start: 160, end: 100, type: 'angle_min' }
  },
  'Crunches': {
    id: 'Crunches',
    name: 'Crunches',
    instructions: "Lie on back. Curl shoulders towards knees.",
    // Metric: Hip Angle
    calculateProgress: (lm) => {
      const leftHip = calculateAngle(lm[11], lm[23], lm[25]); 
      return { value: leftHip, target: 60, visualPoint: lm[23] };
    },
    thresholds: { start: 130, end: 70, type: 'angle_min' } // Flat is ~180, curled is acute
  }
};


// --- Helper for creating PCM blob ---
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
  
  // Workout State
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);
  const [exerciseId, setExerciseId] = useState<string>('Squats');
  const [feedback, setFeedback] = useState("Align body");
  const [repProgress, setRepProgress] = useState(0); // 0 to 100%
  const [debugValue, setDebugValue] = useState(0);

  const [logs, setLogs] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);

  const { initializeAudio, decodeAndPlay, audioContext } = useAudio();
  
  // Refs for logic loop to avoid stale closures
  const isConnectedRef = useRef(false);
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const lastRepTime = useRef<number>(0);
  const exerciseState = useRef<ExerciseState>('START');
  const valueSmoothing = useRef<number>(180); // Init high

  // IMPORTANT: State Refs for the loop
  const repsRef = useRef(0);
  const exerciseIdRef = useRef('Squats');
  const activeSessionRef = useRef<any>(null);

  // Sync State to Refs
  useEffect(() => {
    repsRef.current = reps;
  }, [reps]);

  useEffect(() => {
    exerciseIdRef.current = exerciseId;
  }, [exerciseId]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const addLog = (msg: string) => {
    setLogs(prev => [new Date().toLocaleTimeString().slice(0,8) + ': ' + msg, ...prev.slice(0, 4)]);
  };

  // --- Pose Processing Loop ---
  // Defined BEFORE the useEffect that uses it
  const processExerciseLogic = (landmarks: any[], ctx: CanvasRenderingContext2D) => {
    // Use REF to get current exercise ID inside loop
    const config = EXERCISE_CATALOG[exerciseIdRef.current];
    if (!config) return;

    // A. Calculate Metric
    const rawData = config.calculateProgress(landmarks);
    
    // B. Smooth Metric
    valueSmoothing.current = smoothValue(rawData.value, valueSmoothing.current, 0.3);
    const currentValue = valueSmoothing.current;
    
    // C. Draw Metric on Screen (Visual Feedback)
    if (rawData.visualPoint) {
      const x = rawData.visualPoint.x * ctx.canvas.width;
      const y = rawData.visualPoint.y * ctx.canvas.height;
      
      ctx.fillStyle = "#FF0000"; 
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.font = "bold 24px Inter";
      ctx.fillStyle = "#00FF00";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      const displayValue = Math.round(currentValue);
      ctx.strokeText(`${displayValue}°`, x + 10, y);
      ctx.fillText(`${displayValue}°`, x + 10, y);
    }

    // D. State Machine
    const { start, end, type } = config.thresholds;
    const isMin = type === 'angle_min' || type === 'distance_min';

    // Calculate percent complete (0 to 100)
    let percent = 0;
    if (isMin) {
       percent = Math.min(100, Math.max(0, ((start - currentValue) / (start - end)) * 100));
    } else {
       percent = Math.min(100, Math.max(0, ((currentValue - start) / (end - start)) * 100));
    }
    setRepProgress(percent);
    setDebugValue(Math.round(currentValue));

    // Transitions
    const buffer = 10; // Hysteresis buffer
    const now = Date.now();

    if (exerciseState.current === 'START') {
      const crossedThreshold = isMin ? (currentValue <= end) : (currentValue >= end);
      if (crossedThreshold) {
        exerciseState.current = 'MIDDLE';
        setFeedback("Hold...");
      } else if (percent > 50) {
        setFeedback("Lower...");
      } else {
        setFeedback("Ready");
      }
    } 
    else if (exerciseState.current === 'MIDDLE') {
      // Must return to start
      const returnedToStart = isMin ? (currentValue >= start - buffer) : (currentValue <= start + buffer);
      
      if (returnedToStart) {
        // REP COMPLETE
        if (now - lastRepTime.current > 500) {
          // Use REF to get current reps
          const newReps = repsRef.current + 1;
          
          // Update Ref IMMEDIATELY for next frame logic
          repsRef.current = newReps;
          lastRepTime.current = now;
          
          // Update State for UI
          setReps(newReps);
          
          exerciseState.current = 'START';
          setFeedback("Rep Complete!");
          
          // AI Notification (Use REF for session)
          if (activeSessionRef.current && isConnectedRef.current) {
             activeSessionRef.current.sendRealtimeInput({
                content: [{ text: `User did rep ${newReps} of ${exerciseIdRef.current}. Say the number ${newReps} enthusiastically.` }]
             });
          }
        }
      }
    }
  };

  const onPoseResults = useCallback((results: any) => {
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // 1. Draw Camera Feed
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.save();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // 2. Draw Skeleton
    if (results.poseLandmarks) {
      window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS,
                 {color: 'rgba(0, 255, 0, 0.5)', lineWidth: 2});
      window.drawLandmarks(ctx, results.poseLandmarks,
                 {color: 'rgba(255, 0, 0, 0.5)', lineWidth: 1, radius: 3});
      
      // 3. Process Logic
      processExerciseLogic(results.poseLandmarks, ctx);
    }
    ctx.restore();
  }, []); // Dependencies empty because we use Refs inside

  // --- MediaPipe Initialization ---
  useEffect(() => {
    if (!window.Pose) {
      addLog("MediaPipe not loaded yet");
      return;
    }

    const pose = new window.Pose({
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

    pose.onResults(onPoseResults);
    poseRef.current = pose;

    if (videoRef.current) {
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (poseRef.current) {
            await poseRef.current.send({image: videoRef.current});
          }
        },
        width: 640,
        height: 480
      });
      cameraRef.current = camera;
      camera.start();
    }

    return () => {
      if (cameraRef.current) cameraRef.current.stop();
      if (poseRef.current) poseRef.current.close();
    };
  }, [onPoseResults]); // Re-init if callback changes (it won't because deps are [])

  // --- Connection Logic ---
  const toggleLiveSession = async () => {
    if (connectionState === LiveConnectionState.CONNECTED || connectionState === LiveConnectionState.CONNECTING) {
       window.location.reload(); 
       return;
    }
    setConnectionState(LiveConnectionState.CONNECTING);
    addLog("Init Audio...");
    await initializeAudio();
    try {
      const client = geminiService.getLiveClient();
      const sessionPromise = client.connect({
        model: MODEL_NAMES.LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: "You are a spotter. When you receive text updates about reps, count them out loud. Example: 'One!', 'Two!'. Keep it brief.",
        },
        callbacks: {
          onopen: () => {
            setConnectionState(LiveConnectionState.CONNECTED);
            isConnectedRef.current = true;
            startAudioStream(sessionPromise);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) decodeAndPlay(audioData);
          },
          onclose: () => {
            setConnectionState(LiveConnectionState.DISCONNECTED);
            isConnectedRef.current = false;
          },
          onerror: (err) => {
            console.error(err);
            setConnectionState(LiveConnectionState.ERROR);
            isConnectedRef.current = false;
          }
        }
      });
      sessionPromise.then(s => setActiveSession(s));
    } catch (e) {
      setConnectionState(LiveConnectionState.ERROR);
    }
  };

  const startAudioStream = async (sessionPromise: Promise<any>) => {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') await audioContext.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const source = inputCtx.createMediaStreamSource(stream);
    const processor = inputCtx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      if (!isConnectedRef.current) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
    };
    source.connect(processor);
    processor.connect(inputCtx.destination);
  };

  const handleSave = () => {
    onSaveWorkout({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      exercise: exerciseId,
      reps,
      weight
    });
    setReps(0);
    alert("Set saved!");
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 relative">
      {/* Video Container */}
      <div className="flex-1 relative overflow-hidden rounded-xl m-2 border border-gray-700 bg-black">
        <video 
          ref={videoRef} 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          playsInline 
          muted 
        />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Progress Bar (Visual Feedback for Rep) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-48 bg-gray-800/80 rounded-full overflow-hidden border border-gray-600 z-10">
          <div 
             className="absolute bottom-0 left-0 right-0 bg-emerald-500 transition-all duration-100 ease-out"
             style={{ height: `${repProgress}%` }}
          />
        </div>

        {/* Info Header */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
          <div className="bg-black/60 p-3 rounded-xl backdrop-blur-md">
            <h3 className="text-white font-bold text-sm">{exerciseId}</h3>
            <p className="text-emerald-400 text-xs font-mono mt-1">
               Current: {debugValue} | Target: {EXERCISE_CATALOG[exerciseId]?.thresholds.end}
            </p>
          </div>

          <div className="flex flex-col gap-2 items-end">
             <div className="bg-black/60 p-2 rounded-lg backdrop-blur-sm flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${connectionState === LiveConnectionState.CONNECTED ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
               <span className="text-white text-xs font-mono">{connectionState === 'CONNECTED' ? 'AI COACH ACTIVE' : 'AI OFFLINE'}</span>
             </div>
          </div>
        </div>

        {/* Dynamic Status Footer */}
        <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-4 rounded-xl backdrop-blur-md border border-gray-700 z-10 flex items-center justify-between">
           <div>
             <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Status</p>
             <p className="text-white font-bold text-lg animate-pulse">{feedback}</p>
           </div>
           <div className="text-right">
             <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Total Reps</p>
             <p className="font-black text-4xl text-emerald-400">{reps}</p>
           </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-gray-800 p-6 rounded-t-3xl shadow-2xl z-20 shrink-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col flex-1 mr-4">
            <label className="text-gray-400 text-xs uppercase mb-1 font-bold">Select Exercise</label>
            <div className="relative">
              <select 
                value={exerciseId} 
                onChange={(e) => { setExerciseId(e.target.value); setReps(0); }}
                className="w-full bg-gray-700 text-white rounded-xl p-4 text-sm border-none focus:ring-2 focus:ring-emerald-500 font-medium appearance-none"
              >
                {Object.values(EXERCISE_CATALOG).map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
              <Settings className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
          </div>
          
          <div className="flex flex-col w-24">
             <label className="text-gray-400 text-xs uppercase mb-1 font-bold">Weight</label>
             <input 
               type="number" 
               value={weight}
               onChange={(e) => setWeight(Number(e.target.value))}
               className="bg-gray-700 text-white rounded-xl p-4 text-sm border-none text-center font-bold"
               placeholder="0"
             />
          </div>
        </div>

        <div className="flex gap-3 mb-4">
           {/* Manual Controls */}
           <button onClick={() => setReps(Math.max(0, reps - 1))} className="p-4 rounded-xl bg-gray-700 text-white font-bold hover:bg-gray-600">-</button>
           <button onClick={() => setReps(reps + 1)} className="p-4 rounded-xl bg-gray-700 text-white font-bold hover:bg-gray-600">+</button>
           
           {/* Voice Button */}
           <button 
             onClick={toggleLiveSession}
             className={`flex-1 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
               connectionState === LiveConnectionState.CONNECTED 
               ? 'bg-red-500 hover:bg-red-600 text-white' 
               : 'bg-indigo-600 hover:bg-indigo-500 text-white'
             }`}
           >
             {connectionState === LiveConnectionState.CONNECTED ? <Square size={20} /> : <Play size={20} />}
             {connectionState === LiveConnectionState.CONNECTED ? "Stop AI" : "Start AI Coach"}
           </button>
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Save size={20} />
          Save Set
        </button>
      </div>
    </div>
  );
};

export default CameraWorkout;