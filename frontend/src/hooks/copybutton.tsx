import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
    text: string;
    /** Tooltip/aria-label shown before copying, e.g. "Copy email". Defaults to a generic label. */
    label?: string;
    /** Icon size in px. Defaults to 12 (the original CopyButton's size). */
    size?: number;
    /** Overrides the default button className entirely when provided. */
    className?: string;
}

export function CopyButton({ text, label = 'Copy to clipboard', size = 12, className }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    };

    return (
        <button
            onClick={copy}
            aria-label={copied ? 'Copied' : label}
            title={copied ? 'Copied!' : label}
            className={className ?? 'ml-1 text-ink-mute hover:text-gold transition-colors'}
        >
            {copied ? (
                <Check size={size} className="text-green-500 animate-in zoom-in duration-300" aria-hidden="true" />
            ) : (
                <Copy size={size} aria-hidden="true" />
            )}
        </button>
    );
}
