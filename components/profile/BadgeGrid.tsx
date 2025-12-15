import React from 'react';
import { Award } from 'lucide-react';

interface BadgeGridProps {
    badges: any[];
}

const BADGE_MAP: Record<string, { icon: string, name: string, desc: string }> = {
    'First Step': { icon: '👟', name: 'First Step', desc: 'Complete your first workout' },
    'High Five': { icon: '✋', name: 'High Five', desc: 'Complete 5 workouts' },
    'Centurion': { icon: '💯', name: 'Centurion', desc: 'Accumulate 100 reps' },
    'Kilo': { icon: '🏋️', name: 'Kilo Club', desc: 'Accumulate 1000 reps' },
    'Perfectionist': { icon: '✨', name: 'Perfectionist', desc: 'Score 100 on a set' },
    'Iron Will': { icon: '🦾', name: 'Iron Will', desc: '7 Day Streak' },
    'Early Bird': { icon: '🌅', name: 'Early Bird', desc: 'Workout before 8am' },
    'Night Owl': { icon: '🦉', name: 'Night Owl', desc: 'Workout after 8pm' }
};

const BadgeGrid: React.FC<BadgeGridProps> = ({ badges }) => {
    if (!badges || badges.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 m-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4 grayscale opacity-50">
                    <span className="text-4xl">🏆</span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No badges earned yet.</p>
                <p className="text-xs text-gray-400">Keep training to unlock achievements!</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 pb-20">
            {badges.map((b) => {
                const info = BADGE_MAP[b.badge_type] || { icon: '❓', name: b.badge_type, desc: 'Mystery Badge' };
                return (
                    <div key={b.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center shadow-sm animate-in zoom-in duration-300 hover:scale-105 transition-transform">
                        <div className="text-4xl mb-2 filter drop-shadow-sm">{info.icon}</div>
                        <div className="font-bold text-gray-900 dark:text-white text-sm">{info.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{info.desc}</div>
                    </div>
                );
            })}
        </div>
    );
};

export default BadgeGrid;
