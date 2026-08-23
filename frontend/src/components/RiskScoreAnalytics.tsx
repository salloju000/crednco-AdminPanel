import { memo, useMemo } from 'react';
import type { SearchRecord } from '../hooks/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { TrendingUp, AlertTriangle, Activity } from 'lucide-react';

/* ── Colors ───────────────────────────────────────────────────── */
const GOLD = '#c89b3c';
const GREEN = '#22c55e';
const RED = '#ef4444';
const AMBER = '#f59e0b';

function getRiskColor(score: number): string {
  if (score >= 80) return GREEN;
  if (score >= 60) return '#84cc16';
  if (score >= 40) return AMBER;
  if (score >= 20) return '#f97316';
  return RED;
}

function getRiskLabel(score: number): string {
  if (score >= 80) return 'Low Risk';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Elevated';
  if (score >= 20) return 'High Risk';
  return 'Critical';
}

/* ── Custom Tooltip ───────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-luxury text-xs">
      <p className="font-bold text-ink mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
          <span className="text-ink-mute">{entry.name}:</span>
          <span className="font-bold text-ink">{typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Chart Card ───────────────────────────────────────────────── */
function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-3xl border border-border p-6 shadow-luxury hover:border-gold/30 transition-all">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
          <Icon size={18} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-ink tracking-tight">{title}</h4>
          {subtitle && <p className="text-[10px] text-ink-mute">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                */
/* ═══════════════════════════════════════════════════════════════ */

interface Props {
  applications: SearchRecord[];
  loading: boolean;
}

export const RiskScoreAnalytics = memo(function RiskScoreAnalytics({ applications, loading }: Props) {
  /* ── Average risk score over time ──────────────────────────── */
  const avgScoreOverTime = useMemo(() => {
    const buckets = new Map<string, { total: number; count: number }>();

    applications.forEach((r) => {
      if (!r.timestamp || r.metadata?.prediction?.approval_probability == null) return;
      const d = new Date(r.timestamp);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const b = buckets.get(key) || { total: 0, count: 0 };
      b.total += Number(r.metadata.prediction.approval_probability);
      b.count++;
      buckets.set(key, b);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([name, data]) => ({
        name,
        avgScore: data.total / data.count,
      }));
  }, [applications]);

  /* ── Risk distribution by loan type ────────────────────────── */
  const riskByLoanType = useMemo(() => {
    const buckets = new Map<string, { total: number; count: number; high: number }>();

    applications.forEach((r) => {
      const prob = r.metadata?.prediction?.approval_probability;
      if (prob == null) return;
      const loanType = String(r.data?.loan_type ?? 'Unknown')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const b = buckets.get(loanType) || { total: 0, count: 0, high: 0 };
      b.total += Number(prob);
      b.count++;
      if (prob < 40) b.high++;
      buckets.set(loanType, b);
    });

    return Array.from(buckets.entries())
      .map(([name, data]) => ({
        name,
        avgScore: parseFloat((data.total / data.count).toFixed(1)),
        count: data.count,
        highRisk: data.high,
      }))
      .sort((a, b) => a.avgScore - b.avgScore);
  }, [applications]);

  /* ── High-risk applications ────────────────────────────────── */
  const highRiskApps = useMemo(() => {
    return applications
      .filter((r) => {
        const prob = r.metadata?.prediction?.approval_probability;
        return prob != null && prob < 40;
      })
      .sort((a, b) => {
        const ap = a.metadata?.prediction?.approval_probability ?? 0;
        const bp = b.metadata?.prediction?.approval_probability ?? 0;
        return ap - bp;
      })
      .slice(0, 6);
  }, [applications]);

  /* ── Summary stats ─────────────────────────────────────────── */
  const stats = useMemo(() => {
    const scores = applications
      .map((r) => r.metadata?.prediction?.approval_probability)
      .filter((s): s is number => s != null);

    if (!scores.length) return { avg: 0, min: 0, max: 0, highRiskCount: 0, total: 0 };

    return {
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      min: Math.min(...scores),
      max: Math.max(...scores),
      highRiskCount: scores.filter((s) => s < 40).length,
      total: scores.length,
    };
  }, [applications]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card rounded-3xl border border-border p-6 shadow-luxury">
            <div className="h-5 w-40 bg-muted/40 animate-pulse rounded-md mb-6" />
            <div className="h-[200px] bg-muted/20 animate-pulse rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  if (!applications.length) return null;

  return (
    <div className="space-y-4">
      {/* Risk Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 shadow-luxury">
          <p className="text-[10px] font-black uppercase tracking-widest text-ink-mute mb-1">Avg Risk Score</p>
          <p className="text-3xl font-black" style={{ color: getRiskColor(stats.avg) }}>
            {stats.avg.toFixed(1)}%
          </p>
          <p className="text-[10px] text-ink-mute mt-1">{getRiskLabel(stats.avg)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 shadow-luxury">
          <p className="text-[10px] font-black uppercase tracking-widest text-ink-mute mb-1">Score Range</p>
          <p className="text-2xl font-black text-ink">
            <span style={{ color: getRiskColor(stats.min) }}>{stats.min.toFixed(0)}</span>
            <span className="text-ink-mute mx-1">–</span>
            <span style={{ color: getRiskColor(stats.max) }}>{stats.max.toFixed(0)}</span>
            <span className="text-sm text-ink-mute">%</span>
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 shadow-luxury">
          <p className="text-[10px] font-black uppercase tracking-widest text-ink-mute mb-1">High Risk</p>
          <p className="text-3xl font-black text-red-500">{stats.highRiskCount}</p>
          <p className="text-[10px] text-ink-mute mt-1">Below 40% threshold</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 shadow-luxury">
          <p className="text-[10px] font-black uppercase tracking-widest text-ink-mute mb-1">Scored Total</p>
          <p className="text-3xl font-black text-ink">{stats.total}</p>
          <p className="text-[10px] text-ink-mute mt-1">With predictions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Average score over time */}
        {avgScoreOverTime.length > 1 && (
          <ChartCard title="Risk Score Trend" subtitle="Average approval probability over time" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={avgScoreOverTime} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'hsl(var(--ink-mute))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--ink-mute))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                {/* Danger zone reference */}
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  name="Avg Score"
                  stroke={GOLD}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: GOLD, stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: GOLD, stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Risk by loan type */}
        {riskByLoanType.length > 0 && (
          <ChartCard title="Risk by Loan Type" subtitle="Average approval probability per category" icon={Activity}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={riskByLoanType} margin={{ top: 5, right: 10, left: -15, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--ink-mute))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 9, fill: 'hsl(var(--ink-mute))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="avgScore" name="Avg Score %" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {riskByLoanType.map((entry, index) => (
                    <Cell key={index} fill={getRiskColor(entry.avgScore)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* High-risk flagged applications */}
      {highRiskApps.length > 0 && (
        <div className="bg-card rounded-3xl border border-red-500/20 shadow-luxury overflow-hidden">
          <div className="flex items-center gap-3 p-6 pb-4 border-b border-border/40">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-ink">High-Risk Flagged</h4>
              <p className="text-[10px] text-ink-mute">Applications below 40% approval threshold</p>
            </div>
            <span className="ml-auto bg-red-500/10 text-red-500 text-[10px] font-bold px-3 py-1 rounded-full border border-red-500/20">
              {highRiskApps.length} flagged
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {highRiskApps.map((app, idx) => {
              const score = app.metadata?.prediction?.approval_probability ?? 0;
              const name = String(app.data?.name ?? 'Anonymous');
              const amount = app.data?.loan_amount_requested
                ? `₹${Number(app.data.loan_amount_requested).toLocaleString('en-IN')}`
                : 'N/A';
              const loanType = String(app.data?.loan_type ?? 'Unknown')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase());

              return (
                <div key={app.id ?? idx} className="flex items-center gap-4 px-6 py-3.5 hover:bg-red-500/5 transition-all">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: `${getRiskColor(score)}15`, color: getRiskColor(score) }}
                  >
                    {score.toFixed(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{name}</p>
                    <p className="text-[10px] text-ink-mute">{loanType} · {amount}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${score}%`, backgroundColor: getRiskColor(score) }}
                      />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: getRiskColor(score) }}>
                      {score.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
