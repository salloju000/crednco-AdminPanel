import { useState, useMemo } from 'react';

const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'aol.com', 'zoho.com', 'protonmail.com', 'yandex.com', 'mail.com',
];

export interface EmailStats {
  gmail: number;
  publicOther: number;
  corporate: number;
  totalPublic: number;
}

/**
 * Owns the Accounts tab's search/filter state and the derived email-domain
 * breakdown + filtered email list computed from it.
 *
 * Extracted from App.tsx, which previously owned this alongside unrelated
 * auth/theme/tab-navigation state. Also hoists the public-email-domain list
 * (previously declared inline, identically, in two separate useMemo blocks)
 * into a single module-level constant.
 *
 * @param emails - the full registered-user email list (userStats.emails)
 */
export function useAccountsDirectory(emails: string[]) {
  const [accountEmailQuery, setAccountEmailQuery] = useState('');
  const [accountsFilter, setAccountsFilter] = useState<'all' | 'corporate' | 'public'>('all');

  const emailStats: EmailStats = useMemo(() => {
    let gmailCount = 0;
    let corporateCount = 0;
    let otherCount = 0;

    emails.forEach((email) => {
      const parts = email.split('@');
      if (parts.length < 2) return;
      const domain = parts[1].toLowerCase();
      if (domain === 'gmail.com') {
        gmailCount++;
      } else if (PUBLIC_EMAIL_DOMAINS.includes(domain)) {
        otherCount++;
      } else {
        corporateCount++;
      }
    });

    return {
      gmail: gmailCount,
      publicOther: otherCount,
      corporate: corporateCount,
      totalPublic: gmailCount + otherCount,
    };
  }, [emails]);

  const finalFilteredEmails = useMemo(() => {
    let list = emails;

    if (accountEmailQuery.trim()) {
      const query = accountEmailQuery.trim().toLowerCase();
      list = list.filter((email) => email.toLowerCase().includes(query));
    }

    if (accountsFilter === 'corporate') {
      list = list.filter((email) => {
        const parts = email.split('@');
        if (parts.length < 2) return false;
        return !PUBLIC_EMAIL_DOMAINS.includes(parts[1].toLowerCase());
      });
    } else if (accountsFilter === 'public') {
      list = list.filter((email) => {
        const parts = email.split('@');
        if (parts.length < 2) return false;
        return PUBLIC_EMAIL_DOMAINS.includes(parts[1].toLowerCase());
      });
    }

    return list;
  }, [accountEmailQuery, accountsFilter, emails]);

  return {
    accountEmailQuery,
    setAccountEmailQuery,
    accountsFilter,
    setAccountsFilter,
    emailStats,
    finalFilteredEmails,
  };
}
