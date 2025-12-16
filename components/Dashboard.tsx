import React from 'react';
import { WorkoutSession } from '../types';
import ReadinessCard from './dashboard/ReadinessCard';
import InsightsCard from './dashboard/InsightsCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Flame, Play, Calendar, Upload, MessageCircle } from 'lucide-react';
import { WorkoutPlan } from '../types';

interface DashboardProps {
  history: WorkoutSession[];
  onStartWorkout?: () => void;
  onImport?: () => void;
  onAskCoach?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ history, onStartWorkout, onImport, onAskCoach }) => {
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

  const [activePlan, setActivePlan] = React.useState<WorkoutSession | null>(null);
  const [nextWorkout, setNextWorkout] = React.useState<any>(null);

  React.useEffect(() => {
    const fetchActivePlan = async () => {
      const { data: { session } } = await import('../services/supabaseClient').then(m => m.supabase.auth.getSession());
      if (session) {
        const { data } = await import('../services/supabaseClient').then(m => m.supabase
          .from('workout_plans')
          .select('name, schedule')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .single());

        if (data) {
          // MVP: Just show Week 1 Day 1
          const firstDay = data.schedule.weeks[0]?.days[0];
          setNextWorkout({
            planName: data.name,
            day: firstDay.day,
            focus: firstDay.focus,
            exercises: firstDay.exercises
          });
        }
      }
    };
    fetchActivePlan();
  }, []);

  return (

    <div className="p-4 sm:p-6 bg-white dark:bg-gray-900 min-h-full text-gray-900 dark:text-white overflow-y-auto transition-colors duration-300">
      <h2 className="text-3xl sm:text-2xl font-bold mb-4 sm:mb-3 text-emerald-500 dark:text-emerald-400">Progress Tracker</h2>

      {/* Quick Actions - Always Visible */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={onImport}
          className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <Upload size={20} className="text-white" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900 dark:text-white">Import</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Apple Health & more</p>
          </div>
        </button>
        <button
          onClick={onAskCoach}
          className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
        >
          <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
            <MessageCircle size={20} className="text-white" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900 dark:text-white">Ask Coach</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Get AI advice</p>
          </div>
        </button>
      </div>



      {/* Weekly Insights */}
      <div className="mb-6">
        <InsightsCard history={history} />
      </div>

      {/* Active Plan Card */}
      {nextWorkout && (
        <div className="mb-6 p-5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Active Plan</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{nextWorkout.planName}</h3>
            </div>
            <Calendar className="text-indigo-500" size={24} />
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-indigo-100 dark:border-indigo-500/20 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-gray-700 dark:text-gray-200">{nextWorkout.day}</span>
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded-full">{nextWorkout.focus}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{nextWorkout.exercises.length} Exercises • Estimated 45 min</p>
          </div>

          <button
            onClick={onStartWorkout}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Play size={20} fill="currentColor" /> Start {nextWorkout.focus}
          </button>
        </div>
      )}

      {history.length === 0 && (
        <div className="mb-8 p-6 bg-gradient-to-r from-emerald-900 to-teal-900 border border-emerald-500/20 rounded-2xl text-center relative overflow-hidden">
          {/* Trust Badge */}
          <div className="absolute top-4 right-4 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 backdrop-blur-sm">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Beta</span>
          </div>

          <div className="h-14 w-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <Flame className="w-7 h-7 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-white">Let's Get Moving</h3>
          <p className="text-gray-300 mb-8 max-w-md mx-auto text-sm leading-relaxed">
            Point your camera, start lifting. We'll count your reps.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left max-w-2xl mx-auto">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
              <span className="block font-bold text-emerald-400 text-sm mb-1">📹 Rep Counting</span>
              <span className="text-xs text-gray-400">Camera tracks your movements</span>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
              <span className="block font-bold text-emerald-400 text-sm mb-1">📊 Progress Tracking</span>
              <span className="text-xs text-gray-400">See your gains over time</span>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
              <span className="block font-bold text-emerald-400 text-sm mb-1">🤖 AI Coach</span>
              <span className="text-xs text-gray-400">Ask questions, get answers</span>
            </div>
          </div>
          <button
            onClick={onStartWorkout}
            className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2 mx-auto ring-4 ring-emerald-500/10"
          >
            <Play size={20} fill="currentColor" /> Start Workout
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
      <div className="mb-6">
        <ReadinessCard />
      </div>
    </div>
  );
};

export default Dashboard;
