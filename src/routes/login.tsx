import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Loader2, LogIn } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { AboutButton } from "@/components/about-dialog";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Terminal One" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err?.message ?? "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err?.message ?? "Google sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return <AuthShell title="Sign in" subtitle="Access the Terminal One intelligence layer.">
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field label="Email" type="email" value={email} onChange={setEmail} autoFocus />
      <Field label="Password" type="password" value={password} onChange={setPassword} />
      {error && <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{error}</div>}
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-sm bg-amber px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        Sign in
      </button>
      <button
        type="button"
        onClick={onGoogle}
        disabled={submitting}
        className="rounded-sm border border-border px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-accent disabled:opacity-50"
      >
        Continue with Google
      </button>
    </form>
    <div className="mt-5 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
      No account?{" "}
      <Link to="/signup" className="text-amber hover:underline">Create one</Link>
    </div>
  </AuthShell>;
}

function Field({ label, type, value, onChange, autoFocus }: { label: string; type: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        required
        className="rounded-sm border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-amber"
      />
    </label>
  );
}

function MarketChartIllustration() {
  return (
    <div className="w-full max-w-md rounded-sm border border-border bg-background/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Market pulse
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-amber">LIVE</div>
      </div>
      <svg viewBox="0 0 360 120" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="marketLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* grid */}
        {[0, 30, 60, 90, 120].map((y) => (
          <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="currentColor" strokeOpacity="0.08" className="text-foreground" />
        ))}
        {/* area fill */}
        <path d="M0 90 L40 85 L80 92 L120 70 L160 74 L200 55 L240 60 L280 40 L320 42 L360 25 L360 120 L0 120 Z" fill="url(#marketLine)" />
        {/* line */}
        <path d="M0 90 L40 85 L80 92 L120 70 L160 74 L200 55 L240 60 L280 40 L320 42 L360 25" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* candles */}
        {[32, 72, 112, 152, 192, 232, 272, 312].map((x, i) => {
          const open = [78, 70, 84, 66, 60, 52, 46, 38][i];
          const close = [82, 66, 80, 72, 56, 58, 44, 42][i];
          const high = Math.min(open, close) - 8;
          const low = Math.max(open, close) + 8;
          const bullish = close <= open;
          return (
            <g key={x}>
              <line x1={x} y1={high} x2={x} y2={low} stroke="currentColor" className="text-foreground" strokeOpacity="0.5" strokeWidth="1" />
              <rect x={x - 5} y={Math.min(open, close)} width="10" height={Math.max(2, Math.abs(open - close))} fill={bullish ? "var(--amber)" : "currentColor"} className={bullish ? "" : "text-foreground"} opacity={bullish ? 1 : 0.7} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background lg:flex-row">
      {/* Left brand panel — clean, no overlays */}
      <div className="hidden w-1/2 flex-col justify-between border-r border-border bg-card p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-sm bg-amber text-primary-foreground">
            <span className="text-lg font-black">T1</span>
          </div>
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.22em]">Terminal One</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Financial Intelligence OS</div>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-amber/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber">
              <span className="pulse-dot" /> Live · Real-time intel
            </div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              Decode the markets.<br />
              <span className="text-amber">In real time.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              A Bloomberg-grade terminal powered by a fleet of specialized AI agents — fundamentals, technicals, macro, risk, and beyond.
            </p>
          </div>

          <MarketChartIllustration />

          <div className="grid max-w-md grid-cols-3 gap-3">
            {[
              { k: "AGENTS", v: "8" },
              { k: "SOURCES", v: "16+" },
              { k: "REFRESH", v: "15s" },
            ].map((s) => (
              <div key={s.k} className="rounded-sm border border-border p-3">
                <div className="text-2xl font-bold text-amber">{s.v}</div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{s.k}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <div className="text-amber/80">Developed &amp; designed by Aaron Fernandes</div>
          <div className="flex items-center justify-between">
            <span>© Terminal One</span>
            <span>v2.0 · Phase II</span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 lg:invisible">
              <div className="flex size-9 items-center justify-center rounded-sm bg-amber text-primary-foreground">
                <span className="text-base font-black">T1</span>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em]">Terminal One</div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Financial Intelligence OS</div>
              </div>
            </div>
            <AboutButton />
          </div>
          <div className="rounded-sm border border-border bg-card p-6 sm:p-8">
            <div className="mb-1 inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-amber">
              <span className="size-1.5 rounded-full bg-amber" /> Secure access
            </div>
            <h1 className="text-2xl font-bold uppercase tracking-wider">{title}</h1>
            <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
            Secured by Firebase · Live market data
          </p>
          <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-amber/80 lg:hidden">
            Developed &amp; designed by Aaron Fernandes
          </p>
        </div>
      </div>
    </div>
  );
}
