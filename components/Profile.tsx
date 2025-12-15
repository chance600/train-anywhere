import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { Profile as ProfileType, WorkoutSession } from '../types';

// New Components
import ProfileHeader from './profile/ProfileHeader';
import StatsRow from './profile/StatsRow';
import ActivityFeed from './profile/ActivityFeed';
import SettingsTab from './profile/SettingsTab';
import BadgeGrid from './profile/BadgeGrid';
import ActivityHeatmap from './profile/ActivityHeatmap';
import PersonalRecords from './profile/PersonalRecords';

interface ProfileProps {
    session: any;
    isPro?: boolean;
    subscriptionStatus?: string | null;
}

const Profile: React.FC<ProfileProps> = ({ session, isPro = false, subscriptionStatus }) => {
    const [profile, setProfile] = useState<ProfileType | null>(null);
    const [badges, setBadges] = useState<any[]>([]);
    const [history, setHistory] = useState<WorkoutSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'activity' | 'badges' | 'settings'>('activity');

    useEffect(() => {
        fetchProfileData();
    }, []);

    const fetchProfileData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            if (profileError) throw profileError;
            setProfile(profileData);

            // 2. Badges
            const { data: badgeData } = await supabase
                .from('badges')
                .select('*')
                .eq('user_id', user.id);
            setBadges(badgeData || []);

            // 3. History (Fetched ALL for PRs and Heatmap, client-side limit for Feed)
            const { data: historyData } = await supabase
                .from('workouts')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (historyData) {
                setHistory(historyData.map(d => ({
                    id: d.id,
                    date: d.created_at,
                    exercise: d.exercise,
                    reps: d.reps,
                    weight: d.weight, // Ensure weight is passed
                    score: d.score
                })));
            }
        } catch (error) {
            console.error('Error fetching profile data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

    return (
        <div className="h-full bg-white dark:bg-gray-900 overflow-y-auto transition-colors duration-300">
            {/* Header Section */}
            <ProfileHeader
                profile={profile}
                isPro={isPro}
                onSettingsClick={() => setActiveTab('settings')}
            />

            {/* Main Content Area */}
            {activeTab === 'settings' ? (
                // Settings View
                <div className="animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-2 px-4 mb-4">
                        <button
                            onClick={() => setActiveTab('activity')}
                            className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        >
                            ← Back to Profile
                        </button>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
                    </div>
                    <SettingsTab
                        profile={profile}
                        isPro={isPro}
                        subscriptionStatus={subscriptionStatus}
                        onUpdateProfile={setProfile}
                        onSignOut={() => supabase.auth.signOut()}
                    />
                </div>
            ) : (
                // Profile View
                <>
                    <StatsRow profile={profile} />

                    {/* Heatmap (Visual Consistency) */}
                    <ActivityHeatmap history={history} />

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-gray-100 dark:border-gray-800 mb-6 px-4">
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`flex-1 pb-3 text-sm font-bold text-center transition-colors relative ${activeTab === 'activity'
                                    ? 'text-emerald-500'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}
                        >
                            Activity
                            {activeTab === 'activity' && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('badges')}
                            className={`flex-1 pb-3 text-sm font-bold text-center transition-colors relative ${activeTab === 'badges'
                                    ? 'text-emerald-500'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}
                        >
                            Badges
                            {activeTab === 'badges' && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full" />
                            )}
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[300px]">
                        {activeTab === 'activity' && (
                            <div className="animate-in slide-in-from-bottom-2 duration-300">
                                <PersonalRecords history={history} />
                                <ActivityFeed history={history} />
                            </div>
                        )}
                        {activeTab === 'badges' && <BadgeGrid badges={badges} />}
                    </div>
                </>
            )}
        </div>
    );
};

export default Profile;
