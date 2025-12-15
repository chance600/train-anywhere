import React, { useMemo } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import { WorkoutSession } from '../../types';

interface PersonalRecordsProps {
    history: WorkoutSession[];
}

const PersonalRecords: React.FC<PersonalRecordsProps> = ({ history }) => {

    // Calculate PRs
    const prs = useMemo(() => {
        const bests: Record<string, { weight: number, date: string, reps: number }> = {};

        history.forEach(session => {
            // Simple normalization (lowercase, trim)
            const name = session.exercise.toLowerCase().trim();
            // Skip bodyweight or 0 weight for PRs mostly, unless purely reps? 
            // Let's assume weight > 0 is interesting, or high reps.
            // For now, track Max Weight.

            const currentWeight = session.weight || 0;

            if (!bests[name] || currentWeight > bests[name].weight) {
                bests[name] = {
                    weight: currentWeight,
                    date: session.date,
                    reps: session.reps
                };
            }
        });

        // Convert to array and take top 4 most impressive (highest weight?)
        return Object.entries(bests)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 4); // Top 4
    }, [history]);

    if (prs.length === 0) return null;

    return (
        <div className="px-4 mb-8">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Trophy size={14} className="text-yellow-500" /> Personal Records
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {prs.map((pr) => (
                    <div key={pr.name} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Trophy size={32} />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold truncate">
                            {pr.name}
                        </p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                            {pr.weight} <span className="text-xs font-normal text-gray-400">lbs</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(pr.date).toLocaleDateString()} • {pr.reps} reps
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PersonalRecords;
