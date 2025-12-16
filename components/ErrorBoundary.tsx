import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
        // Could send to error tracking service here
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
                <div className="text-center max-w-sm">
                    {this.state.error?.message.includes('Failed to fetch dynamically imported module') || this.state.error?.message.includes('Importing a module script failed') ? (
                        <>
                            <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <RefreshCw className="text-blue-500 animate-spin-slow" size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                New Update Available
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                                A new version of TrainAnywhere has been deployed. Please refresh to get the latest features.
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 mx-auto transition-colors shadow-lg shadow-blue-500/20"
                            >
                                <RefreshCw size={18} />
                                Update Now
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="bg-red-100 dark:bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="text-red-500" size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                Something went wrong
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                                {this.state.error?.message || 'An unexpected error occurred.'}
                            </p>
                            <button
                                onClick={this.handleRetry}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 mx-auto transition-colors"
                            >
                                <RefreshCw size={18} />
                                Try Again
                            </button>
                        </>
                    )}
                </div>
            </div>
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
