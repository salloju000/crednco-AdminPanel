import { useAdminResource } from './useAdminResource';

export function useSearches(authToken: string | null, onUnauthorized?: () => void) {
  const {
    items: searches,
    loading,
    error,
    actionLoading,
    lastRefreshed,
    toasts,
    fetchItems: fetchSearches,
    handleAction,
  } = useAdminResource(authToken, onUnauthorized, {
    resourcePath: 'searches',
    logPrefix: '[useSearches]',
  });

  return {
    searches,
    loading,
    error,
    actionLoading,
    lastRefreshed,
    toasts,
    fetchSearches,
    handleAction,
  };
}
