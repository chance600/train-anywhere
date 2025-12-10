import React from 'react';
import { WorkoutSession } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Flame, Play } from 'lucide-react';

interface DashboardProps {
  history: WorkoutSession[];
  onStartWorkout?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ history, onStartWorkout }) => {
  // Group by date for the chart
  const data = history.slice(-7).map(session => ({
    date: new Date(session.date).toLocaleDateString(undefined, { weekday: 'short' }),
    volume: session.reps * session.weight,
    reps: session.reps
  }));

  // Calculate Streak
  const calculateStreak = () => {
    if (history.length === 0) return 0;
    const uniqueDates = Array.from(new Set(history.map(s => new Date(s.date).toDateString())))
      .map((d: string) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());

    if (uniqueDates.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // If no workout today or yesterday, streak is broken (0)
    // Unless we want to show the streak that *just* ended? Usually 0.
    // Let's say if last workout was yesterday, streak is alive.
    const lastWorkout = uniqueDates[0];
    if (lastWorkout.getTime() !== today.getTime() && lastWorkout.getTime() !== yesterday.getTime()) {
      return 0;
    }

    let streak = 1;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const curr = uniqueDates[i];
      const prev = uniqueDates[i + 1]; // older date
      const diffTime = curr.getTime() - prev.getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);

      if (Math.round(diffDays) === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const streak = calculateStreak();

  return (

    <div className="p-4 sm:p-6 bg-white dark:bg-gray-900 min-h-full text-gray-900 dark:text-white overflow-y-auto transition-colors duration-300">
      <h2 className="text-3xl sm:text-2xl font-bold mb-6 sm:mb-4 text-emerald-500 dark:text-emerald-400">Progress Tracker</h2>

      {history.length === 0 && (
        <div className="mb-8 p-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl text-center">
          <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Flame className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Welcome to FitAI Coach!</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-sm mx-auto">
            Your personal AI trainer is ready. We use your camera to count reps and correct your form in real-time.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-left max-w-2xl mx-auto">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <span className="block font-bold text-sm mb-1">📷 AI Vision</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">No sensors needed. Just your camera.</span>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <span className="block font-bold text-sm mb-1">🗣️ Real-time Coaching</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Audio feedback on your form.</span>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <span className="block font-bold text-sm mb-1">📊 Auto Tracking</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Reps & Sets logged automatically.</span>
            </div>
          </div>
          <button
            onClick={onStartWorkout}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-full shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2 mx-auto"
          >
            <Play size={20} fill="currentColor" /> Start First Workout
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-gray-50 dark:bg-gray-800 p-5 sm:p-4 rounded-xl flex flex-col justify-between relative overflow-hidden min-h-[100px] sm:min-h-auto border border-gray-200 dark:border-gray-700 transition-colors">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-xs uppercase font-medium">Day Streak</p>
            <p className="text-4xl sm:text-3xl font-bold text-orange-500 flex items-center gap-2 mt-2 sm:mt-0">
              {streak} <Flame size={28} fill="currentColor" className={`sm:w-6 sm:h-6 ${streak > 0 ? "animate-pulse" : "text-gray-400 dark:text-gray-600"}`} />
            </p>
          </div>
          {streak > 3 && <div className="absolute -right-4 -bottom-4 opacity-10"><Flame size={100} /></div>}
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-5 sm:p-4 rounded-xl min-h-[100px] sm:min-h-auto border border-gray-200 dark:border-gray-700 transition-colors">
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-xs uppercase font-medium">Recent Volume</p>
          <p className="text-4xl sm:text-3xl font-bold mt-2 sm:mt-0 text-gray-900 dark:text-white">{history.length > 0 ? (history[history.length - 1].reps * history[history.length - 1].weight) : 0} <span className="text-base sm:text-sm text-gray-500">kg</span></p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-5 sm:p-4 rounded-xl h-72 sm:h-64 mb-6 border border-gray-200 dark:border-gray-700 transition-colors">
        <h3 className="text-base sm:text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Volume (Last 7 Sets)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
            <YAxis stroke="#9CA3AF" fontSize={11} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
              itemStyle={{ color: '#10B981' }}
            />
            <Bar dataKey="volume" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors">
        <h3 className="text-base sm:text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Recent History</h3>
        <div className="space-y-3">
          {history.length === 0 ? <p className="text-gray-500 italic text-sm">No workouts yet.</p> : history.slice().reverse().map((session) => (
            <div key={session.id} className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3 min-h-[52px]">
              <div>
                <p className="font-bold text-base sm:text-sm">{session.exercise}</p>
                <p className="text-xs text-gray-400">{new Date(session.date).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 font-bold text-base sm:text-sm">{session.reps} reps</p>
                <p className="text-xs text-gray-400">@ {session.weight}kg</p>
              </div>
            </div>
          ))}
          {history.length === 0 && <p className="text-gray-500 text-center py-6 sm:py-4">No workouts logged yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
