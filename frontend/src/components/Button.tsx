import React from 'react';

type Variant = 'default' | 'primary' | 'success' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    children: React.ReactNode;
}

const STYLES: Record<Variant, string> = {
    default:
        'bg-background border border-border text-ink hover:bg-muted/30 hover:border-gold shadow-sm active:scale-95 transition-all',
    primary: 'bg-gold text-[#2a1500] hover:bg-gold/90 shadow-sm active:scale-95',
    success: 'bg-green-500 text-white hover:bg-green-600 shadow-sm active:scale-95',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm active:scale-95',
    ghost: 'text-ink-mute hover:text-ink hover:bg-muted/30',
};

export function Button({ children, variant = 'default', className = '', ...props }: ButtonProps) {
    return (
        <button
            className={[
                'inline-flex items-center justify-center gap-1.5',
                'px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg',
                'transition-all duration-150',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
                STYLES[variant],
                className,
            ].join(' ')}
            {...props}
        >
            {children}
        </button>
    );
}