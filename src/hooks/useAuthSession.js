import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

function readEffectiveRole(user) {
  return user?.app_metadata?.role || user?.app_metadata?.app_role || "pending";
}

function readRequestedRole(user) {
  return user?.user_metadata?.requested_role || "未申请";
}

function readModulePermissions(role) {
  const map = {
    admin: "全部模块",
    manager: "全部模块",
    finance: "财务/成本/订单",
    ops: "订单/成本",
    sales: "获客/客户/报价/订单",
    marketing: "获客/客户",
    pending: "只读或待审批",
  };

  return map[role] || "只读或待审批";
}

export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);

      if (nextSession?.access_token) {
        localStorage.setItem("access_token", nextSession.access_token);
      } else {
        localStorage.removeItem("access_token");
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const user = session?.user || null;
  const effectiveRole = useMemo(() => readEffectiveRole(user), [user]);
  const requestedRole = useMemo(() => readRequestedRole(user), [user]);
  const modulePermissions = useMemo(() => readModulePermissions(effectiveRole), [effectiveRole]);

  const signIn = async ({ email, password }) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async ({ email, password }) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          requested_role: "sales",
        },
      },
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem("access_token");
  };

  return {
    isConfigured: isSupabaseConfigured,
    loading,
    effectiveRole,
    modulePermissions,
    requestedRole,
    role: effectiveRole,
    session,
    signIn,
    signOut,
    signUp,
    user,
  };
}
