
import React, { useEffect, useState } from 'react';
import { Trophy, Users, ArrowRight, Calendar } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Challenge } from '../../types';
import { useToast } from '../Toast';

const FeaturedChallenge: React.FC = () => {
    const { showToast } = useToast();
    const [challenge, setChallenge] = useState<Challenge & { participant_count: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [joined, setJoined] = useState(false);

    useEffect(() => {
        fetchFeaturedChallenge();
    }, []);

    const fetchFeaturedChallenge = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Get the soonest ending active public challenge
            const { data, error } = await supabase
                .from('challenges')
                .select('*')
                .eq('is_public', true)
                .gt('end_date', new Date().toISOString())
                .order('end_date', { ascending: true })
                .limit(1)
                .single();

            if (data) {
                // Get participant count
                const { count } = await supabase
                    .from('challenge_participants')
                    .select('*', { count: 'exact', head: true })
                    .eq('challenge_id', data.id);

                // Check if user joined
                if (user) {
                    const { data: participation } = await supabase
                        .from('challenge_participants')
                        .select('id')
                        .eq('challenge_id', data.id)
                        .eq('user_id', user.id)
                        .single();
                    setJoined(!!participation);
                }

                setChallenge({ ...data, participant_count: count || 0 });
            }
        } catch (err) {
            console.error('Error fetching featured challenge:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!challenge) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('challenge_participants')
            .insert({ challenge_id: challenge.id, user_id: user.id });

        if (!error) {
            showToast("Challenge accepted! 🚀", "success");
            setJoined(true);
            setChallenge(prev => prev ? { ...prev, participant_count: prev.participant_count + 1 } : null);
        } else {
            showToast("Could not join challenge", "error");
        }
    };

    if (loading || !challenge) return null;

    return (
        <div className="bg-gradient-to-r from-orange-500 to-pink-600 rounded-3xl p-1 shadow-lg transform transition-all hover:scale-[1.01]">
            <div className="bg-white dark:bg-gray-900 rounded-[1.3rem] p-5 h-full relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 dark:bg-orange-900/30 p-2.5 rounded-xl text-orange-600 dark:text-orange-400">
                            <Trophy size={24} />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider block mb-0.5">Featured Event</span>
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{challenge.name}</h3>
                        </div>
                    </div>
                    <div className="text-right hidden sm:block">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">
                            <Users size={12} /> {challenge.participant_count}
                        </div>
                    </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 line-clamp-2">
                    {challenge.description || "Join the community in this limited-time fitness event!"}
                </p>

                <div className="flex items-center gap-3">
                    {joined ? (
                        <div className="flex-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 border border-green-200 dark:border-green-800">
                            <span>✓ Active Participant</span>
                        </div>
                    ) : (
                        <button
                            onClick={handleJoin}
                            className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-lg shadow-gray-900/10"
                        >
                            Join Challenge <ArrowRight size={16} />
                        </button>
                    )}
                    <div className="flex flex-col items-center justify-center px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Ends</span>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            {new Date(challenge.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeaturedChallenge;
