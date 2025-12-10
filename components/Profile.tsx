import React, { useEffect, useState } from 'react';
import { Award, Flame, Calendar, Settings, Loader2, Sun, Moon, Key, Eye, EyeOff, Save, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { Profile as ProfileType } from '../types';
import { useTheme } from './ThemeProvider';
import { KeyManager } from '../services/keyManager';

const Profile: React.FC = () => {
    const [profile, setProfile] = useState<ProfileType | null>(null);
    const [badges, setBadges] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { theme, setTheme } = useTheme();

    // Key Management State
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [hasUserKey, setHasUserKey] = useState(false);
    const [keySaved, setKeySaved] = useState(false);

    useEffect(() => {
        fetchProfile();
        // Load key status on mount
        const savedKey = KeyManager.getKey();
        const isUser = KeyManager.isUserKey();
        if (isUser && savedKey) {
            setApiKey(savedKey);
            setHasUserKey(true);
        }
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;
            setProfile(profileData);

            // Fetch Badges
            const { data: badgeData, error: badgeError } = await supabase
                .from('badges')
                .select('*')
                .eq('user_id', user.id);

            if (badgeError) throw badgeError;
            setBadges(badgeData || []);

        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = () => {
        if (apiKey.trim()) {
            KeyManager.saveKey(apiKey);
            setHasUserKey(true);
            setKeySaved(true);
            setTimeout(() => setKeySaved(false), 2000);
        }
    };

    const handleRemoveKey = () => {
        KeyManager.removeKey();
        setApiKey('');
        setHasUserKey(false);
    };

    const BADGE_MAP: Record<string, { icon: string, name: string, desc: string }> = {
        'First Step': { icon: '👟', name: 'First Step', desc: 'Complete your first workout' },
        'High Five': { icon: '✋', name: 'High Five', desc: 'Complete 5 workouts' },
        'Centurion': { icon: '💯', name: 'Centurion', desc: 'Accumulate 100 reps' },
        'Kilo': { icon: '🏋️', name: 'Kilo Club', desc: 'Accumulate 1000 reps' },
        'Perfectionist': { icon: '✨', name: 'Perfectionist', desc: 'Score 100 on a set' },
    };

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

    return (
        <div className="h-full bg-white dark:bg-gray-900 p-5 sm:p-4 overflow-y-auto transition-colors duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl sm:text-2xl font-bold text-gray-900 dark:text-white">Profile</h2>
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-3 sm:p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-gray-400 hover:text-emerald-500 dark:hover:text-white min-h-[48px] min-w-[48px] sm:min-h-auto sm:min-w-auto transition-colors"
                >
                    {theme === 'dark' ? <Sun size={24} className="sm:w-5 sm:h-5" /> : <Moon size={24} className="sm:w-5 sm:h-5" />}
                </button>
            </div>

            {/* PRO Subscription / API Key Section [NEW] */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${hasUserKey ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                        <Key size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">PRO Settings</h3>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${hasUserKey ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400'}`}>
                                {hasUserKey ? 'PRO ACTIVE' : 'FREE TIER'}
                            </span>
                        </div>
                    </div>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Enter your Google Gemini API Key to unlock advanced AI features like Workout Scanning.
                </p>

                <div className="space-y-3">
                    <div className="relative">
                        <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Paste your API key here..."
                            className="w-full pl-4 pr-10 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 dark:text-white transition-all text-sm font-mono"
                        />
                        <button
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-3.5 text-gray-400 hover:text-purple-500"
                        >
                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveKey}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${keySaved
                                ? 'bg-green-500 text-white'
                                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20'
                                }`}
                        >
                            {keySaved ? <CheckCircle size={16} /> : <Save size={16} />}
                            {keySaved ? 'Saved!' : 'Save Key'}
                        </button>

                        {hasUserKey && (
                            <button
                                onClick={handleRemoveKey}
                                className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>

                    {!hasUserKey && (
                        <div className="mt-2 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>Don't have a key? You can get one for free from Google AI Studio. Later, you can subscribe to have us manage it for you.</span>
                        </div>
                    )}
                </div>
            </div>

            {/* User Info */}
            <div className="flex flex-col items-center mb-8">
                <div className="w-32 h-32 sm:w-24 sm:h-24 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-5xl sm:text-3xl font-bold text-white mb-4 border-4 border-gray-100 dark:border-gray-800 shadow-xl uppercase">
                    {profile?.username?.substring(0, 2) || 'ME'}
                </div>
                <h3 className="text-2xl sm:text-xl font-bold text-gray-900 dark:text-white">{profile?.username || 'User'}</h3>
                <p className="text-base sm:text-sm text-gray-500 dark:text-gray-400">{profile?.tier || 'Bronze'} League</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 dark:bg-gray-800 p-5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 min-h-[100px] transition-colors">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2 text-sm">
                        <Flame size={20} className="sm:w-4 sm:h-4 text-orange-500" /> Total Reps
                    </div>
                    <div className="text-3xl sm:text-2xl font-bold text-gray-900 dark:text-white">{profile?.total_reps || 0}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 min-h-[100px] transition-colors">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2 text-sm">
                        <Calendar size={20} className="sm:w-4 sm:h-4 text-blue-500" /> Workouts
                    </div>
                    <div className="text-3xl sm:text-2xl font-bold text-gray-900 dark:text-white">{profile?.total_workouts || 0}</div>
                </div>
            </div>

            {/* Badges */}
            <div className="mb-8">
                <h3 className="text-xl sm:text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Award size={24} className="sm:w-5 sm:h-5 text-yellow-500" /> Achievements
                </h3>

                {badges.length === 0 ? (
                    <div className="p-6 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-500 dark:text-gray-400 text-center text-base sm:text-sm border border-gray-200 dark:border-gray-700 transition-colors">
                        Start working out to earn badges!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                        {badges.map((b) => {
                            const info = BADGE_MAP[b.badge_type] || { icon: '❓', name: b.badge_type, desc: 'Mystery Badge' };
                            return (
                                <div key={b.id} className="bg-gray-800 p-4 sm:p-3 rounded-xl border border-gray-700 flex items-center gap-4 sm:gap-3 animate-fade-in min-h-[72px] sm:min-h-auto">
                                    <div className="text-4xl sm:text-2xl">{info.icon}</div>
                                    <div>
                                        <div className="font-bold text-white text-base sm:text-sm">{info.name}</div>
                                        <div className="text-xs sm:text-[10px] text-gray-400">{info.desc}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
