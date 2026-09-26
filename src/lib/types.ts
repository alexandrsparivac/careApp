export type Role = 'admin' | 'caregiver' | 'family'
export type Lang = 'ro' | 'en' | 'ru'

export interface Profile {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: Role
  language: Lang
  is_active: boolean
  created_at: string
}

export type PersonRef = Pick<Profile, 'id' | 'full_name'>

export interface Elder {
  id: string
  full_name: string
  birth_date: string | null
  gender: 'female' | 'male' | 'other' | null
  address: string | null
  medical_conditions: string | null
  allergies: string | null
  medications: string | null
  mobility_notes: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  created_at: string
}

export interface ElderMember {
  elder_id: string
  user_id: string
  relationship: string | null
  profile?: Profile | null
}

export const ACTIVITY_CATEGORIES = ['medication', 'hygiene', 'nutrition', 'mobility', 'medical', 'social', 'other'] as const
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]

export const ACTIVITY_STATUSES = ['planned', 'done', 'missed', 'cancelled'] as const
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]

export interface CareActivity {
  id: string
  elder_id: string
  series_id: string | null
  title: string
  description: string | null
  category: ActivityCategory
  scheduled_at: string
  duration_minutes: number | null
  assigned_to: string | null
  status: ActivityStatus
  completed_at: string | null
  completed_by: string | null
  completion_notes: string | null
  created_by: string | null
  created_at: string
  elder?: { id: string; full_name: string } | null
  assignee?: PersonRef | null
  completer?: PersonRef | null
}

export const MOODS = ['very_good', 'good', 'neutral', 'bad', 'very_bad'] as const
export type Mood = (typeof MOODS)[number]

export interface Observation {
  id: string
  elder_id: string
  author_id: string | null
  observed_at: string
  mood: Mood | null
  pain_level: number | null
  systolic: number | null
  diastolic: number | null
  heart_rate: number | null
  temperature: number | null
  glucose: number | null
  oxygen_saturation: number | null
  appetite: 'good' | 'reduced' | 'none' | null
  sleep_quality: 'good' | 'fair' | 'poor' | null
  notes: string | null
  is_alert: boolean
  created_at: string
  author?: { full_name: string } | null
  elder?: { id: string; full_name: string } | null
}

export const EVENT_TYPES = ['appointment', 'visit', 'incident', 'fall', 'hospitalization', 'medication_change', 'other'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const IMPORTANCE_LEVELS = ['low', 'normal', 'high', 'critical'] as const
export type Importance = (typeof IMPORTANCE_LEVELS)[number]

export interface CareEvent {
  id: string
  elder_id: string
  type: EventType
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  importance: Importance
  created_by: string | null
  created_at: string
  elder?: { id: string; full_name: string } | null
  creator?: { full_name: string } | null
}

export interface Message {
  id: string
  elder_id: string
  sender_id: string | null
  content: string
  created_at: string
  sender?: { full_name: string; role: Role } | null
}

export type NotificationType =
  | 'new_message'
  | 'new_event'
  | 'important_event'
  | 'health_alert'
  | 'activity_assigned'
  | 'activity_done'
  | 'activity_missed'
  | 'activity_reminder'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  payload: Record<string, unknown>
  elder_id: string | null
  link: string | null
  is_read: boolean
  created_at: string
}
