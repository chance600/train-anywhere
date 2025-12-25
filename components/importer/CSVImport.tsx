import React, { useState } from 'react';
import { Table, AlertCircle, FileText, Trash2, Check, Loader2 } from 'lucide-react';
import { ManualEntryData } from './ManualEntry';

interface CSVImportProps {
    onSave: (data: ManualEntryData[]) => Promise<void>;
}

const CSVImport: React.FC<CSVImportProps> = ({ onSave }) => {
    const [file, setFile] = useState<File | null>(null);
    const [entries, setEntries] = useState<ManualEntryData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const smartParse = (line: string, headers: string[]): Partial<ManualEntryData> | null => {
        const cols = line.split(',').map(s => s.trim().replace(/"/g, '')); // Handle quotes
        if (cols.length < 3) return null;

        // Strategy: Header Mapping (Case insensitive)
        const headerMap: Record<string, number> = {};
        headers.forEach((h, i) => headerMap[h.toLowerCase()] = i);

        // 1. STRONG App / HEVY / FITBOD Detection
        const getCol = (keys: string[]) => {
            for (const key of keys) {
                if (headerMap[key] !== undefined) return cols[headerMap[key]];
            }
            return null;
        };

        const dateStr = getCol(['date', 'start_time', 'start date', 'workout date']);
        const exerciseName = getCol(['exercise name', 'exercise_name', 'exercise', 'title']);
        const weightVal = getCol(['weight', 'weight (kg)', 'weight (lbs)']);
        const repsVal = getCol(['reps', 'reps_count']);

        if (!exerciseName) return null; // Mandatory

        // Date Parsing
        let cleanDate = new Date().toISOString();
        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) cleanDate = d.toISOString();
        }

        return {
            date: cleanDate, // Full ISO for DB
            exercise: exerciseName,
            sets: 1, // CSV lists sets as rows usually
            reps: parseInt(repsVal || '0') || 0,
            weight: parseFloat(weightVal || '0') || 0,
            created_at: cleanDate
        };
    };

    const processFile = async (file: File) => {
        setFile(file);
        setLoading(true);
        setError(null);
        try {
            const text = await file.text();
            const lines = text.split('\n');
            if (lines.length < 2) throw new Error("File is empty or missing headers");

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const newEntries: ManualEntryData[] = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                // Handle empty lines or purely comma lines
                if (!line || line.replace(/,/g, '').trim() === '') continue;

                const parsed = smartParse(line, headers);
                if (parsed && parsed.exercise) {
                    newEntries.push(parsed as ManualEntryData);
                }
            }

            if (newEntries.length === 0) throw new Error("No valid workouts found. Check headers (Date, Exercise, Weight, Reps).");
            setEntries(newEntries);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'CSV Import Failed');
            setFile(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 rounded-lg text-sm">
                <p className="font-bold">📊 CSV Import (Smart Mode)</p>
                <p className="mt-1">Auto-detects Strong, Hevy, and Fitbod formats. Just drag & drop!</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {!file ? (
                <div
                    className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${dragActive
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-300 dark:border-gray-700 hover:border-emerald-400'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        id="csv-upload"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                        accept=".csv,text/csv"
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                            {loading ? <Loader2 className="animate-spin" /> : <Table className="w-8 h-8" />}
                        </div>
                        <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                            {loading ? 'Processing...' : 'Upload CSV File'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Max 5MB</p>
                    </label>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <FileText size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">{file.name}</p>
                                <p className="text-sm text-gray-500">{entries.length} workouts detected</p>
                            </div>
                        </div>
                        <button onClick={() => { setFile(null); setEntries([]); }} className="text-gray-500 hover:text-red-500"><Trash2 size={20} /></button>
                    </div>

                    <div className="max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg mb-6">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                <tr>
                                    <th className="p-2">Date</th>
                                    <th className="p-2">Exercise</th>
                                    <th className="p-2">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {entries.slice(0, 50).map((e, i) => ( // Limit preview for perf
                                    <tr key={i}>
                                        <td className="p-2 text-gray-500">{new Date(e.date).toLocaleDateString()}</td>
                                        <td className="p-2 font-medium text-gray-900 dark:text-white">{e.exercise}</td>
                                        <td className="p-2 text-gray-500">{e.sets} x {e.reps} @ {e.weight}kg</td>
                                    </tr>
                                ))}
                                {entries.length > 50 && (
                                    <tr>
                                        <td colSpan={3} className="p-2 text-center text-gray-500">...and {entries.length - 50} more</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end">
                        <button onClick={() => onSave(entries)} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                            <Check size={20} /> Import All
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CSVImport;
