import React, { useState } from 'react';
import { ScanEye, AlertCircle, FileText, Trash2, Loader2, Check } from 'lucide-react';
import { ParsedWorkout } from '../../services/geminiParser';
import { ManualEntryData } from './ManualEntry';

interface AIScanProps {
    onSave: (data: ManualEntryData[]) => Promise<void>;
    hasApiKey: boolean;
    isPro: boolean;
}

const AIScan: React.FC<AIScanProps> = ({ onSave, hasApiKey, isPro }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<ParsedWorkout | null>(null);

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

    const handleFiles = (newFiles: File[]) => {
        const valid = newFiles.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
        if (valid.length !== newFiles.length) setError('Only Images and PDFs are supported.');
        setFiles(prev => [...prev, ...valid]);
    };

    const analyzeFiles = async () => {
        if (files.length === 0) return;
        setLoading(true);
        setError(null);
        try {
            const { parseWorkoutFiles } = await import('../../services/geminiParser');
            const result = await parseWorkoutFiles(files);
            setParsedData(result);
            setFiles([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (!parsedData) return;
        const entries: ManualEntryData[] = parsedData.exercises.map(ex => ({
            date: parsedData.date || new Date().toISOString(),
            exercise: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight
        }));
        onSave(entries);
    };

    return (
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
                        ⚠️ Gemini API Key is missing. AI features disabled.
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
                            onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                            accept="image/*,application/pdf"
                            multiple
                        />
                        <label htmlFor="ai-upload" className="cursor-pointer flex flex-col items-center">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-purple-500 shadow-sm">
                                <ScanEye className="w-8 h-8" />
                            </div>
                            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                                Click or Drag Photos
                            </p>
                        </label>
                    </div>

                    {files.length > 0 && (
                        <div className="mt-6">
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
                                        <p className="text-xs truncate font-medium dark:text-gray-300">{f.name}</p>
                                        <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><Trash2 size={12} /></button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={analyzeFiles}
                                disabled={loading}
                                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <ScanEye />}
                                {loading ? 'Analyzing...' : 'Analyze Workouts'}
                            </button>
                        </div>
                    )}
                </div>
            )}

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
                                <Check size={16} className="text-emerald-500" />
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => { setParsedData(null); setFiles([]); }} className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Cancel</button>
                        <button onClick={handleConfirm} className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600">Save</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIScan;
