
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

// [SECURITY] Lock CORS to production domains
const ALLOWED_ORIGINS = [
    'https://train-anywhere.vercel.app',
    'https://trainanywhere.app',
    'http://localhost:5173', // Dev
    'http://localhost:3000'  // Dev
];

const getCorsHeaders = (origin: string | null) => {
    const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
};

serve(async (req) => {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use Service Role for Profile/Embeddings access if needed, or Anon if RLS allows.
            // Using Service Role to ensure we can read all necessary data regardless of RLS complexity for this system function.
        )

        // 1. Auth & Context
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Auth Header');

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 2. Fetch User Profile & Goals (The "Gym Bag")
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('fitness_goals')
            .eq('id', user.id)
            .single();

        const userGoals = profile?.fitness_goals || {};
        const contextGoal = userGoals.target_goal || "General Fitness";
        const contextEquipment = userGoals.equipment || []; // e.g. ["Dumbbells", "Bands"]
        const contextDays = userGoals.days_per_week || 3;
        const contextLevel = userGoals.experience || 'Intermediate';

        // 3. Fetch Workout History (The "Memory")
        // Get last 30 days to analyze consistency and recent volume
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: history } = await supabaseClient
            .from('workouts')
            .select('date, exercise, reps, weight, score')
            .eq('user_id', user.id)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(50);

        const historySummary = history && history.length > 0
            ? JSON.stringify(history.slice(0, 10)) // Send top 10 recent sessions to context
            : "No recent workout history found.";

        // 4. RAG: Fetch Relevant Exercises (The "Knowledge")
        // We embed the GOAL to find semantically relevant exercises (e.g. "Muscle Gain" -> Hypertrophy movements)
        const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
        const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const textModel = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // Embed the Goal to find best exercises
        const embeddingResult = await embeddingModel.embedContent(contextGoal);
        const embedding = embeddingResult.embedding.values;

        // Query Vector Store
        const { data: recommendedExercises, error: ragError } = await supabaseClient.rpc('match_exercises', {
            query_embedding: embedding,
            match_threshold: 0.3, // Loose match to get variety
            match_count: 20
        });

        // Filter Recommendations by Equipment (Crucial for Home vs Gym)
        const availableExercises = recommendedExercises
            ? recommendedExercises.filter((ex: any) => {
                // If user has NO equipment listed, assume Full Gym or Bodyweight? 
                // Let's assume Bodyweight if empty, or just pass all if they haven't set up Gym Bag.
                if (contextEquipment.length === 0) return true;

                // Naive string matching check. 
                // Real implementation would parse 'ex.equipment' properly.
                // Assuming ex.equipment is a string like "dumbbell" or "body weight".
                const reqEquip = ex.equipment?.toLowerCase() || 'body weight';

                // Special Case: Bodyweight is always available
                if (reqEquip.includes('body') || reqEquip.includes('none')) return true;

                // Check if any user equipment matches the requirement
                return contextEquipment.some((uEq: string) => reqEquip.includes(uEq.toLowerCase()));
            }).slice(0, 10) // Take top 10 *valid* ones
            : [];

        const knowledgeContext = availableExercises.map((e: any) => e.name).join(', ');

        // 5. Generate Plan
        const prompt = `
            Act as an elite personal trainer. Create a 1-week structural workout plan.
            
            **User Profile**:
            - Goal: ${contextGoal}
            - Experience: ${contextLevel}
            - Availability: ${contextDays} days/week
            - Equipment Available: ${contextEquipment.length > 0 ? contextEquipment.join(', ') : 'Unspecified (Assume Full Gym)'}

            **Context**:
            - Recent History: ${historySummary} (Use this to determine volume/intensity. If they trained yesterday, don't kill them today.)
            - Recommended Exercises (RAG): ${knowledgeContext} (Prioritize these if they fit the split).

            **Output**:
            Return valid JSON with this structure:
            {
                "name": "Plan Name",
                "description": "Strategic summary.",
                "schedule": {
                    "weeks": [
                        {
                            "week_order": 1,
                            "days": [
                                {
                                    "day": "Monday",
                                    "focus": "Upper Body",
                                    "exercises": [
                                        { "name": "Exercise Name", "sets": 3, "reps": "8-12", "notes": "Focus on form" }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        `;

        const result = await textModel.generateContent(prompt)
        const response = result.response
        const plan = JSON.parse(response.text())

        return new Response(
            JSON.stringify(plan),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }
})

