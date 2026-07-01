import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadsApi } from "../api";
import { queryKeys } from "./queryKeys";

export function useLeadList(query) {
  return useQuery({
    queryKey: queryKeys.leads.list(query),
    queryFn: () => leadsApi.list(query).then((res) => res.data),
    retry: false,
  });
}

export function useLeadDetail(leadId) {
  return useQuery({
    queryKey: leadId ? queryKeys.leads.detail(leadId) : ["leads", "detail", "empty"],
    queryFn: () => leadsApi.detail(leadId).then((res) => res.data),
    enabled: Boolean(leadId),
    retry: false,
  });
}

export function useLeadActivities(leadId) {
  return useQuery({
    queryKey: leadId ? queryKeys.leads.activities(leadId) : ["leads", "activities", "empty"],
    queryFn: () => leadsApi.activities(leadId).then((res) => res.data),
    enabled: Boolean(leadId) && !String(leadId).startsWith("local-"),
    retry: false,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => leadsApi.create(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, ...payload }) => leadsApi.update(leadId, payload).then((res) => res.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      if (variables?.leadId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.leadId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.leads.activities(variables.leadId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useAddLeadActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, ...payload }) => leadsApi.addActivity(leadId, payload).then((res) => res.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      if (variables?.leadId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.leadId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.leads.activities(variables.leadId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useConvertLeadToCustomer(leadId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => leadsApi.convertToCustomer(leadId, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers?.all || ["customers"] });
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
      }
    },
  });
}

export function useScoreLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leadId) => leadsApi.scoreLead(leadId).then((res) => res.data),
    onSuccess: (_data, leadId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useScheduleLeadFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, ...payload }) =>
      leadsApi.scheduleFollowUp(leadId, payload).then((res) => res.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.emailTasksAll });
      if (variables?.leadId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.leadId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useBulkScheduleLeadFollowUps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => leadsApi.bulkScheduleFollowUps(payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.emailTasksAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}

export function useEmailTaskList(query) {
  return useQuery({
    queryKey: queryKeys.leads.emailTasks(query),
    queryFn: () => leadsApi.emailTasks(query).then((res) => res.data),
    retry: false,
  });
}

export function useUpdateEmailTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, ...payload }) => leadsApi.updateEmailTask(taskId, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.emailTasksAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
}
