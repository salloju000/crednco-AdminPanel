import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth.ts';
import { useTheme } from '../hooks/useTheme.ts';
import { useAccountsDirectory } from '../hooks/useAccountsDirectory.ts';
import { 
  Sun, 
  Moon, 
  RefreshCw, 
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Download
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSearches } from '../hooks/useSearches.ts';
import { useApplications } from '../hooks/useApplications.ts';
import { useUserStats } from '../hooks/useUserStats.ts';
import { exportToCSV } from '../hooks/exportCSV.ts';
import type { SearchRecord } from '../hooks/types.ts';
import { Sidebar } from '../components/Sidebar.tsx';
import { ApplicationsTable } from '../components/ApplicationsTable.tsx';
import { ApplicationModal } from '../components/ApplicationModal.tsx';
import { DashboardCharts } from '../components/DashboardCharts.tsx';
import { ActivityFeed } from '../components/ActivityFeed.tsx';
import { UserDetailPanel } from '../components/UserDetailPanel.tsx';
import { Button } from '../components/Button.tsx';
import { ToastStack } from '../components/Toast.tsx';
import { LoginScreen } from '../components/LoginScreen.tsx';
import { AccountCard } from '../components/AccountCard.tsx';
import { DateRangeAnalytics } from '../components/DateRangeAnalytics.tsx';
import { RiskScoreAnalytics } from '../components/RiskScoreAnalytics.tsx';
import { ConversionFunnel } from '../components/ConversionFunnel.tsx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const { authToken, setAuthToken, handleLogOut } = useAdminAuth();
  const { isDark, setIsDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'applications' | 'analytics' | 'accounts'>('dashboard');
  const [selected, setSelected] = useState<SearchRecord | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'funnel' | 'risk' | 'period' | 'checks'>('funnel');

  const {
    searches,
    loading: searchLoading,
    error: searchError,
    toasts: searchToasts,
    fetchSearches,
    handleAction: handleSearchAction,
  } = useSearches(authToken, handleLogOut);

  const {
    applications,
    loading,
    error,
    actionLoading,
    lastRefreshed,
    toasts: applicationToasts,
    fetchApplications,
    handleAction: handleApplicationAction,
  } = useApplications(authToken, handleLogOut);

  const {
    userStats,
    loading: userStatsLoading,
    error: userStatsError,
    fetchUserStats,
  } = useUserStats(authToken, handleLogOut);

  const {
    accountEmailQuery,
    setAccountEmailQuery,
    accountsFilter,
    setAccountsFilter,
    emailStats,
    finalFilteredEmails,
  } = useAccountsDirectory(userStats.emails);

  useEffect(() => {
    if (activeTab === 'accounts' || activeTab === 'analytics') {
      fetchUserStats();
    }
  }, [activeTab, fetchUserStats]);

  const approvedCount = applications.filter((s) => s.metadata?.prediction?.approved === true).length;
  const rejectedCount = applications.filter((s) => s.metadata?.prediction?.approved === false).length;
  const pendingCount = applications.length - approvedCount - rejectedCount;

  // Track "new since last visit" using localStorage
  const newSinceLastVisit = useMemo(() => {
    const lastKnown = parseInt(localStorage.getItem('crednco_last_app_count') ?? '0', 10);
    const current = applications.length;
    if (current > lastKnown && lastKnown > 0) return current - lastKnown;
    return 0;
  }, [applications.length]);

  // Update last known count when visiting applications tab
  useEffect(() => {
    if (activeTab === 'applications' && applications.length > 0) {
      localStorage.setItem('crednco_last_app_count', String(applications.length));
    }
  }, [activeTab, applications.length]);

  const onAction = (id: string, action: 'approve' | 'reject') => {
    const handler = activeTab === 'analytics' ? handleSearchAction : handleApplicationAction;
    handler(id, action, (fresh) => {
      setSelected((prev) => (prev ? (fresh.find((s) => s.id === prev.id) ?? null) : null));
    });
  };

  // Bulk action handler for ApplicationsTable
  const onBulkAction = useCallback((ids: string[], action: 'approve' | 'reject') => {
    ids.forEach((id) => {
      handleApplicationAction(id, action, () => {});
    });
  }, [handleApplicationAction]);

  if (!authToken) {
    return <LoginScreen onLoginSuccess={setAuthToken} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans text-foreground transition-colors duration-300">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lastRefreshed={lastRefreshed}
        onLogOut={handleLogOut}
        pendingCount={pendingCount}
        newSinceLastVisit={newSinceLastVisit}
      />

      <main className="flex-1 p-4 sm:p-6 md:p-10 w-full max-w-[1600px] mx-auto overflow-x-hidden" id="main-content">
        
        {/* Top Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
           <div className="space-y-1">
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">Administrator Console</span>
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
             </div>
             <h2 className="text-4xl font-black font-serif text-ink tracking-tight">
               {activeTab === 'dashboard' ? 'Executive Overview' : 
                activeTab === 'applications' ? 'Loan Repository' : 
                activeTab === 'analytics' ? 'Market Intelligence' :
                'Registered Accounts'}
             </h2>
           </div>

           <div className="flex items-center gap-3">
             <button
               onClick={() => setIsDark(!isDark)}
               className="p-3 bg-card border border-border rounded-2xl text-ink-mute hover:text-gold hover:border-gold transition-all shadow-luxury group"
               aria-label="Toggle Theme"
             >
               {isDark ? <Sun size={20} className="group-hover:rotate-45 transition-transform" /> : <Moon size={20} className="group-hover:-rotate-12 transition-transform" />}
             </button>
             
             {(activeTab === 'applications' || activeTab === 'analytics') && (
               <Button
                 variant="default"
                 onClick={() => {
                   const data = activeTab === 'analytics' ? searches : applications;
                   const name = activeTab === 'analytics' ? 'crednco_searches' : 'crednco_applications';
                   exportToCSV(data, name);
                 }}
                 disabled={(activeTab === 'analytics' ? searches : applications).length === 0}
                 className="h-12 px-5 rounded-2xl shadow-luxury group"
               >
                 <Download size={16} className="mr-2" />
                 Export CSV
               </Button>
             )}
             
             <Button 
               variant="default" 
               onClick={() => {
                 if (activeTab === 'analytics') {
                   fetchSearches();
                 } else if (activeTab === 'applications') {
                   fetchApplications();
                 } else if (activeTab === 'accounts') {
                   fetchUserStats();
                 } else {
                   fetchApplications();
                   fetchSearches();
                   fetchUserStats();
                 }
               }}
               disabled={loading || searchLoading || userStatsLoading}
               className="h-12 px-6 rounded-2xl shadow-luxury group"
             >
               <RefreshCw size={16} className={cn("mr-2", (loading || searchLoading) && "animate-spin")} />
               Sync Data
             </Button>
           </div>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Volume', value: applications.length, color: 'text-ink', icon: Users },
                { label: 'Pending Review', value: pendingCount, color: 'text-amber-500', icon: Clock },
                { label: 'Total Approved', value: approvedCount, color: 'text-green-500', icon: CheckCircle2 },
                { label: 'Rejected', value: rejectedCount, color: 'text-red-500', icon: XCircle },
              ].map(({ label, value, color, icon: Icon }) => (
                <div
                  key={label}
                  className="bg-card p-6 rounded-3xl border border-border shadow-luxury relative overflow-hidden group hover:border-gold/50 transition-all"
                >
                  <div className={cn("absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity", color)}>
                    <Icon size={48} />
                  </div>
                  <p className="text-[10px] font-black tracking-[0.15em] uppercase text-ink-mute mb-2">
                    {label}
                  </p>
                  <p className={cn("text-4xl font-black tracking-tight", color)}>
                    {loading ? '—' : value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 mb-8">
              <div className="bg-muted/30 rounded-3xl border border-border/40 p-6 flex flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-ink flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    System Status: Operational
                  </h4>
                  <p className="text-xs text-ink-mute">
                    Last synchronized {lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'waiting for sync...'}.
                  </p>
                </div>
                <div className="flex items-center gap-4 p-3 bg-card rounded-2xl border border-border shadow-sm">
                  <TrendingUp size={18} className="text-green-500" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-ink-mute">Sync Pace</span>
                    <span className="text-sm font-black text-ink">30s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="mb-8">
              <DashboardCharts
                applications={applications}
                searches={searches}
                loading={loading || searchLoading}
              />
            </div>

            {/* Activity Feed */}
            <div className="mb-8">
              <ActivityFeed
                applications={applications}
                loading={loading}
                onSelect={setSelected}
              />
            </div>
          </div>
        ) : activeTab === 'accounts' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
            {/* Overview Stats */}
            <div className="bg-card rounded-3xl border border-border p-8 shadow-luxury">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gold">Domain Insights</span>
                  <h3 className="text-2xl font-black text-ink mt-1">Account Overview</h3>
                </div>
                <div className="rounded-2xl bg-gold/10 p-3 text-gold">
                  <Users size={24} />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-muted/20 p-5 border border-border/40">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-ink-mute mb-1">Total Profiles</p>
                  <p className="text-3xl font-black text-ink">
                    {userStatsLoading ? '—' : userStats.total_users.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/20 p-5 border border-border/40">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-ink-mute mb-1">Corporate Domains</p>
                  <p className="text-3xl font-black text-gold">
                    {userStatsLoading ? '—' : emailStats.corporate.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/20 p-5 border border-border/40">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-ink-mute mb-1">Public Domains</p>
                  <p className="text-3xl font-black text-ink">
                    {userStatsLoading ? '—' : emailStats.totalPublic.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/20 p-5 border border-border/40">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-ink-mute mb-1">Repeated Profiles</p>
                  <p className="text-3xl font-black text-ink">
                    {userStatsLoading ? '—' : userStats.repeated_users.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Email Directory */}
            <div className="bg-card rounded-3xl border border-border p-8 shadow-luxury">
              {/* Directory Filter & Search Header */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-border/40 pb-6 mb-6">
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <h3 className="text-2xl font-black text-ink">Email Directory</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-ink-mute">
                      Total Registered: {userStats.emails.length}
                    </span>
                    <div className="w-1 h-1 rounded-full bg-border" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
                      Showing: {finalFilteredEmails.length}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  {/* Category Filter Tabs */}
                  <div className="flex bg-muted/30 border border-border/50 rounded-xl p-1 shrink-0 w-full sm:w-auto">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'corporate', label: 'Corporate' },
                      { id: 'public', label: 'Public' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setAccountsFilter(tab.id as any)}
                        className={cn(
                          "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all w-full sm:w-auto",
                          accountsFilter === tab.id
                            ? "bg-card text-gold shadow-sm border border-border/30"
                            : "text-ink-mute hover:text-ink"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Field */}
                  <label className="relative w-full sm:w-64">
                    <span className="sr-only">Search emails</span>
                    <input
                      value={accountEmailQuery}
                      onChange={(event) => setAccountEmailQuery(event.target.value)}
                      placeholder="Search email..."
                      className="w-full rounded-xl border border-border/60 bg-surface px-4 py-2 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                    />
                  </label>
                </div>
              </div>

              {/* Error messages if any */}
              {userStatsError && (
                <div className="p-4 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500">
                  {userStatsError}
                </div>
              )}

              {/* Directory Content */}
              {userStatsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {['pulse-1', 'pulse-2', 'pulse-3', 'pulse-4', 'pulse-5', 'pulse-6'].map((item) => (
                    <div key={item} className="h-[90px] rounded-2xl bg-muted/20 animate-pulse border border-border/20" />
                  ))}
                </div>
              ) : finalFilteredEmails.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[560px] overflow-y-auto p-1">
                  {finalFilteredEmails.map((email) => (
                    <div key={email} onClick={() => setSelectedEmail(email)} className="cursor-pointer">
                      <AccountCard email={email} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-ink-mute">No email addresses found matching the selected filters.</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'applications' ? (
          <div className="animate-in fade-in duration-500">
            <ApplicationsTable
              searches={applications}
              loading={loading}
              error={error}
              actionLoading={actionLoading}
              onRetry={fetchApplications}
              onSelect={setSelected}
              onBulkAction={onBulkAction}
            />
          </div>
        ) : (
          <div className="animate-in fade-in duration-500 space-y-8">
            {/* Header + Sub-navigation */}
            <div className="bg-card dark:bg-muted/5 rounded-[2.5rem] border border-border p-8 shadow-luxury">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-gold">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-ink leading-tight">Market Intelligence</h3>
                    <p className="text-xs text-ink-mute mt-1">Conversion metrics, risk analysis and eligibility trends</p>
                  </div>
                </div>
                
                {/* Analytics Sub Tabs */}
                <div className="flex bg-muted/30 border border-border/50 rounded-2xl p-1.5 shrink-0 w-full md:w-auto overflow-x-auto">
                  {[
                    { id: 'funnel', label: 'Conversion Funnel' },
                    { id: 'risk', label: 'Risk Intelligence' },
                    { id: 'period', label: 'Period Trends' },
                    { id: 'checks', label: 'Eligibility Log' },
                  ].map((subTab) => (
                    <button
                      key={subTab.id}
                      onClick={() => setAnalyticsSubTab(subTab.id as any)}
                      className={cn(
                        "px-5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap",
                        analyticsSubTab === subTab.id
                          ? "bg-gold text-white shadow-md shadow-gold/25"
                          : "text-ink-mute hover:text-ink"
                      )}
                    >
                      {subTab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sub-tab contents */}
            {analyticsSubTab === 'funnel' && (
              <div className="animate-in fade-in duration-500">
                <ConversionFunnel
                  applications={applications}
                  searches={searches}
                  totalUsers={userStats.total_users}
                  loading={loading || searchLoading || userStatsLoading}
                />
              </div>
            )}

            {analyticsSubTab === 'risk' && (
              <div className="animate-in fade-in duration-500">
                <RiskScoreAnalytics
                  applications={applications}
                  loading={loading}
                />
              </div>
            )}

            {analyticsSubTab === 'period' && (
              <div className="animate-in fade-in duration-500">
                <DateRangeAnalytics
                  applications={applications}
                  searches={searches}
                  loading={loading || searchLoading}
                />
              </div>
            )}

            {analyticsSubTab === 'checks' && (
              <div className="animate-in fade-in duration-500">
                <ApplicationsTable
                  searches={searches}
                  loading={searchLoading}
                  error={searchError}
                  actionLoading={actionLoading}
                  onRetry={fetchSearches}
                  onSelect={setSelected}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {selected && (
        <ApplicationModal
          search={selected}
          onClose={() => setSelected(null)}
          onAction={onAction}
          actionLoading={actionLoading}
        />
      )}

      {selectedEmail && (
        <UserDetailPanel
          email={selectedEmail}
          applications={applications}
          onClose={() => setSelectedEmail(null)}
          onNavigateToApplications={() => {
            setActiveTab('applications');
          }}
          onNavigateToAnalytics={() => {
            setActiveTab('analytics');
          }}
          onSelectApplication={(record) => {
            setSelectedEmail(null);
            setSelected(record);
          }}
        />
      )}

      <ToastStack toasts={[...applicationToasts, ...searchToasts]} />
    </div>
  );
}