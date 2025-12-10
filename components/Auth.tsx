import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

interface AuthProps {
    onLogin: () => void;
    onGuest: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onGuest }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onLogin();
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: window.location.origin
                    }
                });
                if (error) throw error;
                alert('Check your email for the confirmation link!');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-900 p-6">
            <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-emerald-500/20 rounded-full">
                        <User size={48} className="text-emerald-400" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-white text-center mb-2">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-gray-400 text-center mb-8">
                    {isLogin ? 'Sign in to track your progress' : 'Join the FitAI community'}
                </p>

                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-gray-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                    >
                        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-700">
                    <button
                        onClick={onGuest}
                        className="w-full py-3 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-700 flex items-center justify-center gap-2 transition-colors"
                    >
                        Continue as Guest <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Auth;
