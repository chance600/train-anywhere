
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
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 min-h-[400px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                <div className="relative z-10 flex justify-between items-start mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
                                Active Plan
                            </span>
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">{plan.name}</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">{plan.description}</p>
                    </div>
                    <button onClick={() => setPlan(null)} className="text-sm font-medium text-gray-500 hover:text-emerald-500 transition-colors">Start Over</button>
                </div>

                <div className="space-y-8 relative z-10">
                    {plan.schedule.weeks.map((week) => (
                        <div key={week.week_order} className="relative pl-6 border-l-2 border-dashed border-gray-200 dark:border-gray-800 last:border-0">
                            <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-gray-900 flex items-center justify-center">
                                <span className="w-2 h-2 rounded-full bg-white"></span>
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-md">Week {week.week_order}</h3>
                            <div className="grid gap-3">
                                {week.days.map((day, idx) => (
                                    <div key={idx} className="group bg-gray-50/50 dark:bg-gray-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 transition-all hover:scale-[1.01]">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-gray-900 dark:text-gray-100">{day.day}</h4>
                                            <span className="text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-600 shadow-sm font-medium">{day.focus}</span>
                                        </div>
                                        <div className="space-y-2">
                                            {day.exercises.map((ex, i) => (
                                                <div key={i} className="flex justify-between text-sm items-center">
                                                    <span className="text-gray-700 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">{ex.name}</span>
                                                    <span className="text-gray-400 dark:text-gray-500 font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{ex.sets}x{ex.reps}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 relative z-10">
                    <button
                        onClick={savePlan}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
                    >
                        {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <CheckCircle size={22} />}
                        Save & Activate Plan
                    </button>
                    <p className="text-xs text-center text-gray-400 mt-3">This will archive any current active plan.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-200 dark:border-gray-800 min-h-[500px] flex flex-col justify-center relative overflow-hidden shadow-2xl">
            {/* Ambient Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

            <div className="relative z-10 text-center mb-10">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/30 rotate-3 transform transition-transform hover:rotate-6">
                    <Sparkles className="text-white drop-shadow-md" size={40} />
                </div>
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 mb-3 tracking-tight">AI Coach Planner</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto text-lg leading-relaxed">
                    Build a pro-level program tailored to your unique goals and gear.
                </p>
            </div>

            <div className="space-y-6 max-w-sm mx-auto w-full relative z-10">
                <div className="group">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Goal</label>
                    <div className="relative">
                        <select
                            value={preferences.goal}
                            onChange={(e) => setPreferences({ ...preferences, goal: e.target.value })}
                            className="w-full bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-transparent hover:border-indigo-500/30 dark:hover:border-indigo-500/30 focus:border-indigo-500 rounded-2xl p-4 text-base font-medium outline-none transition-all appearance-none cursor-pointer"
                        >
                            <option>Muscle Gain</option>
                            <option>Fat Loss</option>
                            <option>Strength</option>
                            <option>Endurance</option>
                        </select>
                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                            <ChevronRight className="rotate-90" size={16} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="group">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Frequency</label>
                        <div className="relative">
                            <select
                                value={preferences.daysPerWeek}
                                onChange={(e) => setPreferences({ ...preferences, daysPerWeek: parseInt(e.target.value) })}
                                className="w-full bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-transparent hover:border-indigo-500/30 dark:hover:border-indigo-500/30 focus:border-indigo-500 rounded-2xl p-4 text-base font-medium outline-none transition-all appearance-none cursor-pointer"
                            >
                                <option value={2}>2 Days</option>
                                <option value={3}>3 Days</option>
                                <option value={4}>4 Days</option>
                                <option value={5}>5 Days</option>
                                <option value={6}>6 Days</option>
                            </select>
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                                <ChevronRight className="rotate-90" size={16} />
                            </div>
                        </div>
                    </div>
                    <div className="group">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Level</label>
                        <div className="relative">
                            <select
                                value={preferences.experience}
                                onChange={(e) => setPreferences({ ...preferences, experience: e.target.value })}
                                className="w-full bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-transparent hover:border-indigo-500/30 dark:hover:border-indigo-500/30 focus:border-indigo-500 rounded-2xl p-4 text-base font-medium outline-none transition-all appearance-none cursor-pointer"
                            >
                                <option>Beginner</option>
                                <option>Intermediate</option>
                                <option>Advanced</option>
                            </select>
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                                <ChevronRight className="rotate-90" size={16} />
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={generatePlan}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed group-hover:shadow-2xl"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span className="animate-pulse">Designing Program...</span>
                        </>
                    ) : (
                        <>Generate Program <ChevronRight size={20} /></>
                    )}
                </button>
            </div>
        </div>
    );
};

export default PlanView;
