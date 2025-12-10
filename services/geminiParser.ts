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

export async function parseWorkoutImage(file: File): Promise<ParsedWorkout> {
    const userKey = KeyManager.getKey();
    const base64Data = await fileToGenerativePart(file);

    // 1. BYO Key Route (Client-Side)
    if (userKey) {
        console.log("Using User-Provided API Key");
        const genAI = new GoogleGenerativeAI(userKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = getPrompt();

        try {
            const result = await model.generateContent([prompt, base64Data]);
            const response = await result.response;
            return cleanAndParse(response.text());
        } catch (error: any) {
            throw new Error(`AI Parsing Failed: ${error.message}`);
        }
    }

    // 2. Subscription Route (Server-Side Proxy)
    // We check if the user is logged in. The Edge Function verifies actual PRO status.
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        console.log("Attempting Subscription Proxy Call...");
        const { data, error } = await supabase.functions.invoke('analyze-workout', {
            body: {
                image: base64Data.inlineData.data,
                prompt: getPrompt()
            }
        });

        if (error) {
            console.error("Proxy Error:", error);
            if (error.context?.status === 403) throw new Error("Subscription Required. Please upgrade to PRO.");
            throw new Error("AI Service Unavailable. Please try again.");
        }
        return data; // Already valid JSON from Edge Function
    }

    // 3. Fallback
    throw new Error("Gemini API Key is missing. Please configure it in Settings or Upgrade to PRO.");
}

function getPrompt() {
    return `
    Analyze this workout log (image or text). 
    Extract the following details into a valid JSON object:
    - date (ISO 8601 YYYY-MM-DD, default to today if missing)
    - exercises: array of objects with:
      - name: string (standardized exercise name)
      - sets: number (count of sets)
      - reps: number (average reps per set)
      - weight: number (weight in kg, estimate if lbs provided)
    
    If the input is not a workout log, return an empty object with exercises array empty.
    Do not use markdown code blocks. Return RAW JSON.
  `;
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
