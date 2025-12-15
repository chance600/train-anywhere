export enum AppView {
  DASHBOARD = 'DASHBOARD',
  WORKOUT = 'WORKOUT',
  PLAN = 'PLAN',
  TRIBE = 'TRIBE',
  PROFILE = 'PROFILE', // Accessed via header avatar
  IMPORT = 'IMPORT', // Accessed via Dashboard quick action
  COACH_CHAT = 'COACH_CHAT' // Accessed via Dashboard FAB
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
  avgRepDuration?: number; // [NEW] Tempo tracking (seconds per rep)
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

export interface DaySchedule {
  day: string;
  focus: string;
  exercises: {
    name: string;
    sets: number;
    reps: string;
    notes?: string;
  }[];
}

export interface WeekSchedule {
  week_order: number;
  days: DaySchedule[];
}

export interface WorkoutPlan {
  name: string;
  description: string;
  schedule: {
    weeks: WeekSchedule[];
  };
}

// ============================================
// Phase 9.4: Notification Preferences
// ============================================

export interface NotificationPreferences {
  id: string;
  user_id: string;
  enabled: boolean;

  // Reminder Types
  inactivity_reminders: boolean;
  plan_reminders: boolean;
  daily_log_reminders: boolean;
  streak_reminders: boolean;
  challenge_reminders: boolean;

  // Timing
  preferred_reminder_time: string; // HH:MM format
  timezone: string;
  inactive_days_threshold: number;

  // Do Not Disturb
  dnd_start_time: string;
  dnd_end_time: string;
  quiet_days: string[]; // ['Sunday', 'Saturday']

  // Rate Limiting
  max_notifications_per_day: number;
  min_hours_between_notifications: number;

  // Style
  notification_style: 'friendly' | 'motivational' | 'minimal';

  // Web Push
  push_subscription?: PushSubscriptionJSON;
}

// ============================================
// Phase 10: Social Features
// ============================================

export type UserRole = 'athlete' | 'coach' | 'admin';
export type PrivacyLevel = 'public' | 'friends_only' | 'private';
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  // Joined profile data
  requester?: Profile;
  addressee?: Profile;
}

export interface CoachAthlete {
  id: string;
  coach_id: string;
  athlete_id: string;
  status: 'pending' | 'active' | 'declined' | 'ended';
  notes?: string;
  created_at: string;
  // Joined profile data
  coach?: Profile;
  athlete?: Profile;
}

export interface ActivityFeedItem {
  id: string;
  user_id: string;
  activity_type: 'workout' | 'badge' | 'plan_started' | 'plan_completed' | 'challenge_joined' | 'challenge_won' | 'streak' | 'milestone';
  content: Record<string, any>;
  created_at: string;
  // Joined profile
  profile?: Profile;
}

export interface Challenge {
  id: string;
  creator_id: string;
  name: string;
  description?: string;
  challenge_type: 'total_reps' | 'total_workouts' | 'specific_exercise' | 'streak';
  target_exercise?: string;
  goal_value?: number;
  start_date: string;
  end_date: string;
  is_public: boolean;
  created_at: string;
  // Computed
  participant_count?: number;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  score: number;
  rank?: number;
  joined_at: string;
  // Joined
  profile?: Profile;
}
