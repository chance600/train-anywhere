import React, { useState } from 'react';
import { Users, Trophy, Activity, Award } from 'lucide-react';
import FriendsList from './FriendsList';
import ChallengeList from './ChallengeList';
import ActivityFeed from './ActivityFeed';
import Leaderboard from '../Leaderboard';

type Tab = 'feed' | 'friends' | 'challenges' | 'leaderboard';

interface TribeHubProps {
    onBack?: () => void;
}

const TribeHub: React.FC<TribeHubProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<Tab>('feed');

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'feed', label: 'Feed', icon: <Activity size={16} /> },
        { key: 'friends', label: 'Friends', icon: <Users size={16} /> },
        { key: 'challenges', label: 'Compete', icon: <Trophy size={16} /> },
        { key: 'leaderboard', label: 'Ranks', icon: <Award size={16} /> },
    ];

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 pt-12 pb-6 px-4">
                <div className="max-w-lg mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Community</h1>
                            <p className="text-white/80 text-sm">Friends, challenges & leaderboards</p>
                        </div>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex gap-1 mt-4">
                        {tabs.map(({ key, label, icon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-medium text-xs transition-all ${activeTab === key
                                    ? 'bg-white text-purple-600 shadow-lg'
                                    : 'bg-white/20 text-white/80 hover:bg-white/30'
                                    }`}
                            >
                                {icon}
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-lg mx-auto px-4 py-6 -mt-2">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg">
                    {activeTab === 'feed' && <ActivityFeed />}
                    {activeTab === 'friends' && <FriendsList />}
                    {activeTab === 'challenges' && <ChallengeList />}
                    {activeTab === 'leaderboard' && <Leaderboard />}
                </div>
            </div>
        </div>
    );
};

export default TribeHub;
