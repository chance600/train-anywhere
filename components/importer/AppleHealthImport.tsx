import React, { useState } from 'react';
import { Activity, AlertCircle, FileText, Check, Loader2, UploadCloud } from 'lucide-react';
import { ManualEntryData } from './ManualEntry';

interface AppleHealthImportProps {
    onSave: (data: ManualEntryData[]) => Promise<void>;
}

const AppleHealthImport: React.FC<AppleHealthImportProps> = ({ onSave }) => {
    const [file, setFile] = useState<File | null>(null);
    const [entries, setEntries] = useState<ManualEntryData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const processFile = async (file: File) => {
        setFile(file);
        setLoading(true);
        setError(null);
        setEntries([]);
        setProgress(0);

        const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
        const fileSize = file.size;
        let offset = 0;
        let leftover = '';
        const newEntries: ManualEntryData[] = [];

        // Regex triggers
        const workoutStart = /<Workout /;
        // We look for TraditionalStrengthTraining (HKWorkoutActivityTypeTraditionalStrengthTraining)
        // or FunctionalStrengthTraining
        // However, extracting data from XML stream with regex is fragile but memory efficient.
        // Given Apple Health export attributes are usually on the <Workout> tag itself:
        // workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="45" durationUnit="min" ... startDate="2023..."

        try {
            const reader = new FileReader();

            const readNextChunk = () => {
                const slice = file.slice(offset, offset + CHUNK_SIZE);
                reader.readAsText(slice);
            };

            reader.onload = (e) => {
                const chunk = (e.target?.result as string) || '';
                const text = leftover + chunk;

                // Process text for <Workout ... /> tags
                // We use a regex global match loop
                const workoutRegex = /<Workout\s+[^>]*workoutActivityType="HKWorkoutActivityType(Traditional|Functional)StrengthTraining"[^>]*>/g;
                let match;

                while ((match = workoutRegex.exec(text)) !== null) {
                    const tag = match[0];

                    // Extract Date
                    const dateMatch = /startDate="([^"]*)"/.exec(tag);
                    const durationMatch = /duration="([^"]*)"/.exec(tag); // Usually minutes
                    const caloriesMatch = /totalEnergyBurned="([^"]*)"/.exec(tag);

                    if (dateMatch) {
                        const date = dateMatch[1].replace(/ [+-]\d{4}$/, ''); // Strip timezone if needed, or keep ISO
                        const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;
                        const calories = caloriesMatch ? parseFloat(caloriesMatch[1]) : 0;

                        // Note: Apple Health Workouts are mostly "Sessions". We map them to a generic "Strength Session" exercise
                        // unless we dive deeper into <WorkoutEvent> or <Record>, which is too complex for this MVP stream.
                        // For now, we import the SESSION as a "Strength Training" entry with duration/cals.

                        newEntries.push({
                            date: new Date(date).toISOString(),
                            exercise: "Strength Training Session", // Generic placeholder
                            sets: 1,
                            reps: 1,
                            weight: 0, // No weight data in summary
                            score: Math.min(100, (duration / 60) * 10), // Mock score based on duration
                            created_at: new Date(date).toISOString()
                        });
                    }
                }

                // Handle boundary: keep the last part that might be cut off
                // Simply keeping the last 200 chars is risky if tag is huge, but <Workout> tags are usually self-contained attributes.
                // Better approach: regex finds complete tags.
                // We just need to ensure we don't cut a tag in half.
                // We search for the LAST '>' and keep everything after it as leftover.
                const lastTagEnd = text.lastIndexOf('>');
                if (lastTagEnd !== -1) {
                    leftover = text.substring(lastTagEnd + 1);
                } else {
                    leftover = text; // No tags found, keep all (pathological case)
                }

                offset += CHUNK_SIZE;
                setProgress(Math.min(100, Math.round((offset / fileSize) * 100)));

                if (offset < fileSize) {
                    readNextChunk(); // Continue
                } else {
                    // Done
                    if (newEntries.length === 0) {
                        setError("No Strength Training workouts found in this export.");
                    } else {
                        setEntries(newEntries);
                    }
                    setLoading(false);
                }
            };

            reader.onerror = () => {
                setError("Failed to read file.");
                setLoading(false);
            };

            readNextChunk(); // Start

        } catch (err) {
            setError("Parsing Error: " + (err instanceof Error ? err.message : String(err)));
            setLoading(false);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300 rounded-lg text-sm">
                <p className="font-bold">🍎 Apple Health Import</p>
                <p className="mt-1">
                    Upload your <b>export.xml</b> (inside the zip).
                    We extract "Strength Training" sessions to populate your consistency graph.
                </p>
                <p className="text-xs mt-2 opacity-80">Note: Apple Health usually only stores duration/calories, not per-set details.</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {!file ? (
                <label className="cursor-pointer block border-2 border-dashed border-rose-300 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20 rounded-2xl p-12 text-center transition-all">
                    <input
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                        accept=".xml"
                    />
                    <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 mx-auto text-rose-500 shadow-sm">
                        {loading ? <Loader2 className="animate-spin" /> : <Activity className="w-8 h-8" />}
                    </div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                        Select export.xml
                    </p>
                    <p className="text-sm text-gray-500">Max 500MB+ supported (Streaming Parse)</p>
                </label>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-400">
                                <FileText size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">{file.name}</p>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    {loading ? (
                                        <><span>Scanning... {progress}%</span> <Loader2 size={12} className="animate-spin" /></>
                                    ) : (
                                        <span>{entries.length} sessions found</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {!loading && entries.length > 0 && (
                        <div className="flex justify-end">
                            <button onClick={() => onSave(entries)} className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2">
                                <Check size={20} /> Import History
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AppleHealthImport;
