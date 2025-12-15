import React, { useState, useEffect } from 'react';
import { Activity, Award, Target, Flame, Calendar, Dumbbell, ChevronDown } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { ActivityFeedItem } from '../../types';

const ActivityFeed: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 20;

    useEffect(() => {
        fetchActivities();
    }, []);

    const fetchActivities = async (loadMore = false) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const from = loadMore ? (page + 1) * PAGE_SIZE : 0;
        const to = from + PAGE_SIZE - 1;

        // This query respects RLS - only shows activities based on privacy
        const { data, error } = await supabase
            .from('activity_feed')
            .select(`
        *,
        profile:profiles(username, avatar_url, tier)
      `)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (data) {
            if (loadMore) {
                setActivities(prev => [...prev, ...data]);
                setPage(p => p + 1);
            } else {
                setActivities(data);
            }
            setHasMore(data.length === PAGE_SIZE);
        }
        setLoading(false);
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'workout': return <Dumbbell size={16} />;
            case 'badge': return <Award size={16} />;
            case 'streak': return <Flame size={16} />;
            case 'challenge_joined':
            case 'challenge_won': return <Target size={16} />;
            case 'plan_started':
            case 'plan_completed': return <Calendar size={16} />;
            default: return <Activity size={16} />;
        }
    };

    const getActivityColor = (type: string) => {
        switch (type) {
            case 'workout': return 'bg-emerald-500';
            case 'badge': return 'bg-yellow-500';
            case 'streak': return 'bg-orange-500';
            case 'challenge_joined': return 'bg-blue-500';
            case 'challenge_won': return 'bg-purple-500';
            case 'plan_started': return 'bg-indigo-500';
            case 'plan_completed': return 'bg-green-500';
            default: return 'bg-gray-500';
        }
    };

    const formatActivityText = (activity: ActivityFeedItem) => {
        const username = activity.profile?.username || 'Someone';
        const content = activity.content;

        switch (activity.activity_type) {
            case 'workout':
                return (
                    <>
                        <strong>{username}</strong> logged <strong>{content.reps}</strong> reps of{' '}
                        <strong>{content.exercise}</strong>
                        {content.weight > 0 && ` @ ${content.weight}lbs`}
                    </>
                );
            case 'badge':
                return (
                    <>
                        <strong>{username}</strong> earned the <strong>{content.badge_name}</strong> badge! 🏅
                    </>
                );
            case 'streak':
                return (
                    <>
                        <strong>{username}</strong> is on a <strong>{content.days}-day</strong> streak! 🔥
                    </>
                );
            case 'challenge_joined':
                return (
                    <>
                        <strong>{username}</strong> joined <strong>{content.challenge_name}</strong>
                    </>
                );
            case 'challenge_won':
                return (
                    <>
                        <strong>{username}</strong> won <strong>{content.challenge_name}</strong>! 🏆
                    </>
                );
            case 'plan_started':
                return (
                    <>
                        <strong>{username}</strong> started a new training plan: <strong>{content.plan_name}</strong>
                    </>
                );
            case 'plan_completed':
                return (
                    <>
                        <strong>{username}</strong> completed <strong>{content.plan_name}</strong>! 💪
                    </>
                );
            default:
                return <strong>{username}</strong>;
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <Activity size={48} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">No activity yet</p>
                <p className="text-sm">Log a workout or add friends to see activity here!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {activities.map(activity => (
                <div key={activity.id} className="flex gap-3 items-start">
                    {/* Avatar */}
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold">
                            {activity.profile?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${getActivityColor(activity.activity_type)} rounded-full flex items-center justify-center text-white`}>
                            {getActivityIcon(activity.activity_type)}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            {formatActivityText(activity)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {formatTime(activity.created_at)}
                        </p>
                    </div>
                </div>
            ))}

            {hasMore && (
                <button
                    onClick={() => fetchActivities(true)}
                    className="w-full py-3 text-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center justify-center gap-1"
                >
                    <ChevronDown size={16} />
                    Load more
                </button>
            )}
        </div>
    );
};

export default ActivityFeed;
