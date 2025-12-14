import React from 'react';
import { CreditCard, Check, Star, Shield, AlertTriangle, Sparkles, AlertCircle } from 'lucide-react';

interface SubscriptionManagerProps {
    isPro: boolean;
    status?: string | null;
    onUpgrade: () => void;
    onManage: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ isPro, status, onUpgrade, onManage }) => {
    // Status Badge Helpers
    const getStatusColor = () => {
        if (!isPro) return 'bg-gray-100 text-gray-600';
        if (status === 'past_due') return 'bg-red-100 text-red-600';
        if (status === 'canceled') return 'bg-orange-100 text-orange-600';
        return 'bg-emerald-100 text-emerald-600';
    };

    const getStatusText = () => {
        if (!isPro) return 'Free Tier';
        if (status === 'past_due') return 'Payment Failed';
        if (status === 'canceled') return 'Canceled (Active)';
        return 'Pro Active';
    };

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl">
            {/* Header / Status */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Subscription Plan
                        {isPro && <Sparkles className="w-5 h-5 text-purple-500 fill-purple-500" />}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isPro ? 'Manage your premium access.' : 'Upgrade to unlock AI features.'}
                    </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor()}`}>
                    {getStatusText()}
                </div>
            </div>

            {/* Warning for Past Due */}
            {status === 'past_due' && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
                    <AlertCircle size={16} />
                    <span>Your payment failed. Please update your card in the portal to keep access.</span>
                </div>
            )}

            {!isPro ? (
                <div className="space-y-6">
                    <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 p-6 rounded-lg border border-emerald-500/20">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-emerald-500/20 rounded-lg">
                                <Star className="text-emerald-400" size={24} />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-white mb-2">Upgrade to Pro</h4>
                                <ul className="space-y-2 text-gray-300 text-sm mb-4">
                                    <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Unlimited AI Log Scanning</li>
                                    <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Advanced Rep Counting</li>
                                    <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Voice Coaching</li>
                                </ul>
                                <button
                                    onClick={onUpgrade}
                                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    Subscribe for $9.99/mo <CreditCard size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                        <div className="flex items-center gap-3 mb-2">
                            <Shield className="text-emerald-400" size={20} />
                            <span className="font-medium text-white">Pro Benefits Active</span>
                        </div>
                        <p className="text-sm text-gray-400">
                            You have full access to all AI features. Thank you for supporting the app!
                        </p>
                    </div>

                    <button
                        onClick={onManage}
                        className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors border border-gray-500"
                    >
                        Manage Subscription
                    </button>
                    <p className="text-xs text-center text-gray-500">
                        Update payment method or cancel anytime via Stripe.
                    </p>
                </div>
            )}
        </div>
    );
};

export default SubscriptionManager;
