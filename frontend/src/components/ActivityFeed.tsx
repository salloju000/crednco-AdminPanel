import { memo, useMemo } from 'react';
import type { SearchRecord } from '../hooks/types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ArrowRight,
} from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────── */
interface ActivityItem {
  id: string;
  type: 'approved' | 'rejected' | 'pending' | 'submitted';
  name: string;
  loanType: string;
  amount: string;
  timestamp: Date;
  timeAgo: string;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG = {
  approved: {
    icon: CheckCircle2,
    label: 'Approved',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    dot: 'bg-green-500',
  },
  rejected: {
    icon: XCircle,
    label: 'Rejected',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
  },
  pending: {
    icon: Clock,
    label: 'Pending Review',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
  },
  submitted: {
    icon: FileText,
    label: 'Submitted',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    dot: 'bg-gold',
  },
};

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                */
/* ═══════════════════════════════════════════════════════════════ */

interface Props {
  applications: SearchRecord[];
  loading: boolean;
  onSelect?: (record: SearchRecord) => void;
}

export const ActivityFeed = memo(function ActivityFeed({ applications, loading, onSelect }: Props) {
  const activities: ActivityItem[] = useMemo(() => {
    return applications
      .filter((r) => r.timestamp)
      .map((r) => {
        const approved = r.metadata?.prediction?.approved;
        let type: ActivityItem['type'] = 'submitted';
        if (approved === true) type = 'approved';
        else if (approved === false) type = 'rejected';
        else type = 'pending';

        const ts = new Date(r.timestamp!);
        const loanType = String(r.data?.loan_type ?? 'Loan')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const amount = r.data?.loan_amount_requested
          ? `₹${Number(r.data.loan_amount_requested).toLocaleString('en-IN')}`
          : '';

        return {
          id: r.id ?? '',
          type,
          name: String(r.data?.name ?? 'Anonymous'),
          loanType,
          amount,
          timestamp: ts,
          timeAgo: getTimeAgo(ts),
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8);
  }, [applications]);

  if (loading) {
    return (
      <div className="bg-card rounded-3xl border border-border p-6 shadow-luxury">
        <div className="h-5 w-40 bg-muted/40 animate-pulse rounded-md mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-muted/30 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-48 bg-muted/30 animate-pulse rounded" />
                <div className="h-3 w-32 bg-muted/20 animate-pulse rounded" />
              </div>
              <div className="h-3 w-14 bg-muted/20 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!activities.length) {
    return (
      <div className="bg-card rounded-3xl border border-border p-8 shadow-luxury text-center">
        <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-gold mx-auto mb-3">
          <Clock size={24} />
        </div>
        <p className="font-bold text-ink text-sm">No recent activity</p>
        <p className="text-xs text-ink-mute mt-1">Activity will appear as applications are processed.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-3xl border border-border shadow-luxury overflow-hidden">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
            <Clock size={18} />
          </div>
          <h4 className="text-sm font-bold text-ink">Recent Activity</h4>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-mute">
          Latest {activities.length}
        </span>
      </div>

      <div className="divide-y divide-border/30">
        {activities.map((activity) => {
          const config = TYPE_CONFIG[activity.type];
          const Icon = config.icon;
          const record = applications.find((a) => a.id === activity.id);

          return (
            <button
              key={activity.id}
              onClick={() => record && onSelect?.(record)}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/15 transition-all group text-left"
            >
              {/* Timeline dot */}
              <div className="relative flex-shrink-0">
                <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center ${config.color} group-hover:scale-110 transition-transform`}>
                  <Icon size={16} />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink text-sm truncate">
                    {activity.name}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-ink-mute">{activity.loanType}</span>
                  {activity.amount && (
                    <>
                      <span className="text-ink-mute text-[8px]">•</span>
                      <span className="text-[11px] font-semibold text-ink-mid">{activity.amount}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Timestamp + arrow */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-ink-mute font-medium">{activity.timeAgo}</span>
                <ArrowRight size={14} className="text-ink-mute opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
