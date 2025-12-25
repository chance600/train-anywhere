import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { KeyManager } from '../services/keyManager';
import ManualEntry, { ManualEntryData } from './importer/ManualEntry';
import CSVImport from './importer/CSVImport';
import AIScan from './importer/AIScan';
import AppleHealthImport from './importer/AppleHealthImport';
import ExerciseLibrary from './importer/ExerciseLibrary';
import { useToast } from './Toast';

interface WorkoutImporterProps {
    onImportComplete: () => void;
    isPro?: boolean;
}

type ImportMode = 'ai' | 'manual' | 'csv' | 'library' | 'apple';

const WorkoutImporter: React.FC<WorkoutImporterProps> = ({ onImportComplete, isPro = false }) => {
    const { showToast } = useToast();
    const [mode, setMode] = useState<ImportMode>('manual');
    const [hasApiKey, setHasApiKey] = useState(false);

    useEffect(() => {
        setHasApiKey(KeyManager.hasKey());
    }, []);

    const handleSave = async (entries: ManualEntryData[]) => {
        if (!entries || entries.length === 0) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const newWorkouts = entries.map(ex => ({
                user_id: session?.user?.id,
                exercise: ex.exercise,
                reps: ex.reps * ex.sets,
                score: 0,
                duration_seconds: 0,
                // Ensure date string is ISO for Supabase
                created_at: ex.date.includes('T') ? ex.date : new Date(ex.date).toISOString()
            }));

            if (session) {
                const { error } = await supabase.from('workouts').insert(newWorkouts);
                if (error) throw error;
            } else {
                // Guest Logic
                const saved = localStorage.getItem('workout_history');
                const currentHistory = saved ? JSON.parse(saved) : [];

                const guestWorkouts = newWorkouts.map(w => ({
                    id: crypto.randomUUID(),
                    date: w.created_at,
                    exercise: w.exercise,
                    reps: w.reps,
                    weight: 0,
                    score: 0
                }));

                localStorage.setItem('workout_history', JSON.stringify([...currentHistory, ...guestWorkouts]));

                // Fire-and-forget Analytics Log (Bulk)
                const analyticsData = newWorkouts.map(w => ({
                    exercise: w.exercise,
                    reps: w.reps
                }));

                supabase.from('anonymous_workouts').insert(analyticsData).then(({ error }) => {
                    if (error) console.error('Analytics Log Error:', error);
                });
            }

            onImportComplete();
        } catch (err) {
            console.error('Failed to save workouts:', err);
            showToast('Failed to save workouts. Please try again.', 'error');
        }
    };

    return (
        <div className="h-full bg-white dark:bg-gray-900 p-6 overflow-y-auto transition-colors duration-300">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Import Workout</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
                Bring your workout history into the app using one of the methods below.
            </p>

            {/* Mode Tabs */}
            <div className="flex gap-2 mb-8 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-auto inline-flex overflow-x-auto">
                <button
                    onClick={() => setMode('manual')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${mode === 'manual' ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    Manual Entry <span className="ml-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 px-1.5 py-0.5 rounded-full">FREE</span>
                </button>
                <button
                    onClick={() => setMode('csv')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${mode === 'csv' ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    CSV Import <span className="ml-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 px-1.5 py-0.5 rounded-full">FREE</span>
                </button>
                <button
                    onClick={() => setMode('ai')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${mode === 'ai' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    AI Scan <span className="ml-1 text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-600 px-1.5 py-0.5 rounded-full">PRO</span>
                </button>
                <button
                    onClick={() => setMode('library')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${mode === 'library' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    Library <span className="ml-1 text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 px-1.5 py-0.5 rounded-full">NEW</span>
                </button>
                <button
                    onClick={() => setMode('apple')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${mode === 'apple' ? 'bg-white dark:bg-gray-700 shadow-sm text-rose-600 dark:text-rose-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    Apple Health <span className="ml-1 text-[10px] bg-rose-100 dark:bg-rose-900/40 text-rose-600 px-1.5 py-0.5 rounded-full">NEW</span>
                </button>
            </div>

            <div className="min-h-[400px]">
                {mode === 'manual' && <ManualEntry onSave={handleSave} />}
                {mode === 'csv' && <CSVImport onSave={handleSave} />}
                {mode === 'apple' && <AppleHealthImport onSave={handleSave} />}
                {mode === 'ai' && <AIScan onSave={handleSave} hasApiKey={hasApiKey} isPro={isPro} />}
                {mode === 'library' && <ExerciseLibrary />}
                {mode === 'apple' && <AppleHealthImport onSave={handleSave} />}
            </div>
        </div>
    );
};

export default WorkoutImporter;
