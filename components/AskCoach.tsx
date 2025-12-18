import React, { useState, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import { supabase } from '../services/supabaseClient'; // [NEW]
import { ChatMessage } from '../types';
import { Send, Image as ImageIcon, Loader2, CheckCircle, Calendar, Sparkles } from 'lucide-react';

const AskCoach: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: "Hello! I'm your AI fitness coach. I can help design workouts, analyze your form from photos, or just answer fitness questions. How can I help today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analysisContext, setAnalysisContext] = useState<string | null>(null); // [NEW]

  // [NEW] Fetch latest analysis context
  React.useEffect(() => {
    const fetchContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('analysis_logs')
        .select('analysis_content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && data.analysis_content) {
        setAnalysisContext(`User's recent form analysis (${new Date(data.created_at).toLocaleDateString()}): ${data.analysis_content}`);
      }
    };
    fetchContext();
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      // Prepare history for context
      const history = messages.filter(m => m.role !== 'user' || !m.image).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // [NEW] Inject Analysis Context if available
      if (analysisContext) {
        history.unshift({
          role: 'model',
          parts: [{ text: `[SYSTEM MEMORY] I have access to your recent workout analysis:\n${analysisContext}\nI will use this to guide my advice.` }]
        });
      }

      const responseText = await geminiService.sendChatMessage(history, userMsg.text, userMsg.image);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText || "I couldn't generate a response."
      }]);

      // Speak the response if short
      if (responseText && responseText.length < 100) {
        // Optional: Trigger TTS for short interactions
        // const audioBuffer = await geminiService.generateSpeech(responseText);
        // ... play audio ...
      }

    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setSelectedImage(base64.split(',')[1]); // Store pure base64
      };
      reader.readAsDataURL(file);
    }
  };

  const generateWeeklyPlan = () => {
    const history = localStorage.getItem('workout_history');
    const prompt = `Based on my workout history: ${history || 'No history yet'}, generate a detailed weekly workout plan. 
    RETURN ONLY VALID JSON (no markdown) in this format: 
    [
      { "day": "Monday", "focus": "Legs", "exercises": ["Squats 3x10", "Lunges 3x12"] }
    ]`;
    setInput(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 p-5 sm:p-4">
      <h2 className="text-3xl sm:text-2xl font-bold text-emerald-400 mb-4">AI Coach Chat</h2>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
              {msg.image && (
                <img src={`data:image/jpeg;base64,${msg.image}`} alt="User upload" className="w-full rounded-lg mb-2 max-h-48 object-cover" />
              )}
              {(() => {
                try {
                  // Attempt to parse JSON plan
                  if (msg.role === 'model' && msg.text.trim().startsWith('[') && msg.text.trim().endsWith(']')) {
                    const plan = JSON.parse(msg.text);
                    if (Array.isArray(plan)) {
                      return (
                        <div className="space-y-2">
                          <h3 className="font-bold text-emerald-400 mb-2 flex items-center gap-2">
                            <Calendar size={16} /> Weekly Schedule
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {plan.map((day: any, i: number) => (
                              <div key={i} className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-white text-sm">{day.day}</span>
                                  <span className="text-[10px] uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">{day.focus}</span>
                                </div>
                                <ul className="text-xs text-gray-300 space-y-1">
                                  {day.exercises.map((ex: string, j: number) => (
                                    <li key={j} className="flex items-start gap-1">
                                      <span className="text-emerald-500 mt-0.5">•</span> {ex}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  }
                } catch (e) {
                  // Fallback to text
                }
                return <p className="whitespace-pre-wrap text-sm">{msg.text}</p>;
              })()}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl p-4 text-gray-400 flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              <span className="text-xs">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        {selectedImage && (
          <div className="mb-2 flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle size={12} /> Image attached
            <button onClick={() => setSelectedImage(null)} className="text-red-400 ml-2 hover:underline">Remove</button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          <button
            onClick={() => setInput("Critique my form on Squats based on general best practices.")}
            className="whitespace-nowrap px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-xs text-emerald-400 border border-emerald-500/30"
          >
            Form Tips
          </button>
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 pt-4">
          <button
            onClick={generateWeeklyPlan}
            disabled={isLoading}
            className="w-full mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 sm:py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg min-h-[56px] sm:min-h-[48px] text-base sm:text-sm"
          >
            <Calendar size={24} className="sm:w-5 sm:h-5" />
            {isLoading ? 'Generating...' : 'Generate Weekly Plan'}
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask me anything about fitness..."
              className="flex-1 bg-gray-800 text-white rounded-xl px-4 sm:px-3 py-4 sm:py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[56px] sm:min-h-[48px]"
              disabled={isLoading}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gray-700 hover:bg-gray-600 p-4 sm:p-3 rounded-xl transition-colors min-w-[56px] min-h-[56px] sm:min-w-[48px] sm:min-h-[48px]"
              disabled={isLoading}
              title="Upload image"
            >
              <ImageIcon size={24} className="sm:w-5 sm:h-5 text-gray-300" />
            </button>
            <button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && !selectedImage)}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed p-4 sm:p-3 rounded-xl transition-colors min-w-[56px] min-h-[56px] sm:min-w-[48px] sm:min-h-[48px]"
            >
              {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} className="sm:w-5 sm:h-5 text-white" />}
            </button>
          </div>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
};

export default AskCoach;