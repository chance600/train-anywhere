
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
try {
    const envConfig = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env.local')));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log("No .env.local found");
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Use VITE_ prefix if needed, but usually server key

if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
        responseMimeType: "application/json"
    }
});

async function testPlanGeneration() {
    console.log("🤖 Testing AI Coach Planner...");

    const preferences = {
        goal: "Muscle Gain",
        daysPerWeek: 4,
        equipment: "Full Gym",
        experience: "Intermediate"
    };

    const prompt = `
      Create a 4-week structured workout plan for a user with the following profile:
      - Goal: ${preferences.goal}
      - Availability: ${preferences.daysPerWeek} days/week
      - Equipment: ${preferences.equipment}
      - Experience: ${preferences.experience}

      Return ONLY valid JSON with this structure:
      {
        "name": "Program Name",
        "description": "Brief summary.",
        "schedule": {
            "weeks": [
                {
                    "week_order": 1,
                    "days": [
                        {
                            "day": "Monday",
                            "focus": "Push",
                            "exercises": [
                                { "name": "Bench Press", "sets": 3, "reps": "8-10", "notes": "Heavy" }
                            ]
                        }
                    ]
                }
            ]
        }
      }
      
      Generate a full 1-week sample.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log("📄 Raw Response Length:", text.length);

        const plan = JSON.parse(text);
        console.log("✅ JSON Parsed Successfully!");
        console.log("Plan Name:", plan.name);
        console.log("First Day Focus:", plan.schedule.weeks[0].days[0].focus);
        console.log("First Exercise:", plan.schedule.weeks[0].days[0].exercises[0].name);

    } catch (error) {
        console.error("❌ Generation Failed:", error);
    }
}

testPlanGeneration();
