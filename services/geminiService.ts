import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { MODEL_NAMES, SYSTEM_INSTRUCTIONS, GEMINI_API_KEY } from '../constants';

// Helper for exponential backoff to handle 503s
async function retryOperation<T>(
  operation: () => Promise<T>, 
  retries: number = 3, 
  delay: number = 1000
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check for 503 Service Unavailable, 500, or network errors
    const isRetryable = 
      error.status === 503 || 
      error.status === 500 ||
      (error.message && (
        error.message.includes('503') || 
        error.message.toLowerCase().includes('unavailable') ||
        error.message.toLowerCase().includes('overloaded') ||
        error.message.toLowerCase().includes('fetch failed')
      ));

    if (retries > 0 && isRetryable) {
      console.warn(`Gemini API busy/unavailable. Retrying in ${delay}ms... (Retries left: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  // --- Chat with Thinking ---
  async sendChatMessage(history: { role: string, parts: { text: string }[] }[], newMessage: string, imageBase64?: string) {
    return retryOperation(async () => {
      try {
        const parts: any[] = [{ text: newMessage }];
        if (imageBase64) {
          parts.unshift({
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64
            }
          });
        }

        if (imageBase64) {
          // Single shot vision analysis with thinking
          const response = await this.ai.models.generateContent({
            model: MODEL_NAMES.VISION,
            contents: { parts },
            config: {
              systemInstruction: SYSTEM_INSTRUCTIONS.COACH,
              thinkingConfig: { thinkingBudget: 2048 } // Lower budget for faster vision response
            }
          });
          return response.text;
        } else {
          // Text chat with history context
          const chat = this.ai.chats.create({
            model: MODEL_NAMES.CHAT_THINKING,
            config: {
              systemInstruction: SYSTEM_INSTRUCTIONS.COACH,
              thinkingConfig: { thinkingBudget: 4096 } // Standard thinking
            },
            history: history.map(h => ({
              role: h.role,
              parts: h.parts
            }))
          });

          const result = await chat.sendMessage({ message: newMessage });
          return result.text;
        }
      } catch (error) {
        console.error("Chat Error:", error);
        throw error;
      }
    });
  }

  // --- TTS ---
  async generateSpeech(text: string): Promise<ArrayBuffer> {
    return retryOperation(async () => {
      const response = await this.ai.models.generateContent({
        model: MODEL_NAMES.TTS,
        contents: { parts: [{ text }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio generated");
      
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    });
  }

  // --- Video Analysis ---
  async analyzeVideo(videoBase64: string, prompt: string) {
    return retryOperation(async () => {
      const response = await this.ai.models.generateContent({
        model: MODEL_NAMES.VIDEO_ANALYSIS,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'video/mp4',
                data: videoBase64
              }
            },
            { text: prompt || "Analyze this workout video." }
          ]
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTIONS.ANALYZER,
          thinkingConfig: { thinkingBudget: 4096 }
        }
      });
      return response.text;
    });
  }

  // --- Live API Helper ---
  // Returns the session object for the component to manage
  // Note: WebSocket connections are handled by the component, which should handle its own reconnection logic.
  getLiveClient() {
    return this.ai.live;
  }
}

export const geminiService = new GeminiService();
