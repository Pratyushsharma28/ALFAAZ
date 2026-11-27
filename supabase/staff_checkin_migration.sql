- ALFAAZ — UNFILTERED: Event Staff Check-In & Admin Audit Schema
-- Run this m-igration once in your Supabase SQL Editor.

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

-- 4. Strict Row-Level Security (RLS) & Privilege Hardening
-- All staff check-in, gate lookup, staff management, and reversal flows run
-- exclusively through authenticated server endpoints using SUPABASE_SERVICE_ROLE_KEY.
-- Direct browser/client access via anon or authenticated JWTs is denied.
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_checkins FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_checkin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_checkin_audit_logs FORCE ROW LEVEL SECURITY;

-- Remove all prior permissive client policies on check-in/staff/audit tables
DROP POLICY IF EXISTS "Admins manage staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Staff can read own active record" ON public.staff_users;
DROP POLICY IF EXISTS "Admins manage ticket_checkins" ON public.ticket_checkins;
DROP POLICY IF EXISTS "Active staff can view and record checkins" ON public.ticket_checkins;
DROP POLICY IF EXISTS "Active staff insert own checkin" ON public.ticket_checkins;
DROP POLICY IF EXISTS "Admins read audit logs" ON public.ticket_checkin_audit_logs;

-- Revoke direct table privileges from PUBLIC, anon, and authenticated roles
REVOKE ALL ON TABLE public.staff_users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ticket_checkins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ticket_checkin_audit_logs FROM PUBLIC, anon, authenticated;

-- Grant server-side service_role access (audit logs remain append-only: SELECT + INSERT only)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ticket_checkins TO service_role;
GRANT SELECT, INSERT ON TABLE public.ticket_checkin_audit_logs TO service_role;

-- 5. Enforce database-level append-only immutability on audit logs
CREATE OR REPLACE FUNCTION public.prevent_ticket_checkin_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'public.ticket_checkin_audit_logs is append-only; UPDATE and DELETE operations are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ticket_checkin_audit_log_mutation ON public.ticket_checkin_audit_logs;
CREATE TRIGGER trg_prevent_ticket_checkin_audit_log_mutation
  BEFORE UPDATE OR DELETE ON public.ticket_checkin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ticket_checkin_audit_log_mutation();

-- 6. Transactional Server-Only RPC Functions (executed strictly by service_role)
-- All ticket signature & payment-status verification happens in the trusted
-- server endpoint BEFORE calling perform_atomic_ticket_checkin.
CREATE OR REPLACE FUNCTION public.perform_atomic_ticket_checkin(
  p_ticket_id text,
  p_registration_id text,
  p_registration_code text,
  p_staff_user_id uuid,
  p_staff_email text,
  p_staff_name text,
  p_scan_method text DEFAULT 'qr'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_ticket_id text := upper(trim(COALESCE(p_ticket_id, '')));
  v_clean_reg_id text := trim(COALESCE(p_registration_id, ''));
  v_clean_reg_code text := trim(COALESCE(p_registration_code, ''));
  v_clean_method text := CASE WHEN lower(trim(COALESCE(p_scan_method, 'qr'))) = 'manual' THEN 'manual' ELSE 'qr' END;
  v_now timestamptz := now();
  v_inserted public.ticket_checkins%ROWTYPE;
  v_existing public.ticket_checkins%ROWTYPE;
BEGIN
  IF v_clean_ticket_id = '' OR v_clean_reg_id = '' THEN
    RAISE EXCEPTION 'ticket_id and registration_id are required for check-in.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.ticket_checkins (
      id,
      ticket_id,
      registration_id,
      registration_code,
      checked_in_at,
      checked_in_by_user_id,
      checked_in_by_email,
      checked_in_by_name,
      scan_method
    )
    VALUES (
      gen_random_uuid(),
      v_clean_ticket_id,
      v_clean_reg_id,
      v_clean_reg_code,
      v_now,
      p_staff_user_id,
      COALESCE(p_staff_email, ''),
      COALESCE(p_staff_name, ''),
      v_clean_method
    )
    RETURNING * INTO v_inserted;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT *
      INTO v_existing
      FROM public.ticket_checkins
      WHERE ticket_id = v_clean_ticket_id
         OR registration_id = v_clean_reg_id
      LIMIT 1;

      RETURN jsonb_build_object(
        'outcome', 'ALREADY_CHECKED_IN',
        'checked_in_at', v_existing.checked_in_at,
        'checked_in_by_name', COALESCE(NULLIF(v_existing.checked_in_by_name, ''), NULLIF(v_existing.checked_in_by_email, ''), 'Gate Staff'),
        'checked_in_by_email', v_existing.checked_in_by_email
      );
  END;

  -- Same transaction: if inserting into ticket_checkin_audit_logs fails,
  -- PostgreSQL rolls back the ticket_checkins insert automatically.
  INSERT INTO public.ticket_checkin_audit_logs (
    id,
    action,
    ticket_id,
    registration_id,
    registration_code,
    performed_by_user_id,
    performed_by_email,
    performed_by_role,
    original_checked_in_at,
    original_staff_user_id,
    reason
  )
  VALUES (
    gen_random_uuid(),
    'CHECKED_IN',
    v_clean_ticket_id,
    v_clean_reg_id,
    v_clean_reg_code,
    p_staff_user_id,
    COALESCE(p_staff_email, ''),
    'staff',
    v_inserted.checked_in_at,
    p_staff_user_id,
    CASE WHEN v_clean_method = 'manual' THEN 'Manual gate check-in' ELSE 'QR camera check-in' END
  );

  RETURN jsonb_build_object(
    'outcome', 'ENTRY_APPROVED',
    'checked_in_at', v_inserted.checked_in_at,
    'checked_in_by_name', COALESCE(NULLIF(v_inserted.checked_in_by_name, ''), p_staff_name),
    'checked_in_by_email', v_inserted.checked_in_by_email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_ticket_checkin_atomic(
  p_ticket_id text,
  p_admin_user_id uuid,
  p_admin_email text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_ticket_id text := upper(trim(COALESCE(p_ticket_id, '')));
  v_clean_reason text := left(trim(COALESCE(p_reason, '')), 300);
  v_deleted public.ticket_checkins%ROWTYPE;
BEGIN
  IF v_clean_ticket_id = '' THEN
    RAISE EXCEPTION 'Ticket ID is required to reverse a check-in.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_clean_reason) < 3 THEN
    RAISE EXCEPTION 'Reversal reason must be at least 3 characters.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.ticket_checkins
  WHERE ticket_id = v_clean_ticket_id
  RETURNING * INTO v_deleted;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'reversed', false,
      'not_found', true,
      'ticket_id', v_clean_ticket_id
    );
  END IF;

  -- Same transaction: if inserting the REVERSED audit row fails,
  -- PostgreSQL rolls back the DELETE from ticket_checkins automatically.
  INSERT INTO public.ticket_checkin_audit_logs (
    id,
    action,
    ticket_id,
    registration_id,
    registration_code,
    performed_by_user_id,
    performed_by_email,
    performed_by_role,
    original_checked_in_at,
    original_staff_user_id,
    reason
  )
  VALUES (
    gen_random_uuid(),
    'REVERSED',
    v_deleted.ticket_id,
    v_deleted.registration_id,
    v_deleted.registration_code,
    p_admin_user_id,
    COALESCE(p_admin_email, ''),
    'admin',
    v_deleted.checked_in_at,
    v_deleted.checked_in_by_user_id,
    v_clean_reason
  );

  RETURN jsonb_build_object(
    'reversed', true,
    'not_found', false,
    'ticket_id', v_deleted.ticket_id,
    'registration_id', v_deleted.registration_id,
    'registration_code', v_deleted.registration_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.perform_atomic_ticket_checkin(text, text, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.perform_atomic_ticket_checkin(text, text, text, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.reverse_ticket_checkin_atomic(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_ticket_checkin_atomic(text, uuid, text, text) TO service_role;
