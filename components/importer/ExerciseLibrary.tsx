import React, { useState } from 'react';
import { Search, Loader2, Dumbbell, ChevronRight, Info } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../Toast';

interface Exercise {
    id: string;
    name: string;
    body_part: string;
    equipment: string;
    target: string;
    gif_url: string;
    similarity?: number;
}

const ExerciseLibrary: React.FC = () => {
    const { showToast } = useToast();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setSelectedExercise(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-exercises`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                },
                body: JSON.stringify({ query })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setResults(data.exercises || []);
        } catch (error) {
            console.error('Search error:', error);
            showToast('Failed to search exercises', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden items-center justify-center p-8 text-center">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-4 rounded-full mb-4 animate-pulse">
                <Dumbbell size={48} className="text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">The Knowledge Graph</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                We are indexing thousands of exercises with sports science data.
                <br />
                <span className="font-bold text-emerald-500">Coming Soon via AI Search.</span>
            </p>
            <div className="flex gap-2 text-xs font-mono text-gray-400 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800">
                <span>Phase 3</span>
                <span>•</span>
                <span>Indexing...</span>
            </div>
        </div>
    );
};

export default ExerciseLibrary;
