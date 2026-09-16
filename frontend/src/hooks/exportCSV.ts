import type { SearchRecord } from './types';

/**
 * Export an array of SearchRecords to a CSV file and trigger a download.
 */
export function exportToCSV(records: SearchRecord[], filename: string = 'crednco_export') {
  if (!records.length) return;

  // Define columns
  const headers = [
    'Name',
    'Loan Type',
    'Loan Amount',
    'Monthly Income',
    'Credit Score',
    'Age',
    'Employment Type',
    'Experience (yrs)',
    'Existing EMIs',
    'Existing Loans',
    'Tenure (months)',
    'Status',
    'Approval Probability',
    'Sanctioned Amount',
    'Loan Grade',
    'Monthly EMI',
    'Submission Date',
    'User ID',
    'IP Address',
  ];

  const rows = records.map((r) => {
    const d = r.data ?? {};
    const p = r.metadata?.prediction ?? {};
    const approved = p.approved;
    const status = approved === true ? 'Approved' : approved === false ? 'Rejected' : 'Pending';

    return [
      String(d.name ?? ''),
      String(d.loan_type ?? ''),
      d.loan_amount_requested ?? '',
      d.monthly_income ?? '',
      d.credit_score ?? '',
      d.age ?? '',
      String(d.employment_type ?? ''),
      d.years_of_experience ?? '',
      d.existing_emis ?? '',
      d.existing_loans_count ?? '',
      d.loan_tenure_months ?? '',
      status,
      p.approval_probability != null ? `${Number(p.approval_probability).toFixed(1)}%` : '',
      p.sanctioned_amount ?? '',
      p.loan_grade ?? '',
      p.monthly_emi ?? '',
      r.timestamp ? new Date(r.timestamp).toLocaleString() : '',
      r.metadata?.uid ?? '',
      r.metadata?.ip_address ?? '',
    ];
  });

  // Build CSV string
  const escape = (val: unknown) => {
    let str = String(val ?? '');
    // Applicant-supplied text lands in a spreadsheet, so neutralise values a
    // spreadsheet would execute as a formula (=, +, -, @, tab, CR).
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    // Wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csv = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n');

  // Trigger download
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
