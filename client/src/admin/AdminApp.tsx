import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import type { AdminMeDTO } from "@sd/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminApiError, ME_KEY, adminApi } from "./api";
import { DashboardPage } from "./DashboardPage";
import { RequirementsPage } from "./RequirementsPage";

export function AdminApp() {
  const me = useQuery({ queryKey: ME_KEY, queryFn: adminApi.me, staleTime: 60_000 });

  if (me.isLoading) return <Centered>Loading…</Centered>;
  if (me.isError) return <Centered>Couldn't reach the server. Please refresh.</Centered>;
  if (!me.data) return <LoginPage />;
  return <Shell admin={me.data} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center px-4 text-sm text-muted">{children}</div>;
}

const inputCls = "h-11 w-full rounded-input border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-primary sm:text-sm";

function LoginPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => adminApi.login(email, password),
    onSuccess: (admin) => qc.setQueryData(ME_KEY, admin),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };
  const error = login.error instanceof AdminApiError ? login.error.message : login.error ? "Couldn't reach the server." : null;

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-modal border border-line bg-surface p-5 shadow-panel sm:p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-button bg-primary text-white">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg">Admin sign in</h1>
            <p className="text-xs text-muted">Search Distributor back office</p>
          </div>
        </div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="email">
          Email
        </label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={cn(inputCls, "mb-4")} />
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="password">
          Password
        </label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-5 w-full" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/requirements", label: "Requirements", icon: ClipboardList, end: false },
];

function Shell({ admin }: { admin: AdminMeDTO }) {
  const qc = useQueryClient();
  const logout = useMutation({
    mutationFn: adminApi.logout,
    onSettled: () => {
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    },
  });

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-4 py-3 sm:px-5 sm:py-4">
          <span className="grid h-9 w-9 place-items-center rounded-button bg-primary text-white">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display text-base font-bold text-ink">Admin</span>
        </div>
        <nav aria-label="Admin" className="scrollbar-none relative flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:overflow-visible md:pb-0">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn("flex min-h-11 shrink-0 items-center gap-2.5 rounded-button px-3 text-sm font-medium transition-colors md:min-h-0 md:py-2", isActive ? "bg-primary-soft text-primary-dark" : "text-body hover:bg-slate-100")
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2 sm:justify-end sm:px-5 sm:py-3">
          <div className="min-w-0 truncate text-left text-sm leading-tight sm:text-right">
            <div className="font-medium text-ink">{admin.name}</div>
            <div className="text-xs text-muted">{admin.role === "SUPER_ADMIN" ? "Super admin" : "Moderator"}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </Button>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-8">
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="requirements" element={<RequirementsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
