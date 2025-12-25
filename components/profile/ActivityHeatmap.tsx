import React, { useMemo } from 'react';
import { WorkoutSession } from '../../types';

interface ActivityHeatmapProps {
    history: WorkoutSession[];
    days?: number;
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ history, days = 90 }) => {

    // Generate the last N days
    const calendar = useMemo(() => {
        const today = new Date();
        const dates: { date: string; count: number; intensity: number }[] = [];

        // Map history to a frequency map
        const activityMap: Record<string, number> = {};
        history.forEach(session => {
            const d = new Date(session.date).toISOString().split('T')[0];
            activityMap[d] = (activityMap[d] || 0) + 1;
        });

        for (let i = days; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const count = activityMap[dateStr] || 0;

            // Intensity: 0 (none), 1 (light), 2 (medium), 3 (high)
            let intensity = 0;
            if (count > 0) intensity = 1;
            if (count > 2) intensity = 2;
            if (count > 4) intensity = 3;

            dates.push({ date: dateStr, count, intensity });
        }
        return dates;
    }, [history, days]);

    // Color scales
    const getColor = (intensity: number) => {
        switch (intensity) {
            case 0: return 'bg-gray-100 dark:bg-gray-800';
            case 1: return 'bg-emerald-200 dark:bg-emerald-900/40';
            case 2: return 'bg-emerald-400 dark:bg-emerald-700';
            case 3: return 'bg-emerald-600 dark:bg-emerald-500';
            default: return 'bg-gray-100 dark:bg-gray-800';
        }
    };

    return (
        <div className="w-full overflow-x-auto pb-2">
            <div className="flex gap-1 min-w-max">
                {/* We render columns of 7 days (weeks)? Or just a linear strip? 
                    GitHub does 7 rows (days of week) x Weeks. 
                    Let's do a linear strip for mobile simplicity first, or a grid if we want desktop style.
                    Given "Train Anywhere" implies mobile, a linear "Streak Strip" is often better.
                    BUT user asked for "GitHub style". GitHub is a Grid.
                    Let's do a Grid: 7 rows (Sun-Sat), X columns.
                */}
                <div className="grid grid-rows-7 grid-flow-col gap-1">
                    {/* Render days. We need to align them by day of week. */}
                    {calendar.map((day, i) => (
                        <div
                            key={day.date}
                            className={`w-3 h-3 rounded-sm ${getColor(day.intensity)}`}
                            title={`${day.date}: ${day.count} workouts`}
                        />
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-2 text-[10px] text-gray-400">
                <span>Less</span>
                <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-sm bg-gray-100 dark:bg-gray-800" />
                    <div className="w-2 h-2 rounded-sm bg-emerald-200 dark:bg-emerald-900/40" />
                    <div className="w-2 h-2 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
                    <div className="w-2 h-2 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
                </div>
                <span>More</span>
            </div>
        </div>
    );
};

export default ActivityHeatmap;
