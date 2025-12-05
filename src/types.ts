export type Bindings = {
  DB: D1Database;
};

export type User = {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'consultant' | 'boss' | 'region_manager' | 'business_unit_manager';
  boss_id?: number;
  division?: string;
  region?: string;
  location?: string;
  title?: string;
  active: number;
  created_at: string;
  last_login?: string;
};

export type Level = {
  id: number;
  title: string;
  description?: string;
  order_index: number;
  is_boss_level: number;
  active: number;
  created_at: string;
};

export type TrainingMaterial = {
  id: number;
  level_id: number;
  title: string;
  description?: string;
  material_type: 'powerpoint' | 'video' | 'word' | 'excel' | 'other';
  sharepoint_url: string;
  order_index: number;
  created_at: string;
};

export type Test = {
  id: number;
  level_id: number;
  title: string;
  description?: string;
  pass_percentage: number;
  time_limit_minutes?: number;
  created_at: string;
};

export type Question = {
  id: number;
  test_id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'open_text';
  order_index: number;
  points: number;
  created_at: string;
};

export type AnswerOption = {
  id: number;
  question_id: number;
  option_text: string;
  is_correct: number;
  order_index: number;
};

export type UserProgress = {
  id: number;
  user_id: number;
  level_id: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'awaiting_signoff';
  started_at?: string;
  completed_at?: string;
};

export type TestAttempt = {
  id: number;
  user_id: number;
  test_id: number;
  score: number;
  max_score: number;
  percentage: number;
  passed: number;
  started_at: string;
  completed_at: string;
};

export type SignoffRequest = {
  id: number;
  user_id: number;
  level_id: number;
  boss_id: number;
  evidence_notes?: string;
  evidence_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  boss_feedback?: string;
  requested_at: string;
  reviewed_at?: string;
};

export type UserStreak = {
  id: number;
  user_id: number;
  current_login_streak: number;
  longest_login_streak: number;
  current_test_streak: number;
  longest_test_streak: number;
  current_practice_streak: number;
  longest_practice_streak: number;
  last_login_date?: string;
  last_test_date?: string;
  last_practice_date?: string;
  total_points: number;
};

export type Achievement = {
  id: number;
  code: string;
  title: string;
  description: string;
  icon?: string;
  points: number;
};

export type LeaderboardEntry = {
  id: number;
  user_id: number;
  rungs_completed: number;
  days_used: number;
  total_points: number;
  rank?: number;
  league?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  updated_at: string;
};

export type JWTPayload = {
  userId: number;
  email: string;
  role: string;
  exp: number;
};
