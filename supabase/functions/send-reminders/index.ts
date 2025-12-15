// Send Reminders Edge Function
// Triggered by Supabase cron or external scheduler to send workout logging reminders

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Message templates by style
const MESSAGES = {
    friendly: {
        inactivity: (days: number) => `Hey! It's been ${days} days since your last workout. Did you train today? 💪`,
        plan: (focus: string) => `Today is ${focus} Day per your plan! Log your workout when you're done 📝`,
        daily: "How was training today? Log your workout to track progress 📊",
        streak: (days: number) => `🔥 ${days}-day streak! Log today's workout to keep it going!`
    },
    motivational: {
        inactivity: (days: number) => `${days} days of rest is enough - time to crush it! 🔥 Log your workout!`,
        plan: (focus: string) => `${focus} Day - let's dominate! Log when you're done 💥`,
        daily: "Champions log their workouts. Are you a champion? 🏆",
        streak: (days: number) => `UNSTOPPABLE! ${days} days strong! Don't break the chain! 🔥`
    },
    minimal: {
        inactivity: (days: number) => `Log workout (${days}d since last)`,
        plan: (focus: string) => `${focus} Day - ready to log?`,
        daily: "Log today's workout",
        streak: (days: number) => `${days}-day streak - log workout`
    }
}

interface NotificationPrefs {
    user_id: string
    enabled: boolean
    inactivity_reminders: boolean
    plan_reminders: boolean
    daily_log_reminders: boolean
    streak_reminders: boolean
    preferred_reminder_time: string
    timezone: string
    inactive_days_threshold: number
    dnd_start_time: string
    dnd_end_time: string
    quiet_days: string[]
    max_notifications_per_day: number
    min_hours_between_notifications: number
    last_notification_at: string | null
    notifications_today: number
    notification_style: 'friendly' | 'motivational' | 'minimal'
    push_subscription: any
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Service role for admin access
        )

        const now = new Date()
        const currentHour = now.getUTCHours()
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' })

        // Fetch users who should receive notifications
        const { data: prefs, error: prefsError } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('enabled', true)
            .not('push_subscription', 'is', null)

        if (prefsError) {
            throw new Error(`Failed to fetch preferences: ${prefsError.message}`)
        }

        const results: { sent: number, skipped: number, errors: string[] } = { sent: 0, skipped: 0, errors: [] }

        for (const pref of (prefs || []) as NotificationPrefs[]) {
            try {
                // Check quiet days
                if (pref.quiet_days?.includes(currentDay)) {
                    results.skipped++
                    continue
                }

                // Check DND hours (simplified - just check UTC for now)
                // TODO: Proper timezone handling with user's timezone

                // Check rate limiting
                if (pref.notifications_today >= pref.max_notifications_per_day) {
                    results.skipped++
                    continue
                }

                // Check cooldown
                if (pref.last_notification_at) {
                    const lastNotif = new Date(pref.last_notification_at)
                    const hoursSince = (now.getTime() - lastNotif.getTime()) / (1000 * 60 * 60)
                    if (hoursSince < pref.min_hours_between_notifications) {
                        results.skipped++
                        continue
                    }
                }

                // Get user's last workout
                const { data: lastWorkout } = await supabase
                    .from('workouts')
                    .select('created_at')
                    .eq('user_id', pref.user_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                const messages = MESSAGES[pref.notification_style] || MESSAGES.friendly
                let message: string | null = null
                let reminderType: string | null = null

                // Determine which reminder to send
                if (lastWorkout && pref.inactivity_reminders) {
                    const lastWorkoutDate = new Date(lastWorkout.created_at)
                    const daysSince = Math.floor((now.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24))

                    if (daysSince >= pref.inactive_days_threshold) {
                        message = messages.inactivity(daysSince)
                        reminderType = 'inactivity'
                    }
                }

                // Check for active plan's today schedule
                if (!message && pref.plan_reminders) {
                    const { data: activePlan } = await supabase
                        .from('workout_plans')
                        .select('schedule')
                        .eq('user_id', pref.user_id)
                        .eq('status', 'active')
                        .limit(1)
                        .single()

                    if (activePlan?.schedule?.weeks) {
                        // Find today's workout (simplified - assumes sequential progression)
                        const todaySchedule = activePlan.schedule.weeks[0]?.days?.find(
                            (d: any) => d.day === currentDay
                        )
                        if (todaySchedule?.focus) {
                            message = messages.plan(todaySchedule.focus)
                            reminderType = 'plan'
                        }
                    }
                }

                // Daily log reminder (if it's the user's preferred time)
                if (!message && pref.daily_log_reminders) {
                    // Check if current hour matches preferred time (simplified)
                    const prefHour = parseInt(pref.preferred_reminder_time?.split(':')[0] || '20')
                    if (currentHour === prefHour) {
                        // Only send if no workout logged today
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                        const { count } = await supabase
                            .from('workouts')
                            .select('*', { count: 'exact', head: true })
                            .eq('user_id', pref.user_id)
                            .gte('created_at', todayStart.toISOString())

                        if ((count || 0) === 0) {
                            message = messages.daily
                            reminderType = 'daily'
                        }
                    }
                }

                if (message && pref.push_subscription) {
                    // TODO: Implement actual Web Push sending
                    // This requires VAPID keys and web-push library
                    // For now, just log and update counters

                    console.log(`Would send to ${pref.user_id}: ${message}`)

                    // Update notification counters
                    await supabase
                        .from('notification_preferences')
                        .update({
                            last_notification_at: now.toISOString(),
                            notifications_today: pref.notifications_today + 1
                        })
                        .eq('user_id', pref.user_id)

                    results.sent++
                } else {
                    results.skipped++
                }

            } catch (userError) {
                results.errors.push(`User ${pref.user_id}: ${userError}`)
            }
        }

        return new Response(JSON.stringify({
            success: true,
            timestamp: now.toISOString(),
            results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Send reminders error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
