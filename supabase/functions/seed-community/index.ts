
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

        // 1. Create Dummy Users
        const dummies = [
            { email: 'sarah.squats@example.com', password: 'password123', name: 'Sarah Squats', bio: 'Leg day is every day. 🍑' },
            { email: 'mike.calisthenics@example.com', password: 'password123', name: 'Mike Calisthenics', bio: 'Gravity is just a suggestion. 💪' },
            { email: 'davina.daily@example.com', password: 'password123', name: 'Davina Daily', bio: 'Consistency > Intensity. 🔥' }
        ];

        const userIds = {};

        for (const d of dummies) {
            // Check if exists
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            let user = existingUsers.users.find(u => u.email === d.email);

            if (!user) {
                const { data: newUser, error } = await supabase.auth.admin.createUser({
                    email: d.email,
                    password: d.password,
                    email_confirm: true,
                    user_metadata: { full_name: d.name }
                });
                if (error) {
                    logs.push(`Failed to create ${d.name}: ${error.message}`);
                    continue;
                }
                user = newUser.user;
                logs.push(`Created user ${d.name}`);
            } else {
                logs.push(`User ${d.name} already exists`);
            }

            if (user) {
                userIds[d.email] = user.id;
                // Ensure profile exists and is updated
                await supabase.from('profiles').upsert({
                    id: user.id,
                    full_name: d.name,
                    username: d.name.toLowerCase().replace(' ', '_'),
                    bio: d.bio,
                    updated_at: new Date()
                });
            }
        }

        // 2. Create Challenges
        const challenges = [
            {
                creator_email: 'sarah.squats@example.com',
                name: '🍑 Squattober 1000',
                description: 'Can you hit 1000 squats in 30 days? High volume leg building challenge. Any variation counts!',
                challenge_type: 'total_reps',
                target_exercise: 'Squat',
                goal_value: 1000,
                duration: 30
            },
            {
                creator_email: 'mike.calisthenics@example.com',
                name: '💪 Push Up Pro',
                description: '500 Pushups in 30 days. Build that chest and tricep definition.',
                challenge_type: 'total_reps',
                target_exercise: 'Pushups',
                goal_value: 500,
                duration: 30
            },
            {
                creator_email: 'davina.daily@example.com',
                name: '🔥 The Daily 30',
                description: 'Streak Challenge: Log a workout 30 days in a row. No days off!',
                challenge_type: 'streak',
                goal_value: 30,
                duration: 30
            }
        ];

        for (const c of challenges) {
            const creatorId = userIds[c.creator_email];
            if (!creatorId) continue;

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
                        creator_id: creatorId,
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

            // 3. Make creators participants
            if (challengeId) {
                await supabase.from('challenge_participants').upsert({
                    challenge_id: challengeId,
                    user_id: creatorId,
                    status: 'active'
                });
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
