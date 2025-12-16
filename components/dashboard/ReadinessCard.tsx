
import React from 'react';
import { Activity, Watch, Smartphone, Link } from 'lucide-react';
import { useToast } from '../Toast';

const ReadinessCard: React.FC = () => {
    const { showToast } = useToast();

    const handleConnect = () => {
        showToast("Health integrations coming soon!", "info");
    };

    return (
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white text-center relative overflow-hidden shadow-xl group">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"></div>

            <div className="relative z-10 flex flex-col items-center">
                <div className="bg-white/20 backdrop-blur-sm w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-white/10">
                    <Activity size={28} className="text-white" />
                </div>

                <h3 className="font-bold text-xl mb-2">Health Sync</h3>
                <p className="text-sm text-indigo-100 mb-6 max-w-xs leading-relaxed">
                    Connect your wearable to unlock AI recovery insights and auto-adjust your training volume.
                </p>

                <div className="flex gap-4 mb-6 opacity-70">
                    <Watch size={20} />
                    <Smartphone size={20} />
                    <Activity size={20} />
                </div>

                <button
                    onClick={handleConnect}
                    className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-50 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg"
                >
                    <Link size={16} />
                    Connect Device
                </button>
            </div>
        </div>
    );
};

export default ReadinessCard;

