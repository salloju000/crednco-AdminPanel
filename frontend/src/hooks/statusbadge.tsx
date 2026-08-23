import { getStatus } from './types';

const CFG = {
    approved: 'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400 dark:bg-green-400/10',
    rejected: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400 dark:bg-red-400/10',
    pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 dark:bg-amber-400/10',
};

export function StatusBadge({ approved }: { approved?: boolean }) {
    const status = getStatus(approved);
    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border uppercase ${CFG[status]}`}
        >
            {status}
        </span>
    );
}