-- ALFAAZ — UNFILTERED: Audience Registration & Permanent Registration Type Migration
-- Run this idempotent migration once in your Supabase SQL Editor.
-- Safe & non-destructive: preserves all existing registrations, payments, check-ins,
-- audit logs, and leaves public.admin_users / is_alfaaz_admin() completely untouched.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add permanent server-controlled registration_type to registrations
DO $$
BEGIN
  IF to_regclass('public.registrations') IS NOT NULL THEN
    ALTER TABLE public.registrations
      ADD COLUMN IF NOT EXISTS registration_type text NOT NULL DEFAULT 'PARTICIPANT';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.registrations'::regclass
        AND conname = 'registrations_registration_type_check'
    ) THEN
      ALTER TABLE public.registrations
        ADD CONSTRAINT registrations_registration_type_check
        CHECK (registration_type IN ('PARTICIPANT', 'AUDIENCE'));
    END IF;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_registrations_registration_type
  ON public.registrations (registration_type, created_at DESC);

-- 2. Add permanent registration_type to payment_submissions
DO $$
BEGIN
  IF to_regclass('public.payment_submissions') IS NOT NULL THEN
    ALTER TABLE public.payment_submissions
      ADD COLUMN IF NOT EXISTS registration_type text NOT NULL DEFAULT 'PARTICIPANT';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.payment_submissions'::regclass
        AND conname = 'payment_submissions_registration_type_check'
    ) THEN
      ALTER TABLE public.payment_submissions
        ADD CONSTRAINT payment_submissions_registration_type_check
        CHECK (registration_type IN ('PARTICIPANT', 'AUDIENCE'));
    END IF;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_payment_submissions_registration_type
  ON public.payment_submissions (registration_type, registration_id);

-- 3. Add permanent registration_type to ticket_checkins and ticket_checkin_audit_logs
DO $$
BEGIN
  IF to_regclass('public.ticket_checkins') IS NOT NULL THEN
    ALTER TABLE public.ticket_checkins
      ADD COLUMN IF NOT EXISTS registration_type text NOT NULL DEFAULT 'PARTICIPANT';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.ticket_checkins'::regclass
        AND conname = 'ticket_checkins_registration_type_check'
    ) THEN
      ALTER TABLE public.ticket_checkins
        ADD CONSTRAINT ticket_checkins_registration_type_check
        CHECK (registration_type IN ('PARTICIPANT', 'AUDIENCE'));
    END IF;
  END IF;

  IF to_regclass('public.ticket_checkin_audit_logs') IS NOT NULL THEN
    ALTER TABLE public.ticket_checkin_audit_logs
      ADD COLUMN IF NOT EXISTS registration_type text NOT NULL DEFAULT 'PARTICIPANT';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.ticket_checkin_audit_logs'::regclass
        AND conname = 'ticket_checkin_audit_logs_registration_type_check'
    ) THEN
      ALTER TABLE public.ticket_checkin_audit_logs
        ADD CONSTRAINT ticket_checkin_audit_logs_registration_type_check
        CHECK (registration_type IN ('PARTICIPANT', 'AUDIENCE'));
    END IF;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_ticket_checkins_registration_type
  ON public.ticket_checkins (registration_type, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkin_audit_registration_type
  ON public.ticket_checkin_audit_logs (registration_type, created_at DESC);

-- 4. Safely backfill registration_type on linked tables from registrations
-- Existing rows default to PARTICIPANT. Only explicit AUDIENCE registrations propagate.
DO $$
BEGIN
  IF to_regclass('public.registrations') IS NOT NULL
     AND to_regclass('public.payment_submissions') IS NOT NULL THEN
    UPDATE public.payment_submissions AS ps
    SET registration_type = r.registration_type
    FROM public.registrations AS r
    WHERE ps.registration_id::text = r.id::text
      AND ps.registration_type IS DISTINCT FROM r.registration_type;
  END IF;

  IF to_regclass('public.registrations') IS NOT NULL
     AND to_regclass('public.ticket_checkins') IS NOT NULL THEN
    UPDATE public.ticket_checkins AS tc
    SET registration_type = r.registration_type
    FROM public.registrations AS r
    WHERE tc.registration_id::text = r.id::text
      AND tc.registration_type IS DISTINCT FROM r.registration_type;
  END IF;
END
$$;

-- 5. Update Server-Only Transactional Check-In & Reversal RPCs
-- Drop the legacy 7-argument overload so PostgREST resolves cleanly to the 8-argument signature.
DROP FUNCTION IF EXISTS public.perform_atomic_ticket_checkin(text, text, text, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.perform_atomic_ticket_checkin(
  p_ticket_id text,
  p_registration_id text,
  p_registration_code text,
  p_staff_user_id uuid,
  p_staff_email text,
  p_staff_name text,
  p_scan_method text DEFAULT 'qr',
  p_registration_type text DEFAULT 'PARTICIPANT'
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
  v_clean_reg_type text := CASE WHEN upper(trim(COALESCE(p_registration_type, 'PARTICIPANT'))) = 'AUDIENCE' THEN 'AUDIENCE' ELSE 'PARTICIPANT' END;
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
      registration_type,
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
      v_clean_reg_type,
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
        'registration_type', COALESCE(NULLIF(v_existing.registration_type, ''), v_clean_reg_type),
        'checked_in_at', v_existing.checked_in_at,
        'checked_in_by_name', COALESCE(NULLIF(v_existing.checked_in_by_name, ''), NULLIF(v_existing.checked_in_by_email, ''), 'Gate Staff'),
        'checked_in_by_email', v_existing.checked_in_by_email
      );
  END;

  INSERT INTO public.ticket_checkin_audit_logs (
    id,
    action,
    ticket_id,
    registration_id,
    registration_code,
    registration_type,
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
    v_clean_reg_type,
    p_staff_user_id,
    COALESCE(p_staff_email, ''),
    'staff',
    v_inserted.checked_in_at,
    p_staff_user_id,
    CASE WHEN v_clean_method = 'manual' THEN 'Manual gate check-in' ELSE 'QR camera check-in' END
  );

  RETURN jsonb_build_object(
    'outcome', 'ENTRY_APPROVED',
    'registration_type', v_inserted.registration_type,
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

  INSERT INTO public.ticket_checkin_audit_logs (
    id,
    action,
    ticket_id,
    registration_id,
    registration_code,
    registration_type,
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
    COALESCE(NULLIF(v_deleted.registration_type, ''), 'PARTICIPANT'),
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
    'registration_code', v_deleted.registration_code,
    'registration_type', COALESCE(NULLIF(v_deleted.registration_type, ''), 'PARTICIPANT')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.perform_atomic_ticket_checkin(text, text, text, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.perform_atomic_ticket_checkin(text, text, text, uuid, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.reverse_ticket_checkin_atomic(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_ticket_checkin_atomic(text, uuid, text, text) TO service_role;
