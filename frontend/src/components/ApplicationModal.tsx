import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Briefcase, 
  IndianRupee, 
  Activity, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  CreditCard,
  History,
  FileText,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Fingerprint
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { SearchRecord } from '../hooks/types';
import { Button } from './Button';
import { StatusBadge } from '../hooks/statusbadge';
import { CopyButton } from '../hooks/copybutton';
import { formatLoanType } from '../hooks/formatLoanType';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  search: SearchRecord;
  onClose: () => void;
  onAction: (id: string, action: 'approve' | 'reject') => void;
  actionLoading: boolean;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <div className="mb-6 last:mb-0 bg-muted/20 dark:bg-muted/10 rounded-2xl p-6 border border-border/20">
      <div className="flex items-center gap-2 mb-5 border-b border-border/40 pb-3">
        <div className="text-gold opacity-80">{icon}</div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-ink">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
        {children}
      </div>
    </div>
  );
}

function Detail({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start gap-3">
       {icon && <div className="mt-0.5 text-gold/60">{icon}</div>}
       <div className="flex flex-col">
         <span className="text-[9px] font-black text-ink-mute uppercase tracking-[0.15em] leading-none mb-1.5 opacity-80">{label}</span>
         <span className="text-sm font-bold text-ink leading-tight tracking-tight">{value}</span>
       </div>
    </div>
  );
}

export function ApplicationModal({ search, onClose, onAction, actionLoading }: Props) {
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null);
  const dialogRef             = useRef<HTMLDialogElement>(null);
  const firstFocusRef         = useRef<HTMLButtonElement>(null);

  const data       = search.data ?? {};
  const prediction = search.metadata?.prediction ?? {};
  const approved   = prediction.approved;

  const score = prediction.approval_probability != null
    ? `${Number(prediction.approval_probability).toFixed(1)}%`
    : 'N/A';

  const amount = data.loan_amount_requested != null
    ? '₹' + Number(data.loan_amount_requested).toLocaleString('en-IN')
    : 'N/A';

  let scoreColor = 'text-amber-500';
  if (approved === true)       scoreColor = 'text-green-600';
  else if (approved === false) scoreColor = 'text-red-600';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null);
        else onClose();
      }
    };
    globalThis.addEventListener('keydown', handler);
    return () => globalThis.removeEventListener('keydown', handler);
  }, [confirm, onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const displayName = String(data.name ?? 'Anonymous applicant')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
    
  const uid         = search.metadata?.uid ?? search.id;

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Application dossier for ${displayName}`}
      open
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent max-w-none m-0 w-full h-full"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={handleBackdropClick}
    >
      <div className="bg-card rounded-[2.5rem] shadow-luxury w-full max-w-2xl max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden border border-border/60 dark:border-white/10 ring-1 ring-white/5">
        
        {/* Header - Luxury Banner */}
        <div className="relative pt-10 pb-8 px-10 border-b border-border/40 bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mr-8">
            <div className="space-y-3">
               <div className="flex items-center gap-2 mb-1">
                 <ShieldCheck size={14} className="text-gold" />
                 <span className="text-[10px] font-black uppercase tracking-[0.25em] text-gold/80">Official Loan Application</span>
               </div>
               <h2 className="text-4xl font-black font-serif text-ink tracking-tight leading-tight">{displayName}</h2>
               <div className="flex items-center gap-2.5">
                 <CopyButton text={String(uid)} />
                 <span className="text-[10px] font-bold text-ink-mute uppercase tracking-[0.1em]">{uid}</span>
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-4 min-w-[120px]">
              <StatusBadge approved={approved} />
              <div className="text-right">
                 <p className="text-[10px] font-black text-ink-mute uppercase tracking-[0.15em] mb-1">Risk Assessment</p>
                 <p className={cn("text-3xl font-black tabular-nums leading-none", scoreColor)}>{score}</p>
              </div>
            </div>
          </div>
          
          <button
            ref={firstFocusRef}
            onClick={onClose}
            className="absolute top-6 right-6 p-2.5 text-ink-mute hover:text-ink hover:bg-muted/50 rounded-full transition-all z-10"
            aria-label="Close dossier"
          >
            <X size={22} />
          </button>
        </div>

        {/* Dossier Body */}
        <div className="overflow-y-auto flex-1 p-8">
          
          <Section title="Applicant Profile" icon={<User size={14} />}>
            <Detail label="Current Age" value={data.age} icon={<Calendar size={14} />} />
            <Detail label="Employment" value={data.employment_type} icon={<Briefcase size={14} />} />
            <Detail label="Experience" value={data.years_of_experience != null ? `${data.years_of_experience} Years` : null} icon={<History size={14} />} />
            <Detail label="Monthly Income" value={data.monthly_income != null ? `₹${Number(data.monthly_income).toLocaleString('en-IN')}` : null} icon={<IndianRupee size={14} />} />
          </Section>

          <Section title="Financial Health" icon={<Activity size={14} />}>
            <Detail label="Credit Score" value={data.credit_score} icon={<CreditCard size={14} />} />
            <Detail label="Total Existing Loans" value={data.existing_loans_count} icon={<Activity size={14} />} />
            <Detail label="Ongoing EMIs" value={data.existing_emis != null ? `₹${Number(data.existing_emis).toLocaleString('en-IN')}` : null} icon={<IndianRupee size={14} />} />
          </Section>

          <Section title="Requested Terms" icon={<FileText size={14} />}>
            <Detail 
              label="Loan Product" 
              value={data.loan_type ? formatLoanType(data.loan_type) : null}
              icon={<ChevronRight size={14} />} 
            />
            <Detail label="Principal Amount" value={amount} icon={<IndianRupee size={14} />} />
            <Detail label="Requested Tenure" value={data.loan_tenure_months != null ? `${data.loan_tenure_months} Months` : null} icon={<Clock size={14} />} />
          </Section>

          <Section title="System Information" icon={<ShieldCheck size={14} />}>
             <Detail label="Submission Date" value={search.timestamp ? new Date(search.timestamp).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' }) : 'N/A'} icon={<Calendar size={14} />} />
             <Detail label="Network Identifier" value={search.metadata?.ip_address ?? 'Not captured'} icon={<Fingerprint size={14} />} />
          </Section>

          {/* Probability Bar */}
          <div className="mt-4 bg-muted/30 p-6 rounded-2xl border border-border/40">
             <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-ink uppercase tracking-widest">Confidence Score</span>
                <span className={cn("text-sm font-black", scoreColor)}>{score}</span>
             </div>
             <div className="h-2 w-full bg-border/20 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-1000", approved === true ? "bg-green-500" : approved === false ? "bg-red-500" : "bg-gold")}
                  style={{ width: prediction.approval_probability ? `${prediction.approval_probability}%` : '0%' }}
                />
             </div>
             <p className="text-[10px] text-ink-mute mt-3 italic leading-relaxed">
               This score represents the automated risk engine's confidence level based on historically approved credit profiles.
             </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-8 bg-muted/40 border-t border-border/40">
          {confirm ? (
            <div className="flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-3">
                 <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", confirm === 'approve' ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600")}>
                    <AlertCircle size={20} />
                 </div>
                 <p className="text-sm font-bold text-ink">
                   Confirm <span className="font-black uppercase tracking-wider">{confirm}</span>?
                 </p>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setConfirm(null)} disabled={actionLoading} className="px-6 h-11">
                  Go Back
                </Button>
                <Button
                  variant={confirm === 'approve' ? 'success' : 'danger'}
                  disabled={actionLoading}
                  onClick={() => { onAction(search.id ?? '', confirm); setConfirm(null); }}
                  className="px-8 h-11"
                >
                  {actionLoading ? 'Saving...' : `Proceed with ${confirm}`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
               <div className="hidden sm:block">
                 <p className="text-xs font-bold text-ink-mute">Manual review required for final processing.</p>
               </div>
               <div className="flex gap-3 w-full sm:w-auto">
                 <Button
                   variant="success"
                   disabled={approved === true || actionLoading}
                   onClick={() => setConfirm('approve')}
                   className="flex-1 sm:flex-none h-11 px-8 rounded-xl"
                 >
                   <ThumbsUp size={14} className="mr-2" />
                   Approved
                 </Button>
                 <Button
                   variant="danger"
                   disabled={approved === false || actionLoading}
                   onClick={() => setConfirm('reject')}
                   className="flex-1 sm:flex-none h-11 px-8 rounded-xl"
                 >
                   <ThumbsDown size={14} className="mr-2" />
                   Rejected
                 </Button>
               </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}