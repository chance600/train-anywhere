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
        <div className="h-full bg-white dark:bg-gray-900 p-5 sm:p-4 flex flex-col transition-colors duration-300">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Trophy size={32} className="sm:w-6 sm:h-6 text-yellow-500" /> Leaderboard
                </h2>
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {['global', 'leagues', 'friends'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 sm:px-3 sm:py-1 rounded-md text-sm font-medium transition-colors capitalize ${activeTab === tab
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-3">
                    {displayUsers.map((user, index) => (
                        <div
                            key={user.id}
                            className={`flex items-center p-4 rounded-xl border transition-colors ${user.id === currentUser?.id
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/30'
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                }`}
                        >
                            <div className="w-8 font-bold text-gray-400 dark:text-gray-500 text-lg">#{index + 1}</div>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm mr-4 uppercase">
                                {user.username?.substring(0, 2) || 'U'}
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-bold text-sm ${user.id === currentUser?.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                                    {user.username || 'Anonymous'} {user.id === currentUser?.id && '(You)'}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <Shield size={12} className="text-blue-500" /> {user.tier || 'Bronze'} League
                                </div>
                            </div>

                            {user.id !== currentUser?.id && (
                                <button
                                    onClick={() => toggleFollow(user.id)}
                                    className={`mr-3 px-3 py-1 rounded-full text-xs font-medium transition-colors ${followedIds.has(user.id)
                                            ? 'bg-emerald-500 text-white border border-emerald-500'
                                            : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-emerald-500 hover:text-emerald-500'
                                        }`}
                                >
                                    {followedIds.has(user.id) ? 'Following' : 'Follow'}
                                </button>
                            )}

                            <div className="text-right">
                                <div className="text-xl font-bold text-gray-900 dark:text-white">{user.total_reps}</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Reps</div>
                            </div>
                        </div>
                    ))}
                    {displayUsers.length === 0 && (
                        <div className="text-center p-8 text-gray-500 dark:text-gray-400">
                            {activeTab === 'friends' ? "You're not following anyone yet. Follow users to see them here!" : "No active users found. Be the first!"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
