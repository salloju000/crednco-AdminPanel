import { Globe, Building2 } from 'lucide-react';
import { CopyButton } from '../hooks/copybutton';

interface AccountCardProps {
  email: string;
}

export function AccountCard({ email }: AccountCardProps) {
  // Parse email
  const [username, domain] = email.split('@');
  const displayUsername = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : 'User';
  const initial = displayUsername.charAt(0);

  // Common public email domains
  const publicDomains = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'icloud.com',
    'aol.com',
    'zoho.com',
    'protonmail.com',
    'yandex.com',
    'mail.com',
  ];

  const isCorporate = domain ? !publicDomains.includes(domain.toLowerCase()) : false;

  return (
    <div className="bg-card border border-border/60 hover:border-gold/40 p-4 rounded-2xl shadow-luxury hover:shadow-md transition-all duration-300 flex items-center justify-between gap-4 group">
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gold/10 text-gold flex items-center justify-center font-bold text-sm shrink-0 uppercase">
          {initial}
        </div>
        
        {/* User Info */}
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink truncate leading-tight mb-0.5">
            {displayUsername}
          </p>
          <p className="text-xs text-ink-mute truncate font-mono mb-1.5" title={email}>
            {email}
          </p>
          
          {/* Badge */}
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

      {/* Action Button */}
      <CopyButton
        text={email}
        label="Copy email to clipboard"
        size={16}
        className="p-2 hover:bg-muted/40 text-ink-mute hover:text-gold rounded-xl transition-all duration-200 shrink-0 relative"
      />
    </div>
  );
}
