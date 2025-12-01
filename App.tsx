import React, { useState, useEffect } from 'react';
import { AppView, WorkoutSession } from './types';
import CameraWorkout from './components/CameraWorkout';
import Dashboard from './components/Dashboard';
import AskCoach from './components/AskCoach';
import MediaAnalyzer from './components/MediaAnalyzer';
import { Activity, Dumbbell, MessageSquare, Video } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.WORKOUT);
  const [history, setHistory] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('workout_history');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  const saveWorkout = (session: WorkoutSession) => {
    const newHistory = [...history, session];
    setHistory(newHistory);
    localStorage.setItem('workout_history', JSON.stringify(newHistory));
  };

  const NavButton = ({ view, icon: Icon, label }: { view: AppView, icon: any, label: string }) => (
    <button 
      onClick={() => setCurrentView(view)}
      className={`flex flex-col items-center justify-center py-2 flex-1 transition-colors ${currentView === view ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
    >
      <Icon size={24} className="mb-1" />
      <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-center px-4 shrink-0">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
          FitAI Coach
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {currentView === AppView.WORKOUT && <CameraWorkout onSaveWorkout={saveWorkout} />}
        {currentView === AppView.DASHBOARD && <Dashboard history={history} />}
        {currentView === AppView.COACH_CHAT && <AskCoach />}
        {currentView === AppView.ANALYSIS && <MediaAnalyzer />}
      </main>

      {/* Navigation */}
      <nav className="h-16 bg-gray-900 border-t border-gray-800 flex justify-around items-center shrink-0 z-50">
        <NavButton view={AppView.WORKOUT} icon={Dumbbell} label="Workout" />
        <NavButton view={AppView.DASHBOARD} icon={Activity} label="History" />
        <NavButton view={AppView.COACH_CHAT} icon={MessageSquare} label="Ask Coach" />
        <NavButton view={AppView.ANALYSIS} icon={Video} label="Analysis" />
      </nav>
    </div>
  );
};

export default App;
