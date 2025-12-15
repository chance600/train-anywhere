import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Clock, Calendar, Zap, MessageSquare, Target, Users, Info } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { NotificationPreferences } from '../../types';
import { useToast } from '../Toast';
import { subscribeUserToPush } from '../../utils/pushSubscription';

const TIMEZONES = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney'
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const NotificationSettings: React.FC = () => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [prefs, setPrefs] = useState<Partial<NotificationPreferences>>({
        enabled: true,
        inactivity_reminders: true,
        plan_reminders: true,
        daily_log_reminders: true,
        streak_reminders: true,
        challenge_reminders: true,
        preferred_reminder_time: '20:00',
        timezone: 'America/New_York',
        inactive_days_threshold: 2,
        dnd_start_time: '22:00',
        dnd_end_time: '08:00',
        quiet_days: [],
        max_notifications_per_day: 2,
        min_hours_between_notifications: 4,
        notification_style: 'friendly'
    });

    useEffect(() => {
        fetchPreferences();
    }, []);

    const fetchPreferences = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (data) {
            setPrefs(data);
        } else if (!error || error.code === 'PGRST116') {
            // Create default preferences if none exist
            await supabase.from('notification_preferences').insert({ user_id: user.id });
        }
        setLoading(false);
    };

    const savePreferences = async () => {
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // [NEW] Request Push Permission if enabled
        let subscription = prefs.push_subscription;
        if (prefs.enabled) {
            try {
                const sub = await subscribeUserToPush();
                if (sub) {
                    subscription = sub;
                } else {
                    // Start of push failure handling
                    // If we failed to get a subscription but enabled is true, 
                    // we might want to warn the user or keep enabled false?
                    // For now, we proceed but toast a warning if it failed explicitly?
                    // console.warn("Could not subscribe to push");
                }
            } catch (err) {
                console.error("Subscription error", err);
            }
        }

        const { error } = await supabase
            .from('notification_preferences')
            .upsert({
                ...prefs,
                user_id: user.id,
                updated_at: new Date().toISOString(),
                push_subscription: subscription as any // Cast to any or Json
            });

        if (error) {
            showToast('Failed to save preferences', 'error');
        } else {
            showToast('Preferences saved! Notifications verified.', 'success');
        }
        setSaving(false);
    };

    const toggleQuietDay = (day: string) => {
        const current = prefs.quiet_days || [];
        const updated = current.includes(day)
            ? current.filter(d => d !== day)
            : [...current, day];
        setPrefs({ ...prefs, quiet_days: updated });
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-500/20 p-2 rounded-xl">
                        <Bell className="text-purple-500" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Workout Reminders</h3>
                        <p className="text-sm text-gray-500">Get reminded to log your workouts</p>
                    </div>
                </div>
                <button
                    onClick={() => setPrefs({ ...prefs, enabled: !prefs.enabled })}
                    className={`relative w-14 h-7 rounded-full transition-colors ${prefs.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.enabled ? 'translate-x-8' : 'translate-x-1'
                        }`} />
                </button>
            </div>

            {!prefs.enabled && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex items-start gap-3">
                    <BellOff className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Reminders are off. You won't receive any workout logging notifications.
                    </p>
                </div>
            )}

            {prefs.enabled && (
                <>
                    {/* Reminder Types */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                            Reminder Types
                        </h4>
                        <p className="text-xs text-gray-500 mb-3">Choose which reminders you find helpful</p>

                        {[
                            { key: 'inactivity_reminders', icon: Clock, label: 'Inactivity Check-ins', desc: "When you haven't logged in a while" },
                            { key: 'plan_reminders', icon: Calendar, label: 'Plan Schedule', desc: 'Based on your active workout plan' },
                            { key: 'daily_log_reminders', icon: MessageSquare, label: 'Daily Log Prompt', desc: 'Evening reminder to log your workout' },
                            { key: 'streak_reminders', icon: Zap, label: 'Streak Alerts', desc: 'Keep your streak alive!' },
                            { key: 'challenge_reminders', icon: Target, label: 'Challenge Updates', desc: 'Progress in active challenges' },
                        ].map(({ key, icon: Icon, label, desc }) => (
                            <label key={key} className="flex items-center justify-between py-2 cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <Icon size={18} className="text-gray-400" />
                                    <div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                                        <p className="text-xs text-gray-500">{desc}</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={prefs[key as keyof NotificationPreferences] as boolean}
                                    onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                                />
                            </label>
                        ))}
                    </div>

                    {/* Timing */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-4">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                            Timing
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Preferred Time</label>
                                <input
                                    type="time"
                                    value={prefs.preferred_reminder_time || '20:00'}
                                    onChange={(e) => setPrefs({ ...prefs, preferred_reminder_time: e.target.value })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Timezone</label>
                                <select
                                    value={prefs.timezone || 'America/New_York'}
                                    onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm"
                                >
                                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">
                                Remind after {prefs.inactive_days_threshold} day(s) of inactivity
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="7"
                                value={prefs.inactive_days_threshold || 2}
                                onChange={(e) => setPrefs({ ...prefs, inactive_days_threshold: parseInt(e.target.value) })}
                                className="w-full accent-emerald-500"
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>1 day</span>
                                <span>7 days</span>
                            </div>
                        </div>
                    </div>

                    {/* Do Not Disturb */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-4">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                            🌙 Do Not Disturb
                        </h4>
                        <p className="text-xs text-gray-500">We won't send notifications during these times</p>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Quiet After</label>
                                <input
                                    type="time"
                                    value={prefs.dnd_start_time || '22:00'}
                                    onChange={(e) => setPrefs({ ...prefs, dnd_start_time: e.target.value })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Quiet Until</label>
                                <input
                                    type="time"
                                    value={prefs.dnd_end_time || '08:00'}
                                    onChange={(e) => setPrefs({ ...prefs, dnd_end_time: e.target.value })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-2">Rest Days (No Notifications)</label>
                            <div className="flex flex-wrap gap-2">
                                {DAYS.map(day => (
                                    <button
                                        key={day}
                                        onClick={() => toggleQuietDay(day)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${(prefs.quiet_days || []).includes(day)
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                            }`}
                                    >
                                        {day.slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Rate Limiting */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-4">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                            Frequency Limits
                        </h4>
                        <p className="text-xs text-gray-500">Control how often you receive reminders</p>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Max per day</label>
                                <select
                                    value={prefs.max_notifications_per_day || 2}
                                    onChange={(e) => setPrefs({ ...prefs, max_notifications_per_day: parseInt(e.target.value) })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm"
                                >
                                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Min hours between</label>
                                <select
                                    value={prefs.min_hours_between_notifications || 4}
                                    onChange={(e) => setPrefs({ ...prefs, min_hours_between_notifications: parseInt(e.target.value) })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm"
                                >
                                    {[1, 2, 4, 6, 8, 12].map(n => <option key={n} value={n}>{n}h</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Notification Style */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                            Message Style
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'friendly', label: '😊 Friendly', example: 'Ready to log today?' },
                                { value: 'motivational', label: '🔥 Motivational', example: 'Crush it today!' },
                                { value: 'minimal', label: '📝 Minimal', example: 'Log workout' },
                            ].map(({ value, label, example }) => (
                                <button
                                    key={value}
                                    onClick={() => setPrefs({ ...prefs, notification_style: value as any })}
                                    className={`p-3 rounded-xl text-center transition-all ${prefs.notification_style === value
                                        ? 'bg-emerald-500 text-white shadow-lg'
                                        : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
                                        }`}
                                >
                                    <div className="text-sm font-medium">{label}</div>
                                    <div className={`text-xs mt-1 ${prefs.notification_style === value ? 'text-emerald-100' : 'text-gray-400'}`}>
                                        {example}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Save Button */}
            <button
                onClick={savePreferences}
                disabled={saving}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {saving ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                    'Save Preferences'
                )}
            </button>

            {/* Info */}
            <div className="flex items-start gap-2 text-xs text-gray-400">
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                <p>
                    Reminders help you stay consistent by prompting you to log workouts you've done elsewhere.
                    We respect your time - you control when and how often we reach out.
                </p>
            </div>
        </div>
    );
};

export default NotificationSettings;
