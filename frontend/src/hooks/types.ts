// Prediction/SearchRecord describe the backend's normalize_record() output —
// see src/types/backendRecords.ts, duplicated from the app repo's copy of
// the same contract (both repos consume the same /admin & /user endpoints).
export type { Prediction, SearchRecord } from '../types/backendRecords';

export type Status = 'approved' | 'rejected' | 'pending';
export type SortKey = 'score' | 'amount' | 'name' | null;
export type SortDir = 'asc' | 'desc';

export function getStatus(approved?: boolean): Status {
    if (approved === true) return 'approved';
    if (approved === false) return 'rejected';
    return 'pending';
}