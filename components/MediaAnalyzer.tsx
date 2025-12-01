import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import { Upload, Film, FileVideo, Loader2 } from 'lucide-react';

const MediaAnalyzer: React.FC = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setAnalyzing(true);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        // Use the service to analyze
        const analysis = await geminiService.analyzeVideo(base64, "Analyze this workout video. What exercise is it? How is the form? Count the reps if possible.");
        setResult(analysis);
        setAnalyzing(false);
        
        // Optional: Text to speech the summary
        try {
           const audioBuffer = await geminiService.generateSpeech("Here is your analysis: " + analysis.substring(0, 100));
           const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
           const buffer = await ctx.decodeAudioData(audioBuffer);
           const source = ctx.createBufferSource();
           source.buffer = buffer;
           source.connect(ctx.destination);
           source.start(0);
        } catch(e) { console.log("TTS Error ignored"); }
      };
      reader.readAsDataURL(selectedFile);
    } catch (e) {
      console.error(e);
      setResult("Analysis failed. Please try a shorter video.");
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-6 h-full bg-gray-900 overflow-y-auto">
      <h2 className="text-2xl font-bold mb-2 text-emerald-400">Form Check AI</h2>
      <p className="text-gray-400 mb-8 text-sm">Upload a video of your set. Gemini Pro will analyze your form, count reps, and provide feedback.</p>

      <div className="bg-gray-800 border-2 border-dashed border-gray-600 rounded-2xl p-8 flex flex-col items-center justify-center mb-8">
        {!selectedFile ? (
          <>
            <Upload className="text-emerald-500 mb-4" size={48} />
            <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">
              <span>Select Video</span>
              <input type="file" className="hidden" accept="video/mp4,video/quicktime" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            </label>
            <p className="mt-4 text-xs text-gray-500">MP4 or MOV up to 50MB</p>
          </>
        ) : (
          <div className="text-center">
            <FileVideo className="text-emerald-500 mb-2 mx-auto" size={48} />
            <p className="text-white font-medium mb-4">{selectedFile.name}</p>
            <button onClick={() => setSelectedFile(null)} className="text-red-400 text-sm hover:underline">Change File</button>
          </div>
        )}
      </div>

      <button 
        onClick={handleAnalyze} 
        disabled={!selectedFile || analyzing}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 mb-8"
      >
        {analyzing ? <Loader2 className="animate-spin" /> : <Film />}
        {analyzing ? "Analyzing Video..." : "Analyze Form"}
      </button>

      {result && (
        <div className="bg-gray-800 rounded-xl p-6 border border-emerald-500/30">
          <h3 className="text-emerald-400 font-bold mb-4 text-lg">Coach's Analysis</h3>
          <div className="prose prose-invert text-sm max-w-none">
             <p className="whitespace-pre-wrap leading-relaxed">{result}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaAnalyzer;
