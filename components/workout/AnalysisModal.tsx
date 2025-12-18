import React from 'react';
import { X, Loader2, CheckCircle, AlertTriangle, Lightbulb, Shield, Dumbbell } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: string | null;
    isLoading: boolean;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, result, isLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">

                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-md z-10">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent flex items-center gap-2">
                        Coach's Eye Analysis
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                                <Loader2 size={48} className="text-purple-500 animate-spin relative z-10" />
                            </div>
                            <p className="text-gray-400 font-medium animate-pulse">Analyzing form mechanics...</p>
                            <p className="text-xs text-gray-600">This uses Gemini Vision • May take 10-20s</p>
                        </div>
                    ) : result ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            {/* Custom renderers for Markdown to add icons/styling */}
                            <ReactMarkdown
                                components={{
                                    h2: ({ node, ...props }) => <h3 className="text-lg font-bold text-white mt-6 mb-3 flex items-center gap-2 border-b border-gray-800 pb-2" {...props} />,
                                    ul: ({ node, ...props }) => <ul className="space-y-2 mb-4" {...props} />,
                                    li: ({ node, ...props }) => <li className="flex items-start gap-2 text-gray-300" {...props} />,
                                    strong: ({ node, ...props }) => <span className="text-purple-300 font-bold" {...props} />
                                }}
                            >
                                {result}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 py-10">
                            Upload a video to see the magic.
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!isLoading && (
                    <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalysisModal;
