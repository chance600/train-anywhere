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
        <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
            {/* Header */}
            <div className="bg-gradient-to-br from-purple-700 via-pink-600 to-rose-500 pt-16 pb-12 px-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
                {/* Abstract Shapes */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-900/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

                <div className="max-w-xl mx-auto relative z-10 text-center">
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Community</h1>
                    <p className="text-white/90 font-medium text-lg">Connect, Compete, Conquer.</p>

                    {/* Floating Tab Switcher */}
                    <div className="flex p-1.5 mt-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-full max-w-sm mx-auto shadow-lg">
                        {tabs.map(({ key, label, icon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full font-bold text-xs transition-all duration-300 ${activeTab === key
                                    ? 'bg-white text-pink-600 shadow-md transform scale-105'
                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
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
            <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
                {/* No white box wrapper anymore, allowing feed items to "breathe" */}

                {activeTab === 'feed' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in">
                        <ActivityFeed />
                    </div>
                )}
                {activeTab === 'friends' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in">
                        <FriendsList />
                    </div>
                )}
                {activeTab === 'challenges' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in">
                        <ChallengeList />
                    </div>
                )}
                {activeTab === 'leaderboard' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in">
                        <Leaderboard />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TribeHub;
