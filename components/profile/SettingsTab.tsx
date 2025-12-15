import React, { useState } from 'react';
import { Eye, EyeOff, Key, Save, CheckCircle, Trash2, Shield, CreditCard, LogOut } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Profile } from '../../types';
import { KeyManager } from '../../services/keyManager';
import NotificationSettings from './NotificationSettings';
interface SettingsTabProps {
    profile: Profile | null;
    isPro: boolean;
    subscriptionStatus: string | null;
    onUpdateProfile: (newProfile: Profile) => void;
    onSignOut: () => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ profile, isPro, subscriptionStatus, onUpdateProfile, onSignOut }) => {
    // API Key State
    const [apiKey, setApiKey] = useState(KeyManager.isUserKey() ? KeyManager.getKey() : '');
    const [showKey, setShowKey] = useState(false);
    const [keySaved, setKeySaved] = useState(false);

    const handleSaveKey = () => {
        if (apiKey.trim()) {
            KeyManager.saveKey(apiKey);
            setKeySaved(true);
            setTimeout(() => setKeySaved(false), 2000);
        }
    };

    const handleRemoveKey = () => {
        KeyManager.removeKey();
        setApiKey('');
    };

    const togglePrivacy = async () => {
        if (!profile) return;
        const newVal = !profile.is_public;

        // Optimistic Update
        onUpdateProfile({ ...profile, is_public: newVal });

        const { error } = await supabase
            .from('profiles')
            .update({ is_public: newVal })
            .eq('id', profile.id);

        if (error) {
            console.error('Privacy Update Failed', error);
            onUpdateProfile({ ...profile, is_public: !newVal }); // Revert
        }
    };

    return (
        <div className="px-4 pb-20 space-y-6">
            {/* Account Status Card (Subscription) */}
            <div className={`p-5 rounded-2xl border ${isPro ? 'bg-indigo-900/10 border-indigo-500/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                            Free Beta Access
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Pro features are unlocked for everyone during the beta!
                        </p>
                    </div>
                </div>

                <div className="w-full py-3 bg-indigo-500/10 text-indigo-400 font-bold rounded-xl border border-indigo-500/20 text-center flex items-center justify-center gap-2">
                    <CheckCircle size={18} /> Status: Pro (Beta Gift)
                </div>
            </div>

            {/* Privacy Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">Public Profile</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
                        Visible on leaderboard. Uncheck to go private.
                    </p>
                </div>
                <button
                    onClick={togglePrivacy}
                    className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${profile?.is_public ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                    <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${profile?.is_public ? 'translate-x-6' : 'translate-x-0'}`}>
                        {profile?.is_public ? <Eye size={14} className="text-emerald-500" /> : <EyeOff size={14} className="text-gray-400" />}
                    </div>
                </button>
            </div>

            {/* Notification Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                <NotificationSettings />
            </div>

            {/* Developer Keys (BYO) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                    <Key size={18} className="text-purple-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white">Developer API Key</h3>
                </div>
                <div className="relative mb-3">
                    <input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Gemini API Key..."
                        className="w-full pl-4 pr-10 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 dark:text-white text-sm font-mono"
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
                        {keySaved ? 'Saved' : 'Save Key'}
                    </button>
                    {apiKey && (
                        <button
                            onClick={handleRemoveKey}
                            className="px-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-800"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Logout */}
            <button
                onClick={onSignOut}
                className="w-full py-4 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
                <LogOut size={20} /> Sign Out
            </button>

            <div className="text-center text-xs text-gray-400 pt-4">
                v1.0.2 • TrainAnywhere
            </div>
        </div>
    );
};

export default SettingsTab;
