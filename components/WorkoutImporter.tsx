import React, { useState, useEffect } from 'react';
import { Upload, FileText, Check, AlertCircle, Loader2, Plus, Trash2, Table, ScanEye } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { parseWorkoutFiles, ParsedWorkout } from '../services/geminiParser';
// ... imports ...

// ... inside component ...



import { supabase } from '../services/supabaseClient';
import { KeyManager } from '../services/keyManager';

interface WorkoutImporterProps {
    onImportComplete: () => void;
    isPro?: boolean;
}

type ImportMode = 'ai' | 'manual' | 'csv';

interface ManualEntry {
    date: string;
    exercise: string;
    sets: number;
    reps: number;
    weight: number;
}

const WorkoutImporter: React.FC<WorkoutImporterProps> = ({ onImportComplete, isPro = false }) => {
    const { theme } = useTheme();
    const [mode, setMode] = useState<ImportMode>('manual'); // Default to manual
    const [dragActive, setDragActive] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<ParsedWorkout | null>(null);
    const [file, setFile] = useState<File | null>(null); // State for CSV file

    // API Key State
    const [hasApiKey, setHasApiKey] = useState(false);

    useEffect(() => {
        setHasApiKey(KeyManager.hasKey());
    }, []);

    // Manual Entry State
    const [manualEntries, setManualEntries] = useState<ManualEntry[]>([
        { date: new Date().toISOString().split('T')[0], exercise: '', sets: 3, reps: 10, weight: 0 }
    ]);

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
            handleFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(Array.from(e.target.files));
        }
    };

    const handleFiles = (newFiles: File[]) => {
        setError(null);
        if (mode === 'csv') {
            // CSV Logic remains single file for now
            if (newFiles.length > 0) {
                setFile(newFiles[0]);
                processCSV(newFiles[0]);
            }
        } else {
            // AI Mode - Append to assess
            const validFiles = newFiles.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
            if (validFiles.length !== newFiles.length) {
                setError('Some files were ignored (only Images/PDF supported).');
            }
            setFiles(prev => [...prev, ...validFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const processCSV = async (file: File) => {
        // ... existing CSV logic ...
        setLoading(true);
        try {
            const text = await file.text();
            // ... (keep csv parsing logic or move to helper if it gets too long)
            const lines = text.split('\n');
            const entries: ManualEntry[] = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const [date, exercise, sets, reps, weight] = line.split(',').map(s => s.trim());
                if (exercise) {
                    entries.push({
                        date: date || new Date().toISOString().split('T')[0],
                        exercise,
                        sets: parseInt(sets) || 1,
                        reps: parseInt(reps) || 0,
                        weight: parseFloat(weight) || 0
                    });
                }
            }
            setManualEntries(entries);
            if (entries.length === 0) throw new Error("No valid workouts found in CSV.");
        } catch (err) {
            setError(err instanceof Error ? err.message : 'CSV Error');
        } finally {
            setLoading(false);
        }
    };

    const analyzeFiles = async () => {
        if (files.length === 0) return;
        setLoading(true);
        setError(null);

        try {
            // Dynamic import to avoid circular dependency if any, or just direct
            const { parseWorkoutFiles } = await import('../services/geminiParser');
            const result = await parseWorkoutFiles(files);
            setParsedData(result);
            setFiles([]); // Clear staging after success
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (dataToSave?: ManualEntry[]) => {
        const entries = dataToSave || (mode === 'ai' && parsedData ? parsedData.exercises.map(ex => ({
            date: parsedData.date || new Date().toISOString(),
            exercise: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight
        })) : manualEntries);

        if (!entries || entries.length === 0) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const newWorkouts = entries.map(ex => ({
                user_id: session?.user?.id,
                exercise: ex.exercise,
                reps: ex.reps * ex.sets,
                score: 0,
                duration_seconds: 0,
                created_at: ex.date.includes('T') ? ex.date : new Date(ex.date).toISOString()
            }));

            if (session) {
                const { error } = await supabase.from('workouts').insert(newWorkouts);
                if (error) throw error;
            } else {
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
            setError('Failed to save workouts. Please try again.');
            console.error(err);
        }
    };

    const addManualRow = () => {
        setManualEntries([...manualEntries, { date: new Date().toISOString().split('T')[0], exercise: '', sets: 3, reps: 10, weight: 0 }]);
    };

    const updateManualRow = (index: number, field: keyof ManualEntry, value: any) => {
        const newEntries = [...manualEntries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        setManualEntries(newEntries);
    };

    const removeManualRow = (index: number) => {
        const newEntries = manualEntries.filter((_, i) => i !== index);
        setManualEntries(newEntries);
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
            </div>

            {/* Manual Mode */}
            {mode === 'manual' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 rounded-lg text-sm">
                        <p className="font-bold">✍️ Manual Entry</p>
                        <p className="mt-1">Log past workouts one by one. Best for copying from a notebook.</p>
                    </div>
                    {/* ... table ... */}
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
                                    {manualEntries.map((entry, i) => (
                                        <tr key={i} className="bg-white dark:bg-gray-900/50">
                                            <td className="p-2">
                                                <input type="date" value={entry.date} onChange={(e) => updateManualRow(i, 'date', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" placeholder="e.g. Bench Press" value={entry.exercise} onChange={(e) => updateManualRow(i, 'exercise', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" value={entry.sets} onChange={(e) => updateManualRow(i, 'sets', parseInt(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" value={entry.reps} onChange={(e) => updateManualRow(i, 'reps', parseInt(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" value={entry.weight} onChange={(e) => updateManualRow(i, 'weight', parseFloat(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white" />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => removeManualRow(i)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={addManualRow} className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
                                <Plus size={16} /> Add Exercise
                            </button>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button onClick={() => handleSave()} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                            <Check size={20} /> Save Workouts
                        </button>
                    </div>
                </div>
            )}

            {/* CSV Mode */}
            {mode === 'csv' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 rounded-lg text-sm">
                        <p className="font-bold">📊 CSV Import</p>
                        <p className="mt-1">Bulk upload worksouts from other apps like Apple Health or Strong.</p>
                    </div>

                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg text-sm">
                        <p className="font-bold flex items-center gap-2"><AlertCircle size={16} /> CSV Format Required</p>
                        <p className="mt-1">Your CSV file must have these columns in order: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">Date, Exercise, Sets, Reps, Weight</code></p>
                    </div>
                    {/* Reuse Upload Logic for CSV */}
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
                                onChange={handleChange}
                                accept=".csv,text/csv"
                            />
                            <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                                    <Table className="w-8 h-8" />
                                </div>
                                <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                                    Upload CSV File
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Max 5MB
                                </p>
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
                                        <p className="text-sm text-gray-500">{manualEntries.length} workouts found</p>
                                    </div>
                                </div>
                                <button onClick={() => { setFile(null); setManualEntries([]); }} className="text-gray-500 hover:text-red-500"><Trash2 size={20} /></button>
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
                                        {manualEntries.map((e, i) => (
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
                                <button onClick={() => handleSave(manualEntries)} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                                    <Check size={20} /> Import {manualEntries.length} Workouts
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* AI Mode (Existing) */}
            {mode === 'ai' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 rounded-lg text-sm">
                        <div className="flex items-center gap-2 font-bold">
                            <div className="px-2 py-0.5 bg-purple-100 dark:bg-purple-800 rounded text-xs">PRO</div>
                            AI Scan
                            {!hasApiKey && !isPro && <span className="text-red-500 text-xs ml-2">(Setup Required)</span>}
                        </div>
                        <p className="mt-1">Upload a photo of your handwritten log or a screenshot.</p>
                        {!hasApiKey && !isPro && (
                            <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-medium">
                                ⚠️ Gemini API Key is missing. AI features are currently disabled. Please add a key in Profile Settings.
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {!parsedData && (
                        <div className="mt-6 space-y-6">
                            {/* Instructions */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-500 dark:text-gray-400">
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <span className="block font-bold text-gray-900 dark:text-white mb-1">1. Take a Photo</span>
                                    Snap a picture of your handwritten gym log or whiteboard.
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <span className="block font-bold text-gray-900 dark:text-white mb-1">2. Or Screenshot</span>
                                    Upload a screenshot from your notes app or another tracker.
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <span className="block font-bold text-gray-900 dark:text-white mb-1">3. AI Extraction</span>
                                    Gemini Vision extracts exercises, sets, reps, and weights.
                                </div>
                            </div>

                            {/* Drop Zone */}
                            <div
                                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${dragActive
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                    : 'border-gray-300 dark:border-gray-700 hover:border-purple-400'
                                    }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                <input
                                    type="file"
                                    id="ai-upload"
                                    className="hidden"
                                    onChange={handleChange}
                                    accept="image/*,application/pdf"
                                    multiple
                                />
                                <label htmlFor="ai-upload" className="cursor-pointer flex flex-col items-center">
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-purple-500 shadow-sm">
                                        <ScanEye className="w-8 h-8" />
                                    </div>
                                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                                        Click to Upload or Drag & Drop
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Supports multiple JPG, PNG, PDF (Max 20MB Total)
                                    </p>
                                </label>
                            </div>

                            {/* Staging Area - Assessment Step */}
                            {files.length > 0 && (
                                <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <FileText size={18} /> Selected Files
                                        </h3>
                                        <button onClick={() => setFiles([])} className="text-xs text-red-500 hover:text-red-600 font-medium">
                                            Clear All
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                        {files.map((f, i) => (
                                            <div key={i} className="relative group p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                                <div className="w-full h-20 bg-gray-200 dark:bg-gray-700 rounded-md mb-2 overflow-hidden flex items-center justify-center">
                                                    {f.type.startsWith('image/') ? (
                                                        <img src={URL.createObjectURL(f)} alt="preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs font-bold text-gray-500">PDF</span>
                                                    )}
                                                </div>
                                                <p className="text-xs truncate font-medium dark:text-gray-300">{f.name}</p>
                                                <p className="text-[10px] text-gray-500">{(f.size / 1024).toFixed(0)} KB</p>
                                                <button
                                                    onClick={() => removeFile(i)}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={analyzeFiles}
                                        disabled={loading}
                                        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <ScanEye />}
                                        {loading ? 'Analyzing...' : `Assessment Complete - Process ${files.length} Files`}
                                    </button>
                                    <p className="text-center text-xs text-gray-500 mt-2">
                                        Generative AI will extract workouts from all files simultaneously.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview UI */}
                    {parsedData && (
                        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Detected Workout</h3>
                                <span className="text-sm text-gray-500">{parsedData.date || 'Today'}</span>
                            </div>

                            <div className="space-y-3 mb-6">
                                {parsedData.exercises.map((ex, i) => (
                                    <div key={i} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{ex.name}</p>
                                            <p className="text-sm text-gray-500">{ex.sets} sets × {ex.reps} reps {ex.weight > 0 && `@ ${ex.weight}kg`}</p>
                                        </div>
                                        <div className="h-8 w-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                            <Check size={16} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setParsedData(null); setFiles([]); }}
                                    className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleSave()}
                                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                                >
                                    Confirm & Save
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkoutImporter;
