/**
 * shared/backendRecords.ts
 *
 * Single source of truth for the shape of a normalized loan search/application
 * record as returned by the FastAPI backend's admin_logic.normalize_record()
 * (see backend/admin_logic.py) and consumed by /admin/searches,
 * /admin/applications, and /user/applications.
 *
 * Both the public frontend (src/) and the admin panel (admin-panel/) talk to
 * this same backend contract but are separate npm projects with no shared
 * package boundary between them — previously each maintained its own
 * hand-written copy of this shape (admin-panel/src/hooks/types.ts's
 * SearchRecord/Prediction), with nothing keeping them in sync if the backend
 * changed. This file is that shared contract; each project re-exports from it
 * via a relative import rather than redefining it.
 *
 * NOTE: normalize_record()'s "old nested format" branch returns a legacy
 * Firestore document shape as-is rather than the "new flat format" modeled
 * below — that branch only applies to documents written before the backend's
 * flat-record migration and is not represented here.
 */

export interface Prediction {
    approved?: boolean;
    approval_probability?: number;
    sanctioned_amount?: number;
    loan_grade?: string;
    monthly_emi?: number;
}

export interface SearchRecordData {
    name?: string;
    loan_type?: string;
    loan_amount_requested?: number;
    /** Legacy field name from pre-flat-record Firestore documents — normalize_record()'s "old nested format" branch returns these as-is. Prefer loan_amount_requested for current records. */
    loan_amount?: number;
    monthly_income?: number;
    credit_score?: number;
    age?: number;
    employment_type?: string;
    years_of_experience?: number;
    existing_emis?: number;
    existing_loans_count?: number;
    loan_tenure_months?: number;
    interest_rate?: number;
    [key: string]: unknown;
}

export interface SearchRecordMetadata {
    uid?: string;
    ip_address?: string;
    correlation_id?: string;
    prediction?: Prediction;
}

export interface SearchRecord {
    id?: string;
    timestamp?: string;
    data?: SearchRecordData;
    metadata?: SearchRecordMetadata;
}
