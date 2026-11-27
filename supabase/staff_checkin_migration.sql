-- ALFAAZ — UNFILTERED: Event Staff Check-In & Admin Audit Schema
-- Run this migration once in your Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Authorized Event Check-In Staff (managed strictly by admins)
CREATE TABLE IF NOT EXISTS public.staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'checkin_staff',
  is_active boolean NOT NULL DEFAULT true,
  authorized_by uuid REFERENCES auth.users(id),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_users_active ON public.staff_users (user_id, is_active);

-- 2. Ticket Check-Ins (UNIQUE constraints prevent simultaneous double check-ins atomically)
CREATE TABLE IF NOT EXISTS public.ticket_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL UNIQUE,
  registration_id text NOT NULL UNIQUE,
  registration_code text NOT NULL DEFAULT '',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_in_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  checked_in_by_email text NOT NULL DEFAULT '',
  checked_in_by_name text NOT NULL DEFAULT '',
  scan_method text NOT NULL DEFAULT 'qr' CHECK (scan_method IN ('qr', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_checkins_time ON public.ticket_checkins (checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_checkins_staff ON public.ticket_checkins (checked_in_by_user_id);

-- 3. Immutable Audit Log for Check-Ins and Admin Reversals
CREATE TABLE IF NOT EXISTS public.ticket_checkin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('CHECKED_IN', 'REVERSED')),
  ticket_id text NOT NULL,
  registration_id text NOT NULL,
  registration_code text NOT NULL DEFAULT '',
  performed_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  performed_by_email text NOT NULL DEFAULT '',
  performed_by_role text NOT NULL CHECK (performed_by_role IN ('staff', 'admin')),
  original_checked_in_at timestamptz,
  original_staff_user_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkin_audit_created ON public.ticket_checkin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_audit_ticket ON public.ticket_checkin_audit_logs (ticket_id);

-- 4. Strict Row-Level Security (RLS)
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_checkin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper predicates inside policies rely on existing admin_users table
DROP POLICY IF EXISTS "Admins manage staff_users" ON public.staff_users;
CREATE POLICY "Admins manage staff_users"
  ON public.staff_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.user_id = auth.uid() AND COALESCE(a.is_active, true) = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.user_id = auth.uid() AND COALESCE(a.is_active, true) = true
    )
  );

DROP POLICY IF EXISTS "Staff can read own active record" ON public.staff_users;
CREATE POLICY "Staff can read own active record"
  ON public.staff_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_active = true AND revoked_at IS NULL);

DROP POLICY IF EXISTS "Admins manage ticket_checkins" ON public.ticket_checkins;
CREATE POLICY "Admins manage ticket_checkins"
  ON public.ticket_checkins
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.user_id = auth.uid() AND COALESCE(a.is_active, true) = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.user_id = auth.uid() AND COALESCE(a.is_active, true) = true
    )
  );

DROP POLICY IF EXISTS "Active staff can view and record checkins" ON public.ticket_checkins;
CREATE POLICY "Active staff can view and record checkins"
  ON public.ticket_checkins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.user_id = auth.uid() AND s.is_active = true AND s.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Active staff insert own checkin" ON public.ticket_checkins;
CREATE POLICY "Active staff insert own checkin"
  ON public.ticket_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    checked_in_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.user_id = auth.uid() AND s.is_active = true AND s.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins read audit logs" ON public.ticket_checkin_audit_logs;
CREATE POLICY "Admins read audit logs"
  ON public.ticket_checkin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.user_id = auth.uid() AND COALESCE(a.is_active, true) = true
    )
  );
