import { ApiHttpError, type NodeHttpRequest } from './httpUtils.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

export interface AuthenticatedParticipant {
  userId: string;
  email: string;
}

export function extractBearerToken(req: NodeHttpRequest): string {
  const rawAuth = req.headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!authHeader || typeof authHeader !== 'string') {
    throw new ApiHttpError(
      401,
      'Authentication required. Please verify your email via OTP or magic link.',
      'UNAUTHENTICATED'
    );
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? '';
  if (!token) {
    throw new ApiHttpError(
      401,
      'Missing bearer token. Please sign in again.',
      'UNAUTHENTICATED'
    );
  }

  return token;
}

/**
 * Cryptographically verifies the participant's Supabase Auth JWT on the server
 * via supabaseAdmin.auth.getUser(token). Never trusts client-supplied emails or IDs.
 */
export async function requireAuthenticatedParticipant(
  req: NodeHttpRequest
): Promise<AuthenticatedParticipant> {
  const token = extractBearerToken(req);
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new ApiHttpError(
      401,
      'Your verification session has expired or is invalid. Please request a new email code.',
      'UNAUTHENTICATED'
    );
  }

  const email = (data.user.email ?? '').trim().toLowerCase();
  if (!email) {
    throw new ApiHttpError(
      403,
      'Your account does not have a verified email address.',
      'EMAIL_NOT_VERIFIED'
    );
  }

  const isEmailConfirmed = Boolean(
    data.user.email_confirmed_at ||
      (data.user as { confirmed_at?: string | null }).confirmed_at
  );
  if (!isEmailConfirmed) {
    throw new ApiHttpError(
      403,
      'Email verification is incomplete. Please enter the verification code or click the link sent to your email.',
      'EMAIL_NOT_VERIFIED'
    );
  }

  return {
    userId: data.user.id,
    email,
  };
}
