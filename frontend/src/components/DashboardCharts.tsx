import { memo, useMemo } from 'react';
import { getStatus, type SearchRecord } from '../hooks/types';
import { formatLoanType } from '../hooks/formatLoanType';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Layers, Activity } from 'lucide-react';

/* ── Theme Colors ─────────────────────────────────────────────── */
const GOLD = '#c89b3c';
const GREEN = '#22c55e';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const SLATE = 'rgba(100, 116, 139, 0.5)';

const RISK_BUCKETS = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
const RISK_COLORS = [RED, '#f97316', AMBER, '#84cc16', GREEN];

/* ── Helpers ──────────────────────────────────────────────────── */
const DAY_MS = 24 * 60 * 60 * 1000;

function toValidDate(record: SearchRecord): Date | null {
  if (!record.timestamp) return null;
  const d = new Date(record.timestamp);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Per-day (range ≤ 60 days) or per-month buckets in local time, continuous from
 * the first to the last record so empty periods plot as 0 instead of being
 * skipped. Buckets are keyed by a sortable YYYY-MM[-DD] string and created in
 * chronological order, so no label parsing is needed to sort them.
 */
function buildTimeline(applications: SearchRecord[], searches: SearchRecord[]) {
  const appDates = applications.map(toValidDate).filter((d): d is Date => d !== null);
  const checkDates = searches.map(toValidDate).filter((d): d is Date => d !== null);
  const all = [...appDates, ...checkDates];
  if (!all.length) return [];

  let minTs = Infinity;
  let maxTs = -Infinity;
  for (const d of all) {
    minTs = Math.min(minTs, d.getTime());
    maxTs = Math.max(maxTs, d.getTime());
  }
  const useDays = (maxTs - minTs) / DAY_MS <= 60;

  const keyOf = (d: Date) =>
    useDays
      ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
      : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  const labelOf = (d: Date) =>
    useDays
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : `${d.toLocaleDateString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(-2)}`;

  const first = new Date(minTs);
  const end = new Date(maxTs);
  const cursor = useDays
    ? new Date(first.getFullYear(), first.getMonth(), first.getDate())
    : new Date(first.getFullYear(), first.getMonth(), 1);

  const buckets = new Map<string, { name: string; applications: number; checks: number }>();
  while (cursor <= end) {
    buckets.set(keyOf(cursor), { name: labelOf(cursor), applications: 0, checks: 0 });
    if (useDays) cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }

  appDates.forEach((d) => { buckets.get(keyOf(d))!.applications++; });
  checkDates.forEach((d) => { buckets.get(keyOf(d))!.checks++; });
  return Array.from(buckets.values());
}

/* ── Custom Tooltip ───────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-luxury text-xs">
      <p className="font-bold text-ink mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-ink-mute">{entry.name}:</span>
          <span className="font-bold text-ink">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Chart Card Wrapper ───────────────────────────────────────── */
function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-3xl border border-border p-6 shadow-luxury hover:border-gold/30 transition-all">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
          <Icon size={18} />
        </div>
        <h4 className="text-sm font-bold text-ink tracking-tight">{title}</h4>
      </div>
      {children}
    </div>
  );
}

/* ── Empty / error placeholder for application-based charts ───── */
function ChartEmpty({ error }: { error?: string | null }) {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center text-center gap-1 px-4">
      <p className={`text-sm font-bold ${error ? 'text-red-500' : 'text-ink'}`}>
        {error ? "Couldn't load applications" : 'No applications yet'}
      </p>
      <p className="text-xs text-ink-mute max-w-xs">
        {error ?? 'This chart fills in once loan applications are submitted.'}
      </p>
    </div>
  );
}

/* ── Series legend ────────────────────────────────────────────── */
function SeriesLegend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex items-center justify-center gap-5 mt-3 text-xs">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-ink-mute font-medium">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Custom Legend for Pie ─────────────────────────────────────── */
function PieLegend({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="flex flex-col gap-2 mt-2">
      {data.map((d) => (
        <div key={d.name} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-ink-mute font-medium">{d.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">{d.value}</span>
            <span className="text-ink-mute text-[10px]">({((d.value / total) * 100).toFixed(0)}%)</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                */
/* ═══════════════════════════════════════════════════════════════ */

interface Props {
  applications: SearchRecord[];
  searches: SearchRecord[];
  loading: boolean;
  /** Applications fetch error — shown in place of the application-based charts. */
  error?: string | null;
}

export const DashboardCharts = memo(function DashboardCharts({ applications, searches, loading, error }: Props) {
  /* ── 1) Applications Over Time ─────────────────────────────── */
  const timelineData = useMemo(() => buildTimeline(applications, searches), [applications, searches]);

  /* ── 2) Approval Breakdown ─────────────────────────────────── */
  const approvalData = useMemo(() => {
    const counts = { approved: 0, rejected: 0, pending: 0 };
    applications.forEach((r) => {
      counts[getStatus(r.metadata?.prediction?.approved)]++;
    });
    return [
      { name: 'Approved', value: counts.approved, color: GREEN },
      { name: 'Rejected', value: counts.rejected, color: RED },
      { name: 'Pending', value: counts.pending, color: AMBER },
    ];
  }, [applications]);

  // Zero-value slices still receive paddingAngle and leave a stray gap in the ring.
  const pieSlices = approvalData.filter((d) => d.value > 0);

  /* ── 3) Loan Type Distribution ─────────────────────────────── */
  const loanTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    applications.forEach((r) => {
      const loanType = formatLoanType(r.data?.loan_type);
      counts.set(loanType, (counts.get(loanType) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [applications]);

  /* ── 4) Risk Score Distribution ────────────────────────────── */
  const riskData = useMemo(() => {
    const counts = RISK_BUCKETS.map(() => 0);
    applications.forEach((r) => {
      const raw = r.metadata?.prediction?.approval_probability;
      if (raw == null) return;
      const prob = Number(raw);
      if (!Number.isFinite(prob)) return;
      // 0-100 scale; 100 belongs to the top bucket, out-of-range values are clamped.
      counts[Math.min(RISK_BUCKETS.length - 1, Math.max(0, Math.floor(prob / 20)))]++;
    });
    return RISK_BUCKETS.map((name, i) => ({ name, count: counts[i] }));
  }, [applications]);

  const hasApplications = applications.length > 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-3xl border border-border p-6 shadow-luxury">
            <div className="h-5 w-40 bg-muted/40 animate-pulse rounded-md mb-6" />
            <div className="h-[200px] bg-muted/20 animate-pulse rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  const hasData = applications.length > 0 || searches.length > 0;

  if (!hasData) {
    return (
      <div className="bg-card rounded-3xl border border-border p-12 shadow-luxury text-center">
        <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center text-gold mx-auto mb-4">
          <TrendingUp size={28} />
        </div>
        <p className="font-bold text-ink text-base">{error ? "Couldn't load chart data" : 'No data to visualize'}</p>
        <p className="text-sm text-ink-mute mt-1">{error ?? 'Charts will appear once application data is available.'}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Area Chart: Applications Over Time ───────────────── */}
      <ChartCard title="Volume Over Time" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="slateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SLATE} stopOpacity={0.2} />
                <stop offset="95%" stopColor={SLATE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'hsl(var(--ink-mute))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--ink-mute))' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="applications"
              name="Applications"
              stroke={GOLD}
              strokeWidth={2.5}
              fill="url(#goldGradient)"
              dot={false}
              activeDot={{ r: 5, fill: GOLD, stroke: '#fff', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="checks"
              name="Eligibility Checks"
              stroke={SLATE}
              strokeWidth={1.5}
              fill="url(#slateGradient)"
              dot={false}
              activeDot={{ r: 4, fill: SLATE, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <SeriesLegend items={[{ name: 'Applications', color: GOLD }, { name: 'Eligibility Checks', color: SLATE }]} />
      </ChartCard>

      {/* ── Pie Chart: Approval Breakdown ────────────────────── */}
      <ChartCard title="Approval Breakdown" icon={PieIcon}>
        {hasApplications ? (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie
                  data={pieSlices}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={pieSlices.length > 1 ? 4 : 0}
                  dataKey="value"
                  stroke="none"
                >
                  {pieSlices.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1">
              <PieLegend data={approvalData} />
            </div>
          </div>
        ) : (
          <ChartEmpty error={error} />
        )}
      </ChartCard>

      {/* ── Bar Chart: Loan Type Distribution ────────────────── */}
      <ChartCard title="Loan Type Distribution" icon={Layers}>
        {hasApplications ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={loanTypeData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: 'hsl(var(--ink-mute))' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--ink-mute))' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="count"
                name="Applications"
                fill={GOLD}
                radius={[8, 8, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmpty error={error} />
        )}
      </ChartCard>

      {/* ── Bar Chart: Risk Score Distribution ───────────────── */}
      <ChartCard title="Risk Score Distribution" icon={Activity}>
        {hasApplications ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={riskData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'hsl(var(--ink-mute))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--ink-mute))' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Applications" radius={[8, 8, 0, 0]} maxBarSize={50}>
                {riskData.map((bucket, index) => (
                  <Cell key={bucket.name} fill={RISK_COLORS[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmpty error={error} />
        )}
      </ChartCard>
    </div>
  );
});
