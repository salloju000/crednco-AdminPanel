import { memo, useMemo, useState } from 'react';
import type { SearchRecord } from '../hooks/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Calendar, ArrowUpRight, ArrowDownRight, Minus as MinusIcon } from 'lucide-react';

/* ── Colors ───────────────────────────────────────────────────── */
const GOLD = '#c89b3c';
const SLATE = 'rgba(100, 116, 139, 0.6)';

/* ── Date Range Presets ───────────────────────────────────────── */
type RangePreset = '7d' | '14d' | '30d' | '90d' | 'all';

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '14d', label: '14 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: 'all', label: 'All Time' },
];

function getDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - d.getDay());
  return `W${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
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

/* ── Trend Indicator ──────────────────────────────────────────── */
function TrendBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0 && current === 0) {
    return (
      <div className="flex items-center gap-1 text-ink-mute">
        <MinusIcon size={12} />
        <span className="text-[10px] font-bold">No data</span>
      </div>
    );
  }

  const change = previous === 0 ? 100 : ((current - previous) / previous) * 100;
  const isUp = change > 0;
  const isNeutral = change === 0;

  return (
    <div className={`flex items-center gap-1 ${isNeutral ? 'text-ink-mute' : isUp ? 'text-green-500' : 'text-red-500'}`}>
      {isNeutral ? <MinusIcon size={12} /> : isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      <span className="text-[10px] font-bold">
        {isNeutral ? 'No change' : `${Math.abs(change).toFixed(0)}% vs prev ${label}`}
      </span>
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

export const DateRangeAnalytics = memo(function DateRangeAnalytics({ applications, searches, loading }: Props) {
  const [range, setRange] = useState<RangePreset>('30d');

  // Filter records by date range
  const filterByRange = (records: SearchRecord[], preset: RangePreset) => {
    if (preset === 'all') return records;
    const days = parseInt(preset);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return records.filter((r) => r.timestamp && new Date(r.timestamp) >= cutoff);
  };

  // Current period data
  const currentApps = useMemo(() => filterByRange(applications, range), [applications, range]);
  const currentSearches = useMemo(() => filterByRange(searches, range), [searches, range]);

  // Previous period data (for comparison)
  const previousPeriodData = useMemo(() => {
    if (range === 'all') return { apps: 0, searches: 0 };
    const days = parseInt(range);
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(now.getDate() - days);
    const prevStart = new Date(currentStart);
    prevStart.setDate(currentStart.getDate() - days);

    const prevApps = applications.filter((r) => {
      if (!r.timestamp) return false;
      const d = new Date(r.timestamp);
      return d >= prevStart && d < currentStart;
    });
    const prevSearches = searches.filter((r) => {
      if (!r.timestamp) return false;
      const d = new Date(r.timestamp);
      return d >= prevStart && d < currentStart;
    });
    return { apps: prevApps.length, searches: prevSearches.length };
  }, [applications, searches, range]);

  // Trend chart data
  const trendData = useMemo(() => {
    const allRecords = [...currentApps, ...currentSearches];
    if (!allRecords.length) return [];

    const days = range === 'all' ? 999 : parseInt(range);
    const useWeeks = days > 30;
    const keyFn = useWeeks ? getWeekKey : getDayKey;

    const buckets = new Map<string, { applications: number; checks: number }>();

    currentApps.forEach((r) => {
      if (!r.timestamp) return;
      const key = keyFn(r.timestamp);
      const b = buckets.get(key) || { applications: 0, checks: 0 };
      b.applications++;
      buckets.set(key, b);
    });

    currentSearches.forEach((r) => {
      if (!r.timestamp) return;
      const key = keyFn(r.timestamp);
      const b = buckets.get(key) || { applications: 0, checks: 0 };
      b.checks++;
      buckets.set(key, b);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([name, data]) => ({ name, ...data }));
  }, [currentApps, currentSearches, range]);

  // Compute metrics
  const currentConversion = currentSearches.length > 0
    ? ((currentApps.length / currentSearches.length) * 100).toFixed(1)
    : '0.0';

  const prevConversion = previousPeriodData.searches > 0
    ? ((previousPeriodData.apps / previousPeriodData.searches) * 100)
    : 0;

  const rangeLabel = range === 'all' ? 'period' : range;

  if (loading) {
    return (
      <div className="bg-card rounded-3xl border border-border p-8 shadow-luxury">
        <div className="h-5 w-48 bg-muted/40 animate-pulse rounded-md mb-6" />
        <div className="h-[280px] bg-muted/20 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-3xl border border-border shadow-luxury overflow-hidden">
      {/* Header with date range selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 pb-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
            <Calendar size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink">Period Analysis</h4>
            <p className="text-[10px] text-ink-mute">Compare metrics across time ranges</p>
          </div>
        </div>

        <div className="flex bg-muted/30 border border-border/50 rounded-xl p-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setRange(p.id)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                range === p.id
                  ? 'bg-gold text-white shadow-md shadow-gold/20'
                  : 'text-ink-mute hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
        <div className="bg-muted/15 rounded-2xl p-5 border border-border/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-ink-mute mb-1">Applications</p>
          <p className="text-3xl font-black text-ink mb-2">{currentApps.length.toLocaleString()}</p>
          <TrendBadge current={currentApps.length} previous={previousPeriodData.apps} label={rangeLabel} />
        </div>
        <div className="bg-muted/15 rounded-2xl p-5 border border-border/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-ink-mute mb-1">Eligibility Checks</p>
          <p className="text-3xl font-black text-ink mb-2">{currentSearches.length.toLocaleString()}</p>
          <TrendBadge current={currentSearches.length} previous={previousPeriodData.searches} label={rangeLabel} />
        </div>
        <div className="bg-muted/15 rounded-2xl p-5 border border-border/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-ink-mute mb-1">Conversion Rate</p>
          <p className="text-3xl font-black text-gold mb-2">{currentConversion}%</p>
          <TrendBadge current={parseFloat(currentConversion)} previous={prevConversion} label={rangeLabel} />
        </div>
      </div>

      {/* Trend Chart */}
      {trendData.length > 0 && (
        <div className="px-6 pb-6">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="dateGoldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dateSlateGrad" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#dateGoldGrad)"
                dot={false}
                activeDot={{ r: 5, fill: GOLD, stroke: '#fff', strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="checks"
                name="Eligibility Checks"
                stroke={SLATE}
                strokeWidth={1.5}
                fill="url(#dateSlateGrad)"
                dot={false}
                activeDot={{ r: 4, fill: SLATE, stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
});
