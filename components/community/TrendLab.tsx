
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Sparkles, Terminal, ArrowUpRight, Check, Trash2, Rocket, RefreshCw } from 'lucide-react';
import { useToast } from '../Toast';
import { Challenge } from '../../types';

interface Trend {
    id: string;
    title: string;
    description: string;
    category: string;
    viral_score: number;
    source_platform: string;
    status: 'discovered' | 'approved' | 'rejected' | 'active';
    suggested_duration_days: number;
    suggested_win_condition: string;
    created_at: string;
}

const TrendLab: React.FC = () => {
    const { showToast } = useToast();
    const [trends, setTrends] = useState<Trend[]>([]);
    const [loading, setLoading] = useState(true);
    const [scouting, setScouting] = useState(false);

    useEffect(() => {
        fetchTrends();
    }, []);

    const fetchTrends = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('trend_repository')
            .select('*')
            .order('viral_score', { ascending: false });

        if (data) setTrends(data);
        setLoading(false);
    };

    const scoutForTrends = async () => {
        setScouting(true);
        try {
            const { data, error } = await supabase.functions.invoke('discover-trends');
            if (error) throw error;

            if (data.success && data.discovered > 0) {
                showToast(`🤖 Discovered ${data.discovered} new viral trends!`, 'success');
                fetchTrends();
            } else {
                showToast('No new trends found right now.', 'neutral');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to scout trends.', 'error');
        } finally {
            setScouting(false);
        }
    };

    const deployTrend = async (trend: Trend) => {
        // 1. Convert Trend to Challenge
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (trend.suggested_duration_days || 30));

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const newChallenge = {
            creator_id: user.id,
            name: trend.title,
            description: trend.description + `\n\nWin Condition: ${trend.suggested_win_condition}`,
            challenge_type: 'total_workouts', // Default safest type
            goal_value: trend.suggested_duration_days, // e.g. 30 workouts in 30 days
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            is_public: true
        };

        const { error: insertError } = await supabase
            .from('challenges')
            .insert(newChallenge);

        if (insertError) {
            showToast('Failed to deploy challenge.', 'error');
            return;
        }

        // 2. Update Trend Status
        await supabase
            .from('trend_repository')
            .update({ status: 'active', deployed_at: new Date().toISOString() })
            .eq('id', trend.id);

        showToast(`🚀 Deployed "${trend.title}" to Community!`, 'success');
        fetchTrends(); // Refresh changes
    };

    const rejectTrend = async (id: string) => {
        await supabase.from('trend_repository').update({ status: 'rejected' }).eq('id', id);
        setTrends(trends.filter(t => t.id !== id));
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Trend Lab...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Terminal className="text-purple-500" /> Trend Discovery Engine
                    </h2>
                    <p className="text-sm text-gray-500">AI-powered scout for viral fitness challenges.</p>
                </div>
                <button
                    onClick={scoutForTrends}
                    disabled={scouting}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium transition-all ${scouting ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/30'
                        }`}
                >
                    {scouting ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    {scouting ? 'Scouting...' : 'Scout with AI'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trends.filter(t => t.status !== 'rejected').map(trend => (
                    <div key={trend.id} className={`bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 relative overflow-hidden group hover:shadow-xl transition-shadow ${trend.status === 'active' ? 'opacity-75' : ''}`}>
                        {/* Viral Score Badge */}
                        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/10 dark:bg-white/10 px-2 py-1 rounded-full text-xs font-bold">
                            <span className={trend.viral_score > 80 ? 'text-red-500' : 'text-yellow-500'}>
                                {trend.viral_score}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">/ 100</span>
                        </div>

                        <div className="mb-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-500 mb-1">
                                {trend.source_platform} • {trend.category}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                {trend.title}
                            </h3>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                            {trend.description}
                        </p>

                        <div className="text-xs text-gray-500 mb-4 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg">
                            <strong>Win Condition:</strong> {trend.suggested_win_condition}
                        </div>

                        {/* Actions */}
                        {trend.status !== 'active' ? (
                            <div className="flex gap-2 mt-auto">
                                <button
                                    onClick={() => deployTrend(trend)}
                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 transition-colors"
                                >
                                    <Rocket size={16} /> Deploy
                                </button>
                                <button
                                    onClick={() => rejectTrend(trend.id)}
                                    className="px-3 bg-gray-100 dark:bg-gray-700 hover:bg-red-100 hover:text-red-500 text-gray-500 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="h-10 flex items-center justify-center text-emerald-500 font-bold bg-emerald-500/10 rounded-lg text-sm">
                                <Check size={16} className="mr-1" /> Deployed
                            </div>
                        )}
                    </div>
                ))}

                {trends.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                        <Sparkles className="mx-auto mb-3 text-purple-300" size={48} />
                        <p>No trends discovered yet.</p>
                        <p className="text-sm">Click "Scout with AI" to find some!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrendLab;
