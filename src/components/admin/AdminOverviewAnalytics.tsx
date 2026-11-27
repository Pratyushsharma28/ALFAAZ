import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSearch,
  IndianRupee,
  Radio,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  AdminDashboardPayload,
  AdminPaymentSubmissionRecord,
  AdminRegistrationRecord,
  CanonicalPaymentStatus,
  RealtimeConnectionStatus,
} from '../../types/admin';
import { EntryPassTierId, RegistrationType } from '../../types/registration';
import {
  ENTRY_TYPE_META,
  formatDateTime,
  formatInr,
  PAYMENT_STATUS_META,
  REGISTRATION_TYPE_META,
} from './AdminFormatters';

interface AdminOverviewAnalyticsProps {
  payload: AdminDashboardPayload | null;
  isLoading: boolean;
  errorMessage: string | null;
  realtimeStatus: RealtimeConnectionStatus;
  onRetry: () => void;
  onOpenRegistrations: (
    presetEntryType?: 'all' | EntryPassTierId,
    presetRegType?: 'all' | RegistrationType
  ) => void;
  onOpenVerification: (presetStatus?: 'all' | CanonicalPaymentStatus) => void;
  onSelectRegistration: (reg: AdminRegistrationRecord) => void;
  onInspectSubmission: (sub: AdminPaymentSubmissionRecord) => void;
}

export function AdminOverviewAnalytics({
  payload,
  isLoading,
  errorMessage,
  realtimeStatus,
  onRetry,
  onOpenRegistrations,
  onOpenVerification,
  onSelectRegistration,
  onInspectSubmission,
}: AdminOverviewAnalyticsProps) {
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');
  const [hoveredBucketKey, setHoveredBucketKey] = useState<string | null>(null);

  const series = useMemo(() => {
    if (!payload) return [];
    const raw =
      granularity === 'day'
        ? payload.analytics.dailySeries
        : payload.analytics.monthlySeries;
    return granularity === 'day' ? raw.slice(-14) : raw.slice(-12);
  }, [payload, granularity]);

  const activeBucket = useMemo(() => {
    if (series.length === 0) return null;
    if (hoveredBucketKey) {
      const found = series.find((b) => b.key === hoveredBucketKey);
      if (found) return found;
    }
    return series[series.length - 1];
  }, [series, hoveredBucketKey]);

  // Never silently display zeros when the database query failed and no valid payload exists
  if (errorMessage && !payload) {
    return (
      <div className="border border-[#FF1744]/45 bg-[#0B0B0D] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF1744]" aria-hidden="true" />
          <div>
            <h2 className="font-display text-2xl font-bold text-[#EAE7E0] uppercase">
              Unable to Load Supabase Analytics
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#EAE7E0]/75">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex min-h-[40px] cursor-pointer items-center border border-[#FF1744] bg-[#FF1744] px-4 py-2 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:bg-[#ff2b54]"
            >
              Retry Database Query
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !payload) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 animate-pulse border border-[#EAE7E0]/12 bg-[#0B0B0D]"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="h-80 animate-pulse border border-[#EAE7E0]/12 bg-[#0B0B0D] xl:col-span-7" />
          <div className="h-80 animate-pulse border border-[#EAE7E0]/12 bg-[#0B0B0D] xl:col-span-5" />
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="h-64 animate-pulse border border-[#EAE7E0]/12 bg-[#0B0B0D]" />
          <div className="h-64 animate-pulse border border-[#EAE7E0]/12 bg-[#0B0B0D]" />
        </div>
      </div>
    );
  }

  if (!payload) return null;

  const { stats, analytics, registrations, submissions, fetchedAt } = payload;

  const maxPeriodCount = Math.max(1, ...series.map((b) => b.count));
  const maxCumulative = Math.max(1, ...series.map((b) => b.cumulativeCount));
  const totalStatusCount =
    stats.verifiedCount + stats.pendingCount + stats.rejectedCount;

  const realtimeLabel =
    realtimeStatus === 'subscribed'
      ? 'Realtime: Live'
      : realtimeStatus === 'connecting'
        ? 'Realtime: Connecting'
        : 'Realtime: Manual Sync';

  const realtimeColor =
    realtimeStatus === 'subscribed'
      ? 'text-[#C8F36B]'
      : realtimeStatus === 'connecting'
        ? 'text-[#00E5FF]'
        : 'text-[#EAE7E0]/55';

  return (
    <div className="space-y-8">
      {/* Error Banner if a background/realtime refresh failed while stale data is displayed */}
      {errorMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border border-[#FF1744]/45 bg-[#FF1744]/10 p-4 text-xs text-[#EAE7E0]"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF1744]" aria-hidden="true" />
            <span>
              Latest refresh failed ({errorMessage}). Showing last synced snapshot from{' '}
              <span className="font-mono-num">{formatDateTime(fetchedAt)}</span>.
            </span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer border border-[#FF1744] bg-[#FF1744] px-3 py-1.5 text-[11px] font-semibold text-[#EAE7E0] uppercase"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Primary Live KPI Cards (Clickable Navigation) */}
      <section aria-labelledby="stats-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2
            id="stats-heading"
            className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase"
          >
            Live Event & Revenue Metrics
          </h2>

          <div className="flex flex-wrap items-center gap-4 font-mono-num text-[11px]">
            <span className={`inline-flex items-center gap-1.5 ${realtimeColor}`}>
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{realtimeLabel}</span>
            </span>
            <span className="text-[#EAE7E0]/50">
              Synced {formatDateTime(fetchedAt)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ClickableKpiCard
            label="Total Registrations"
            value={String(stats.totalRegistrations)}
            subtext="Open registrations ledger"
            accent="text-[#EAE7E0]"
            hoverBorder="hover:border-[#EAE7E0]/45"
            icon={<ClipboardList className="h-4 w-4 text-[#EAE7E0]/60" aria-hidden="true" />}
            onClick={() => onOpenRegistrations('all')}
          />

          <ClickableKpiCard
            label="Verified Payments"
            value={String(stats.verifiedCount)}
            subtext="Open verified payment records"
            accent="text-[#C8F36B]"
            hoverBorder="hover:border-[#C8F36B]/55"
            icon={<CheckCircle2 className="h-4 w-4 text-[#C8F36B]" aria-hidden="true" />}
            onClick={() => onOpenVerification('verified')}
          />

          <ClickableKpiCard
            label="Pending Payments"
            value={String(stats.pendingCount)}
            subtext="Open pending verification queue"
            accent="text-[#F59E0B]"
            hoverBorder="hover:border-[#F59E0B]/55"
            icon={<Clock className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />}
            onClick={() => onOpenVerification('pending')}
          />

          <ClickableKpiCard
            label="Rejected Payments"
            value={String(stats.rejectedCount)}
            subtext="Review rejected submissions"
            accent="text-[#FF1744]"
            hoverBorder="hover:border-[#FF1744]/55"
            icon={<XCircle className="h-4 w-4 text-[#FF1744]" aria-hidden="true" />}
            onClick={() => onOpenVerification('rejected')}
          />

          <ClickableKpiCard
            label="Verified Revenue"
            value={formatInr(stats.totalVerifiedAmountInr)}
            subtext={`${stats.verifiedUniqueRegistrationCount} unique verified ${
              stats.verifiedUniqueRegistrationCount === 1 ? 'entry' : 'entries'
            }`}
            accent="text-[#C8F36B]"
            hoverBorder="hover:border-[#C8F36B]/55"
            icon={<IndianRupee className="h-4 w-4 text-[#C8F36B]" aria-hidden="true" />}
            onClick={() => onOpenVerification('verified')}
          />
        </div>

        {/* Separated Participant vs Audience Split Cards */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onOpenRegistrations('all', 'PARTICIPANT')}
            className="group flex cursor-pointer items-center justify-between gap-4 border border-[#FF1744]/30 bg-[#0B0B0D] px-5 py-4 text-left transition-colors hover:border-[#FF1744] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744]"
          >
            <div>
              <p className="font-mono-num text-[11px] font-bold tracking-[0.18em] text-[#FF1744] uppercase">
                Participant Registrations (Performers)
              </p>
              <p className="mt-1 text-xs text-[#EAE7E0]/75">
                <span className="font-mono-num text-[#C8F36B]">{stats.participantVerifiedCount}</span> verified ·{' '}
                <span className="font-mono-num text-[#F59E0B]">{stats.participantPendingCount}</span> pending · Revenue{' '}
                <span className="font-mono-num font-bold text-[#EAE7E0]">
                  {formatInr(stats.participantVerifiedAmountInr)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono-num text-2xl font-bold text-[#EAE7E0]">
                {stats.participantCount}
              </span>
              <ArrowUpRight className="h-4 w-4 text-[#EAE7E0]/45 group-hover:text-[#FF1744]" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onOpenRegistrations('all', 'AUDIENCE')}
            className="group flex cursor-pointer items-center justify-between gap-4 border border-[#00E5FF]/35 bg-[#0B0B0D] px-5 py-4 text-left transition-colors hover:border-[#00E5FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
          >
            <div>
              <p className="font-mono-num text-[11px] font-bold tracking-[0.18em] text-[#00E5FF] uppercase">
                Audience Registrations (₹59 Watch Only)
              </p>
              <p className="mt-1 text-xs text-[#EAE7E0]/75">
                <span className="font-mono-num text-[#C8F36B]">{stats.audienceVerifiedCount}</span> verified ·{' '}
                <span className="font-mono-num text-[#F59E0B]">{stats.audiencePendingCount}</span> pending · Revenue{' '}
                <span className="font-mono-num font-bold text-[#EAE7E0]">
                  {formatInr(stats.audienceVerifiedAmountInr)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono-num text-2xl font-bold text-[#EAE7E0]">
                {stats.audienceCount}
              </span>
              <ArrowUpRight className="h-4 w-4 text-[#EAE7E0]/45 group-hover:text-[#00E5FF]" aria-hidden="true" />
            </div>
          </button>
        </div>

        {/* Pass Tier Quick Filter Strip */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {analytics.tierBreakdown.map((tier) => {
            const isAudienceTier = tier.key === 'audience';
            const accentClass = isAudienceTier
              ? 'text-[#00E5FF]'
              : ENTRY_TYPE_META[tier.entryType].accentClass;
            const titleLabel = isAudienceTier
              ? 'Audience Pass (₹59)'
              : `${ENTRY_TYPE_META[tier.entryType].label} Registrations`;
            return (
              <button
                key={tier.key}
                type="button"
                onClick={() =>
                  onOpenRegistrations(
                    isAudienceTier ? 'all' : tier.entryType,
                    tier.registrationType
                  )
                }
                className="group flex cursor-pointer items-center justify-between gap-3 border border-[#EAE7E0]/12 bg-[#0B0B0D] px-4 py-3 text-left transition-colors hover:border-[#EAE7E0]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744]"
              >
                <div>
                  <p className={`text-xs font-semibold ${accentClass}`}>
                    {titleLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#EAE7E0]/55">
                    <span className="font-mono-num text-[#EAE7E0]/80">
                      {tier.verifiedCount}
                    </span>{' '}
                    verified ·{' '}
                    <span className="font-mono-num text-[#C8F36B]">
                      {formatInr(tier.verifiedRevenueInr)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-num text-xl font-bold text-[#EAE7E0]">
                    {tier.totalCount}
                  </span>
                  <ArrowUpRight
                    className="h-3.5 w-3.5 text-[#EAE7E0]/40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#EAE7E0]"
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Registration Analytics & Payment Analytics Split */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Registration Analytics (Day / Month & Growth Over Time) */}
        <section
          aria-labelledby="reg-analytics-heading"
          className="flex flex-col justify-between border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5 xl:col-span-7"
        >
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2
                  id="reg-analytics-heading"
                  className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase"
                >
                  Registration Analytics
                </h2>
                <p className="mt-0.5 text-xs text-[#EAE7E0]/60">
                  New registrations and cumulative growth from Supabase timestamps
                </p>
              </div>

              <div
                className="inline-flex border border-[#EAE7E0]/15 bg-[#050505] p-0.5"
                role="group"
                aria-label="Timeline granularity"
              >
                <button
                  type="button"
                  onClick={() => {
                    setGranularity('day');
                    setHoveredBucketKey(null);
                  }}
                  className={`min-h-[32px] cursor-pointer px-3 py-1 font-mono-num text-xs font-semibold transition-colors ${
                    granularity === 'day'
                      ? 'bg-[#FF1744] text-[#EAE7E0]'
                      : 'text-[#EAE7E0]/65 hover:text-[#EAE7E0]'
                  }`}
                >
                  By Day
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGranularity('month');
                    setHoveredBucketKey(null);
                  }}
                  className={`min-h-[32px] cursor-pointer px-3 py-1 font-mono-num text-xs font-semibold transition-colors ${
                    granularity === 'month'
                      ? 'bg-[#FF1744] text-[#EAE7E0]'
                      : 'text-[#EAE7E0]/65 hover:text-[#EAE7E0]'
                  }`}
                >
                  By Month
                </button>
              </div>
            </div>

            {/* Growth Summary Metrics */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-y border-[#EAE7E0]/10 py-3">
              <div>
                <p className="text-[11px] text-[#EAE7E0]/55">Today</p>
                <p className="mt-0.5 font-mono-num text-xl font-bold text-[#EAE7E0]">
                  {analytics.growth.todayCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#EAE7E0]/55">Last 7 Days</p>
                <p className="mt-0.5 font-mono-num text-xl font-bold text-[#00E5FF]">
                  {analytics.growth.last7DaysCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#EAE7E0]/55">7-Day Growth</p>
                <p className="mt-0.5 flex items-center gap-1 font-mono-num text-xl font-bold text-[#C8F36B]">
                  <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {analytics.growth.growthDeltaPercent !== null
                      ? `${analytics.growth.growthDeltaPercent >= 0 ? '+' : ''}${analytics.growth.growthDeltaPercent}%`
                      : `${analytics.growth.growthDeltaCount >= 0 ? '+' : ''}${analytics.growth.growthDeltaCount}`}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {series.length === 0 ? (
            <div className="mt-6 flex min-h-[190px] items-center justify-center border border-[#EAE7E0]/10 bg-[#050505] p-6 text-center text-xs text-[#EAE7E0]/60">
              No dated registration records available in Supabase yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {/* Interactive Readout Bar */}
              {activeBucket && (
                <div className="flex flex-wrap items-center justify-between gap-2 border border-[#EAE7E0]/10 bg-[#050505] px-3.5 py-2 text-xs">
                  <span className="font-mono-num font-semibold text-[#EAE7E0]">
                    {activeBucket.label}
                  </span>
                  <div className="flex flex-wrap items-center gap-4 font-mono-num text-[11px]">
                    <span className="text-[#FF1744]">
                      New: <strong>{activeBucket.count}</strong>
                    </span>
                    <span className="text-[#00E5FF]">
                      Cumulative: <strong>{activeBucket.cumulativeCount}</strong>
                    </span>
                    <span className="text-[#C8F36B]">
                      Verified Revenue: <strong>{formatInr(activeBucket.verifiedRevenueInr)}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Dual Bar + Cumulative Growth Line Chart */}
              <div className="border border-[#EAE7E0]/10 bg-[#050505] p-4">
                <div className="relative h-44 w-full">
                  {/* Cumulative Growth Polyline Overlay */}
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    {series.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#00E5FF"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        points={series
                          .map((bucket, idx) => {
                            const x = ((idx + 0.5) / series.length) * 100;
                            const y = 94 - (bucket.cumulativeCount / maxCumulative) * 82;
                            return `${x.toFixed(2)},${y.toFixed(2)}`;
                          })
                          .join(' ')}
                      />
                    )}
                  </svg>

                  {/* Interactive Period Columns */}
                  <div
                    className="relative z-10 grid h-full items-end gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
                  >
                    {series.map((bucket) => {
                      const barHeightPct = Math.max(
                        6,
                        Math.round((bucket.count / maxPeriodCount) * 86)
                      );
                      const isActive = activeBucket?.key === bucket.key;
                      return (
                        <button
                          key={bucket.key}
                          type="button"
                          onMouseEnter={() => setHoveredBucketKey(bucket.key)}
                          onFocus={() => setHoveredBucketKey(bucket.key)}
                          onClick={() => setHoveredBucketKey(bucket.key)}
                          aria-label={`${bucket.label}: ${bucket.count} new registrations, ${bucket.cumulativeCount} cumulative`}
                          className="group flex h-full cursor-pointer flex-col items-center justify-end focus:outline-none"
                        >
                          <span
                            className={`mb-1 font-mono-num text-[10px] transition-opacity ${
                              isActive
                                ? 'text-[#EAE7E0] opacity-100'
                                : 'text-[#EAE7E0]/50 opacity-75 group-hover:opacity-100'
                            }`}
                          >
                            {bucket.count}
                          </span>
                          <div
                            style={{ height: `${barHeightPct}%` }}
                            className={`w-full max-w-[32px] border transition-colors ${
                              isActive
                                ? 'border-[#FF1744] bg-[#FF1744]'
                                : 'border-[#FF1744]/50 bg-[#FF1744]/45 group-hover:bg-[#FF1744]/75'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* X-Axis Labels */}
                <div
                  className="mt-2 grid gap-1.5 border-t border-[#EAE7E0]/10 pt-2"
                  style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
                >
                  {series.map((bucket) => (
                    <span
                      key={bucket.key}
                      className="truncate text-center font-mono-num text-[10px] text-[#EAE7E0]/55"
                      title={bucket.label}
                    >
                      {bucket.label}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#EAE7E0]/55">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 bg-[#FF1744]" aria-hidden="true" />
                    Period Registrations
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-3.5 bg-[#00E5FF]" aria-hidden="true" />
                    Cumulative Growth
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Payment Analytics */}
        <section
          aria-labelledby="payment-analytics-heading"
          className="flex flex-col justify-between border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5 xl:col-span-5"
        >
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="payment-analytics-heading"
                  className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase"
                >
                  Payment Analytics
                </h2>
                <p className="mt-0.5 text-xs text-[#EAE7E0]/60">
                  Deduplicated verified revenue & submission status breakdown
                </p>
              </div>
              {stats.verificationRatePercent !== null && (
                <div className="text-right">
                  <p className="text-[11px] text-[#EAE7E0]/55">Approval Rate</p>
                  <p className="font-mono-num text-lg font-bold text-[#C8F36B]">
                    {stats.verificationRatePercent}%
                  </p>
                </div>
              )}
            </div>

            {/* Proportional Status Bar */}
            <div>
              <div className="flex h-3 w-full overflow-hidden border border-[#EAE7E0]/15 bg-[#050505]">
                {totalStatusCount > 0 && (
                  <>
                    <div
                      style={{
                        width: `${(stats.verifiedCount / totalStatusCount) * 100}%`,
                      }}
                      className="bg-[#C8F36B]"
                      title={`Verified: ${stats.verifiedCount}`}
                    />
                    <div
                      style={{
                        width: `${(stats.pendingCount / totalStatusCount) * 100}%`,
                      }}
                      className="bg-[#F59E0B]"
                      title={`Pending: ${stats.pendingCount}`}
                    />
                    <div
                      style={{
                        width: `${(stats.rejectedCount / totalStatusCount) * 100}%`,
                      }}
                      className="bg-[#FF1744]"
                      title={`Rejected: ${stats.rejectedCount}`}
                    />
                  </>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => onOpenVerification('verified')}
                  className="cursor-pointer border border-[#EAE7E0]/10 bg-[#050505] p-2.5 text-left transition-colors hover:border-[#C8F36B]/50"
                >
                  <p className="text-[11px] text-[#C8F36B]">Verified</p>
                  <p className="mt-0.5 font-mono-num text-lg font-bold text-[#EAE7E0]">
                    {stats.verifiedCount}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenVerification('pending')}
                  className="cursor-pointer border border-[#EAE7E0]/10 bg-[#050505] p-2.5 text-left transition-colors hover:border-[#F59E0B]/50"
                >
                  <p className="text-[11px] text-[#F59E0B]">Pending</p>
                  <p className="mt-0.5 font-mono-num text-lg font-bold text-[#EAE7E0]">
                    {stats.pendingCount}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenVerification('rejected')}
                  className="cursor-pointer border border-[#EAE7E0]/10 bg-[#050505] p-2.5 text-left transition-colors hover:border-[#FF1744]/50"
                >
                  <p className="text-[11px] text-[#FF1744]">Rejected</p>
                  <p className="mt-0.5 font-mono-num text-lg font-bold text-[#EAE7E0]">
                    {stats.rejectedCount}
                  </p>
                </button>
              </div>
            </div>

            {/* Verified Revenue By Pass Tier */}
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#EAE7E0]/75 uppercase">
                Verified Revenue by Pass Tier
              </p>
              <div className="mt-2.5 divide-y divide-[#EAE7E0]/10 border border-[#EAE7E0]/12 bg-[#050505]">
                {analytics.tierBreakdown.map((tier) => (
                  <div
                    key={tier.key}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <span
                        className={`font-semibold ${
                          tier.key === 'audience'
                            ? 'text-[#00E5FF]'
                            : ENTRY_TYPE_META[tier.entryType].accentClass
                        }`}
                      >
                        {tier.label}
                      </span>
                      <span className="ml-2 font-mono-num text-[11px] text-[#EAE7E0]/55">
                        {tier.verifiedCount} verified
                      </span>
                    </div>
                    <span className="font-mono-num font-bold text-[#EAE7E0]">
                      {formatInr(tier.verifiedRevenueInr)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-[#0B0B0D] px-3.5 py-2.5 text-xs">
                  <span className="font-semibold text-[#C8F36B]">Total Verified Revenue</span>
                  <span className="font-mono-num text-base font-bold text-[#C8F36B]">
                    {formatInr(stats.totalVerifiedAmountInr)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 border-t border-[#EAE7E0]/10 pt-3 text-[11px] leading-relaxed text-[#EAE7E0]/55">
            Revenue includes verified payments only and is deduplicated per registration to
            prevent double-counting across re-submissions.
          </p>
        </section>
      </div>

      {/* 3. Recent Activity: Latest Registrations & Latest Payment Submissions */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Recent Registrations */}
        <section aria-labelledby="recent-regs-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="recent-regs-heading"
                className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase"
              >
                Recent Registrations
              </h2>
              <p className="text-xs text-[#EAE7E0]/55">
                Latest entries recorded in <code className="font-mono-num">registrations</code>
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenRegistrations('all')}
              className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#0B0B0D] px-3 py-1 text-xs font-semibold text-[#EAE7E0] transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF]"
            >
              <span>View All ({stats.totalRegistrations})</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {registrations.length === 0 ? (
            <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-6 text-xs text-[#EAE7E0]/60">
              No registrations recorded in Supabase yet.
            </div>
          ) : (
            <div className="divide-y divide-[#EAE7E0]/10 border border-[#EAE7E0]/12 bg-[#0B0B0D]">
              {registrations.slice(0, 5).map((reg) => {
                const statusMeta = PAYMENT_STATUS_META[reg.paymentStatus];
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => onSelectRegistration(reg)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[#EAE7E0]/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`border px-1.5 py-0.5 font-mono-num text-[10px] font-bold uppercase ${
                            REGISTRATION_TYPE_META[reg.registrationType].borderClass
                          }`}
                        >
                          {REGISTRATION_TYPE_META[reg.registrationType].shortLabel}
                        </span>
                        <span className="font-mono-num text-[#00E5FF]">
                          {reg.registrationCode || reg.id.slice(0, 8)}
                        </span>
                        <span className="text-[#EAE7E0]/30">·</span>
                        <span
                          className={
                            reg.registrationType === 'AUDIENCE'
                              ? 'text-[#00E5FF]'
                              : ENTRY_TYPE_META[reg.entryType].accentClass
                          }
                        >
                          {reg.registrationType === 'AUDIENCE'
                            ? 'Watch Only'
                            : ENTRY_TYPE_META[reg.entryType].label}
                        </span>
                        {reg.registrationType !== 'AUDIENCE' && (
                          <>
                            <span className="text-[#EAE7E0]/30">·</span>
                            <span className="truncate text-[#EAE7E0]/70">
                              {reg.categoriesDisplay}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-[#EAE7E0]">
                        {reg.fullName}
                        <span className="font-normal text-[#EAE7E0]/55">
                          {' '}
                          · {reg.collegeName}
                        </span>
                      </p>
                      <p className="mt-0.5 font-mono-num text-[11px] text-[#EAE7E0]/50">
                        {formatDateTime(reg.createdAt)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-mono-num text-sm font-bold text-[#EAE7E0]">
                        {formatInr(reg.amountInr)}
                      </p>
                      <span
                        className={`mt-1 inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.borderClass} ${statusMeta.textClass}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Payment Submissions */}
        <section aria-labelledby="recent-payments-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="recent-payments-heading"
                className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase"
              >
                Recent Payment Submissions
              </h2>
              <p className="text-xs text-[#EAE7E0]/55">
                Latest proofs recorded in{' '}
                <code className="font-mono-num">payment_submissions</code>
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenVerification('all')}
              className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#0B0B0D] px-3 py-1 text-xs font-semibold text-[#EAE7E0] transition-colors hover:border-[#FF1744] hover:text-[#FF1744]"
            >
              <span>All Submissions ({stats.totalSubmissionCount})</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {submissions.length === 0 ? (
            <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-6 text-xs text-[#EAE7E0]/60">
              No payment submissions recorded in Supabase yet.
            </div>
          ) : (
            <div className="divide-y divide-[#EAE7E0]/10 border border-[#EAE7E0]/12 bg-[#0B0B0D]">
              {submissions.slice(0, 5).map((sub) => {
                const statusMeta = PAYMENT_STATUS_META[sub.status];
                return (
                  <div
                    key={sub.id}
                    className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`border px-1.5 py-0.5 font-mono-num text-[10px] font-bold uppercase ${
                            REGISTRATION_TYPE_META[sub.registrationType].borderClass
                          }`}
                        >
                          {REGISTRATION_TYPE_META[sub.registrationType].shortLabel}
                        </span>
                        <span
                          className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.borderClass} ${statusMeta.textClass}`}
                        >
                          {statusMeta.label}
                        </span>
                        <span className="font-mono-num text-[#00E5FF]">
                          {sub.registrationCode || sub.registrationId}
                        </span>
                        <span className="font-mono-num text-[#C8F36B]">UTR: {sub.utr}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-[#EAE7E0]">
                        {sub.participantName}
                        <span className="font-mono-num text-xs font-normal text-[#EAE7E0]/65">
                          {' '}
                          · {formatInr(sub.amountInr)}
                        </span>
                      </p>
                      <p className="mt-0.5 font-mono-num text-[11px] text-[#EAE7E0]/50">
                        {formatDateTime(sub.submittedAt)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectSubmission(sub)}
                      className="inline-flex min-h-[36px] shrink-0 cursor-pointer items-center justify-center gap-1.5 border border-[#FF1744]/60 bg-[#FF1744]/10 px-3 py-1.5 text-xs font-semibold text-[#FF1744] transition-colors hover:bg-[#FF1744] hover:text-[#EAE7E0]"
                    >
                      <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{sub.status === 'pending' ? 'Verify' : 'Inspect'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ClickableKpiCard({
  label,
  value,
  subtext,
  accent,
  hoverBorder,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  subtext: string;
  accent: string;
  hoverBorder: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex cursor-pointer flex-col justify-between border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5 text-left transition-colors ${hoverBorder} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744]`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#EAE7E0]/65">{label}</span>
        {icon}
      </div>
      <p className={`mt-2.5 font-mono-num text-3xl font-bold tracking-tight ${accent}`}>
        {value}
      </p>
      <div className="mt-2 flex w-full items-center justify-between gap-2 text-[11px] text-[#EAE7E0]/50 group-hover:text-[#EAE7E0]/80">
        <span className="truncate">{subtext}</span>
        <ArrowUpRight
          className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
