
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const logs = [];

        // 1. Get an existing admin/user to be the creator
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError || !users || users.length === 0) {
            throw new Error("No users found to assign challenges to. Please sign up first.");
        }
        const adminUserId = users[0].id; // Use the first user (likely the dev)
        logs.push(`Assigning challenges to user ID: ${adminUserId}`);

        // 2. Create Challenges
        const challenges = [
            {
                name: '🍑 Squattober 1000',
                description: 'Can you hit 1000 squats in 30 days? High volume leg building challenge. Any variation counts!',
                challenge_type: 'total_reps',
                target_exercise: 'Squat',
                goal_value: 1000,
                duration: 30
            },
            {
                name: '💪 Push Up Pro',
                description: '500 Pushups in 30 days. Build that chest and tricep definition.',
                challenge_type: 'total_reps',
                target_exercise: 'Pushups',
                goal_value: 500,
                duration: 30
            },
            {
                name: '🔥 The Daily 30',
                description: 'Streak Challenge: Log a workout 30 days in a row. No days off!',
                challenge_type: 'streak',
                goal_value: 30,
                duration: 30
            }
        ];

        for (const c of challenges) {
            // Check if challenge exists
            const { data: existing } = await supabase
                .from('challenges')
                .select('id')
                .eq('name', c.name)
                .maybeSingle();

            let challengeId = existing?.id;

            if (!existing) {
                const startDate = new Date();
                const endDate = new Date();
                endDate.setDate(startDate.getDate() + c.duration);

                const { data: newCh, error } = await supabase
                    .from('challenges')
                    .insert({
                        creator_id: adminUserId,
                        name: c.name,
                        description: c.description,
                        challenge_type: c.challenge_type,
                        target_exercise: c.target_exercise,
                        goal_value: c.goal_value,
                        start_date: startDate.toISOString(),
                        end_date: endDate.toISOString(),
                        is_public: true
                    })
                    .select()
                    .single();

                if (error) {
                    logs.push(`Failed to create challenge ${c.name}: ${error.message}`);
                    continue;
                }
                challengeId = newCh.id;
                logs.push(`Created challenge ${c.name}`);
            } else {
                logs.push(`Challenge ${c.name} already exists`);
            }
        }

        return new Response(JSON.stringify({ success: true, logs }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
