import type { SearchRecord, SortKey, SortDir } from '../hooks/types';
import { getStatus } from '../hooks/types';
import { memo, useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUp, 
  ArrowDown,
  User,
  IndianRupee,
  Activity,
  CheckSquare,
  Square,
  Minus,
  ThumbsUp,
  ThumbsDown,
  X,
  AlertCircle,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './Button';
import { StatusBadge } from '../hooks/statusbadge';
import { CopyButton } from '../hooks/copybutton';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  const widths = [80, 60, 45, 55, 40];
  return (
    <tr>
      {widths.map((w, i) => (
        <td key={`skel-${w}-${i}`} className="px-6 py-5">
          <div
            className="h-4 bg-muted/40 animate-pulse rounded-md"
            style={{ width: `${w}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ── Sortable header cell ───────────────────────────────────────────────────────
interface SortThProps {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  icon?: React.ReactNode;
}

function SortTh({ label, sortKey, activeSortKey, sortDir, onSort, icon }: SortThProps) {
  const isActive = activeSortKey === sortKey;
  const nextDir = isActive && sortDir === 'desc' ? 'ascending' : 'descending';
  return (
    <th
      className="px-6 py-4 text-[10px] font-black tracking-[0.1em] uppercase text-ink-mute whitespace-nowrap"
      aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        className="flex items-center gap-1.5 hover:text-ink transition-colors focus:outline-none group"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}, ${nextDir}`}
      >
        {icon}
        {label}
        <div className={cn("transition-opacity", isActive ? "opacity-100" : "opacity-0 group-hover:opacity-30")}>
          {isActive && sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
        </div>
      </button>
    </th>
  );
}

const PER_PAGE = 10;
type DateFilterType = 'all' | 'today' | '7d' | '30d';

/**
 * Page numbers to render, `null` marking an elided range. Rendering one button
 * per page overflowed the card (and hid the later pages entirely on phones)
 * once a filter matched more than a handful of pages.
 */
function getPageWindow(current: number, total: number): (number | null)[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  if (current > 1) pages.add(current - 1);
  if (current < total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

interface Props {
  searches: SearchRecord[];
  loading: boolean;
  error: string | null;
  actionLoading: boolean;
  onRetry: () => void;
  onSelect: (s: SearchRecord) => void;
  onBulkAction?: (ids: string[], action: 'approve' | 'reject') => void;
  /** Rows currently shown after search/filter/sort — lets the parent export exactly this view. */
  onVisibleRowsChange?: (rows: SearchRecord[]) => void;
}

export const ApplicationsTable = memo(function ApplicationsTable({
  searches,
  loading,
  error,
  actionLoading,
  onRetry,
  onSelect,
  onBulkAction,
  onVisibleRowsChange,
}: Props) {
  const [query, setQuery]               = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'rejected' | 'pending'>('all');
  const [dateFilter, setDateFilter]     = useState<DateFilterType>('all');
  const [sortBy, setSortBy]             = useState<SortKey>(null);
  const [sortDir, setSortDir]           = useState<SortDir>('desc');
  const [page, setPage]                 = useState(1);

  // ── Bulk selection state ─────────────────────────────────────
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm]   = useState<'approve' | 'reject' | null>(null);

  // A selection made under one filter must not silently act on records the admin
  // can no longer see, so changing search/filters starts a fresh selection.
  const clearSelectionState = () => {
    setSelectedIds(new Set());
    setBulkConfirm(null);
  };
  const changeQuery = (value: string) => { setQuery(value); setPage(1); clearSelectionState(); };
  const changeStatus = (value: 'all' | 'approved' | 'rejected' | 'pending') => { setStatusFilter(value); setPage(1); clearSelectionState(); };
  const changeDate = (value: DateFilterType) => { setDateFilter(value); setPage(1); clearSelectionState(); };
  const resetFilters = () => { setQuery(''); setStatusFilter('all'); setDateFilter('all'); setPage(1); clearSelectionState(); };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d: SortDir) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('desc'); }
    setPage(1);
  };

  const processed = useMemo(() => {
    let list = searches.filter((s) => {
      const name        = String(s.data?.name ?? '').toLowerCase();
      const matchSearch = name.includes(query.toLowerCase());
      const status      = getStatus(s.metadata?.prediction?.approved);
      const matchStatus = statusFilter === 'all' || status === statusFilter;
      
      // Date filtering — a record with no (or an unparseable) timestamp can't be
      // inside a date window, so it only shows under "All Time".
      let matchDate = true;
      if (dateFilter !== 'all') {
        const appDate = s.timestamp ? new Date(s.timestamp) : null;
        if (!appDate || Number.isNaN(appDate.getTime())) {
          matchDate = false;
        } else {
          const now = new Date();
          const diffDays = (now.getTime() - appDate.getTime()) / (1000 * 60 * 60 * 24);

          if (dateFilter === 'today') {
            matchDate = appDate.toDateString() === now.toDateString();
          } else if (dateFilter === '7d') {
            matchDate = diffDays <= 7;
          } else if (dateFilter === '30d') {
            matchDate = diffDays <= 30;
          }
        }
      }

      return matchSearch && matchStatus && matchDate;
    });

    if (sortBy) {
      list = [...list].sort((a, b) => {
        if (sortBy === 'name') {
          const an = String(a.data?.name ?? '');
          const bn = String(b.data?.name ?? '');
          return sortDir === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an);
        }
        let av = 0;
        let bv = 0;
        if (sortBy === 'score') {
          av = (a.metadata?.prediction?.approval_probability as number) ?? -1;
          bv = (b.metadata?.prediction?.approval_probability as number) ?? -1;
        } else if (sortBy === 'amount') {
          av = (a.data?.loan_amount_requested as number) ?? 0;
          bv = (b.data?.loan_amount_requested as number) ?? 0;
        }
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }

    return list;
  }, [searches, query, statusFilter, dateFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = processed.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const filtersActive = query !== '' || statusFilter !== 'all' || dateFilter !== 'all';

  useEffect(() => {
    onVisibleRowsChange?.(processed);
  }, [processed, onVisibleRowsChange]);

  // ── Bulk selection logic ─────────────────────────────────────
  const pageIds = useMemo(() => paginated.map((r) => r.id).filter(Boolean) as string[], [paginated]);

  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
        if (next.size === 0) setBulkConfirm(null);
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [pageIds, allPageSelected]);

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Dropping back to an empty selection must also disarm a pending
      // confirmation, or the next record selected is one click from being actioned.
      if (next.size === 0) setBulkConfirm(null);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkConfirm(null);
  }, []);

  const handleBulkAction = useCallback((action: 'approve' | 'reject') => {
    if (onBulkAction && selectedIds.size > 0) {
      onBulkAction(Array.from(selectedIds), action);
      clearSelection();
    }
  }, [onBulkAction, selectedIds, clearSelection]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-gold/5 border border-gold/20 rounded-2xl px-6 py-3 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center text-gold">
              <CheckSquare size={16} />
            </div>
            <span className="text-sm font-bold text-ink">
              <span className="text-gold">{selectedIds.size}</span> {selectedIds.size === 1 ? 'record' : 'records'} selected
            </span>
          </div>

          {bulkConfirm ? (
            <div className="flex items-center gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className={bulkConfirm === 'approve' ? 'text-green-500' : 'text-red-500'} />
                <span className="text-xs font-bold text-ink">
                  {bulkConfirm === 'approve' ? 'Approve' : 'Reject'} {selectedIds.size} {selectedIds.size === 1 ? 'record' : 'records'}?
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={() => setBulkConfirm(null)}
                disabled={actionLoading}
                className="h-8 px-3 text-xs rounded-lg"
              >
                Cancel
              </Button>
              <Button
                variant={bulkConfirm === 'approve' ? 'success' : 'danger'}
                onClick={() => handleBulkAction(bulkConfirm)}
                disabled={actionLoading}
                className="h-8 px-4 text-xs rounded-lg"
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="success"
                onClick={() => setBulkConfirm('approve')}
                disabled={actionLoading}
                className="h-8 px-4 text-xs rounded-lg"
              >
                <ThumbsUp size={12} className="mr-1.5" />
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={() => setBulkConfirm('reject')}
                disabled={actionLoading}
                className="h-8 px-4 text-xs rounded-lg"
              >
                <ThumbsDown size={12} className="mr-1.5" />
                Reject
              </Button>
              <button
                onClick={clearSelection}
                className="p-1.5 text-ink-mute hover:text-ink rounded-lg transition-all ml-1"
                aria-label="Clear selection"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute" size={16} />
            <input
              type="search"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/20 placeholder:text-ink-mute transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center bg-card border border-border rounded-2xl p-1 shadow-sm">
            {(['all', 'today', '7d', '30d'] as DateFilterType[]).map((t) => (
              <button
                key={t}
                onClick={() => changeDate(t)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all",
                  dateFilter === t 
                    ? "bg-gold text-white shadow-md shadow-gold/20" 
                    : "text-ink-mute hover:text-ink"
                )}
              >
                {t === 'all' ? 'All Time' : t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2 shadow-sm w-full lg:w-auto">
            <Filter size={14} className="text-ink-mute" />
            <select
              value={statusFilter}
              onChange={(e) => changeStatus(e.target.value as 'all' | 'approved' | 'rejected' | 'pending')}
              className="bg-transparent text-sm font-semibold outline-none text-ink min-w-[120px]"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
               <Activity size={20} />
             </div>
             <div>
               <p className="font-bold text-red-700 dark:text-red-400 text-sm">Failed to sync data</p>
               <p className="text-red-500/80 text-xs mt-0.5">{error}</p>
             </div>
          </div>
          <Button variant="danger" onClick={onRetry}>Retry Sync</Button>
        </div>
      )}

      {/* Table card */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-luxury">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                {/* Checkbox header */}
                {onBulkAction && (
                  <th className="px-4 py-4 w-12">
                    <button
                      onClick={toggleSelectAll}
                      role="checkbox"
                      aria-checked={allPageSelected ? 'true' : somePageSelected ? 'mixed' : 'false'}
                      className="flex items-center justify-center w-5 h-5 text-ink-mute hover:text-gold transition-colors"
                      aria-label={allPageSelected ? 'Deselect all rows on this page' : 'Select all rows on this page'}
                    >
                      {allPageSelected ? (
                        <CheckSquare size={16} className="text-gold" />
                      ) : somePageSelected ? (
                        <Minus size={16} className="text-gold" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                )}
                <SortTh 
                  label="Applicant" 
                  sortKey="name" 
                  activeSortKey={sortBy} 
                  sortDir={sortDir} 
                  onSort={toggleSort}
                  icon={<User size={12} />}
                />
                <SortTh 
                  label="Loan Requested" 
                  sortKey="amount" 
                  activeSortKey={sortBy} 
                  sortDir={sortDir} 
                  onSort={toggleSort}
                  icon={<IndianRupee size={12} />}
                />
                <SortTh 
                  label="Risk Score" 
                  sortKey="score" 
                  activeSortKey={sortBy} 
                  sortDir={sortDir} 
                  onSort={toggleSort}
                  icon={<Activity size={12} />}
                />
                <th className="px-6 py-4 text-[10px] font-black tracking-widest uppercase text-ink-mute">Status</th>
                <th className="px-6 py-4 text-[10px] font-black tracking-widest uppercase text-ink-mute text-right pr-10">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : processed.length === 0 ? (
                <tr>
                  <td colSpan={onBulkAction ? 6 : 5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-muted p-4 rounded-full text-ink-mute">
                        <Search size={32} strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="font-bold text-ink text-base">
                          {filtersActive ? 'No record found' : 'No applications yet'}
                        </p>
                        <p className="text-sm text-ink-mute mt-1 max-w-[240px] mx-auto leading-relaxed">
                          {filtersActive
                            ? "We couldn't find any applications matching your current filter criteria."
                            : 'Submitted loan applications will appear here.'}
                        </p>
                      </div>
                      {filtersActive && (
                        <button
                          onClick={resetFilters}
                          className="mt-2 text-xs font-bold text-gold hover:underline underline-offset-4 uppercase tracking-widest"
                        >
                          Reset All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((search, idx) => {
                  const data = search.data ?? {};
                  const prediction = search.metadata?.prediction ?? {};
                  const approved = prediction.approved;
                  const score = prediction.approval_probability != null 
                    ? `${Number(prediction.approval_probability).toFixed(1)}%` 
                    : 'N/A';
                  const amount = data.loan_amount_requested 
                    ? `₹${Number(data.loan_amount_requested).toLocaleString('en-IN')}` 
                    : 'N/A';
                  const displayName = String(data.name ?? 'Anonymous');
                  const isSelected = search.id ? selectedIds.has(search.id) : false;
                  
                  let scoreColor = 'text-ink-mid';
                  if (approved === true) scoreColor = 'text-green-500';
                  else if (approved === false) scoreColor = 'text-red-500';

                  return (
                    <tr
                      key={search.id ?? idx}
                      className={cn(
                        "group hover:bg-muted/20 transition-all cursor-pointer border-l-4 border-transparent hover:border-gold",
                        isSelected && "bg-gold/5 border-l-gold/50"
                      )}
                    >
                      {/* Checkbox cell */}
                      {onBulkAction && (
                        <td className="px-4 py-5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (search.id) toggleSelectOne(search.id);
                            }}
                            role="checkbox"
                            aria-checked={isSelected}
                            className="flex items-center justify-center w-5 h-5 text-ink-mute hover:text-gold transition-colors"
                            aria-label={`${isSelected ? 'Deselect' : 'Select'} ${displayName}`}
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-gold" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-6 py-5" onClick={() => !actionLoading && onSelect(search)}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gold/5 flex items-center justify-center border border-gold/10 text-gold font-bold text-sm">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-ink leading-tight">{displayName}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                               <CopyButton text={String(search.metadata?.uid ?? 'GUEST')} />
                               <span className="text-[10px] font-bold text-ink-mute uppercase tracking-widest">
                                 {String(search.metadata?.uid ?? 'Guest').slice(0, 8)}...
                               </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5" onClick={() => !actionLoading && onSelect(search)}>
                        <p className="font-bold text-ink-mid text-sm">{amount}</p>
                        {search.timestamp && (
                          <p className="text-[10px] text-ink-mute mt-1 font-medium italic">
                            Applied {new Date(search.timestamp).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-5" onClick={() => !actionLoading && onSelect(search)}>
                        <div className="flex flex-col gap-1.5">
                          <span className={cn("text-sm font-bold", scoreColor)}>
                            {score}
                          </span>
                          <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full transition-all duration-1000", approved === true ? "bg-green-500" : approved === false ? "bg-red-500" : "bg-gold")}
                              style={{ width: prediction.approval_probability ? `${prediction.approval_probability}%` : '0%' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5" onClick={() => !actionLoading && onSelect(search)}>
                        <StatusBadge approved={approved} />
                      </td>
                      <td className="px-6 py-5 text-right pr-6" onClick={() => !actionLoading && onSelect(search)}>
                        <button 
                          className="p-2 rounded-xl text-ink-mute hover:text-gold hover:bg-gold/10 transition-all group-hover:scale-110"
                          aria-label="View Details"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && processed.length > PER_PAGE && (
          <div className="flex items-center justify-between px-8 py-5 border-t border-border bg-muted/10">
            <p className="text-[11px] font-bold text-ink-mute uppercase tracking-widest">
              Showing <span className="text-ink">{paginated.length}</span> of <span className="text-ink">{processed.length}</span> Results
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="default"
                disabled={safePage <= 1}
                onClick={(e) => { e.stopPropagation(); setPage(safePage - 1); }}
                className="h-9 px-3 rounded-xl border border-border shadow-sm"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </Button>
              {getPageWindow(safePage, totalPages).map((p, i) =>
                p === null ? (
                  <span key={`gap-${i}`} className="w-5 text-center text-xs font-bold text-ink-mute">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    aria-label={`Page ${p}`}
                    aria-current={safePage === p ? 'page' : undefined}
                    className={cn(
                      "w-9 h-9 rounded-xl text-xs font-bold transition-all",
                      safePage === p
                        ? "bg-gold text-white shadow-md shadow-gold/20"
                        : "text-ink-mute hover:text-ink hover:bg-muted/50"
                    )}
                  >
                    {p}
                  </button>
                )
              )}
              <Button
                variant="default"
                disabled={safePage >= totalPages}
                onClick={(e) => { e.stopPropagation(); setPage(safePage + 1); }}
                className="h-9 px-3 rounded-xl border border-border shadow-sm"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});