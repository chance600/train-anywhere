
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
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Auth Check
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { goal, daysPerWeek, equipment, experience } = await req.json()

        // [SECURITY] Input Validation
        const validGoals = ['Muscle Gain', 'Fat Loss', 'Strength', 'Endurance'];
        const validEquipment = ['Full Gym', 'Home Gym', 'Bodyweight Only', 'Dumbbells'];
        const validExperience = ['Beginner', 'Intermediate', 'Advanced'];

        if (!validGoals.includes(goal)) {
            return new Response(JSON.stringify({ error: 'Invalid goal' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        if (!validEquipment.includes(equipment)) {
            return new Response(JSON.stringify({ error: 'Invalid equipment' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        if (!validExperience.includes(experience)) {
            return new Response(JSON.stringify({ error: 'Invalid experience level' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        if (typeof daysPerWeek !== 'number' || daysPerWeek < 1 || daysPerWeek > 7) {
            return new Response(JSON.stringify({ error: 'Invalid days per week' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json"
            }
        })

        const prompt = `
      Create a 4-week structured workout plan for a user with the following profile:
      - Goal: ${goal}
      - Availability: ${daysPerWeek} days/week
      - Equipment: ${equipment}
      - Experience: ${experience}

      Return ONLY valid JSON with this structure:
      {
        "name": "Program Name (e.g. Summer Shred)",
        "description": "Brief summary of the plan strategy.",
        "schedule": {
            "weeks": [
                {
                    "week_order": 1,
                    "days": [
                        {
                            "day": "Monday",
                            "focus": "Push (Chest/Tri)",
                            "exercises": [
                                { "name": "Bench Press", "sets": 3, "reps": "8-10", "notes": "Heavy" }
                            ]
                        }
                    ]
                }
            ]
        }
      }
      
      Generate a full 1-week sample (Week 1), and then summaries for Weeks 2-4 if redundant, or full detail if distinct. Ensure progressive overload context is in the notes.
    `

        const result = await model.generateContent(prompt)
        const response = result.response
        const text = response.text()

        // Validate JSON parsing
        const plan = JSON.parse(text)

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

