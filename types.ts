export enum AppView {
  DASHBOARD = 'DASHBOARD',
  WORKOUT = 'WORKOUT',
  COACH_CHAT = 'COACH_CHAT',
  ANALYSIS = 'ANALYSIS',
  LEADERBOARD = 'LEADERBOARD',
  PROFILE = 'PROFILE',
  IMPORT = 'IMPORT'
}

export interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  total_reps: number;
  total_workouts: number;
  tier: string;
  // Subscription Fields
  is_pro?: boolean;
  is_public?: boolean;
  stripe_customer_id?: string;
  subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
}

export interface Badge {
  id: string;
  badge_type: string;
  earned_at: string;
}

export interface WorkoutSession {
  id: string;
  date: string;
  exercise: string;
  reps: number;
  weight: number;
  score?: number;
}

export interface DBWorkout {
  id: string;
  user_id: string;
  exercise: string;
  reps: number;
  score: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  isLoading?: boolean;
}

export enum LiveConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}
