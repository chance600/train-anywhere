import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { WorkoutSession } from '../../types';

interface ExerciseProgressChartProps {
    exerciseName: string;
    history: WorkoutSession[];
}

const ExerciseProgressChart: React.FC<ExerciseProgressChartProps> = ({ exerciseName, history }) => {

    const data = React.useMemo(() => {
        // Filter history for this exercise
        const relevant = history.filter(h => h.exercise.toLowerCase() === exerciseName.toLowerCase());

        // Sort by date
        relevant.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Process: For each session, find the Max Weight (1RM estim) or Volume
        // Flattening: If a user did multiple sets, we usually want the "Best Set" for progress tracking on 1RM.
        return relevant.map(h => ({
            date: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            weight: h.weight || 0,
            reps: h.reps || 0,
            // Epley Formula for 1RM: w * (1 + r/30)
            orm: (h.weight || 0) * (1 + (h.reps || 0) / 30)
        }));

    }, [history, exerciseName]);

    if (data.length < 2) {
        return (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm italic border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                Not enough data yet. Log more {exerciseName}!
            </div>
        );
    }

    return (
        <div className="w-full h-64 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">{exerciseName} Progress (Est. 1RM)</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.3} />
                    <XAxis
                        dataKey="date"
                        stroke="#9CA3AF"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="#9CA3AF"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', color: '#fff', borderRadius: '8px', border: 'none' }}
                        itemStyle={{ color: '#fff' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="orm"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={{ fill: '#10B981', r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ExerciseProgressChart;
