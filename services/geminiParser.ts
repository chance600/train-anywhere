import { GoogleGenerativeAI } from "@google/generative-ai";
import { KeyManager } from './keyManager';
import { supabase } from './supabaseClient';

export interface ParsedWorkout {
    date: string;
    exercises: {
        name: string;
        sets: number;
        reps: number;
        weight: number;
    }[];
}

const SYSTEM_PROMPT = `
You are an expert fitness coach and data cleaning assistant. 
Your task is to extracting structured workout data from images of workout logs.

The images may be:
- Handwritten notes (messy, cursive, shorthand)
- Digital screenshots (Notes app, Excel, specific workout apps)
- Whiteboard photos

CRITICAL INSTRUCTIONS:
1. **Handwriting**: Be extremely resilient to messy handwriting. Look for patterns like "Exerbise Name", numbers indicating sets/reps (e.g. "3x10", "3 sets of 10", "10, 10, 10").
2. **Dates**: Identify the date of the workout. If ambiguous, look for headers. If NO date is found, strictly return null for the date field. Supports formats like "Mon 12/5", "Oct 20", "Today".
3. **Structure**: Return a SINGLE valid JSON object. Do NOT include markdown formatting (\`\`\`json).
4. **Schema**:
   {
     "date": "YYYY-MM-DD" or null,
     "exercises": [
       { "name": "Standardized Exercise Name", "sets": Number, "reps": Number, "weight": Number (in kg, convert lbs by 0.45 if explicitly lbs) }
     ]
   }
5. **Refinement**: 
   - Standardize names (e.g. "Bp" -> "Bench Press", "Squats" -> "Squat").
   - If weight is missing, set to 0.
   - If multiple sets have different reps, use the average or the most common rep count.

Extract the data now.
`;


export async function parseWorkoutFiles(files: File[]): Promise<ParsedWorkout> {
    const userKey = KeyManager.getKey();

    // Process all files to Base64 parts
    const imageParts = await Promise.all(files.map(fileToGenerativePart));

    // 1. BYO Key Route (Client-Side)
    if (userKey) {
        console.log("Using User-Provided API Key");
        const genAI = new GoogleGenerativeAI(userKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        try {
            // Spread imageParts into the generation request
            const result = await model.generateContent([SYSTEM_PROMPT, ...imageParts]);
            const response = await result.response;
            return cleanAndParse(response.text());
        } catch (error: any) {
            throw new Error(`AI Parsing Failed: ${error.message}`);
        }
    }

    // 2. Subscription Route (Server-Side Proxy)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        console.log("Attempting Subscription Proxy Call...");

        // Prepare payload for Edge Function
        const imagesPayload = imageParts.map(part => ({
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType
        }));

        const { data, error } = await supabase.functions.invoke('analyze-workout', {
            body: {
                images: imagesPayload,
                prompt: SYSTEM_PROMPT
            }
        });

        if (error) {
            console.error("Proxy Error:", error);
            if (error.context?.status === 403) throw new Error("Subscription Required. Please upgrade to PRO.");
            throw new Error(`AI Service Unavailable: ${error.message}`);
        }
        return data;
    }

    // 3. Fallback
    throw new Error("Gemini API Key is missing. Please configure it in Settings or Upgrade to PRO.");
}


function cleanAndParse(text: string) {
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
}

async function fileToGenerativePart(file: File) {
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });

    return {
        inlineData: {
            data: await base64EncodedDataPromise as string,
            mimeType: file.type,
        },
    };
}
