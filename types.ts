export enum AppView {
  DASHBOARD = 'DASHBOARD',
  WORKOUT = 'WORKOUT',
  COACH_CHAT = 'COACH_CHAT',
  ANALYSIS = 'ANALYSIS'
}

export interface WorkoutSession {
  id: string;
  date: string;
  exercise: string;
  reps: number;
  weight: number;
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
