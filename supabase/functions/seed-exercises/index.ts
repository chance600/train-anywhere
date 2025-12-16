
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai"

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

        // 3. Batch Upsert
        const BATCH_SIZE = 100;
        let successCount = 0;

        for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
            const batch = exercises.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from('exercises').upsert(batch, { onConflict: 'id' });

            if (error) {
                logs.push(`Batch ${i} Error: ${error.message}`);
            } else {
                successCount += batch.length;
            }
        }

        logs.push(`Success! Ingested ${successCount} exercises.`);

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
