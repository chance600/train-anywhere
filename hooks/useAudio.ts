import { useRef, useEffect, useState } from 'react';

export const useAudio = () => {
  const [isReady, setIsReady] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<AudioNode | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const initializeAudio = async () => {
    if (audioContextRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({ sampleRate: 24000 }); // 24kHz for Gemini Output
    audioContextRef.current = ctx;

    // Output path
    const outNode = ctx.createGain();
    outNode.connect(ctx.destination);
    outputNodeRef.current = outNode;

    // Input path (for microphone if needed manually, though live.connect handles stream usually)
    // We mainly need context for decoding output.

    setIsReady(true);
  };

  const decodeAndPlay = async (base64Audio: string) => {
    if (!audioContextRef.current || !outputNodeRef.current) return;
    const ctx = audioContextRef.current;

    try {
      // Decode
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert raw PCM to AudioBuffer
      // Gemini sends raw PCM 16-bit 24kHz mono (usually)
      // We need to implement manual PCM to AudioBuffer conversion because decodeAudioData expects headers (WAV/MP3)
      // unless the API sends a WAV container. The Live API sends raw PCM.

      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      // Schedule
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(outputNodeRef.current);

      const currentTime = ctx.currentTime;
      // If next start time is in the past, reset to now
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;

      source.onended = () => {
        sourcesRef.current.delete(source);
      };
      sourcesRef.current.add(source);

    } catch (e) {
      console.error("Audio decode error", e);
    }
  };

  const stopAll = () => {
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const playDing = () => {
    if (!audioContextRef.current || !outputNodeRef.current) return;
    const ctx = audioContextRef.current;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(outputNodeRef.current);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); // Drop pitch slightly

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  };

  return {
    initializeAudio,
    decodeAndPlay,
    stopAll,
    playDing,
    isReady,
    audioContext: audioContextRef.current
  };
};
