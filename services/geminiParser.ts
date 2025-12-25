import { GoogleGenerativeAI } from "@google/generative-ai";
import { KeyManager } from './keyManager';
import { supabase } from './supabaseClient';

export interface ParsedWorkout {
    workouts: {
        date: string;
        exercises: {
            name: string;
            sets: number;
            reps: number;
            weight: number;
        }[];
    }[];
}

const SYSTEM_PROMPT = `
You are an expert fitness coach and data cleaning assistant. 
Your task is to extracting structured workout data from images of workout logs.

The images may be:
1. **Single Session**: Handwritten notes, Whiteboard, or App Summary.
2. **History Feed**: A long screenshot (e.g. infinite scroll) of multiple past workouts (e.g. from Hevy, Strong, Notes).

CRITICAL INSTRUCTIONS:
1. **Structure**: Return a SINGLE valid JSON object containing an array of workouts.
2. **Schema**:
   {
     "workouts": [
       {
         "date": "YYYY-MM-DD" or null,
         "exercises": [
           { "name": "Standardized Exercise Name", "sets": Number, "reps": Number, "weight": Number (kg) }
         ]
       }
     ]
   }
3. **Multi-Session Logic**:
   - If the image contains multiple dates/sessions (e.g. "Monday", "Tuesday"), separate them into distinct objects in the "workouts" array.
   - Infer dates from headers (e.g. "Yesterday", "Oct 12"). If "Today" is seen, assume the current date is the anchor, but return "Today" string if unsure, or calculate YYYY-MM-DD if context allows. Ideally return ISO date if possible, else original string.
4. **Refinement**: 
   - Standardize names (e.g. "Bp" -> "Bench Press").
   - If weight is missing, set to 0.
   - If multiple sets have different reps, use the average.

Extract the data now. Return ONLY valid JSON.
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
