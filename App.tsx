import React, { useState, useEffect } from 'react';
import { AppView, WorkoutSession } from './types';
import Dashboard from './components/Dashboard';
import CameraWorkout from './components/CameraWorkout';
import AskCoach from './components/AskCoach';
import MediaAnalyzer from './components/MediaAnalyzer';
import Auth from './components/Auth';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import { LayoutDashboard, Dumbbell, MessageSquare, ScanEye, Trophy, User, Sun, Moon, LogIn, FileText, Loader2 } from 'lucide-react';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import WorkoutImporter from './components/WorkoutImporter';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  /* Removed duplicate session */
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { theme, setTheme } = useTheme();

  const [isPro, setIsPro] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Load User Session & Profile
  useEffect(() => {
    // Load local history for guest mode first
    const saved = localStorage.getItem('workout_history');
    if (saved) {
      setHistory(JSON.parse(saved));
    }

    const initApp = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session) {
          await fetchProfile(session.user.id);
          fetchHistory(session.user.id);
        }
      } catch (e) {
        console.error("Init Error:", e);
      } finally {
        setIsInitializing(false);
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchHistory(session.user.id);
      } else {
        setIsPro(false);
        setSubscriptionStatus(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_pro, subscription_status')
      .eq('id', userId)
      .single();

    if (data) {
      setIsPro(data.is_pro || false);
      setSubscriptionStatus(data.subscription_status);
    }
  };

  const fetchHistory = async (userId: string) => {
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (data) {
      // Map DB types to App types
      const formatted = data.map(d => ({
        id: d.id,
        date: d.created_at,
        exercise: d.exercise,
        reps: d.reps,
        weight: 0, // DB doesn't have weight yet, default to 0
        score: d.score
      }));
      setHistory(formatted);
    }
  };

  const handleSaveWorkout = async (workout: any) => {
    if (session) {
      // Save to Supabase
      const { error } = await supabase.from('workouts').insert({
        user_id: session.user.id,
        exercise: workout.exercise,
        reps: workout.reps,
        score: workout.score || 0, // Fallback
        duration_seconds: 0
      });

      if (!error) {
        // Update Profile Stats for Leaderboard
        const { data: profile } = await supabase
          .from('profiles')
          .select('total_reps, total_workouts')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          await supabase.from('profiles').update({
            total_reps: (profile.total_reps || 0) + workout.reps,
            total_workouts: (profile.total_workouts || 0) + 1,
            last_workout_at: new Date().toISOString()
          }).eq('id', session.user.id);
        }

        fetchHistory(session.user.id);
      }
    } else {
      // Local Save (Guest)
      const newHistory = [...history, workout];
      setHistory(newHistory);
      localStorage.setItem('workout_history', JSON.stringify(newHistory));

      // Fire-and-forget Analytics Log
      supabase.from('anonymous_workouts').insert({
        exercise: workout.exercise,
        reps: workout.reps
      }).then(({ error }) => {
        if (error) console.error('Analytics Log Error:', error);
      });
    }
    setCurrentView(AppView.DASHBOARD);
  };

  if (isInitializing) {
    return (
      <div className={`h-screen w-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300`}>
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Loading TrainAnywhere...</p>
      </div>
    );
  }

  if (!session && !isGuest) {
    return <Auth onLogin={() => { }} onGuest={() => setIsGuest(true)} />;
  }

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard history={history} onStartWorkout={() => setCurrentView(AppView.WORKOUT)} />;
      case AppView.WORKOUT:
        return <CameraWorkout onSaveWorkout={handleSaveWorkout} onFocusChange={setIsFocusMode} isPro={isPro} />;
      case AppView.COACH_CHAT:
        return <AskCoach />;
      case AppView.ANALYSIS:
        return <MediaAnalyzer />;
      case AppView.LEADERBOARD:
        return <Leaderboard />;
      case AppView.PROFILE:
        return <Profile session={session} isPro={isPro} subscriptionStatus={subscriptionStatus} />;
      case AppView.IMPORT:
        return <WorkoutImporter onImportComplete={() => {
          if (session) {
            fetchProfile(session.user.id);
            fetchHistory(session.user.id);
          }
          setCurrentView(AppView.DASHBOARD);
        }} isPro={isPro} />;
      default:
        return <Dashboard onStartWorkout={() => setCurrentView(AppView.WORKOUT)} />;
    }
  };

  const NavButton = ({ view, icon: Icon, label }: { view: AppView, icon: any, label: string }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`flex flex-col items-center justify-center py-3 px-2 flex-1 transition-all min-h-[60px] sm:min-h-[44px] ${currentView === view
        ? 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 rounded-xl'
        : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-xl'
        }`}
    >
      <Icon size={28} className="mb-1 sm:mb-0.5" strokeWidth={currentView === view ? 2.5 : 2} />
      <span className="text-[11px] sm:text-[10px] font-medium uppercase tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden transition-colors duration-300">
      {/* Header */}
      {!isFocusMode && (
        <header className="h-16 sm:h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 shrink-0 pt-safe transition-colors duration-300">
          <h1 className="text-2xl sm:text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500 bg-clip-text text-transparent">
            FitAI Coach
          </h1>
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {/* Login Button for Guests */}
            {isGuest && (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
              >
                <LogIn size={16} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        {renderView()}
      </main>

      {/* Navigation */}
      {!isFocusMode && (
        <nav className="h-20 sm:h-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-around items-center gap-1 px-2 shrink-0 z-50 pb-safe transition-colors duration-300">
          <NavButton view={AppView.DASHBOARD} icon={LayoutDashboard} label="Home" />
          <NavButton view={AppView.WORKOUT} icon={Dumbbell} label="Workout" />
          <NavButton view={AppView.IMPORT} icon={FileText} label="Import" />
          <NavButton view={AppView.COACH_CHAT} icon={MessageSquare} label="Coach" />
          <NavButton view={AppView.LEADERBOARD} icon={Trophy} label="Rank" />
          <NavButton view={AppView.PROFILE} icon={User} label="Profile" />
        </nav>
      )}

      {/* Auth Modal for Guests */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
            <Auth onLogin={() => { setShowAuthModal(false); setIsGuest(false); }} onGuest={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => (
  <ThemeProvider defaultTheme="dark" storageKey="fitai-ui-theme">
    <AppContent />
  </ThemeProvider>
);

export default App;
