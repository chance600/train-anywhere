import React from 'react';
import { Calendar, Dumbbell, Trophy, TrendingUp } from 'lucide-react';
import { WorkoutSession } from '../../types';

interface ActivityFeedProps {
    history: WorkoutSession[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ history }) => {
    if (!history || history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Dumbbell size={48} className="mb-4 opacity-20" />
                <p>No recent activity.</p>
                <p className="text-sm">Time to hit the gym!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 px-4 pb-20">
            {history.slice(0, 10).map((workout) => (
                <div key={workout.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <Dumbbell size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base">
                                    {workout.exercise}
                                </h4>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Calendar size={10} /> {new Date(workout.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        {workout.score && workout.score > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50">
                                <Trophy size={12} className="text-yellow-600 dark:text-yellow-500" />
                                <span className="text-xs font-bold text-yellow-700 dark:text-yellow-500">
                                    {workout.score}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Stats Grid for the Feed Item */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                            <span className="block text-xs text-gray-400 uppercase tracking-wider">Reps</span>
                            <span className="block text-lg font-bold text-gray-900 dark:text-white">{workout.reps}</span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                            <span className="block text-xs text-gray-400 uppercase tracking-wider">Weight</span>
                            <span className="block text-lg font-bold text-gray-900 dark:text-white">{workout.weight || 0} <span className="text-xs font-normal">lbs</span></span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                            <span className="block text-xs text-amber-500 uppercase tracking-wider">Tempo</span>
                            <span className="block text-lg font-bold text-amber-500">
                                {workout.avgRepDuration ? `${workout.avgRepDuration.toFixed(1)}s` : '--'}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ActivityFeed;
