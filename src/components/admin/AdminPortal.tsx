import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
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
  CanonicalPaymentStatus,
  RealtimeConnectionStatus,
} from '../../types/admin';
import { EntryPassTierId } from '../../types/registration';
import { EDITORIAL_EASE } from '../MotionPrimitives';
import {
  AdminAccessDeniedScreen,
  AdminConfigErrorView,
  AdminLoginScreen,
} from './AdminAuthScreens';
import { AdminOverviewAnalytics } from './AdminOverviewAnalytics';
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

  const [regEntryTypeFilter, setRegEntryTypeFilter] = useState<'all' | EntryPassTierId>('all');
  const [verificationStatusFilter, setVerificationStatusFilter] = useState<
    'all' | CanonicalPaymentStatus
  >('all');

  const [dashboardData, setDashboardData] = useState<AdminDashboardPayload | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeConnectionStatus>('connecting');

  const [selectedRegistration, setSelectedRegistration] =
    useState<AdminRegistrationRecord | null>(null);
  const [reviewingSubmission, setReviewingSubmission] =
    useState<AdminPaymentSubmissionRecord | null>(null);

  const realtimeDebounceRef = useRef<number | null>(null);

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
        setRealtimeStatus('closed');
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

  const loadDashboard = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoadingData(true);
    }
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
      if (!options?.silent) {
        setIsLoadingData(false);
      }
    }
  }, []);

  const authorizedAdminUuid =
    authState.status === 'authorized' ? authState.admin.uuid : null;

  useEffect(() => {
    if (!authorizedAdminUuid) return;

    void loadDashboard();

    const supabase = getSupabaseClient();
    setRealtimeStatus('connecting');

    const scheduleRealtimeRefresh = () => {
      if (realtimeDebounceRef.current !== null) {
        window.clearTimeout(realtimeDebounceRef.current);
      }
      realtimeDebounceRef.current = window.setTimeout(() => {
        void loadDashboard({ silent: true });
      }, 350);
    };

    const channel = supabase
      .channel(`alfaaz-admin-realtime-${authorizedAdminUuid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrations' },
        scheduleRealtimeRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_submissions' },
        scheduleRealtimeRefresh
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('subscribed');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error');
        } else if (status === 'CLOSED') {
          setRealtimeStatus('closed');
        }
      });

    return () => {
      if (realtimeDebounceRef.current !== null) {
        window.clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [authorizedAdminUuid, loadDashboard]);

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
      setRealtimeStatus('closed');
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

  const handleOpenRegistrations = (presetEntryType: 'all' | EntryPassTierId = 'all') => {
    setRegEntryTypeFilter(presetEntryType);
    setActiveTab('registrations');
    setMobileNavOpen(false);
  };

  const handleOpenVerification = (presetStatus: 'all' | CanonicalPaymentStatus = 'all') => {
    setVerificationStatusFilter(presetStatus);
    setActiveTab('verification');
    setMobileNavOpen(false);
  };

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
            >
              <AdminOverviewAnalytics
                payload={dashboardData}
                isLoading={isLoadingData}
                errorMessage={dataError}
                realtimeStatus={realtimeStatus}
                onRetry={() => void loadDashboard()}
                onOpenRegistrations={handleOpenRegistrations}
                onOpenVerification={handleOpenVerification}
                onSelectRegistration={(reg) => setSelectedRegistration(reg)}
                onInspectSubmission={(sub) => setReviewingSubmission(sub)}
              />
            </motion.div>
          )}

          {activeTab === 'registrations' && (
            <AdminRegistrationsView
              registrations={dashboardData?.registrations ?? []}
              submissionsByRegId={submissionsByRegId}
              isLoading={isLoadingData}
              errorMessage={dataError}
              entryTypeFilter={regEntryTypeFilter}
              onEntryTypeFilterChange={setRegEntryTypeFilter}
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
              statusFilter={verificationStatusFilter}
              onStatusFilterChange={setVerificationStatusFilter}
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
