/**
 * Veritabanı fonksiyonlarının dönüş biçimleri.
 *
 * Bu tipler elle yazıldı, üretilmedi. `supabase gen types` çıktısı jsonb
 * dönen fonksiyonlar için `Json` der ve panel tarafında hiçbir şey
 * güvenceye alınmaz. Fonksiyon imzası değişirse buranın da değişmesi
 * gerektiği bilinçli bir maliyet — karşılığında ekranlar alan adlarını
 * derleme anında doğruluyor.
 */

export type AdminRole = 'owner' | 'admin' | 'support';

export interface AdminOverview {
  generated_at: string;
  users: {
    total: number;
    confirmed: number;
    banned: number;
    new_24h: number;
    new_7d: number;
    new_30d: number;
  };
  activity: { dau: number; wau: number; mau: number };
  records: {
    rides: number;
    shifts: number;
    expenses: number;
    fuel_logs: number;
    vehicles: number;
    earning_sources: number;
    recurring_expenses: number;
    goals: number;
  };
  money: {
    gross_kurus: number;
    commission_kurus: number;
    net_kurus: number;
    tip_kurus: number;
    expense_kurus: number;
    fuel_kurus: number;
  };
  sync: { rows_24h: number; last_write_at: string | null };
}

export interface GrowthPoint {
  day: string;
  signups: number;
  active_users: number;
  rides: number;
  net_kurus: number;
}

export interface UserListRow {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  banned: boolean;
  admin_role: AdminRole | null;
  vehicle_count: number;
  ride_count: number;
  last_activity_at: string | null;
  net_total_kurus: number;
  total_count: number;
}

export interface UserDetail {
  user: {
    id: string;
    email: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
    banned_until: string | null;
    admin_role: AdminRole | null;
  };
  settings: {
    day_cutoff_hour: number;
    region_code: string;
    onboarding_completed_at: number | null;
  } | null;
  counts: Record<string, number>;
  money: {
    gross_kurus: number;
    commission_kurus: number;
    net_kurus: number;
    tip_kurus: number;
    expense_kurus: number;
    fuel_kurus: number;
  };
  range: {
    first_business_date: string | null;
    last_business_date: string | null;
    last_activity_at: string | null;
  };
}

export interface UserRecords {
  table: string;
  total: number;
  rows: Record<string, unknown>[];
}

export type HealthSeverity = 'critical' | 'warning' | 'info';

export interface HealthCheck {
  key: string;
  label: string;
  severity: HealthSeverity;
  count: number;
  samples: string[];
}

export interface SystemHealth {
  generated_at: string;
  checks: HealthCheck[];
  fuel_prices: {
    regions: number;
    rows: number;
    latest_effective_date: string | null;
    last_fetched_at: string | null;
    hours_since_fetch: number | null;
    stale_combinations: number;
  };
  volumes: {
    rides_24h: number;
    shifts_24h: number;
    expenses_24h: number;
    fuel_logs_24h: number;
    soft_deleted: number;
  };
}

export interface FuelPrice {
  id: string;
  region_code: string;
  fuel_type: string;
  unit_price_kurus: number;
  effective_date: string;
  source: string;
  fetched_at: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  platform: 'all' | 'ios' | 'android';
  min_app_version: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlag {
  key: string;
  description: string;
  is_enabled: boolean;
  rollout_percent: number;
  updated_at: string;
}

export interface AdminUserRow {
  user_id: string;
  role: AdminRole;
  note: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  admin_id: string | null;
  admin_email: string | null;
  source: 'admin' | 'system';
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}
