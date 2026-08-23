import { memo, useMemo } from 'react';
import type { SearchRecord } from '../hooks/types';
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

const PIE_COLORS = [GREEN, RED, AMBER];

/* ── Helpers ──────────────────────────────────────────────────── */
function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
}

export const DashboardCharts = memo(function DashboardCharts({ applications, searches, loading }: Props) {
  /* ── 1) Applications Over Time ─────────────────────────────── */
  const timelineData = useMemo(() => {
    const allRecords = [...applications, ...searches];
    if (!allRecords.length) return [];

    const buckets = new Map<string, { applications: number; checks: number }>();

    // Determine if we should use days or months
    const timestamps = allRecords
      .filter((r) => r.timestamp)
      .map((r) => new Date(r.timestamp!).getTime());

    if (!timestamps.length) return [];

    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const rangeInDays = (maxTs - minTs) / (1000 * 60 * 60 * 24);
    const useDays = rangeInDays <= 60;

    const keyFn = useDays ? getDayKey : getMonthKey;

    applications.forEach((r) => {
      if (!r.timestamp) return;
      const key = keyFn(r.timestamp);
      const b = buckets.get(key) || { applications: 0, checks: 0 };
      b.applications++;
      buckets.set(key, b);
    });

    searches.forEach((r) => {
      if (!r.timestamp) return;
      const key = keyFn(r.timestamp);
      const b = buckets.get(key) || { applications: 0, checks: 0 };
      b.checks++;
      buckets.set(key, b);
    });

    // Sort chronologically
    return Array.from(buckets.entries())
      .sort((a, b) => {
        const da = new Date(a[0]);
        const db = new Date(b[0]);
        return da.getTime() - db.getTime();
      })
      .map(([name, data]) => ({ name, ...data }));
  }, [applications, searches]);

  /* ── 2) Approval Breakdown ─────────────────────────────────── */
  const approvalData = useMemo(() => {
    let approved = 0, rejected = 0, pending = 0;
    applications.forEach((r) => {
      const a = r.metadata?.prediction?.approved;
      if (a === true) approved++;
      else if (a === false) rejected++;
      else pending++;
    });
    return [
      { name: 'Approved', value: approved, color: GREEN },
      { name: 'Rejected', value: rejected, color: RED },
      { name: 'Pending', value: pending, color: AMBER },
    ];
  }, [applications]);

  /* ── 3) Loan Type Distribution ─────────────────────────────── */
  const loanTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    applications.forEach((r) => {
      const loanType = String(r.data?.loan_type ?? 'Unknown')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      counts.set(loanType, (counts.get(loanType) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [applications]);

  /* ── 4) Risk Score Distribution ────────────────────────────── */
  const riskData = useMemo(() => {
    const buckets = [
      { range: '0-20%', min: 0, max: 20, count: 0 },
      { range: '20-40%', min: 20, max: 40, count: 0 },
      { range: '40-60%', min: 40, max: 60, count: 0 },
      { range: '60-80%', min: 60, max: 80, count: 0 },
      { range: '80-100%', min: 80, max: 100, count: 0 },
    ];
    applications.forEach((r) => {
      const prob = r.metadata?.prediction?.approval_probability;
      if (prob == null) return;
      const bucket = buckets.find((b) => prob >= b.min && prob < b.max) ?? buckets[buckets.length - 1];
      if (prob === 100) buckets[buckets.length - 1].count++;
      else bucket.count++;
    });
    return buckets.map((b) => ({ name: b.range, count: b.count }));
  }, [applications]);

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
        <p className="font-bold text-ink text-base">No data to visualize</p>
        <p className="text-sm text-ink-mute mt-1">Charts will appear once application data is available.</p>
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
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
      </ChartCard>

      {/* ── Pie Chart: Approval Breakdown ────────────────────── */}
      <ChartCard title="Approval Breakdown" icon={PieIcon}>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="55%" height={200}>
            <PieChart>
              <Pie
                data={approvalData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {approvalData.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1">
            <PieLegend data={approvalData} />
          </div>
        </div>
      </ChartCard>

      {/* ── Bar Chart: Loan Type Distribution ────────────────── */}
      <ChartCard title="Loan Type Distribution" icon={Layers}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={loanTypeData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
      </ChartCard>

      {/* ── Bar Chart: Risk Score Distribution ───────────────── */}
      <ChartCard title="Risk Score Distribution" icon={Activity}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={riskData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
              {riskData.map((_, index) => {
                const colors = [RED, '#f97316', AMBER, '#84cc16', GREEN];
                return <Cell key={index} fill={colors[index]} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
});
