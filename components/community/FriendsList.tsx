import React, { useState, useEffect } from 'react';
import { Users, UserPlus, UserMinus, Check, X, Search, Shield, Clock } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Friendship, Profile } from '../../types';
import { useToast } from '../Toast';

const FriendsList: React.FC = () => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [friends, setFriends] = useState<(Friendship & { friend: Profile })[]>([]);
    const [pendingReceived, setPendingReceived] = useState<(Friendship & { requester: Profile })[]>([]);
    const [pendingSent, setPendingSent] = useState<(Friendship & { addressee: Profile })[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [searching, setSearching] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        // Fetch accepted friends (where I'm requester)
        const { data: asRequester } = await supabase
            .from('friendships')
            .select('*, addressee:profiles!friendships_addressee_id_fkey(*)')
            .eq('requester_id', user.id)
            .eq('status', 'accepted');

        // Fetch accepted friends (where I'm addressee)
        const { data: asAddressee } = await supabase
            .from('friendships')
            .select('*, requester:profiles!friendships_requester_id_fkey(*)')
            .eq('addressee_id', user.id)
            .eq('status', 'accepted');

        // Combine and normalize
        const allFriends = [
            ...(asRequester || []).map(f => ({ ...f, friend: f.addressee })),
            ...(asAddressee || []).map(f => ({ ...f, friend: f.requester }))
        ];
        setFriends(allFriends);

        // Pending received
        const { data: received } = await supabase
            .from('friendships')
            .select('*, requester:profiles!friendships_requester_id_fkey(*)')
            .eq('addressee_id', user.id)
            .eq('status', 'pending');
        setPendingReceived(received || []);

        // Pending sent
        const { data: sent } = await supabase
            .from('friendships')
            .select('*, addressee:profiles!friendships_addressee_id_fkey(*)')
            .eq('requester_id', user.id)
            .eq('status', 'pending');
        setPendingSent(sent || []);

        setLoading(false);
    };

    const searchUsers = async () => {
        if (!searchQuery.trim() || searchQuery.length < 2) return;
        setSearching(true);

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .ilike('username', `%${searchQuery}%`)
            .neq('id', currentUserId)
            .limit(10);

        // Filter out existing friends and pending requests
        const existingIds = new Set([
            ...friends.map(f => f.friend?.id),
            ...pendingSent.map(p => p.addressee?.id),
            ...pendingReceived.map(p => p.requester?.id)
        ]);

        setSearchResults((data || []).filter(p => !existingIds.has(p.id)));
        setSearching(false);
    };

    const sendFriendRequest = async (profileId: string) => {
        const { error } = await supabase
            .from('friendships')
            .insert({ requester_id: currentUserId, addressee_id: profileId });

        if (error) {
            showToast('Failed to send request', 'error');
        } else {
            showToast('Friend request sent!', 'success');
            setSearchResults(prev => prev.filter(p => p.id !== profileId));
            fetchFriends();
        }
    };

    const respondToRequest = async (friendshipId: string, accept: boolean) => {
        const { error } = await supabase
            .from('friendships')
            .update({ status: accept ? 'accepted' : 'blocked', updated_at: new Date().toISOString() })
            .eq('id', friendshipId);

        if (error) {
            showToast('Failed to respond', 'error');
        } else {
            showToast(accept ? 'Friend added!' : 'Request declined', accept ? 'success' : 'info');
            fetchFriends();
        }
    };

    const removeFriend = async (friendshipId: string) => {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', friendshipId);

        if (error) {
            showToast('Failed to remove friend', 'error');
        } else {
            showToast('Friend removed', 'info');
            fetchFriends();
        }
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Search */}
            <div className="relative">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                    placeholder="Search users by username..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <button
                    onClick={searchUsers}
                    disabled={searching}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-emerald-600"
                >
                    {searching ? '...' : 'Search'}
                </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300">Search Results</h4>
                    {searchResults.map(profile => (
                        <div key={profile.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold">
                                    {profile.username?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{profile.username}</p>
                                    <p className="text-xs text-gray-500">{profile.total_workouts || 0} workouts</p>
                                </div>
                            </div>
                            <button
                                onClick={() => sendFriendRequest(profile.id)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg transition-colors"
                            >
                                <UserPlus size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Pending Received */}
            {pendingReceived.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-bold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                        <Clock size={16} /> Friend Requests ({pendingReceived.length})
                    </h4>
                    {pendingReceived.map(friendship => (
                        <div key={friendship.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold">
                                    {friendship.requester?.username?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{friendship.requester?.username}</p>
                                    <p className="text-xs text-gray-500">wants to connect</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => respondToRequest(friendship.id, true)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg transition-colors"
                                >
                                    <Check size={18} />
                                </button>
                                <button
                                    onClick={() => respondToRequest(friendship.id, false)}
                                    className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 p-2 rounded-lg transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}


            {/* Friends List */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 pl-1 mb-3">
                    <Users size={14} /> My Friends ({friends.length})
                </h4>

                {friends.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-gray-900 dark:text-white font-bold mb-1">Build Your Tribe</h3>
                        <p className="text-sm text-gray-500 mb-4">Training is better together. Find friends to compete with!</p>
                        <button onClick={() => document.querySelector('input')?.focus()} className="text-emerald-500 font-bold text-sm hover:underline">Search for people</button>
                    </div>
                ) : (
                    friends.map(friendship => (
                        <div key={friendship.id} className="relative group bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/10">
                                    {friendship.friend?.username?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white text-lg">{friendship.friend?.username}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-medium">{friendship.friend?.tier || 'Bronze'}</span>
                                        <span>•</span>
                                        <span>{friendship.friend?.total_workouts || 0} Workouts</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {friendship.friend?.privacy_level === 'public' && (
                                    <span className="text-xs text-emerald-500 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full font-medium">
                                        <Shield size={10} /> Public
                                    </span>
                                )}
                                <button
                                    onClick={() => removeFriend(friendship.id)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                                    title="Remove friend"
                                >
                                    <UserMinus size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pending Sent */}
            {pendingSent.length > 0 && (
                <div className="text-xs text-gray-400">
                    <p className="font-medium">Pending requests sent: {pendingSent.map(p => p.addressee?.username).join(', ')}</p>
                </div>
            )}
        </div>
    );
};

export default FriendsList;
