
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars from local file if running locally
try {
    const envConfig = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env.local')));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log("No .env.local found, assuming env vars are set.");
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Needed for admin write
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
    console.error("Missing Env Vars. Ensure VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY are set.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

const SAMPLE_EXERCISES = [
    {
        id: "0001",
        name: "Barbell Bench Press",
        body_part: "chest",
        equipment: "barbell",
        target: "pectorals",
        gif_url: "https://v2.exercisedb.io/image/3/4/sit-up.gif", // Placeholder
        instructions: ["Lie on bench", "Lower bar to chest", "Press up"]
    },
    {
        id: "0002",
        name: "Dumbbell Fly",
        body_part: "chest",
        equipment: "dumbbell",
        target: "pectorals",
        gif_url: "",
        instructions: []
    },
    {
        id: "0003",
        name: "Push Up",
        body_part: "chest",
        equipment: "body weight",
        target: "pectorals",
        gif_url: "",
        instructions: []
    },
    {
        id: "0004",
        name: "Squat",
        body_part: "legs",
        equipment: "barbell",
        target: "quads",
        gif_url: "",
        instructions: []
    },
    {
        id: "0005",
        name: "Deadlift",
        body_part: "back",
        equipment: "barbell",
        target: "spinal erectors",
        gif_url: "",
        instructions: []
    },
    {
        id: "0006",
        name: "Pull Up",
        body_part: "back",
        equipment: "body weight",
        target: "lats",
        gif_url: "",
        instructions: []
    },
    {
        id: "0007",
        name: "Shoulder Press",
        body_part: "shoulders",
        equipment: "dumbbell",
        target: "deltoids",
        gif_url: "",
        instructions: []
    },
    {
        id: "0008",
        name: "Lateral Raise",
        body_part: "shoulders",
        equipment: "dumbbell",
        target: "deltoids",
        gif_url: "",
        instructions: []
    },
    {
        id: "0009",
        name: "Lunges",
        body_part: "legs",
        equipment: "body weight",
        target: "glutes",
        gif_url: "",
        instructions: []
    },
    {
        id: "0010",
        name: "Plank",
        body_part: "waist",
        equipment: "body weight",
        target: "core",
        gif_url: "",
        instructions: []
    }
];

async function seed() {
    console.log("🌱 Starting Seed...");

    for (const ex of SAMPLE_EXERCISES) {
        console.log(`Processing: ${ex.name}`);

        // 1. Upsert Exercise
        const { error: dbError } = await supabase
            .from('exercises')
            .upsert(ex);

        if (dbError) {
            console.error(`Error inserting ${ex.name}:`, dbError);
            continue;
        }

        // 2. Generate Embedding
        // We embed the "concept": Name + Target + Equipment
        const textToEmbed = `${ex.name} for ${ex.target} using ${ex.equipment}`;
        const result = await model.embedContent(textToEmbed);
        const embedding = result.embedding.values;

        // 3. Insert Embedding
        // First delete existing to avoid duplicates in this simple seed script
        await supabase.from('exercise_embeddings').delete().eq('exercise_id', ex.id);

        const { error: embedError } = await supabase
            .from('exercise_embeddings')
            .insert({
                exercise_id: ex.id,
                embedding: embedding
            });

        if (embedError) {
            console.error(`Error embedding ${ex.name}:`, embedError);
        }
    }

    console.log("✅ Seeding Complete!");
}

seed();
