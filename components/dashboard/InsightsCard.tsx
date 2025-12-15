import React, { useMemo } from 'react';
import { WorkoutSession } from '../../types';
import { TrendingUp, TrendingDown, Minus, Award, Target, Calendar, Zap } from 'lucide-react';

interface InsightsCardProps {
    history: WorkoutSession[];
}

const InsightsCard: React.FC<InsightsCardProps> = ({ history }) => {
    const insights = useMemo(() => {
        if (history.length === 0) {
            return null;
        }

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        // This week's workouts
        const thisWeek = history.filter(w => new Date(w.date) >= oneWeekAgo);
        const lastWeek = history.filter(w => {
            const d = new Date(w.date);
            return d >= twoWeeksAgo && d < oneWeekAgo;
        });

        // Volume calculations
        const thisWeekVolume = thisWeek.reduce((sum, w) => sum + (w.reps * w.weight), 0);
        const lastWeekVolume = lastWeek.reduce((sum, w) => sum + (w.reps * w.weight), 0);
        const volumeChange = lastWeekVolume > 0
            ? Math.round(((thisWeekVolume - lastWeekVolume) / lastWeekVolume) * 100)
            : thisWeekVolume > 0 ? 100 : 0;

        // Personal records
        const allTimeMaxVolume = Math.max(...history.map(w => w.reps * w.weight));
        const recentPR = thisWeek.some(w => w.reps * w.weight === allTimeMaxVolume);

        // Workout consistency (days worked out this week)
        const uniqueDaysThisWeek = new Set(thisWeek.map(w => new Date(w.date).toDateString())).size;

        // Most trained exercise
        const exerciseCounts: Record<string, number> = {};
        history.forEach(w => {
            exerciseCounts[w.exercise] = (exerciseCounts[w.exercise] || 0) + 1;
        });
        const topExercise = Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1])[0];

        // Total stats
        const totalReps = history.reduce((sum, w) => sum + w.reps, 0);
        const totalWorkouts = history.length;

        return {
            thisWeekVolume,
            lastWeekVolume,
            volumeChange,
            recentPR,
            uniqueDaysThisWeek,
            topExercise: topExercise?.[0] || 'N/A',
            topExerciseCount: topExercise?.[1] || 0,
            totalReps,
            totalWorkouts,
            allTimeMaxVolume
        };
    }, [history]);

    if (!insights) {
        return (
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">📊 Insights</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Complete some workouts to see your insights!</p>
            </div>
        );
    }

    const getTrendIcon = (change: number) => {
        if (change > 5) return <TrendingUp size={16} className="text-green-500" />;
        if (change < -5) return <TrendingDown size={16} className="text-red-500" />;
        return <Minus size={16} className="text-gray-400" />;
    };

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-5 border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    📊 Weekly Insights
                </h3>
                {insights.recentPR && (
                    <span className="flex items-center gap-1 text-xs font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                        <Award size={12} /> New PR!
                    </span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Volume Trend */}
                <div className="bg-white dark:bg-gray-800/50 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                        <Zap size={12} />
                        Weekly Volume
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {insights.thisWeekVolume.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400">kg</span>
                        {getTrendIcon(insights.volumeChange)}
                        <span className={`text-xs ${insights.volumeChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {insights.volumeChange > 0 ? '+' : ''}{insights.volumeChange}%
                        </span>
                    </div>
                </div>

                {/* Training Days */}
                <div className="bg-white dark:bg-gray-800/50 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                        <Calendar size={12} />
                        This Week
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {insights.uniqueDaysThisWeek}
                        </span>
                        <span className="text-xs text-gray-400">days trained</span>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1">
                    <Target size={12} />
                    Top: <span className="font-medium text-gray-700 dark:text-gray-300">{insights.topExercise}</span>
                </div>
                <div>
                    Total: <span className="font-medium text-gray-700 dark:text-gray-300">{insights.totalReps.toLocaleString()} reps</span>
                </div>
            </div>
        </div>
    );
};

export default InsightsCard;
