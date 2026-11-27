import type { Session } from '@supabase/supabase-js';
import { getParticipantSupabaseClient } from '../lib/participantSupabaseClient';
import type {
  ParticipantPortalPayload,
  TicketQrVerificationResponse,
} from '../types/participant';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

function apiUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export class ParticipantApiError extends Error {
  readonly statusCode?: number;
  readonly code?: string;

  constructor(message: string, statusCode?: number, code?: string) {
    super(message);
    this.name = 'ParticipantApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function getParticipantAccessToken(): Promise<string> {
  const supabase = getParticipantSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new ParticipantApiError(
      'Please verify your email to view your registrations and tickets.',
      401,
      'UNAUTHENTICATED'
    );
  }
  return data.session.access_token;
}

export async function getActiveParticipantSession(): Promise<Session | null> {
  const supabase = getParticipantSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return null;
  }
  return data.session ?? null;
}

export async function requestParticipantEmailOtp(email: string): Promise<{
  cooldownSeconds: number;
}> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
    throw new ParticipantApiError('Please enter a valid email address.', 400, 'VALIDATION_ERROR');
  }

  // 1. Enforce server-side rate limiting before dispatching Supabase OTP
  let precheckRes: Response;
  try {
    precheckRes = await fetch(apiUrl('/api/participant/auth/request-otp'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email: cleanEmail }),
    });
  } catch {
    throw new ParticipantApiError(
      'Unable to reach the verification server. Please check your internet connection.',
      0,
      'NETWORK_ERROR'
    );
  }

  let precheckJson: Record<string, unknown> | null = null;
  try {
    precheckJson = (await precheckRes.json()) as Record<string, unknown>;
  } catch {
    precheckJson = null;
  }

  if (!precheckRes.ok) {
    const msg =
      typeof precheckJson?.message === 'string'
        ? precheckJson.message
        : `Unable to initiate verification (${precheckRes.status}).`;
    throw new ParticipantApiError(
      msg,
      precheckRes.status,
      typeof precheckJson?.error === 'string' ? precheckJson.error : undefined
    );
  }

  // 2. Dispatch Email OTP + Magic Link via Supabase Auth
  const supabase = getParticipantSupabaseClient();
  const redirectUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/my-tickets` : undefined;

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    throw new ParticipantApiError(
      error.message || 'Unable to send verification email via Supabase Auth.',
      400,
      'SUPABASE_OTP_ERROR'
    );
  }

  const cooldown =
    typeof precheckJson?.cooldownSeconds === 'number' ? precheckJson.cooldownSeconds : 60;
  return { cooldownSeconds: cooldown };
}

export async function verifyParticipantEmailOtp(
  email: string,
  otpCode: string
): Promise<Session> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = otpCode.replace(/\s+/g, '');

  if (!/^\d{6,8}$/.test(cleanToken)) {
    throw new ParticipantApiError(
      'Enter the 6-digit verification code sent to your email.',
      400,
      'VALIDATION_ERROR'
    );
  }

  const supabase = getParticipantSupabaseClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: 'email',
  });

  if (error || !data.session) {
    throw new ParticipantApiError(
      error?.message || 'Invalid or expired verification code. Please request a new code.',
      401,
      'INVALID_OTP'
    );
  }

  return data.session;
}

export async function signOutParticipant(): Promise<void> {
  const supabase = getParticipantSupabaseClient();
  await supabase.auth.signOut();
}

export async function fetchMyRegistrations(): Promise<ParticipantPortalPayload> {
  const token = await getParticipantAccessToken();

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/participant/registrations'), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new ParticipantApiError(
      'Unable to reach the registrations server. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = (await response.json()) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  if (!response.ok || !parsed) {
    const msg =
      typeof parsed?.message === 'string'
        ? parsed.message
        : `Unable to fetch registrations (${response.status}).`;
    throw new ParticipantApiError(
      msg,
      response.status,
      typeof parsed?.error === 'string' ? parsed.error : undefined
    );
  }

  return parsed as unknown as ParticipantPortalPayload;
}

export async function resubmitRejectedProofWithProgress(params: {
  registrationId: string;
  utr: string;
  proofFile: File;
  onProgress?: (percent: number) => void;
}): Promise<{
  registrationId: string;
  registrationCode: string;
  status: string;
  utr: string;
  message: string;
}> {
  const token = await getParticipantAccessToken();
  const url = apiUrl('/api/participant/resubmit-proof');

  const body = new FormData();
  body.append('registrationId', params.registrationId);
  body.append('utr', params.utr.trim());
  body.append('proof', params.proofFile);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        params.onProgress?.(Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100))));
      }
    };

    xhr.onerror = () => {
      reject(
        new ParticipantApiError(
          'Unable to upload payment proof. Please check your connection and try again.',
          0,
          'NETWORK_ERROR'
        )
      );
    };

    xhr.onload = () => {
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : null;
      } catch {
        parsed = null;
      }

      if (xhr.status < 200 || xhr.status >= 300 || !parsed) {
        const msg =
          typeof parsed?.message === 'string'
            ? parsed.message
            : `Failed to resubmit payment proof (${xhr.status}).`;
        reject(
          new ParticipantApiError(
            msg,
            xhr.status,
            typeof parsed?.error === 'string' ? parsed.error : undefined
          )
        );
        return;
      }

      params.onProgress?.(100);
      resolve(
        parsed as {
          registrationId: string;
          registrationCode: string;
          status: string;
          utr: string;
          message: string;
        }
      );
    };

    xhr.send(body);
  });
}

export async function downloadConfirmedTicketPdf(params: {
  registrationId: string;
  fallbackCode: string;
}): Promise<void> {
  const token = await getParticipantAccessToken();
  const query = new URLSearchParams({ registrationId: params.registrationId });

  let response: Response;
  try {
    response = await fetch(apiUrl(`/api/participant/ticket?${query.toString()}`), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new ParticipantApiError(
      'Unable to download ticket PDF. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }

  if (!response.ok) {
    let message = `Unable to generate ticket PDF (${response.status}).`;
    try {
      const errJson = (await response.json()) as { message?: unknown };
      if (typeof errJson.message === 'string') {
        message = errJson.message;
      }
    } catch {
      // ignore non-JSON error
    }
    throw new ParticipantApiError(message, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
  const fileName =
    nameMatch?.[1] || `ALFAAZ-Ticket-${params.fallbackCode.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export async function verifyTicketQrCode(params: {
  ticketId: string;
  registrationId: string;
  signature: string;
}): Promise<TicketQrVerificationResponse> {
  const query = new URLSearchParams({
    ticketId: params.ticketId,
    reg: params.registrationId,
    sig: params.signature,
  });

  let response: Response;
  try {
    response = await fetch(apiUrl(`/api/tickets/verify?${query.toString()}`), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new ParticipantApiError(
      'Unable to reach ticket verification server.',
      0,
      'NETWORK_ERROR'
    );
  }

  const parsed = (await response.json()) as TicketQrVerificationResponse & { message?: string };
  if (!response.ok) {
    throw new ParticipantApiError(
      parsed?.message || `Ticket verification failed (${response.status}).`,
      response.status
    );
  }

  return parsed;
}
