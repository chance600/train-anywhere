import React, { useRef, useState, useEffect, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { useAudio } from '../hooks/useAudio';
import { LiveConnectionState, WorkoutSession } from '../types';
import { MODEL_NAMES, SYSTEM_INSTRUCTIONS } from '../constants';
import { Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { Camera, Mic, Square, Play, Save, CheckCircle, RefreshCw, Activity, Terminal } from 'lucide-react';

// Tool Definition for the AI to report progress
const workoutTool: FunctionDeclaration = {
  name: 'updateWorkoutStats',
  description: 'Call this function to update the user\'s workout statistics on the screen when a rep is completed or exercise changes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reps: {
        type: Type.NUMBER,
        description: 'The total number of reps completed for the current set.',
      },
      exerciseDetected: {
        type: Type.STRING,
        description: 'The name of the exercise currently being performed (e.g. Squats, Pushups).',
      },
      feedback: {
        type: Type.STRING,
        description: 'Brief feedback string about form or encouragement to display on screen.',
      },
    },
    required: ['reps', 'exerciseDetected', 'feedback'],
  },
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

  const { initializeAudio, decodeAndPlay, stopAll, audioContext } = useAudio();
  
  // Refs for loop management to avoid stale closures
  const frameIntervalRef = useRef<number>();
  const isConnectedRef = useRef(false);

  const addLog = (msg: string) => {
    setLogs(prev => [new Date().toLocaleTimeString() + ': ' + msg, ...prev.slice(0, 4)]);
  };

  // Initialize camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 }, 
          audio: true 
        });
        setStream(ms);
        if (videoRef.current) {
          videoRef.current.srcObject = ms;
        }
        addLog("Camera initialized");
      } catch (e) {
        console.error("Camera error:", e);
        setFeedback("Camera permission denied.");
        addLog("Camera error");
      }
    };
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
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
          tools: [{ functionDeclarations: [workoutTool] }],
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
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Scale 0.5 is sufficient for Gemini 1.5/2.0 Vision
      canvas.width = video.videoWidth * 0.5; 
      canvas.height = video.videoHeight * 0.5;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      
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
          className="w-full h-full object-cover opacity-90"
        />
        <canvas ref={canvasRef} className="hidden" />
        
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

      {/* Controls */}
      <div className="bg-gray-800 p-6 rounded-t-3xl shadow-2xl z-20">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col flex-1 mr-4">
            <label className="text-gray-400 text-xs uppercase mb-1 flex items-center gap-1">
              Exercise 
              {connectionState === LiveConnectionState.CONNECTED && <RefreshCw size={10} className="animate-spin" />}
            </label>
            <select 
              value={exercise} 
              onChange={(e) => setExercise(e.target.value)}
              className="bg-gray-700 text-white rounded-lg p-3 text-sm border-none focus:ring-2 focus:ring-emerald-500 font-medium"
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
             className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
               connectionState === LiveConnectionState.CONNECTED 
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
