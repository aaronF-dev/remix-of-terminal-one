import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { Loader2, UserPlus } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { AuthShell } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — Terminal One" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
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
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err?.message ?? "Sign-up failed");
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

  return (
    <AuthShell title="Create account" subtitle="Provision your Terminal One workspace.">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Full name" type="text" value={name} onChange={setName} autoFocus />
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />
        {error && (
          <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-sm bg-amber px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Create account
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
        Already registered?{" "}
        <Link to="/login" className="text-amber hover:underline">
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
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
        required={type !== "text"}
        className="rounded-sm border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-amber"
      />
    </label>
  );
}
