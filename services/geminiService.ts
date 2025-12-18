import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import { MODEL_NAMES, SYSTEM_INSTRUCTIONS } from '../constants';
import { KeyManager } from './keyManager';

class GeminiService {

  private getClient(): GoogleGenAI {
    const apiKey = KeyManager.getKey();
    if (!apiKey) {
      throw new Error("API Key Missing. Please add it in Settings.");
    }
    return new GoogleGenAI({ apiKey });
  }

  // --- Chat with Thinking ---
  async sendChatMessage(history: { role: string, parts: { text: string }[] }[], newMessage: string, imageBase64?: string) {
    try {
      // If we have an image, we use generateContent directly as chat history with images is tricky in some SDK versions,
      // but here we will try to stick to a simple stateless call for the image turn or use chat if text only.
      // For simplicity in this demo, we'll use generateContent for everything to allow easy image mixing.

      const parts: any[] = [{ text: newMessage }];
      if (imageBase64) {
        parts.unshift({
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64
          }
        });
      }

      // Construct history for context if needed, but for this simpler implementation we might just send the prompt
      // or maintain a proper chat object in the component.
      // Let's use the proper Chat API for text-only history, and single-shot for images.

      if (imageBase64) {
        // Single shot vision analysis with thinking
        const response = await this.getClient().models.generateContent({
          model: MODEL_NAMES.VISION,
          contents: { parts },
          config: {
            systemInstruction: SYSTEM_INSTRUCTIONS.COACH,
            thinkingConfig: { thinkingBudget: 2048 } // Lower budget for faster vision response, or max if needed
          }
        });
        return response.text;
      } else {
        // Text chat with history context
        // We'll create a fresh chat instance with history each time for simplicity in this stateless service wrapper
        // or just pass the message if we assume the UI handles history display.
        // Let's just generate content with the history provided as "contents" is flexible,
        // but ChatSession is better.
        const chat = this.getClient().chats.create({
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
  }

  // --- TTS ---
  async generateSpeech(text: string): Promise<ArrayBuffer> {
    const response = await this.getClient().models.generateContent({
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
  }

  // --- Video Analysis ---
  async analyzeVideo(videoBase64: string, prompt: string) {
    const response = await this.getClient().models.generateContent({
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
  }

  // --- Unified File Analysis ---
  async analyzeFile(file: File): Promise<string> {
    const base64 = await this.fileToBase64(file);
    const mimeType = file.type;
    const isVideo = mimeType.startsWith('video/');

    const prompt = `
    Analyze this workout media as an elite fitness coach.
    Provide a structured "Form Critique" in Markdown format:
    
    ## 📋 Exercise Identified
    [Name of exercise]

    ## 🔍 Form Analysis
    - **Good**: [List positive points]
    - **Corrections**: [List mistakes]

    ## 🛡️ Safety Score
    [1-10]/10

    ## 💡 Pro Tip
    [One actionable tip]
    `;

    if (isVideo) {
      return this.analyzeVideo(base64, prompt);
    } else {
      // Image Analysis
      const parts: any[] = [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64
          }
        },
        { text: prompt }
      ];

      const response = await this.getClient().models.generateContent({
        model: MODEL_NAMES.VISION,
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTIONS.ANALYZER,
          thinkingConfig: { thinkingBudget: 2048 }
        }
      });
      return response.text;
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/xyz;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // --- Live API Helper ---

  // Returns the session object for the component to manage
  getLiveClient() {
    return this.getClient().live;
  }
}

export const geminiService = new GeminiService();
