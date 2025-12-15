
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

console.log("Hello from Seed Function!")

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
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" })

        const logs = [];

        // 2. Loop and Insert
        for (const ex of SAMPLE_EXERCISES) {
            // Upsert Exercise
            const { error: dbError } = await supabase.from('exercises').upsert(ex)
            if (dbError) {
                logs.push(`Error inserting ${ex.name}: ${dbError.message}`)
                continue
            }

            // Generate Embedding
            const textToEmbed = `${ex.name} for ${ex.target} using ${ex.equipment}`
            const result = await model.embedContent(textToEmbed)
            const embedding = result.embedding.values

            // Delete old embeddings for this exercise to avoid dupes
            await supabase.from('exercise_embeddings').delete().eq('exercise_id', ex.id)

            // Insert Embedding
            const { error: embedError } = await supabase.from('exercise_embeddings').insert({
                exercise_id: ex.id,
                embedding: embedding
            })

            if (embedError) {
                logs.push(`Error embedding ${ex.name}: ${embedError.message}`)
            } else {
                logs.push(`Success: ${ex.name}`)
            }
        }

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
