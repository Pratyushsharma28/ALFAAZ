import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { getSupabaseClient, getSupabaseConfigStatus } from '../../lib/supabaseClient';
import {
  AdminApiError,
  exportRegistrationsCsv,
  fetchAdminDashboardData,
  getCurrentVerifiedAdmin,
  signInAdminWithPassword,
  signOutAdminSession,
} from '../../services/adminApi';
import {
  AdminDashboardPayload,
  AdminPaymentSubmissionRecord,
  AdminRegistrationRecord,
  AdminUserRecord,
} from '../../types/admin';
import { EDITORIAL_EASE } from '../MotionPrimitives';
import {
  AdminAccessDeniedScreen,
  AdminConfigErrorView,
  AdminLoginScreen,
} from './AdminAuthScreens';
import {
  ENTRY_TYPE_META,
  formatDateTime,
  formatInr,
  PAYMENT_STATUS_META,
} from './AdminFormatters';
import { AdminPaymentVerificationView } from './AdminPaymentVerificationView';
import { AdminProofViewerModal } from './AdminProofViewerModal';
import { AdminRegistrationDetailDrawer } from './AdminRegistrationDetailDrawer';
import { AdminRegistrationsView } from './AdminRegistrationsView';

type AdminTab = 'overview' | 'registrations' | 'verification';

type AuthGateState =
  | { status: 'checking' }
  | { status: 'not_configured'; configError: string; missingVars: string[] }
  | { status: 'unauthenticated'; errorMessage: string | null }
  | { status: 'access_denied'; attemptedEmail?: string; reason: string }
  | { status: 'authorized'; admin: AdminUserRecord };

export default function AdminPortal() {
  const shouldReduceMotion = useReducedMotion();
  const [authState, setAuthState] = useState<AuthGateState>({ status: 'checking' });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [dashboardData, setDashboardData] = useState<AdminDashboardPayload | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const [selectedRegistration, setSelectedRegistration] =
    useState<AdminRegistrationRecord | null>(null);
  const [reviewingSubmission, setReviewingSubmission] =
    useState<AdminPaymentSubmissionRecord | null>(null);

  const navigateToPublic = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const checkConfigurationAndSession = useCallback(async () => {
    const config = getSupabaseConfigStatus();
    if (!config.isConfigured) {
      setAuthState({
        status: 'not_configured',
        configError: config.configError || 'Supabase environment variables are missing.',
        missingVars: config.missingVars,
      });
      return;
    }

    setAuthState({ status: 'checking' });
    try {
      const admin = await getCurrentVerifiedAdmin();
      if (!admin) {
        setAuthState({ status: 'unauthenticated', errorMessage: null });
        return;
      }
      setAuthState({ status: 'authorized', admin });
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'ACCESS_DENIED') {
        setAuthState({
          status: 'access_denied',
          reason: err.message,
        });
      } else {
        setAuthState({
          status: 'unauthenticated',
          errorMessage:
            err instanceof Error
              ? err.message
              : 'Unable to verify existing session. Please sign in.',
        });
      }
    }
  }, []);

  useEffect(() => {
    void checkConfigurationAndSession();
  }, [checkConfigurationAndSession]);

  useEffect(() => {
    const config = getSupabaseConfigStatus();
    if (!config.isConfigured) return;

    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setDashboardData(null);
        setSelectedRegistration(null);
        setReviewingSubmission(null);
        setAuthState((prev) =>
          prev.status === 'access_denied'
            ? prev
            : { status: 'unauthenticated', errorMessage: null }
        );
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const payload = await fetchAdminDashboardData();
      setDashboardData(payload);
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'ACCESS_DENIED') {
        await signOutAdminSession().catch(() => undefined);
        setAuthState({
          status: 'access_denied',
          reason: err.message,
        });
        return;
      }
      if (err instanceof AdminApiError && err.code === 'UNAUTHENTICATED') {
        setAuthState({
          status: 'unauthenticated',
          errorMessage: err.message,
        });
        return;
      }
      setDataError(
        err instanceof Error ? err.message : 'Unable to load dashboard data from Supabase.'
      );
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (authState.status === 'authorized') {
      void loadDashboard();
    }
  }, [authState.status, loadDashboard]);

  const handleLogin = async (email: string, password: string) => {
    setIsSigningIn(true);
    try {
      const admin = await signInAdminWithPassword(email, password);
      setAuthState({ status: 'authorized', admin });
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'ACCESS_DENIED') {
        setAuthState({
          status: 'access_denied',
          attemptedEmail: email,
          reason: err.message,
        });
      } else {
        setAuthState({
          status: 'unauthenticated',
          errorMessage: err instanceof Error ? err.message : 'Sign-in failed.',
        });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutAdminSession();
    } finally {
      setDashboardData(null);
      setSelectedRegistration(null);
      setReviewingSubmission(null);
      setBannerMessage(null);
      setAuthState({ status: 'unauthenticated', errorMessage: null });
    }
  };

  const submissionsByRegId = useMemo(() => {
    const map = new Map<string, AdminPaymentSubmissionRecord>();
    for (const sub of dashboardData?.submissions ?? []) {
      if (sub.registrationId && !map.has(sub.registrationId)) {
        map.set(sub.registrationId, sub);
      }
      if (sub.registrationCode && !map.has(sub.registrationCode)) {
        map.set(sub.registrationCode, sub);
      }
    }
    return map;
  }, [dashboardData?.submissions]);

  const pendingSubmissions = useMemo(
    () => (dashboardData?.submissions ?? []).filter((s) => s.status === 'pending'),
    [dashboardData?.submissions]
  );

  // Auth / Setup Gates
  if (authState.status === 'checking') {
    return (
      <div className="underground-surface flex min-h-screen items-center justify-center px-6 text-[#EAE7E0]">
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw className="h-6 w-6 animate-spin text-[#FF1744]" aria-hidden="true" />
          <p className="font-mono-num text-xs tracking-widest text-[#EAE7E0]/75 uppercase">
            Verifying Organizer Session...
          </p>
        </div>
      </div>
    );
  }

  if (authState.status === 'not_configured') {
    return (
      <AdminConfigErrorView
        configError={authState.configError}
        missingVars={authState.missingVars}
        onRetry={() => void checkConfigurationAndSession()}
        onNavigatePublic={navigateToPublic}
      />
    );
  }

  if (authState.status === 'unauthenticated') {
    return (
      <AdminLoginScreen
        onLogin={handleLogin}
        isSubmitting={isSigningIn}
        errorMessage={authState.errorMessage}
        onNavigatePublic={navigateToPublic}
      />
    );
  }

  if (authState.status === 'access_denied') {
    return (
      <AdminAccessDeniedScreen
        attemptedEmail={authState.attemptedEmail}
        reason={authState.reason}
        onTryDifferentAccount={() =>
          setAuthState({ status: 'unauthenticated', errorMessage: null })
        }
        onNavigatePublic={navigateToPublic}
      />
    );
  }

  const { admin } = authState;
  const stats = dashboardData?.stats;

  const navItems: {
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    { id: 'overview', label: 'Overview & Stats', icon: LayoutDashboard },
    {
      id: 'registrations',
      label: 'Registrations',
      icon: Users,
      badge: stats?.totalRegistrations,
    },
    {
      id: 'verification',
      label: 'Payment Verification',
      icon: ShieldCheck,
      badge: stats?.pendingCount,
    },
  ];

  const handleExportAll = () => {
    const records = dashboardData?.registrations ?? [];
    if (records.length === 0) return;
    exportRegistrationsCsv(records, 'alfaaz-all-registrations');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#EAE7E0] lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-[#EAE7E0]/12 bg-[#0B0B0D] lg:flex">
        <div>
          <div className="border-b border-[#EAE7E0]/12 px-6 py-5">
            <p className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase">
              ALFAAZ <span className="text-[#FF1744]">ADMIN</span>
            </p>
            <p className="mt-0.5 font-mono-num text-[11px] text-[#EAE7E0]/55">
              18 Dec 2026 · Quad AI
            </p>
          </div>

          <nav aria-label="Admin sections" className="space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex min-h-[42px] w-full cursor-pointer items-center justify-between gap-2 border px-3.5 py-2 text-left text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-[#FF1744]/50 bg-[#FF1744]/15 text-[#EAE7E0]'
                      : 'border-transparent text-[#EAE7E0]/70 hover:bg-[#EAE7E0]/[0.04] hover:text-[#EAE7E0]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <Icon
                      className={`h-4 w-4 ${isActive ? 'text-[#FF1744]' : 'text-[#EAE7E0]/55'}`}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && (
                    <span className="font-mono-num text-[11px] text-[#EAE7E0]/70">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 border-t border-[#EAE7E0]/12 p-4">
          <div className="border border-[#EAE7E0]/10 bg-[#050505] p-3">
            <p className="truncate text-xs font-semibold text-[#EAE7E0]">{admin.fullName}</p>
            <p className="mt-0.5 truncate font-mono-num text-[11px] text-[#EAE7E0]/55">
              {admin.email}
            </p>
            <p className="mt-1 font-mono-num text-[10px] tracking-wider text-[#C8F36B] uppercase">
              {admin.role} · Verified
            </p>
          </div>

          <button
            type="button"
            onClick={navigateToPublic}
            className="flex min-h-[38px] w-full cursor-pointer items-center justify-between border border-[#EAE7E0]/15 bg-[#050505] px-3 py-2 text-xs text-[#EAE7E0]/80 transition-colors hover:border-[#EAE7E0]/40"
          >
            <span>Public Website</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex min-h-[38px] w-full cursor-pointer items-center justify-center gap-2 border border-[#FF1744]/40 bg-[#FF1744]/10 px-3 py-2 text-xs font-semibold tracking-wider text-[#FF1744] uppercase transition-colors hover:bg-[#FF1744] hover:text-[#EAE7E0]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[#EAE7E0]/12 bg-[#050505]/95 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label={mobileNavOpen ? 'Close admin menu' : 'Open admin menu'}
              className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[#EAE7E0]/20 text-[#EAE7E0] lg:hidden"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <div>
              <p className="font-mono-num text-[11px] text-[#EAE7E0]/55">
                ALFAAZ — UNFILTERED · Private Admin
              </p>
              <h1 className="font-display text-xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-2xl">
                {activeTab === 'overview'
                  ? 'Organizer Overview'
                  : activeTab === 'registrations'
                    ? 'Registrations Ledger'
                    : 'Payment Verification'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isLoadingData}
              onClick={() => void loadDashboard()}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#0B0B0D] px-3 py-1.5 text-xs font-medium text-[#EAE7E0] transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF] disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingData ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              disabled={!dashboardData || dashboardData.registrations.length === 0}
              onClick={handleExportAll}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border border-[#C8F36B]/45 bg-[#C8F36B]/10 px-3 py-1.5 text-xs font-semibold text-[#C8F36B] transition-colors hover:bg-[#C8F36B] hover:text-[#050505] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border border-[#FF1744]/45 bg-[#FF1744]/10 px-3 py-1.5 text-xs font-semibold text-[#FF1744] transition-colors hover:bg-[#FF1744] hover:text-[#EAE7E0] lg:hidden whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {mobileNavOpen && (
          <div className="border-b border-[#EAE7E0]/15 bg-[#0B0B0D] p-4 lg:hidden">
            <nav aria-label="Mobile admin navigation" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`flex min-h-[42px] w-full cursor-pointer items-center justify-between border px-3 py-2 text-xs font-semibold ${
                      isActive
                        ? 'border-[#FF1744]/50 bg-[#FF1744]/15 text-[#EAE7E0]'
                        : 'border-transparent text-[#EAE7E0]/75'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#FF1744]" aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && (
                      <span className="font-mono-num text-xs">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-[#EAE7E0]/10 pt-3 text-xs text-[#EAE7E0]/65">
              <span className="truncate font-mono-num">{admin.email}</span>
              <button
                type="button"
                onClick={navigateToPublic}
                className="shrink-0 font-semibold text-[#00E5FF] underline"
              >
                Public Site
              </button>
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-8 px-4 py-6 sm:px-6 lg:px-8">
          {bannerMessage && (
            <div
              role="status"
              className="flex items-start justify-between gap-3 border border-[#F59E0B]/45 bg-[#F59E0B]/10 p-4 text-xs text-[#EAE7E0]"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]"
                  aria-hidden="true"
                />
                <span>{bannerMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setBannerMessage(null)}
                aria-label="Dismiss notice"
                className="cursor-pointer text-[#EAE7E0]/70 hover:text-[#EAE7E0]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion ? { duration: 0.01 } : { duration: 0.25, ease: EDITORIAL_EASE }
              }
              className="space-y-8"
            >
              {/* Connection Error Banner on Overview */}
              {dataError && (
                <div className="border border-[#FF1744]/40 bg-[#0B0B0D] p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#FF1744]"
                      aria-hidden="true"
                    />
                    <div>
                      <h2 className="font-display text-2xl font-bold text-[#EAE7E0] uppercase">
                        Supabase Query Error
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-[#EAE7E0]/75">
                        {dataError}
                      </p>
                      <button
                        type="button"
                        onClick={() => void loadDashboard()}
                        className="mt-3 inline-flex min-h-[36px] cursor-pointer items-center border border-[#FF1744] bg-[#FF1744] px-4 py-1.5 text-xs font-semibold text-[#EAE7E0] uppercase"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Statistics Grid (8 live metrics) */}
              <section aria-labelledby="stats-heading">
                <div className="mb-4 flex items-center justify-between">
                  <h2
                    id="stats-heading"
                    className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase"
                  >
                    Live Event Statistics
                  </h2>
                  <span className="font-mono-num text-[11px] text-[#EAE7E0]/55">
                    Source: Supabase Live Tables
                  </span>
                </div>

                {isLoadingData && !stats ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="h-24 animate-pulse border border-[#EAE7E0]/12 bg-[#0B0B0D]"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatTile
                      label="Total Registrations"
                      value={String(stats?.totalRegistrations ?? 0)}
                      subtext="All submitted entries"
                      accent="text-[#EAE7E0]"
                      icon={<ClipboardList className="h-4 w-4 text-[#EAE7E0]/55" />}
                    />
                    <StatTile
                      label="Individual Passes"
                      value={String(stats?.individualCount ?? 0)}
                      subtext="₹99 · Solo performers"
                      accent="text-[#00E5FF]"
                    />
                    <StatTile
                      label="Couple Passes"
                      value={String(stats?.coupleCount ?? 0)}
                      subtext="₹149 · Duo entries"
                      accent="text-[#D500F9]"
                    />
                    <StatTile
                      label="Group Passes"
                      value={String(stats?.groupCount ?? 0)}
                      subtext="₹199 · Crew / band entries"
                      accent="text-[#FF1744]"
                    />
                    <StatTile
                      label="Pending Verification"
                      value={String(stats?.pendingCount ?? 0)}
                      subtext="Awaiting UTR confirmation"
                      accent="text-[#F59E0B]"
                      icon={<AlertTriangle className="h-4 w-4 text-[#F59E0B]" />}
                    />
                    <StatTile
                      label="Verified / Paid"
                      value={String(stats?.verifiedCount ?? 0)}
                      subtext="Confirmed by organizer"
                      accent="text-[#C8F36B]"
                      icon={<CheckCircle2 className="h-4 w-4 text-[#C8F36B]" />}
                    />
                    <StatTile
                      label="Rejected Payments"
                      value={String(stats?.rejectedCount ?? 0)}
                      subtext="Flagged or unmatched UTR"
                      accent="text-[#FF1744]"
                      icon={<XCircle className="h-4 w-4 text-[#FF1744]" />}
                    />
                    <StatTile
                      label="Verified Collected (INR)"
                      value={formatInr(stats?.totalVerifiedAmountInr ?? 0)}
                      subtext="Sum of verified entries only"
                      accent="text-[#C8F36B]"
                      icon={<IndianRupee className="h-4 w-4 text-[#C8F36B]" />}
                    />
                  </div>
                )}
              </section>

              {/* Pending Payment Verification Queue Preview */}
              <section aria-labelledby="pending-queue-heading" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2
                      id="pending-queue-heading"
                      className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase"
                    >
                      Pending Payment Verification Queue
                    </h2>
                    <p className="mt-0.5 text-xs text-[#EAE7E0]/60">
                      Review screenshots/PDFs from private storage and verify UTRs before
                      confirming.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('verification')}
                    className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#0B0B0D] px-3.5 py-1.5 text-xs font-semibold text-[#EAE7E0] transition-colors hover:border-[#FF1744] hover:text-[#FF1744]"
                  >
                    <span>Open Full Queue</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                {pendingSubmissions.length === 0 ? (
                  <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-6 text-xs text-[#EAE7E0]/65">
                    {isLoadingData
                      ? 'Loading pending payment submissions...'
                      : 'No pending payment submissions right now.'}
                  </div>
                ) : (
                  <div className="divide-y divide-[#EAE7E0]/10 border border-[#EAE7E0]/12 bg-[#0B0B0D]">
                    {pendingSubmissions.slice(0, 5).map((sub) => (
                      <div
                        key={sub.id}
                        className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono-num text-[#00E5FF]">
                              {sub.registrationCode || sub.registrationId}
                            </span>
                            <span className="text-[#EAE7E0]/35">·</span>
                            <span className={`font-semibold ${ENTRY_TYPE_META[sub.entryType].accentClass}`}>
                              {ENTRY_TYPE_META[sub.entryType].label} ({formatInr(sub.amountInr)})
                            </span>
                            <span className="text-[#EAE7E0]/35">·</span>
                            <span className="font-mono-num text-[#C8F36B]">UTR: {sub.utr}</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-[#EAE7E0]">
                            {sub.participantName}
                            <span className="font-normal text-[#EAE7E0]/60">
                              {' '}
                              · {sub.collegeName}
                            </span>
                          </p>
                          <p className="mt-0.5 font-mono-num text-[11px] text-[#EAE7E0]/50">
                            Submitted {formatDateTime(sub.submittedAt)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setReviewingSubmission(sub)}
                          className="inline-flex min-h-[38px] shrink-0 cursor-pointer items-center justify-center border border-[#FF1744] bg-[#FF1744] px-4 py-1.5 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:bg-[#ff2b54]"
                        >
                          Inspect Proof
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Recent Registrations Preview */}
              <section aria-labelledby="recent-regs-heading" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2
                    id="recent-regs-heading"
                    className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase"
                  >
                    Recent Registrations
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('registrations')}
                    className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#0B0B0D] px-3.5 py-1.5 text-xs font-semibold text-[#EAE7E0] transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF]"
                  >
                    <span>Manage All ({stats?.totalRegistrations ?? 0})</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                {(dashboardData?.registrations ?? []).length === 0 ? (
                  <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-6 text-xs text-[#EAE7E0]/65">
                    {isLoadingData
                      ? 'Loading recent registrations...'
                      : 'No registrations recorded in Supabase yet.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#EAE7E0]/12 bg-[#0B0B0D]">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#EAE7E0]/12 bg-[#050505] font-mono-num text-[11px] text-[#EAE7E0]/55 uppercase">
                          <th className="px-4 py-2.5 font-medium">Code</th>
                          <th className="px-4 py-2.5 font-medium">Participant</th>
                          <th className="px-4 py-2.5 font-medium">Type & Category</th>
                          <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                          <th className="px-4 py-2.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAE7E0]/8">
                        {(dashboardData?.registrations ?? []).slice(0, 5).map((reg) => (
                          <tr
                            key={reg.id}
                            onClick={() => setSelectedRegistration(reg)}
                            className="cursor-pointer transition-colors hover:bg-[#EAE7E0]/[0.03]"
                          >
                            <td className="px-4 py-3 font-mono-num text-[#00E5FF] whitespace-nowrap">
                              {reg.registrationCode || reg.id.slice(0, 8)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[#EAE7E0]">{reg.fullName}</div>
                              <div className="text-[11px] text-[#EAE7E0]/55">
                                {reg.collegeName}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={ENTRY_TYPE_META[reg.entryType].accentClass}>
                                {ENTRY_TYPE_META[reg.entryType].label}
                              </span>
                              <span className="text-[#EAE7E0]/45"> · </span>
                              <span className="text-[#EAE7E0]/75">{reg.categoriesDisplay}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono-num font-bold text-[#EAE7E0]">
                              {formatInr(reg.amountInr)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-semibold ${PAYMENT_STATUS_META[reg.paymentStatus].borderClass} ${PAYMENT_STATUS_META[reg.paymentStatus].textClass}`}
                              >
                                {PAYMENT_STATUS_META[reg.paymentStatus].label}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {activeTab === 'registrations' && (
            <AdminRegistrationsView
              registrations={dashboardData?.registrations ?? []}
              submissionsByRegId={submissionsByRegId}
              isLoading={isLoadingData}
              errorMessage={dataError}
              onRetry={() => void loadDashboard()}
              onSelectRegistration={(reg) => setSelectedRegistration(reg)}
              onInspectSubmission={(sub) => setReviewingSubmission(sub)}
              onExportCsv={(records) => exportRegistrationsCsv(records)}
            />
          )}

          {activeTab === 'verification' && (
            <AdminPaymentVerificationView
              submissions={dashboardData?.submissions ?? []}
              isLoading={isLoadingData}
              errorMessage={dataError}
              onRetry={() => void loadDashboard()}
              onInspectSubmission={(sub) => setReviewingSubmission(sub)}
            />
          )}
        </main>
      </div>

      {/* Registration Detail Slide-Over Drawer */}
      <AdminRegistrationDetailDrawer
        registration={selectedRegistration}
        linkedSubmission={
          selectedRegistration
            ? submissionsByRegId.get(selectedRegistration.id) ??
              submissionsByRegId.get(selectedRegistration.registrationCode) ??
              null
            : null
        }
        onClose={() => setSelectedRegistration(null)}
        onInspectSubmission={(sub) => setReviewingSubmission(sub)}
      />

      {/* Payment Proof Signed URL Viewer & Verification Modal */}
      <AdminProofViewerModal
        submission={reviewingSubmission}
        onClose={() => setReviewingSubmission(null)}
        onVerificationSaved={async (warning) => {
          if (warning) {
            setBannerMessage(warning);
          }
          await loadDashboard();
        }}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  subtext,
  accent,
  icon,
}: {
  label: string;
  value: string;
  subtext: string;
  accent: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#EAE7E0]/65">{label}</p>
        {icon}
      </div>
      <p className={`mt-2.5 font-mono-num text-3xl font-bold tracking-tight ${accent}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#EAE7E0]/50">{subtext}</p>
    </div>
  );
}
