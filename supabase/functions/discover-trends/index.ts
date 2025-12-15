
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const ALLOWED_ORIGINS = [
    'https://train-anywhere.vercel.app',
    'https://trainanywhere.app',
    'http://localhost:5173',
    'http://localhost:3000'
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
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GEMINI_API_KEY not set');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
        Act as a Viral Fitness Trend Analyst.
        Identify 5 emerging or potential viral fitness challenges for 2024/2025.
        Focus on retention, community engagement, and "fun" factors.
        
        Examples of what I'm looking for: "75 Soft", "Cozy Cardio", "Ruck January", "Squatmas".

        Return a JSON array with these exact fields for each trend:
        - title: Catchy name
        - description: Short, exciting description (max 200 chars)
        - category: One of ['Cardio', 'Strength', 'Mobility', 'Holistic', 'HIIT', 'Challenge']
        - viral_score: A number between 60-99 representing predicted engagement
        - source_platform: e.g. "TikTok", "Instagram", "General"
        - suggested_duration_days: e.g. 30
        - suggested_win_condition: A short string explaining how to win (e.g. "Squat 1000 times")

        Format the output purely as JSON.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON (handle markdown fences if present)
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const trends = JSON.parse(cleanJson);

        // Deduplicate and Insert into Database
        const newTrends = [];
        for (const trend of trends) {
            // Check if title exists to avoid dupes (simple check)
            const { data: existing } = await supabase
                .from('trend_repository')
                .select('id')
                .eq('title', trend.title)
                .maybeSingle();

            if (!existing) {
                newTrends.push(trend);
            }
        }

        if (newTrends.length > 0) {
            const { error } = await supabase.from('trend_repository').insert(newTrends);
            if (error) throw error;
        }

        return new Response(JSON.stringify({
            success: true,
            discovered: newTrends.length,
            trends: newTrends
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
