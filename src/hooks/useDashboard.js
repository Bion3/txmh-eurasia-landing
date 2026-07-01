import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api";
import { queryKeys } from "./queryKeys";

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: () => dashboardApi.summary().then((res) => res.data),
    retry: false,
  });
}

export function useLeadSourceOverview(query) {
  return useQuery({
    queryKey: queryKeys.dashboard.leadSourceOverview(query),
    queryFn: () => dashboardApi.leadSourceOverview(query).then((res) => res.data),
    retry: false,
  });
}
