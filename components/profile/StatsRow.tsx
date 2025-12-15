import React from 'react';
import { Flame, Dumbbell, Trophy } from 'lucide-react';
import { Profile } from '../../types';

interface StatsRowProps {
    profile: Profile | null;
}

const StatsRow: React.FC<StatsRowProps> = ({ profile }) => {
    const stats = [
        {
            label: 'Workouts',
            value: profile?.total_workouts || 0,
            icon: Dumbbell,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            label: 'Total Reps',
            value: (profile?.total_reps || 0).toLocaleString(),
            icon: Flame,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10'
        },
        {
            label: 'League',
            value: profile?.tier || 'Bronze',
            icon: Trophy,
            color: 'text-yellow-500',
            bg: 'bg-yellow-500/10'
        }
    ];

    return (
        <div className="px-4 pb-6">
            <div className="grid grid-cols-3 gap-3">
                {stats.map((stat, i) => (
                    <div key={i} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                        <div className={`p-2 rounded-full mb-2 ${stat.bg} ${stat.color}`}>
                            <stat.icon size={18} />
                        </div>
                        <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                            {stat.value}
                        </span>
                        <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {stat.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StatsRow;
