import React from 'react';
import { WorkoutSession } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardProps {
  history: WorkoutSession[];
}

const Dashboard: React.FC<DashboardProps> = ({ history }) => {
  // Group by date for the chart
  const data = history.slice(-7).map(session => ({
    date: new Date(session.date).toLocaleDateString(undefined, { weekday: 'short' }),
    volume: session.reps * session.weight,
    reps: session.reps
  }));

  return (
    <div className="p-6 bg-gray-900 min-h-full text-white">
      <h2 className="text-2xl font-bold mb-6 text-emerald-400">Progress Tracker</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-xl">
          <p className="text-gray-400 text-xs uppercase">Total Workouts</p>
          <p className="text-3xl font-bold">{history.length}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl">
          <p className="text-gray-400 text-xs uppercase">Recent Volume</p>
          <p className="text-3xl font-bold">{history.length > 0 ? (history[history.length-1].reps * history[history.length-1].weight) : 0} <span className="text-sm text-gray-500">kg</span></p>
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded-xl h-64 mb-6">
        <h3 className="text-sm font-bold text-gray-300 mb-4">Volume (Last 7 Sets)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
              itemStyle={{ color: '#10B981' }}
            />
            <Bar dataKey="volume" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-800 p-4 rounded-xl">
        <h3 className="text-sm font-bold text-gray-300 mb-4">Recent History</h3>
        <div className="space-y-3">
          {history.slice().reverse().map((session) => (
            <div key={session.id} className="flex justify-between items-center border-b border-gray-700 pb-2">
              <div>
                <p className="font-bold">{session.exercise}</p>
                <p className="text-xs text-gray-400">{new Date(session.date).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 font-bold">{session.reps} reps</p>
                <p className="text-xs text-gray-400">@ {session.weight}kg</p>
              </div>
            </div>
          ))}
          {history.length === 0 && <p className="text-gray-500 text-center py-4">No workouts logged yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
