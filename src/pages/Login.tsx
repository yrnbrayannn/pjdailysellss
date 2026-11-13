import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/api";
import { Button, ErrorBox, Field, inputCls } from "../components/ui";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { if (data.session) navigate("/", { replace: true }); });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message);
    else navigate("/", { replace: true });
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center gap-6 px-6">
      <div className="text-center">
        <img src="/icons/shiftrecorder-192.png" alt="" className="mx-auto mb-4 h-20 w-20 rounded-2xl" />
        <h1 className="text-3xl font-extrabold text-brand">PJ's Stock &amp; Sales</h1>
        <p className="mt-1 text-muted">Sign in to start your shift</p>
      </div>
      <form onSubmit={submit} className="grid gap-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="text-center text-sm text-muted">No account? Ask the owner to create your login.</p>
    </main>
  );
}
