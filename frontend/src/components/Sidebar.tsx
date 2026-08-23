import { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  Users,
  LogOut, 
  Menu, 
  X,
  ShieldCheck
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import logo from '../assets/logo.png';
import name from '../assets/name1.png';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
    activeTab: 'dashboard' | 'applications' | 'analytics' | 'accounts';
    onTabChange: (tab: 'dashboard' | 'applications' | 'analytics' | 'accounts') => void;
    lastRefreshed: Date | null;
    onLogOut?: () => void;
    pendingCount?: number;
    newSinceLastVisit?: number;
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'applications', label: 'Applications', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'accounts', label: 'Accounts', icon: Users },
] as const;

export function Sidebar({ activeTab, onTabChange, lastRefreshed, onLogOut, pendingCount = 0, newSinceLastVisit = 0 }: Props) {
    const [isOpen, setIsOpen] = useState(false);

    const handleTabClick = (tab: 'dashboard' | 'applications' | 'analytics' | 'accounts') => {
        onTabChange(tab);
        setIsOpen(false);
    };

    // Get badge config for each tab
    const getBadge = (tabId: string) => {
      if (tabId === 'applications' && pendingCount > 0) {
        return { count: pendingCount, color: 'bg-amber-500' };
      }
      if (tabId === 'dashboard' && newSinceLastVisit > 0) {
        return { count: newSinceLastVisit, color: 'bg-green-500' };
      }
      return null;
    };

    return (
        <>
            {/* Mobile Header */}
            <header className="md:hidden w-full bg-[#0a2540] text-white p-4 flex items-center justify-between shadow-md z-20 sticky top-0 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <img src={logo} alt="Crednco logo" className="h-[1.5rem] w-auto" />
                    <img src={name} alt="Crednco" className="h-[1.2rem] w-auto brightness-125" />
                </div>
                <div className="flex items-center gap-2">
                  {/* Mobile pending badge */}
                  {pendingCount > 0 && (
                    <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[10px] font-bold">{pendingCount}</span>
                    </div>
                  )}
                  <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 -mr-2 outline-none text-white hover:text-gold transition-colors"
                    aria-label="Toggle menu"
                  >
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                  </button>
                </div>
            </header>

            {/* Mobile Overlay */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                  "fixed md:sticky top-0 left-0 h-[100dvh] w-64 bg-[#0a2540] text-white flex flex-col shadow-2xl z-40 transition-transform duration-300 ease-in-out md:translate-x-0 border-r border-white/5",
                  isOpen ? "translate-x-0" : "-translate-x-full"
                )}
                aria-label="Admin navigation"
            >
                <div className="p-8 border-b border-white/5 flex flex-col gap-3">
                    <a href="/" className="flex items-center gap-2.5 outline-none group">
                        <div className="bg-gold/10 p-2 rounded-xl group-hover:bg-gold/20 transition-colors">
                          <img src={logo} alt="Crednco logo" className="h-[1.75rem] w-auto" />
                        </div>
                        <div className="flex flex-col">
                          <img src={name} alt="Crednco" className="h-[1.4rem] w-auto object-contain brightness-125" />
                          <div className="flex items-center gap-1 mt-1">
                            <ShieldCheck size={10} className="text-gold" />
                            <span className="text-[9px] text-slate-400 uppercase tracking-[0.2em] font-bold">Admin Portal</span>
                          </div>
                        </div>
                    </a>
                </div>

                <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto" aria-label="Main navigation">
                    {TABS.map(({ id, label, icon: Icon }) => {
                        const badge = getBadge(id);
                        return (
                          <button
                              key={id}
                              onClick={() => handleTabClick(id)}
                              aria-current={activeTab === id ? 'page' : undefined}
                              className={cn(
                                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                                  activeTab === id
                                      ? "bg-gold/15 text-gold font-bold shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                                      : "text-slate-400 hover:text-white hover:bg-white/5"
                              )}
                          >
                              <Icon 
                                size={18} 
                                className={cn(
                                  "transition-transform group-hover:scale-110",
                                  activeTab === id ? "text-gold" : "text-slate-500 group-hover:text-slate-300"
                                )} 
                              />
                              <span className="text-sm tracking-wide flex-1 text-left">{label}</span>
                              
                              {/* Notification badge */}
                              {badge && (
                                <span className={cn(
                                  "min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-black text-white",
                                  badge.color,
                                  "animate-in zoom-in duration-300"
                                )}>
                                  {badge.count > 99 ? '99+' : badge.count}
                                </span>
                              )}

                              {activeTab === id && (
                                <div className="absolute left-0 w-1 h-6 bg-gold rounded-r-full shadow-[0_0_8px_rgba(200,155,60,0.5)]" />
                              )}
                          </button>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-white/5 bg-black/10">
                    {lastRefreshed && (
                        <div className="flex items-center gap-2 mb-4 px-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          <p className="text-[10px] text-slate-500 font-medium">
                              Live sync enabled
                          </p>
                        </div>
                    )}
                    <button
                        onClick={() => { onLogOut?.(); setIsOpen(false); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                    >
                        <LogOut size={16} />
                        Log Out
                    </button>
                </div>
            </aside>
        </>
    );
}
