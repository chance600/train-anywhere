import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Calendar, Users, Target, Flame, Award, ChevronRight } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Challenge, ChallengeParticipant } from '../../types';
import { useToast } from '../Toast';

const ChallengeList: React.FC = () => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [challenges, setChallenges] = useState<(Challenge & { participants?: ChallengeParticipant[] })[]>([]);
    const [myParticipations, setMyParticipations] = useState<Set<string>>(new Set());
    const [showCreate, setShowCreate] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [newChallenge, setNewChallenge] = useState({
        name: '',
        description: '',
        challenge_type: 'total_reps' as const,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        is_public: true
    });

    useEffect(() => {
        fetchChallenges();
    }, []);

    const fetchChallenges = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        // Fetch public challenges
        const { data: publicChallenges } = await supabase
            .from('challenges')
            .select('*')
            .eq('is_public', true)
            .order('start_date', { ascending: true });

        // Fetch my participations
        const { data: myParts } = await supabase
            .from('challenge_participants')
            .select('challenge_id')
            .eq('user_id', user.id);

        setMyParticipations(new Set((myParts || []).map(p => p.challenge_id)));

        // Fetch participant counts
        const challengesWithCounts = await Promise.all(
            (publicChallenges || []).map(async (challenge) => {
                const { count } = await supabase
                    .from('challenge_participants')
                    .select('*', { count: 'exact', head: true })
                    .eq('challenge_id', challenge.id);
                return { ...challenge, participant_count: count || 0 };
            })
        );

        setChallenges(challengesWithCounts);
        setLoading(false);
    };

    const joinChallenge = async (challengeId: string) => {
        const { error } = await supabase
            .from('challenge_participants')
            .insert({ challenge_id: challengeId, user_id: currentUserId });

        if (error) {
            showToast('Failed to join challenge', 'error');
        } else {
            showToast('Joined challenge! 🎯', 'success');
            setMyParticipations(prev => new Set([...prev, challengeId]));
            fetchChallenges();
        }
    };

    const leaveChallenge = async (challengeId: string) => {
        const { error } = await supabase
            .from('challenge_participants')
            .delete()
            .eq('challenge_id', challengeId)
            .eq('user_id', currentUserId);

        if (error) {
            showToast('Failed to leave challenge', 'error');
        } else {
            showToast('Left challenge', 'info');
            setMyParticipations(prev => {
                const newSet = new Set(prev);
                newSet.delete(challengeId);
                return newSet;
            });
            fetchChallenges();
        }
    };

    const createChallenge = async () => {
        if (!newChallenge.name.trim()) {
            showToast('Please enter a challenge name', 'error');
            return;
        }

        const { error } = await supabase
            .from('challenges')
            .insert({ ...newChallenge, creator_id: currentUserId });

        if (error) {
            showToast('Failed to create challenge', 'error');
        } else {
            showToast('Challenge created! 🏆', 'success');
            setShowCreate(false);
            setNewChallenge({
                name: '',
                description: '',
                challenge_type: 'total_reps',
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                is_public: true
            });
            fetchChallenges();
        }
    };

    const getChallengeIcon = (type: string) => {
        switch (type) {
            case 'total_reps': return <Target size={20} />;
            case 'total_workouts': return <Calendar size={20} />;
            case 'streak': return <Flame size={20} />;
            default: return <Trophy size={20} />;
        }
    };

    const getChallengeColor = (type: string) => {
        switch (type) {
            case 'total_reps': return 'from-orange-400 to-red-500';
            case 'total_workouts': return 'from-blue-400 to-indigo-500';
            case 'streak': return 'from-yellow-400 to-orange-500';
            default: return 'from-purple-400 to-pink-500';
        }
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Create Challenge Button */}
            <button
                onClick={() => setShowCreate(!showCreate)}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:shadow-purple-500/30 transition-shadow"
            >
                <Plus size={20} />
                Create Challenge
            </button>

            {/* Create Form */}
            {showCreate && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-4">
                    <input
                        type="text"
                        value={newChallenge.name}
                        onChange={(e) => setNewChallenge({ ...newChallenge, name: e.target.value })}
                        placeholder="Challenge name (e.g., 'December Push-Up Challenge')"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm"
                    />
                    <textarea
                        value={newChallenge.description}
                        onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })}
                        placeholder="Description (optional)"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm h-20 resize-none"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Type</label>
                            <select
                                value={newChallenge.challenge_type}
                                onChange={(e) => setNewChallenge({ ...newChallenge, challenge_type: e.target.value as any })}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm"
                            >
                                <option value="total_reps">Total Reps</option>
                                <option value="total_workouts">Total Workouts</option>
                                <option value="streak">Streak Days</option>
                                <option value="specific_exercise">Specific Exercise</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isPublic"
                                checked={newChallenge.is_public}
                                onChange={(e) => setNewChallenge({ ...newChallenge, is_public: e.target.checked })}
                                className="w-5 h-5 rounded"
                            />
                            <label htmlFor="isPublic" className="text-sm text-gray-600 dark:text-gray-300">Public</label>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={newChallenge.start_date}
                                onChange={(e) => setNewChallenge({ ...newChallenge, start_date: e.target.value })}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">End Date</label>
                            <input
                                type="date"
                                value={newChallenge.end_date}
                                onChange={(e) => setNewChallenge({ ...newChallenge, end_date: e.target.value })}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowCreate(false)}
                            className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={createChallenge}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 rounded-lg"
                        >
                            Create
                        </button>
                    </div>
                </div>
            )}

            {/* Active Challenges */}
            <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Trophy size={16} /> Active Challenges
                </h4>

                {challenges.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Trophy size={40} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No active challenges. Create one above!</p>
                    </div>
                ) : (
                    challenges.map(challenge => {
                        const isJoined = myParticipations.has(challenge.id);
                        const daysLeft = Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                        return (
                            <div key={challenge.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden">
                                <div className={`bg-gradient-to-r ${getChallengeColor(challenge.challenge_type)} p-4`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white/20 p-2 rounded-lg">
                                                {getChallengeIcon(challenge.challenge_type)}
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-white">{challenge.name}</h5>
                                                <p className="text-white/80 text-xs capitalize">{challenge.challenge_type.replace('_', ' ')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-white/80 text-xs">{daysLeft} days left</div>
                                            <div className="text-white flex items-center gap-1 text-sm">
                                                <Users size={14} />
                                                {challenge.participant_count}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    {challenge.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 flex-1 mr-4 line-clamp-1">
                                            {challenge.description}
                                        </p>
                                    )}
                                    <button
                                        onClick={() => isJoined ? leaveChallenge(challenge.id) : joinChallenge(challenge.id)}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1 transition-colors ${isJoined
                                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-100 hover:text-red-600'
                                            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                            }`}
                                    >
                                        {isJoined ? 'Leave' : 'Join'}
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChallengeList;
