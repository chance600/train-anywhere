
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Shield, CheckCircle, Lock } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { useToast } from './Toast';

interface TermsModalProps {
    session: Session;
    onSigned: () => void;
}

export const LATEST_TERMS_VERSION = 'v1.0';

const TermsModal: React.FC<TermsModalProps> = ({ session, onSigned }) => {
    const { showToast } = useToast();
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // Check if scrolled to bottom (with small buffer)
        if (scrollHeight - scrollTop - clientHeight < 50) {
            setScrolledToBottom(true);
        }
    };

    const handleAccept = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.from('user_agreements').insert({
                user_id: session.user.id,
                document_version: LATEST_TERMS_VERSION,
                document_type: 'liability_waiver',
                user_agent: navigator.userAgent
            });

            if (error) throw error;
            onSigned();
        } catch (error) {
            console.error("Error signing terms:", error);
            showToast("Failed to submit agreement. Please try again.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-3 justify-center mb-2">
                        <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-full">
                            <Shield className="text-emerald-500" size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Safety First</h2>
                    </div>
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                        Please review and accept our liability waiver to continue.
                    </p>
                </div>

                <div
                    onScroll={handleScroll}
                    className="h-64 overflow-y-auto p-6 text-sm text-gray-600 dark:text-gray-300 space-y-4 bg-gray-50/50 dark:bg-gray-900/20"
                >
                    <p className="font-bold text-gray-900 dark:text-white">1. Assumption of Risk</p>
                    <p>
                        You agreed that by participating in physical exercise or training activities, you do so entirely at your own risk.
                        You agree that you are voluntarily participating in these activities and use of these facilities and premises
                        and assume all risks of injury, illness, or death.
                    </p>

                    <p className="font-bold text-gray-900 dark:text-white">2. Medical Clearance</p>
                    <p>
                        You acknowledge that you have either had a physical examination and have been given your physician's permission
                        to participate, or that you have decided to participate in activity and use of equipment and machinery without
                        the approval of your physician and do hereby assume all responsibility for your participation and activities.
                    </p>

                    <p className="font-bold text-gray-900 dark:text-white">3. Release of Liability</p>
                    <p>
                        You agree to release and discharge FitAI Coach (and TrainAnywhere Inc.) from any and all claims or causes of action
                        (known or unknown) arising out of negligence of FitAI Coach.
                    </p>

                    <p className="font-mono text-xs text-gray-400 pt-4">Version: {LATEST_TERMS_VERSION}</p>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <button
                        onClick={handleAccept}
                        disabled={!scrolledToBottom || loading}
                        className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                        bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:shadow-emerald-500/20"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <>
                                {scrolledToBottom ? <CheckCircle size={20} /> : <Lock size={20} />}
                                {scrolledToBottom ? "I Agree & Continue" : "Scroll to Read All"}
                            </>
                        )}
                    </button>
                    {!scrolledToBottom && (
                        <p className="text-xs text-center text-gray-400 mt-2">Please read the full text to enable the button.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TermsModal;
