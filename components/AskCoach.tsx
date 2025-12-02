import React, { useState, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import { ChatMessage } from '../types';
import { Send, Image as ImageIcon, Loader2, CheckCircle, Calendar } from 'lucide-react';

const AskCoach: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: "Hello! I'm your AI fitness coach. I can help design workouts, analyze your form from photos, or just answer fitness questions. How can I help today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Prepare history for context (excluding images for simple text history, but including current image if present)
      const history = messages.filter(m => m.role !== 'user' || !m.image).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

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

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
              {msg.image && (
                <img src={`data:image/jpeg;base64,${msg.image}`} alt="User upload" className="w-full rounded-lg mb-2 max-h-48 object-cover" />
              )}
              <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
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
            onClick={() => {
              const history = localStorage.getItem('workout_history');
              const prompt = `Based on my workout history: ${history || 'No history yet'}, generate a detailed weekly workout plan for me. Focus on progressive overload.`;
              setInput(prompt);
              // Optional: auto-send
              // handleSend(); 
            }}
            className="whitespace-nowrap px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-xs text-emerald-400 border border-emerald-500/30 flex items-center gap-1"
          >
            <Calendar size={12} /> Generate Weekly Plan
          </button>
          <button
            onClick={() => setInput("Critique my form on Squats based on general best practices.")}
            className="whitespace-nowrap px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-xs text-emerald-400 border border-emerald-500/30"
          >
            Form Tips
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-700 rounded-xl hover:bg-gray-600 text-gray-300">
            <ImageIcon size={20} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about workouts, form, or diet..."
            className="flex-1 bg-gray-700 rounded-xl px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="p-3 bg-emerald-500 rounded-xl hover:bg-emerald-400 text-black disabled:opacity-50 font-bold"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AskCoach;