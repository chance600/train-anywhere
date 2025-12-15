import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-dismiss after 3s
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return <CheckCircle size={20} className="text-emerald-400" />;
            case 'error': return <AlertCircle size={20} className="text-red-400" />;
            case 'info': return <Info size={20} className="text-blue-400" />;
        }
    };

    const getBgColor = (type: ToastType) => {
        switch (type) {
            case 'success': return 'bg-emerald-900/90 border-emerald-500/30';
            case 'error': return 'bg-red-900/90 border-red-500/30';
            case 'info': return 'bg-blue-900/90 border-blue-500/30';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-20 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none sm:left-auto sm:right-6 sm:max-w-sm">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto ${getBgColor(toast.type)}`}
                    >
                        {getIcon(toast.type)}
                        <span className="flex-1 text-white text-sm font-medium">{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-white/60 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
