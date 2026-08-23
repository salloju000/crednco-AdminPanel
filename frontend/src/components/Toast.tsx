import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { Toast } from '../hooks/useAdminResource';

export function ToastStack({ toasts }: { toasts: Toast[] }) {
    if (toasts.length === 0) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            aria-atomic="false"
            className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none"
        >
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={[
                        'flex items-center gap-3 px-5 py-4 rounded-[1.25rem] shadow-luxury border pointer-events-auto',
                        'animate-in slide-in-from-right-8 fade-in duration-300',
                        t.type === 'success'
                            ? 'bg-card text-ink border-green-500/20'
                            : 'bg-card text-ink border-destructive/20',
                    ].join(' ')}
                >
                    <div className={t.type === 'success' ? 'text-green-500' : 'text-destructive'}>
                        {t.type === 'success' ? (
                            <CheckCircle2 size={18} />
                        ) : (
                            <AlertCircle size={18} />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <p className="text-xs font-bold tracking-tight">{t.message}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}