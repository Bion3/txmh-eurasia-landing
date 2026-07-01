import { useState } from "react";

export default function AuthPanel({ auth }) {
  const [mode, setMode] = useState("sign-in");
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (mode === "sign-up") {
        await auth.signUp({ email, password });
      } else {
        await auth.signIn({ email, password });
      }
      setExpanded(false);
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!auth.isConfigured) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Supabase 未配置，当前为演示数据。
      </div>
    );
  }

  if (auth.user) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <div className="min-w-0">
          <div className="truncate font-semibold">{auth.user.email}</div>
          <div className="mt-1 grid gap-0.5 text-xs text-emerald-800">
            <div>生效角色：{auth.effectiveRole}</div>
            <div>申请角色：{auth.requestedRole}</div>
            <div>模块权限：{auth.modulePermissions}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={auth.signOut}
          className="shrink-0 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
        >
          退出
        </button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">未登录</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">登录后保存真实业务数据</div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="shrink-0 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          登录
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">未登录</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">登录后保存真实业务数据</div>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setError("");
          }}
          className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          关闭登录
        </button>
      </div>

      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
        <button
          type="button"
          aria-label="关闭登录弹层"
          onClick={() => {
            setExpanded(false);
            setError("");
          }}
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        />
        <form onSubmit={handleSubmit} className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-slate-900">{mode === "sign-up" ? "创建账号" : "登录系统"}</div>
              <div className="mt-1 text-sm text-slate-500">内部操作需要账号和角色权限</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setError("");
              }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              关闭
            </button>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">邮箱</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="operator@company.com"
                required
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="至少 6 位"
                required
              />
            </label>

            <button
              type="submit"
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "处理中..." : mode === "sign-up" ? "创建账号" : "登录"}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setError("");
                setMode((prev) => (prev === "sign-in" ? "sign-up" : "sign-in"));
              }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-950"
            >
              {mode === "sign-in" ? "新用户申请账号" : "已有账号，去登录"}
            </button>
            {mode === "sign-up" && (
              <span className="text-xs text-slate-500">最终角色由管理员分配</span>
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>
      </div>
    </>
  );
}
