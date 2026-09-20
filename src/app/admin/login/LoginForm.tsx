"use client";

import { useActionState } from "react";
import { login } from "../actions";
import styles from "../admin.module.css";

export default function LoginForm({ initialMessage }: { initialMessage: string }) {
  const [state, action, pending] = useActionState(login, { error: initialMessage });
  return <form action={action} className={styles.form} aria-busy={pending}>
    <div className="form-field">
      <label htmlFor="admin-email">Email</label>
      <input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending} aria-describedby={state.error ? "login-error" : undefined} />
    </div>
    <div className="form-field">
      <label htmlFor="admin-password">Password</label>
      <input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={4096} disabled={pending} aria-describedby={state.error ? "login-error" : undefined} />
    </div>
    {state.error && <p id="login-error" className={styles.error} role="alert">{state.error}</p>}
    <button type="submit" className="button" disabled={pending}>{pending ? "Signing in…" : "Login"}</button>
  </form>;
}
