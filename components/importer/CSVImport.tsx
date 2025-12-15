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

    const processFile = async (file: File) => {
        setFile(file);
        setLoading(true);
        setError(null);
        try {
            const text = await file.text();
            const lines = text.split('\n');
            const newEntries: ManualEntryData[] = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const [date, exercise, sets, reps, weight] = line.split(',').map(s => s.trim());
                if (exercise) {
                    newEntries.push({
                        date: date || new Date().toISOString().split('T')[0],
                        exercise,
                        sets: parseInt(sets) || 1,
                        reps: parseInt(reps) || 0,
                        weight: parseFloat(weight) || 0
                    });
                }
            }
            if (newEntries.length === 0) throw new Error("No valid workouts found in CSV.");
            setEntries(newEntries);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'CSV Error');
            setFile(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 rounded-lg text-sm">
                <p className="font-bold">📊 CSV Import</p>
                <p className="mt-1">Bulk upload workouts from other apps like Apple Health, Strong, or Hevy.</p>
            </div>

            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg text-sm">
                <p className="font-bold flex items-center gap-2"><AlertCircle size={16} /> CSV Format Required</p>
                <p className="mt-1">Order: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">Date, Exercise, Sets, Reps, Weight</code></p>
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
                                <p className="text-sm text-gray-500">{entries.length} workouts</p>
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
                                {entries.map((e, i) => (
                                    <tr key={i}>
                                        <td className="p-2 text-gray-500">{e.date}</td>
                                        <td className="p-2 font-medium text-gray-900 dark:text-white">{e.exercise}</td>
                                        <td className="p-2 text-gray-500">{e.sets} x {e.reps} @ {e.weight}kg</td>
                                    </tr>
                                ))}
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
