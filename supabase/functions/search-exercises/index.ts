import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*'

const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Verify Request
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const { query } = await req.json()
        if (!query) throw new Error('Missing query parameter')

        // 2. Generate Embedding with Gemini
        const apiKey = Deno.env.get('GEMINI_API_KEY')
        if (!apiKey) throw new Error('Server Configuration Error: Missing GEMINI_API_KEY')

        const genAI = new GoogleGenerativeAI(apiKey)
        // Use text-embedding-004 for latest quality, dimension 768 matches the DB definition
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" })

        const result = await model.embedContent(query)
        const embedding = result.embedding.values

        // 3. Search Vector DB
        const { data: exercises, error: searchError } = await supabaseClient
            .rpc('match_exercises', {
                query_embedding: embedding,
                match_threshold: 0.5, // Adjust threshold based on testing
                match_count: 5 // Top 5 results
            })

        if (searchError) {
            console.error('Vector Search Error:', searchError)
            throw new Error('Database Search Failed')
        }

        return new Response(
            JSON.stringify({ exercises }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('Search Function Error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
