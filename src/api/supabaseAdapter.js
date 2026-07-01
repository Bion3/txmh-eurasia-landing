import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export function canUseSupabase() {
  return Boolean(isSupabaseConfigured && supabase);
}

export function success(data, meta) {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

export function applyPagination(queryBuilder, query = {}) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || 20);
  const from = Math.max(page - 1, 0) * pageSize;
  const to = from + pageSize - 1;

  return queryBuilder.range(from, to);
}

export async function nextDocNo(prefix) {
  if (!canUseSupabase()) return null;

  const { data, error } = await supabase.rpc("app_next_doc_no", { prefix });

  if (error) return null;
  return data;
}

export async function currentUserId() {
  if (!canUseSupabase()) return null;

  const { data, error } = await supabase.auth.getUser();

  if (error) return null;
  return data?.user?.id || null;
}

export async function requireData(queryBuilder) {
  const { data, error, count } = await queryBuilder;

  if (error) {
    throw error;
  }

  return { data, count };
}
