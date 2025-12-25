
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai"

console.log("Hello from Seed Function!")

const EXERCISE_DB_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

serve(async (req) => {
    try {
        // 1. Init Clients
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

        if (!supabaseServiceKey || !geminiKey) {
            throw new Error("Missing Keys in Edge Function Env")
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        // const genAI = new GoogleGenerativeAI(geminiKey) // Commented out to save time/quota

        const logs = [];

        // 2. Fetch Data
        logs.push("Fetching external DB...");
        const response = await fetch(EXERCISE_DB_URL);
        if (!response.ok) throw new Error("Failed to fetch exercises");
        const rawExercises = await response.json();

        logs.push(`Fetched ${rawExercises.length} items. Transforming...`);

        const exercises = rawExercises.map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            body_part: ex.category,
            equipment: ex.equipment || "body weight",
            target: ex.primaryMuscles && ex.primaryMuscles.length > 0 ? ex.primaryMuscles[0] : ex.category,
            gif_url: ex.images && ex.images.length > 0 ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${ex.images[0]}` : "",
            instructions: ex.instructions || [],
            secondary_muscles: ex.secondaryMuscles || []
        }));

        // 3. Batch Upsert & Embed
        logs.push("Starting Batch Ingestion with Embeddings...");
        const BATCH_SIZE = 10; // Keep small for Edge Function limits (timeout)
        let successCount = 0;

        // Init Gemini
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

        // Limit total for Edge Function safety (prevent timeout on 800 items)
        // We'll do first 50 to prove it, or loop until near timeout?
        // Let's do 50 for now to ensure RAG has DATA, user can run full seed later.
        const limitedExercises = exercises.slice(0, 50);

        for (let i = 0; i < limitedExercises.length; i += BATCH_SIZE) {
            const batch = limitedExercises.slice(i, i + BATCH_SIZE);

            // Text Upsert
            const { error } = await supabase.from('exercises').upsert(batch, { onConflict: 'id' });
            if (error) {
                logs.push(`Batch ${i} Text Error: ${error.message}`);
                continue;
            }

            // Embed
            try {
                const textsToEmbed = batch.map((ex: any) =>
                    `Exercise: ${ex.name}. Target Muscle: ${ex.target}. Equipment: ${ex.equipment}. Body Part: ${ex.body_part}`
                );

                const embeddingsRaw = await Promise.all(textsToEmbed.map(async (text: string) => {
                    const res = await model.embedContent(text);
                    return res.embedding.values;
                }));

                const embeddingRows = batch.map((ex: any, idx: number) => ({
                    exercise_id: ex.id,
                    embedding: embeddingsRaw[idx]
                }));

                const ids = batch.map((b: any) => b.id);
                await supabase.from('exercise_embeddings').delete().in('exercise_id', ids);

                const { error: embedError } = await supabase.from('exercise_embeddings').insert(embeddingRows);
                if (embedError) logs.push(`Batch ${i} Embed Error: ${embedError.message}`);

            } catch (embedErr) {
                logs.push(`Batch ${i} Embed Gen Failed: ${embedErr}`);
            }

            successCount += batch.length;
        }

        logs.push(`Success! Ingested & Embedded ${successCount} exercises (Limited Run).`);

        return new Response(
            JSON.stringify({ message: "Seeding Complete", logs }),
            { headers: { "Content-Type": "application/json" } },
        )
    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        )
    }
})
