import React from 'react';
import { WorkoutSession } from '../../types';

interface ActivityHeatmapProps {
    history: WorkoutSession[];
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ history }) => {
    // Generate last 365 days (52 weeks x 7 days = ~364)
    // We want to display a grid of blocks.

    // 1. Map dates to a Set for O(1) lookup
    const workoutDates = new Set(history.map(h => new Date(h.date).toDateString()));

    // 2. Generate Grid
    const weeks = 20; // Show last 20 weeks for mobile friendliness
    const days = 7;
    const grid = [];

    const today = new Date();
    // Start from (weeks * days) days ago
    for (let w = 0; w < weeks; w++) {
        const weekData = [];
        for (let d = 0; d < days; d++) {
            const date = new Date(today);
            // Calculate date: Today - (Total days - current index)
            // Reverse order: column 0 is oldest, column N is newest
            const daysAgo = (weeks - 1 - w) * 7 + (6 - d);
            date.setDate(today.getDate() - daysAgo);

            weekData.push({
                date: date,
                active: workoutDates.has(date.toDateString())
            });
        }
        grid.push(weekData);
    }

    return (
        <div className="px-4 mb-8">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Consistency (Last 5 Months)
            </h3>
            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                {grid.map((week, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        {week.map((day, j) => (
                            <div
                                key={j}
                                title={day.date.toDateString()}
                                className={`w-3 h-3 rounded-sm ${day.active
                                        ? 'bg-emerald-500'
                                        : 'bg-gray-100 dark:bg-gray-800'
                                    }`}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ActivityHeatmap;
