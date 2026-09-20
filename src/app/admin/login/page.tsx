import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Administrator login" };
const messages: Record<string, string> = {
  "access-denied": "You do not have administrator access.",
  unavailable: "Unable to verify administrator access. Please try again shortly.",
  "logout-local": "Signed out on this device. The server could not confirm session revocation. Please try again when the connection is restored.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = typeof error === "string" && Object.hasOwn(messages, error) ? messages[error] : "";
  return <section className={styles.login} aria-labelledby="login-title">
    <p className="eyebrow">Razaq Thoughts · Administration</p>
    <h1 id="login-title">Welcome back.</h1>
    <p className={styles.intro}>Sign in to your administrator account.</p>
    <LoginForm initialMessage={message} />
    <Link href="/" className={styles.back}>← Back to Razaq Thoughts</Link>
  </section>;
}
