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
        // 1. Verify User Auth
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        // 2. Verify Subscription Status
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('is_pro')
            .eq('id', user.id)
            .single()

        if (profileError || !profile?.is_pro) {
            console.error(JSON.stringify({ event: 'SUBSCRIPTION_ERROR', user: user.id, error: 'Subscription Required' }));
            return new Response(
                JSON.stringify({ error: 'Subscription Required' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Process with Server-Side Key
        // Validate Payload Size
        const reqJson = await req.json()
        const { images, prompt } = reqJson // Now expecting 'images' array

        // Safety: Prevent massive payloads (Limit 20MB base64)
        // Check total size
        const totalSize = JSON.stringify(images).length;
        if (totalSize > 20 * 1024 * 1024) {
            console.error(JSON.stringify({ event: 'PAYLOAD_TOO_LARGE', user: user.id, size: totalSize }));
            throw new Error('Payload too large. Max 20MB.')
        }

        const apiKey = Deno.env.get('GEMINI_API_KEY')
        if (!apiKey) {
            console.error(JSON.stringify({ event: 'CONFIG_ERROR', error: 'Missing GEMINI_API_KEY' }));
            throw new Error('Server Configuration Error')
        }

        console.log(JSON.stringify({ event: 'AI_ANALYSIS_START', user: user.id, images_count: images.length }));

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

        // Construct parts from images array
        const imageParts = images.map((img: any) => ({
            inlineData: {
                data: img.data,
                mimeType: img.mimeType || "image/jpeg"
            }
        }));

        const result = await model.generateContent([prompt, ...imageParts])

        const response = await result.response;
        const text = response.text();

        console.log(JSON.stringify({ event: 'AI_ANALYSIS_SUCCESS', user: user.id }));

        // Clean markdown if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return new Response(
            JSON.stringify(JSON.parse(jsonStr)),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error(JSON.stringify({ event: 'FUNCTION_ERROR', error: error.message }));
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
