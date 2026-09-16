import { useAdminResource } from './useAdminResource';

export function useApplications(authToken: string | null, onUnauthorized?: () => void) {
  const {
    items: applications,
    loading,
    refreshing,
    error,
    actionLoading,
    lastRefreshed,
    toasts,
    fetchItems: fetchApplications,
    handleAction,
    handleBulkAction,
  } = useAdminResource(authToken, onUnauthorized, {
    resourcePath: 'applications',
    logPrefix: '[useApplications]',
  });

  return {
    applications,
    loading,
    refreshing,
    error,
    actionLoading,
    lastRefreshed,
    toasts,
    fetchApplications,
    handleAction,
    handleBulkAction,
  };
}
