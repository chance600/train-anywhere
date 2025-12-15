
import React, { useState } from 'react';
import { Sparkles, Calendar, ChevronRight, CheckCircle, Play } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { WorkoutPlan } from '../types';
import { useToast } from './Toast';

const PlanView: React.FC = () => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [plan, setPlan] = useState<WorkoutPlan | null>(null);
    const [preferences, setPreferences] = useState({
        goal: 'Muscle Gain',
        daysPerWeek: 4,
        equipment: 'Full Gym',
        experience: 'Intermediate'
    });

    const generatePlan = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                showToast("Please log in to generate a plan.", "error");
                return;
            }

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-plan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(preferences)
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setPlan(data);
        } catch (error) {
            console.error('Error generating plan:', error);
            showToast('Failed to generate plan. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const savePlan = async () => {
        if (!plan) return;
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                showToast("Please log in to save a plan.", "error");
                return;
            }

            // 1. Archive existing active plans
            await supabase
                .from('workout_plans')
                .update({ status: 'archived' })
                .eq('user_id', session.user.id)
                .eq('status', 'active');

            // 2. Insert new plan
            const { error } = await supabase.from('workout_plans').insert({
                user_id: session.user.id,
                name: plan.name,
                description: plan.description,
                schedule: plan.schedule,
                status: 'active'
            });

            if (error) throw error;

            showToast("Plan activated! Check your Dashboard.", "success");
            setPlan(null); // Reset view
        } catch (error) {
            console.error('Error saving plan:', error);
            showToast('Failed to save plan.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (plan) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 min-h-[400px]">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{plan.description}</p>
                    </div>
                    <button onClick={() => setPlan(null)} className="text-sm text-gray-500 hover:underline">New Plan</button>
                </div>

                <div className="space-y-6">
                    {plan.schedule.weeks.map((week) => (
                        <div key={week.week_order} className="border-l-2 border-emerald-500 pl-4">
                            <h3 className="font-bold text-emerald-600 dark:text-emerald-400 mb-3 text-sm uppercase tracking-wider">Week {week.week_order}</h3>
                            <div className="space-y-4">
                                {week.days.map((day, idx) => (
                                    <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-gray-900 dark:text-gray-100">{day.day}</h4>
                                            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">{day.focus}</span>
                                        </div>
                                        <div className="space-y-2">
                                            {day.exercises.map((ex, i) => (
                                                <div key={i} className="flex justify-between text-sm">
                                                    <span className="text-gray-700 dark:text-gray-300">{ex.name}</span>
                                                    <span className="text-gray-500 font-mono text-xs">{ex.sets} x {ex.reps}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button
                        onClick={savePlan}
                        disabled={loading}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <CheckCircle size={20} />}
                        Save & Activate Plan
                    </button>
                    <p className="text-xs text-center text-gray-400 mt-2">This will archive any current active plan.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 min-h-[400px] flex flex-col justify-center">
            <div className="text-center mb-8">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                    <Sparkles className="text-white" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">AI Coach Planner</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    Generate a personalized, periodized training plan customized to your goals and equipment.
                </p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto w-full">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Goal</label>
                    <select
                        value={preferences.goal}
                        onChange={(e) => setPreferences({ ...preferences, goal: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option>Muscle Gain</option>
                        <option>Fat Loss</option>
                        <option>Strength</option>
                        <option>Endurance</option>
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Days/Week</label>
                        <select
                            value={preferences.daysPerWeek}
                            onChange={(e) => setPreferences({ ...preferences, daysPerWeek: parseInt(e.target.value) })}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value={2}>2 Days</option>
                            <option value={3}>3 Days</option>
                            <option value={4}>4 Days</option>
                            <option value={5}>5 Days</option>
                            <option value={6}>6 Days</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Experience</label>
                        <select
                            value={preferences.experience}
                            onChange={(e) => setPreferences({ ...preferences, experience: e.target.value })}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option>Beginner</option>
                            <option>Intermediate</option>
                            <option>Advanced</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={generatePlan}
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Generating Plan...
                        </>
                    ) : (
                        <>Generate Program <ChevronRight size={18} /></>
                    )}
                </button>
            </div>
        </div>
    );
};

export default PlanView;
