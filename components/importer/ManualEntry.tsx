import React, { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';

export interface ManualEntryData {
    date: string;
    exercise: string;
    sets: number;
    reps: number;
    weight: number;
    created_at?: string; // [NEW] Full timestamp for DB
}

interface ManualEntryProps {
    onSave: (data: ManualEntryData[]) => Promise<void>;
}

const ManualEntry: React.FC<ManualEntryProps> = ({ onSave }) => {
    const [entries, setEntries] = useState<ManualEntryData[]>([
        { date: new Date().toISOString().split('T')[0], exercise: '', sets: 3, reps: 10, weight: 0 }
    ]);

    const addRow = () => {
        setEntries([...entries, { date: new Date().toISOString().split('T')[0], exercise: '', sets: 3, reps: 10, weight: 0 }]);
    };

    const updateRow = (index: number, field: keyof ManualEntryData, value: any) => {
        const newEntries = [...entries];
        // @ts-ignore - dynamic key access
        newEntries[index] = { ...newEntries[index], [field]: value };
        setEntries(newEntries);
    };

    const removeRow = (index: number) => {
        setEntries(entries.filter((_, i) => i !== index));
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 rounded-lg text-sm">
                <p className="font-bold">✍️ Manual Entry</p>
                <p className="mt-1">Log past workouts one by one. Best for copying from a notebook.</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                            <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Exercise</th>
                                <th className="p-3 w-20">Sets</th>
                                <th className="p-3 w-20">Reps</th>
                                <th className="p-3 w-24">Weight (kg)</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {entries.map((entry, i) => (
                                <tr key={i} className="bg-white dark:bg-gray-900/50">
                                    <td className="p-2">
                                        <input type="date" value={entry.date} onChange={(e) => updateRow(i, 'date', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white" />
                                    </td>
                                    <td className="p-2">
                                        <input type="text" placeholder="e.g. Bench Press" value={entry.exercise} onChange={(e) => updateRow(i, 'exercise', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white" />
                                    </td>
                                    <td className="p-2">
                                        <input type="number" value={entry.sets} onChange={(e) => updateRow(i, 'sets', parseInt(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white" />
                                    </td>
                                    <td className="p-2">
                                        <input type="number" value={entry.reps} onChange={(e) => updateRow(i, 'reps', parseInt(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white" />
                                    </td>
                                    <td className="p-2">
                                        <input type="number" value={entry.weight} onChange={(e) => updateRow(i, 'weight', parseFloat(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white" />
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={addRow} className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
                        <Plus size={16} /> Add Exercise
                    </button>
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button onClick={() => onSave(entries)} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                    <Check size={20} /> Save Workouts
                </button>
            </div>
        </div>
    );
};

export default ManualEntry;
