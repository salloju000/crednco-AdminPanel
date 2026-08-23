import { memo, useMemo } from 'react';
import type { SearchRecord } from '../hooks/types';
import { Filter, ArrowDown, Users, Search, FileText, CheckCircle2 } from 'lucide-react';

/* ── Colors ───────────────────────────────────────────────────── */
const GOLD = '#c89b3c';
const GREEN = '#22c55e';
const BLUE = '#3b82f6';
const PURPLE = '#8b5cf6';

interface FunnelStage {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  description: string;
}

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                */
/* ═══════════════════════════════════════════════════════════════ */

interface Props {
  applications: SearchRecord[];
  searches: SearchRecord[];
  totalUsers: number;
  loading: boolean;
}

export const ConversionFunnel = memo(function ConversionFunnel({ applications, searches, totalUsers, loading }: Props) {
  const stages: FunnelStage[] = useMemo(() => {
    const eligibilityChecks = searches.length;
    const formalApplications = applications.length;
    const approved = applications.filter((r) => r.metadata?.prediction?.approved === true).length;

    return [
      {
        label: 'Registered Users',
        value: totalUsers,
        color: PURPLE,
        icon: Users,
        description: 'Total accounts created',
      },
      {
        label: 'Eligibility Checks',
        value: eligibilityChecks,
        color: BLUE,
        icon: Search,
        description: 'Soft credit inquiries',
      },
      {
        label: 'Formal Applications',
        value: formalApplications,
        color: GOLD,
        icon: FileText,
        description: 'Full loan submissions',
      },
      {
        label: 'Approved Loans',
        value: approved,
        color: GREEN,
        icon: CheckCircle2,
        description: 'Final approvals',
      },
    ];
  }, [applications, searches, totalUsers]);

  // Compute drop-off rates between stages
  const dropoffs = useMemo(() => {
    return stages.slice(1).map((stage, i) => {
      const prev = stages[i].value;
      if (prev === 0) return { rate: 0, absolute: 0 };
      const dropped = prev - stage.value;
      return {
        rate: ((dropped / prev) * 100),
        absolute: dropped,
      };
    });
  }, [stages]);

  if (loading) {
    return (
      <div className="bg-card rounded-3xl border border-border p-8 shadow-luxury">
        <div className="h-5 w-48 bg-muted/40 animate-pulse rounded-md mb-8" />
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted/20 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  // Overall conversion: users → approved
  const overallConversion = totalUsers > 0
    ? ((stages[stages.length - 1].value / totalUsers) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="bg-card rounded-3xl border border-border shadow-luxury overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
            <Filter size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink">Conversion Funnel</h4>
            <p className="text-[10px] text-ink-mute">End-to-end user journey analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/15 border border-border/30 rounded-xl px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-mute">Overall</span>
          <span className="text-lg font-black text-gold">{overallConversion}%</span>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="p-6 space-y-3">
        {stages.map((stage, i) => {
          const widthPercent = maxValue > 0 ? Math.max((stage.value / maxValue) * 100, 8) : 8;
          const Icon = stage.icon;
          const dropoff = i > 0 ? dropoffs[i - 1] : null;
          const convFromPrev = i > 0 && stages[i - 1].value > 0
            ? ((stage.value / stages[i - 1].value) * 100).toFixed(1)
            : null;

          return (
            <div key={stage.label}>
              {/* Drop-off indicator between stages */}
              {dropoff && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="flex-1 border-t border-dashed border-border/40" />
                  <div className="flex items-center gap-2 text-ink-mute">
                    <ArrowDown size={12} />
                    <span className="text-[10px] font-bold">
                      {dropoff.rate > 0
                        ? `${dropoff.rate.toFixed(0)}% drop-off (${dropoff.absolute.toLocaleString()} lost)`
                        : 'No drop-off'}
                    </span>
                    {convFromPrev && (
                      <span className="text-[10px] font-bold text-gold">
                        · {convFromPrev}% converted
                      </span>
                    )}
                  </div>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              )}

              {/* Stage bar */}
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${stage.color}15`, color: stage.color }}
                >
                  <Icon size={18} />
                </div>

                {/* Bar + Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">{stage.label}</span>
                      <span className="text-[10px] text-ink-mute">{stage.description}</span>
                    </div>
                    <span className="text-lg font-black tabular-nums" style={{ color: stage.color }}>
                      {stage.value.toLocaleString()}
                    </span>
                  </div>

                  {/* Visual bar */}
                  <div className="h-3 bg-muted/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: stage.color,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      <div className="px-6 pb-6">
        <div className="bg-muted/15 rounded-2xl p-4 border border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold text-xs font-black">
              ∑
            </div>
            <div>
              <p className="text-xs font-bold text-ink">End-to-End Conversion</p>
              <p className="text-[10px] text-ink-mute">From registration to approved loan</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-gold">{overallConversion}%</p>
            <p className="text-[10px] text-ink-mute">
              {stages[stages.length - 1].value} of {totalUsers} users
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
