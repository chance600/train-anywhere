import React, { useEffect, useState } from 'react';
import { Activity, Moon, Heart, Zap, Plus } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useToast } from '../Toast';

interface Biometrics {
    sleep_score: number;
    hrv_ms: number;
    resting_hr: number;
    readiness_score: number;
    date: string;
}

const ReadinessCard: React.FC = () => {
    const { showToast } = useToast();
    const [data, setData] = useState<Biometrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [showInput, setShowInput] = useState(false);

    // Manual Input State
    const [inputs, setInputs] = useState({
        sleep: 75,
        hrv: 40,
        rhr: 60
    });

    useEffect(() => {
        fetchTodayBiometrics();
    }, []);

    const fetchTodayBiometrics = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('daily_biometrics')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('date', today)
            .single();

        if (data) setData(data);
        setLoading(false);
    };

    const handleSave = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { error } = await supabase
            .from('daily_biometrics')
            .upsert({
                user_id: session.user.id,
                date: new Date().toISOString().split('T')[0],
                sleep_score: inputs.sleep,
                hrv_ms: inputs.hrv,
                resting_hr: inputs.rhr,
                source: 'manual'
            });

        if (!error) {
            fetchTodayBiometrics();
            setShowInput(false);
            showToast("Biometrics saved!", "success");
        } else {
            showToast("Failed to save biometrics", "error");
        }
    };

    if (loading) return <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse"></div>;

    const score = data?.readiness_score || 0;
    const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    const chartData = [
        { name: 'Score', value: score },
        { name: 'Remaining', value: 100 - score }
    ];

    if (!data && !showInput) {
        return (
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white text-center">
                <div className="bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Activity size={24} />
                </div>
                <h3 className="font-bold text-lg mb-1">How are you ready?</h3>
                <p className="text-sm text-indigo-100 mb-4">Log your sleep & HRV to get a daily readiness score.</p>
                <button
                    onClick={() => setShowInput(true)}
                    className="bg-white text-indigo-600 px-6 py-2 rounded-full font-bold text-sm hover:bg-indigo-50 transition-colors"
                >
                    Check Readiness
                </button>
            </div>
        );
    }

    if (showInput) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Log Biometrics</h3>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1">
                            <Moon size={14} /> Sleep Score (0-100)
                        </label>
                        <input
                            type="number"
                            className="w-full bg-gray-100 dark:bg-gray-700 rounded-lg p-2 text-sm"
                            value={inputs.sleep}
                            onChange={e => setInputs({ ...inputs, sleep: parseInt(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1">
                            <Zap size={14} /> HRV (ms)
                        </label>
                        <input
                            type="number"
                            className="w-full bg-gray-100 dark:bg-gray-700 rounded-lg p-2 text-sm"
                            value={inputs.hrv}
                            onChange={e => setInputs({ ...inputs, hrv: parseInt(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1">
                            <Heart size={14} /> Resting HR (bpm)
                        </label>
                        <input
                            type="number"
                            className="w-full bg-gray-100 dark:bg-gray-700 rounded-lg p-2 text-sm"
                            value={inputs.rhr}
                            onChange={e => setInputs({ ...inputs, rhr: parseInt(e.target.value) })}
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setShowInput(false)} className="flex-1 py-2 text-sm text-gray-500">Cancel</button>
                    <button onClick={handleSave} className="flex-1 bg-emerald-500 text-white rounded-lg py-2 text-sm font-bold">Save</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 flex gap-6 items-center">
            {/* Chart */}
            <div className="relative w-24 h-24 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={32}
                            outerRadius={40}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell key="primary" fill={color} />
                            <Cell key="bg" fill="#e5e7eb" />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-xl font-bold dark:text-white">{score}</span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                    {score >= 80 ? 'Prime Readiness' : score >= 50 ? 'Moderate Readiness' : 'Low Readiness'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {score >= 80 ? 'Your body is fully recovered. Push hard today!' :
                        score >= 50 ? 'You are doing okay, but consider moderate volume.' :
                            'Focus on active recovery. Your nervous system needs rest.'}
                </p>

                <div className="flex gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Moon size={12} className="text-indigo-400" /> {data?.sleep_score}%
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Zap size={12} className="text-yellow-400" /> {data?.hrv_ms}ms
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Heart size={12} className="text-red-400" /> {data?.resting_hr}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReadinessCard;
