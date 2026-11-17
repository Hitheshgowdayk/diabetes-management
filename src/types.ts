export type NavPage =
  | 'dashboard'
  | 'glucose'
  | 'history'
  | 'analysis'
  | 'emergency'
  | 'hospitals'
  | 'nutrition'
  | 'reminders'
  | 'appointments'
  | 'profile';

export interface User {
  id: number;
  full_name: string;
  email: string;
}

export interface UserProfile {
  id: number;
  user_id: number;
  age: number | null;
  gender: string;
  diabetes_type: string;
  low_threshold: number;
  fasting_min: number;
  fasting_max: number;
  post_meal_max: number;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  doctor_name: string;
  doctor_phone: string;
  updated_at: string;
}

export interface GlucoseTargets {
  low_threshold: number;
  fasting_min: number;
  fasting_max: number;
  post_meal_max: number;
}

export interface GlucoseReading {
  id: number;
  user_id: number;
  reading_value: number;
  reading_type: 'fasting' | 'post_meal';
  recorded_at: string;
  evaluation_label: string;
  evaluation_status: 'low' | 'normal' | 'elevated' | 'high';
  notes: string;
}

export interface GlucoseEvaluation {
  label: string;
  status: 'low' | 'normal' | 'elevated' | 'high';
  message: string;
  warning: string | null;
  targetDescription: string;
}

export interface ReadingCategoryStats {
  count: number;
  avg_value: number | null;
  min_value: number | null;
  max_value: number | null;
  latest: GlucoseReading | null;
}

export interface GlucoseSummary {
  totalReadings: number;
  latestReading: GlucoseReading | null;
  fastingSummary: ReadingCategoryStats;
  postMealSummary: ReadingCategoryStats;
  recentReadings: GlucoseReading[];
  upcomingAppointments: Appointment[];
  activeRemindersCount: number;
  targets: GlucoseTargets;
}

export interface MedicineReminder {
  id: number;
  user_id: number;
  medicine_name: string;
  dosage: string;
  frequency: string;
  reminder_date: string;
  reminder_time: string;
  instructions: string;
  is_active: number;
  created_at: string;
}

export interface Appointment {
  id: number;
  user_id: number;
  doctor_name: string;
  specialty: string;
  clinic_name: string;
  appointment_date: string;
  appointment_time: string;
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
}

export interface NutritionArticle {
  id: number;
  category: string;
  title: string;
  summary: string;
  content: string;
  sort_order: number;
}

export interface HospitalFacility {
  id: string;
  name: string;
  facilityType: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  emergency: boolean;
  lat: number;
  lon: number;
  distanceKm: number;
  source: string;
}
