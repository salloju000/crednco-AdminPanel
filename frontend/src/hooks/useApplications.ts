import { useAdminResource } from './useAdminResource';

export function useApplications(authToken: string | null, onUnauthorized?: () => void) {
  const {
    items: applications,
    loading,
    error,
    actionLoading,
    lastRefreshed,
    toasts,
    fetchItems: fetchApplications,
    handleAction,
  } = useAdminResource(authToken, onUnauthorized, {
    resourcePath: 'applications',
    logPrefix: '[useApplications]',
  });

  return {
    applications,
    loading,
    error,
    actionLoading,
    lastRefreshed,
    toasts,
    fetchApplications,
    handleAction,
  };
}
