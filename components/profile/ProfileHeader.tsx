import React from 'react';
import { Settings, Shield, Edit2, Share2, MapPin, Calendar } from 'lucide-react';
import { Profile } from '../../types';
import { useToast } from '../Toast';

interface ProfileHeaderProps {
    profile: Profile | null;
    isPro: boolean;
    onSettingsClick: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile, isPro, onSettingsClick }) => {
    const { showToast } = useToast();
    // Tier Colors
    const getTierColor = (tier: string) => {
        switch (tier?.toLowerCase()) {
            case 'gold': return 'from-yellow-400 to-yellow-600';
            case 'silver': return 'from-slate-300 to-slate-500';
            case 'bronze': return 'from-amber-600 to-amber-800';
            default: return 'from-emerald-500 to-teal-600';
        }
    };

    return (
        <div className="relative mb-6">
            {/* Banner Image (Gradient for now, could be image later) */}
            <div className={`h-32 sm:h-40 w-full bg-gradient-to-r ${getTierColor(profile?.tier || 'bronze')} rounded-b-3xl shadow-lg relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/10"></div>
                {isPro && (
                    <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 border border-white/20">
                        <Shield size={12} className="text-yellow-400" fill="currentColor" />
                        PRO MEMBER
                    </div>
                )}
            </div>

            {/* Profile Info Section */}
            <div className="px-4 sm:px-6 -mt-12 sm:-mt-14 flex flex-col items-center sm:items-start sm:flex-row sm:gap-6 relative z-10">
                {/* Avatar */}
                <div className="relative">
                    <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white dark:border-gray-900 bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-3xl font-bold text-gray-400 uppercase shadow-xl`}>
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            profile?.username?.substring(0, 2) || 'ME'
                        )}
                    </div>
                    {/* Tier Badge */}
                    <div className={`absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gradient-to-r ${getTierColor(profile?.tier || 'bronze')} border-2 border-white dark:border-gray-900 flex items-center justify-center text-white text-xs font-bold shadow-md`}>
                        {profile?.tier?.[0] || 'B'}
                    </div>
                </div>

                {/* Text Info */}
                <div className="flex-1 text-center sm:text-left mt-3 sm:mt-12">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {profile?.username || 'Guest User'}
                        </h1>
                    </div>

                    <div className="flex items-center justify-center sm:justify-start gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <MapPin size={14} /> Global
                        </span>
                        <span className="flex items-center gap-1">
                            <Calendar size={14} /> Joined 2024
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 sm:mt-12">
                    <button
                        onClick={async () => {
                            const shareData = {
                                title: 'FitAI Coach Profile',
                                text: `Check out my workout stats on FitAI! ${profile?.total_workouts} workouts and counting.`,
                                url: window.location.href
                            };
                            try {
                                if (navigator.share) {
                                    await navigator.share(shareData);
                                } else {
                                    await navigator.clipboard.writeText(window.location.href);
                                    showToast('Profile link copied!', 'success');
                                }
                            } catch (err) {
                                console.error('Error sharing:', err);
                            }
                        }}
                        className="p-2 sm:px-4 sm:py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <Share2 size={18} />
                        <span className="hidden sm:inline">Share</span>
                    </button>
                    <button
                        onClick={onSettingsClick}
                        className="p-2 sm:px-4 sm:py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <Settings size={18} />
                        <span className="hidden sm:inline">Settings</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileHeader;
