import { useMemo } from 'react';
import {
  X,
  Globe,
  Building2,
  Mail,
  AtSign,
  FileText,
  BarChart3,
  ExternalLink,
  Shield,
} from 'lucide-react';
import type { SearchRecord } from '../hooks/types';
import { CopyButton } from '../hooks/copybutton';

/* ── Public domain list ─────────────────────────────────────── */
const PUBLIC_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'aol.com', 'zoho.com', 'protonmail.com', 'yandex.com', 'mail.com',
];

interface Props {
  email: string;
  applications: SearchRecord[];
  onClose: () => void;
  onNavigateToApplications: () => void;
  onNavigateToAnalytics: () => void;
  onSelectApplication: (record: SearchRecord) => void;
}

export function UserDetailPanel({
  email,
  applications,
  onClose,
  onNavigateToApplications,
  onNavigateToAnalytics,
  onSelectApplication,
}: Props) {
  const [username, domain] = email.split('@');
  const displayName = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const isCorporate = domain ? !PUBLIC_DOMAINS.includes(domain.toLowerCase()) : false;

  // Try to find matching records by email username pattern
  // We look for applications/searches where the applicant name matches the email username
  const userApplications = useMemo(() => {
    const name = username.toLowerCase().replace(/[._-]/g, ' ');
    const nameParts = name.split(' ').filter(Boolean);
    return applications.filter((r) => {
      const appName = String(r.data?.name ?? '').toLowerCase();
      // Match if any part of the email username appears in the application name
      return nameParts.some((part) => part.length > 2 && appName.includes(part));
    });
  }, [applications, username]);

  const approvedCount = userApplications.filter((r) => r.metadata?.prediction?.approved === true).length;
  const rejectedCount = userApplications.filter((r) => r.metadata?.prediction?.approved === false).length;
  const pendingCount = userApplications.length - approvedCount - rejectedCount;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex items-center justify-end p-0 bg-transparent max-w-none m-0 w-full h-full"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card h-full w-full max-w-md shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col border-l border-border/60 overflow-hidden">

        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-border/40 bg-muted/10">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-ink-mute hover:text-ink hover:bg-muted/50 rounded-xl transition-all"
            aria-label="Close panel"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-2 mb-5">
            <Shield size={12} className="text-gold" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold/80">User Profile</span>
          </div>

          {/* Avatar + Name */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 text-gold flex items-center justify-center font-black text-2xl uppercase border border-gold/20">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-black font-serif text-ink tracking-tight truncate">{displayName}</h2>
              <div className="flex items-center gap-2 mt-1">
                {isCorporate ? (
                  <span className="inline-flex items-center gap-1 border border-gold/30 bg-gold/5 text-gold text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    <Building2 size={10} />
                    Corporate
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 border border-border bg-muted/20 text-ink-mute text-[9px] px-2 py-0.5 rounded-full font-medium">
                    <Globe size={10} />
                    Public
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Email row */}
          <div className="flex items-center gap-3 bg-muted/20 rounded-xl px-4 py-3 border border-border/30">
            <Mail size={14} className="text-ink-mute shrink-0" />
            <span className="text-sm font-mono text-ink truncate flex-1" title={email}>{email}</span>
            <CopyButton
              text={email}
              label="Copy email"
              size={14}
              className="p-1.5 text-ink-mute hover:text-gold rounded-lg transition-all shrink-0"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">

          {/* Domain Details */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-ink-mute">Domain Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/15 rounded-xl p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <AtSign size={12} className="text-ink-mute" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-ink-mute">Domain</span>
                </div>
                <p className="text-sm font-bold text-ink">{domain || 'N/A'}</p>
              </div>
              <div className="bg-muted/15 rounded-xl p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <Globe size={12} className="text-ink-mute" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-ink-mute">Type</span>
                </div>
                <p className={`text-sm font-bold ${isCorporate ? 'text-gold' : 'text-ink'}`}>
                  {isCorporate ? 'Corporate' : 'Public'}
                </p>
              </div>
            </div>
          </div>

          {/* Application Stats (if matched) */}
          {userApplications.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-ink-mute">Linked Applications</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/15 rounded-xl p-3 border border-border/30 text-center">
                  <p className="text-2xl font-black text-green-500">{approvedCount}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-ink-mute mt-0.5">Approved</p>
                </div>
                <div className="bg-muted/15 rounded-xl p-3 border border-border/30 text-center">
                  <p className="text-2xl font-black text-amber-500">{pendingCount}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-ink-mute mt-0.5">Pending</p>
                </div>
                <div className="bg-muted/15 rounded-xl p-3 border border-border/30 text-center">
                  <p className="text-2xl font-black text-red-500">{rejectedCount}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-ink-mute mt-0.5">Rejected</p>
                </div>
              </div>

              {/* Recent applications list */}
              <div className="space-y-2 mt-2">
                {userApplications.slice(0, 5).map((app, idx) => {
                  const name = String(app.data?.name ?? 'Unknown');
                  const amount = app.data?.loan_amount_requested
                    ? `₹${Number(app.data.loan_amount_requested).toLocaleString('en-IN')}`
                    : 'N/A';
                  const approved = app.metadata?.prediction?.approved;
                  const statusColor = approved === true ? 'bg-green-500' : approved === false ? 'bg-red-500' : 'bg-amber-500';

                  return (
                    <button
                      key={app.id ?? idx}
                      onClick={() => onSelectApplication(app)}
                      className="w-full flex items-center gap-3 p-3 bg-muted/10 hover:bg-muted/25 rounded-xl border border-border/20 transition-all group text-left"
                    >
                      <div className={`w-2 h-2 rounded-full ${statusColor} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-ink truncate">{name}</p>
                        <p className="text-[10px] text-ink-mute">{amount}</p>
                      </div>
                      <ExternalLink size={12} className="text-ink-mute opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-ink-mute">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  onNavigateToApplications();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-muted/15 hover:bg-gold/5 hover:border-gold/30 rounded-xl border border-border/30 transition-all group text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
                  <FileText size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-ink">Search in Applications</p>
                  <p className="text-[10px] text-ink-mute">Find loan applications by this user</p>
                </div>
                <ExternalLink size={14} className="text-ink-mute group-hover:text-gold transition-colors" />
              </button>

              <button
                onClick={() => {
                  onNavigateToAnalytics();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-muted/15 hover:bg-gold/5 hover:border-gold/30 rounded-xl border border-border/30 transition-all group text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
                  <BarChart3 size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-ink">Search in Analytics</p>
                  <p className="text-[10px] text-ink-mute">View eligibility checks by this user</p>
                </div>
                <ExternalLink size={14} className="text-ink-mute group-hover:text-gold transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
