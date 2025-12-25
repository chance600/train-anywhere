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

const EXERCISE_DB_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

// Rate Limiting Helper
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function seed() {
    console.log("🌱 Starting Massive Seed...");

    try {
        console.log("⬇️  Fetching Exercise Database...");
        const response = await fetch(EXERCISE_DB_URL);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

        const rawExercises = await response.json();
        console.log(`📦 Fetched ${rawExercises.length} exercises. Transforming...`);

        // Transform to our Schema
        const exercises = rawExercises.map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            body_part: ex.category, // Map category to body_part
            equipment: ex.equipment || "body weight",
            target: ex.primaryMuscles && ex.primaryMuscles.length > 0 ? ex.primaryMuscles[0] : ex.category,
            // Use first image if available
            gif_url: ex.images && ex.images.length > 0 ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${ex.images[0]}` : "",
            instructions: ex.instructions || [],
            secondary_muscles: ex.secondaryMuscles || []
        }));

        console.log("🚀 Starting Batch Ingestion with Embeddings...");

        const BATCH_SIZE = 20; // Reduced for Embedding Batch Limits
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
            const batch = exercises.slice(i, i + BATCH_SIZE);

            // 1. Text Data Upsert
            const { error } = await supabase.from('exercises').upsert(batch, { onConflict: 'id' as any });

            if (error) {
                console.error(`❌ Batch ${i} Text Error:`, error.message);
                failCount += batch.length;
                continue;
            }

            // 2. Generate Embeddings (RAG)
            try {
                // Construct prompts for embedding: "Name: Squat. Target: Legs. Equipment: Barbell"
                const textsToEmbed = batch.map(ex =>
                    `Exercise: ${ex.name}. Target Muscle: ${ex.target}. Equipment: ${ex.equipment}. Body Part: ${ex.body_part}`
                );

                // Batch Embed call to Gemini
                // Note: check library version support for batchEmbedContents. If not, use Promise.all.
                // Assuming newer SDK:
                // const result = await model.batchEmbedContents({ requests: textsToEmbed.map(t => ({ content: { parts: [{ text: t }] } })) });

                // Fallback to safe Promise.all for older SDK or stability
                const embeddingsRaw = await Promise.all(textsToEmbed.map(async (text) => {
                    const res = await model.embedContent(text);
                    return res.embedding.values;
                }));

                // 3. Prepare Embedding Rows
                const embeddingRows = batch.map((ex, idx) => ({
                    exercise_id: ex.id,
                    embedding: embeddingsRaw[idx]
                }));

                // 4. Insert Embeddings (Delete old first? Cascade handles mapping, but upsert is better)
                // We'll delete existing embeddings for these IDs to avoid duplicates if re-seeding
                const ids = batch.map(b => b.id);
                await supabase.from('exercise_embeddings').delete().in('exercise_id', ids);

                const { error: embedError } = await supabase.from('exercise_embeddings').insert(embeddingRows);

                if (embedError) {
                    console.error(`❌ Batch ${i} Embedding Error:`, embedError.message);
                    // Non-fatal, but RAG won't work for these.
                }

                successCount += batch.length;
                process.stdout.write(`\r✅ Ingested & Embedded: ${successCount} / ${exercises.length}`);

                // Rate Limit safety
                await sleep(500);

            } catch (embedErr) {
                console.error(`⚠️ Batch ${i} Embedding Gen Failed:`, embedErr);
            }
        }

        console.log(`\n\n🎉 Seeding Complete! Success: ${successCount}, Failed: ${failCount}`);

    } catch (e) {
        console.error("\n💥 Critical Seed Error:", e);
    }
}

seed();
