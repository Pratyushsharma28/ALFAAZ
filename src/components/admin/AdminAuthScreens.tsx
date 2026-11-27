import { FormEvent, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { EDITORIAL_EASE } from '../MotionPrimitives';

interface AdminAuthHeaderProps {
  onNavigatePublic: () => void;
}

function AdminAuthFrame({
  children,
  onNavigatePublic,
}: {
  children: React.ReactNode;
  onNavigatePublic: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="underground-surface relative flex min-h-screen flex-col justify-between px-4 py-8 text-[#EAE7E0] sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase">
            ALFAAZ <span className="text-[#FF1744]">UNFILTERED</span>
          </span>
          <span className="font-mono-num text-xs text-[#EAE7E0]/55 uppercase">
            · Admin Portal
          </span>
        </div>

        <button
          type="button"
          onClick={onNavigatePublic}
          className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 border border-[#EAE7E0]/20 bg-[#0B0B0D] px-4 py-2 text-xs font-medium text-[#EAE7E0]/85 transition-colors hover:border-[#EAE7E0]/45 hover:text-[#EAE7E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="whitespace-nowrap">Public Website</span>
        </button>
      </div>

      <motion.main
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.35, ease: EDITORIAL_EASE }}
        className="mx-auto my-8 w-full max-w-[460px]"
      >
        {children}
      </motion.main>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-col gap-1 border-t border-[#EAE7E0]/10 pt-5 text-xs text-[#EAE7E0]/50 sm:flex-row sm:items-center sm:justify-between">
        <span>Social and Cultural Team · Quad AI, Bengaluru</span>
        <span className="font-mono-num">Restricted Access · Supabase RLS Protected</span>
      </footer>
    </div>
  );
}

export function AdminConfigErrorView({
  configError,
  missingVars,
  onRetry,
  onNavigatePublic,
}: AdminAuthHeaderProps & {
  configError: string;
  missingVars: string[];
  onRetry: () => void;
}) {
  return (
    <AdminAuthFrame onNavigatePublic={onNavigatePublic}>
      <div className="border border-[#FF1744]/35 bg-[#0B0B0D] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-[#FF1744]">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="font-mono-num text-xs font-semibold tracking-widest uppercase">
            Configuration Required
          </span>
        </div>

        <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase">
          Supabase Environment Not Configured
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-[#EAE7E0]/75">{configError}</p>

        <div className="mt-5 border border-[#EAE7E0]/15 bg-[#050505] p-4">
          <p className="text-xs font-semibold text-[#EAE7E0]/85">
            Required Frontend Environment Variables
          </p>
          <ul className="mt-2.5 space-y-1.5 font-mono-num text-xs text-[#00E5FF]">
            {(missingVars.length > 0
              ? missingVars
              : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
            ).map((varName) => (
              <li key={varName}>{varName}=...</li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-[#EAE7E0]/60">
            Configure only your public Supabase project URL and public anon key. Never place a{' '}
            <code className="font-mono-num text-[#FF1744]">service_role</code> key in frontend
            environment variables.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-5 py-2 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:bg-[#ff2b54] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    </AdminAuthFrame>
  );
}

export function AdminLoginScreen({
  onLogin,
  isSubmitting,
  errorMessage,
  onNavigatePublic,
}: AdminAuthHeaderProps & {
  onLogin: (email: string, password: string) => Promise<void>;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || isSubmitting) return;
    await onLogin(email.trim(), password);
  };

  return (
    <AdminAuthFrame onNavigatePublic={onNavigatePublic}>
      <div className="border border-[#EAE7E0]/15 bg-[#0B0B0D] p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-[#FF1744]">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-mono-num text-xs font-semibold tracking-widest uppercase">
            Private Organizer Access
          </span>
        </div>

        <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-[#EAE7E0] uppercase">
          Admin Sign In
        </h1>
        <p className="mt-2 text-sm text-[#EAE7E0]/70">
          Authenticate with your authorized Supabase organizer account to manage ALFAAZ
          registrations and verify UPI payments.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 border border-[#FF1744]/45 bg-[#FF1744]/10 p-3.5 text-xs leading-relaxed text-[#EAE7E0]"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF1744]" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-semibold tracking-wider text-[#EAE7E0]/80 uppercase"
            >
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="organizer@quadai.edu"
              className="mt-1.5 w-full border border-[#EAE7E0]/20 bg-[#050505] px-3.5 py-2.5 text-sm text-[#EAE7E0] placeholder-[#EAE7E0]/35 transition-colors focus:border-[#FF1744] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold tracking-wider text-[#EAE7E0]/80 uppercase"
            >
              Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full border border-[#EAE7E0]/20 bg-[#050505] py-2.5 pr-11 pl-3.5 text-sm text-[#EAE7E0] placeholder-[#EAE7E0]/35 transition-colors focus:border-[#FF1744] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-[#EAE7E0]/55 transition-colors hover:text-[#EAE7E0]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password}
            className="mt-2 inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 border border-[#FF1744] bg-[#FF1744] px-5 py-2.5 font-display text-base font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:bg-[#ff2b54] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>{isSubmitting ? 'Verifying Admin Access...' : 'Sign In to Dashboard'}</span>
          </button>
        </form>

        <p className="mt-5 border-t border-[#EAE7E0]/10 pt-4 text-xs leading-relaxed text-[#EAE7E0]/55">
          Access is verified server-side against your Supabase{' '}
          <code className="font-mono-num text-[#EAE7E0]/80">admin_users</code> table and Row
          Level Security policies.
        </p>
      </div>
    </AdminAuthFrame>
  );
}

export function AdminAccessDeniedScreen({
  attemptedEmail,
  reason,
  onTryDifferentAccount,
  onNavigatePublic,
}: AdminAuthHeaderProps & {
  attemptedEmail?: string;
  reason: string;
  onTryDifferentAccount: () => void;
}) {
  return (
    <AdminAuthFrame onNavigatePublic={onNavigatePublic}>
      <div className="border border-[#FF1744]/45 bg-[#0B0B0D] p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-[#FF1744]">
          <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="font-mono-num text-xs font-semibold tracking-widest uppercase">
            Access Denied · 403
          </span>
        </div>

        <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-[#EAE7E0] uppercase">
          Unauthorized Account
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-[#EAE7E0]/75">{reason}</p>

        {attemptedEmail && (
          <div className="mt-4 border border-[#EAE7E0]/15 bg-[#050505] px-3.5 py-2.5 text-xs text-[#EAE7E0]/75">
            Attempted account:{' '}
            <span className="font-mono-num text-[#EAE7E0]">{attemptedEmail}</span>
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-[#EAE7E0]/60">
          Your session has been signed out. Ensure the authenticated user&apos;s UUID is inserted
          into <code className="font-mono-num text-[#EAE7E0]/85">admin_users</code> before trying
          again.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onTryDifferentAccount}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-5 py-2 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:bg-[#ff2b54]"
          >
            <span>Sign In with Admin Account</span>
          </button>

          <button
            type="button"
            onClick={onNavigatePublic}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-[#EAE7E0]/20 bg-[#050505] px-4 py-2 text-xs font-semibold tracking-wider text-[#EAE7E0]/85 uppercase transition-colors hover:border-[#EAE7E0]/45"
          >
            <span>Return to Website</span>
          </button>
        </div>
      </div>
    </AdminAuthFrame>
  );
}
