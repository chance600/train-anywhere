import React, { useState, useEffect } from 'react';
import { Trophy, Shield, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { Profile } from '../types';

const Leaderboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'global' | 'leagues' | 'friends'>('global');
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchLeaderboard();
        supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));

        // Load followed users from localStorage
        const saved = localStorage.getItem('fitai_followed_users');
        if (saved) {
            setFollowedIds(new Set(JSON.parse(saved)));
        }
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('is_public', true) // Only show public profiles
                .order('total_reps', { ascending: false })
                .limit(50);

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleFollow = (userId: string) => {
        setFollowedIds(prev => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            localStorage.setItem('fitai_followed_users', JSON.stringify([...next]));
            return next;
        });
    };

    // Filter users based on active tab
    const displayUsers = activeTab === 'friends'
        ? users.filter(u => followedIds.has(u.id))
        : users;

    return (
        <div className="flex flex-col h-full bg-transparent">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1">
                    <Trophy size={14} className="text-yellow-500" /> Global Rankings
                </h2>
                <div className="flex bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-full p-1 border border-gray-200 dark:border-gray-700">
                    {['global', 'leagues', 'friends'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${activeTab === tab
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                </div>
            ) : (
                <div className="space-y-3">
                    {displayUsers.map((user, index) => (
                        <div
                            key={user.id}
                            className={`relative flex items-center p-4 rounded-2xl transition-all hover:scale-[1.01] ${user.id === currentUser?.id
                                ? 'bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-500/30 shadow-emerald-500/10 shadow-lg'
                                : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-md'
                                }`}
                        >
                            <div className={`w-8 font-black text-xl italic ${index < 3 ? 'text-yellow-500 drop-shadow-sm' : 'text-gray-300 dark:text-gray-600'
                                }`}>#{index + 1}</div>

                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg mr-4 shadow-lg shadow-blue-500/20">
                                {user.username?.substring(0, 1).toUpperCase() || 'U'}
                            </div>

                            <div className="flex-1 min-w-0 mr-4">
                                <h3 className={`font-bold truncate ${user.id === currentUser?.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                                    {user.username || 'Anonymous'} {user.id === currentUser?.id && '(You)'}
                                </h3>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    <Shield size={10} className="text-blue-500 fill-blue-500" /> {user.tier || 'Bronze'} League
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{user.total_reps.toLocaleString()}</div>
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Reps</div>
                            </div>
                        </div>
                    ))}
                    {displayUsers.length === 0 && (
                        <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 font-medium">
                                {activeTab === 'friends' ? "You're not following anyone yet." : "No active users found."}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
