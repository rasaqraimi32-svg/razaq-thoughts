"use client";
import styles from "./admin.module.css";

export default function AdminError({ reset }: { reset: () => void }) {
  return <section className={styles.login}><h1>Unable to load this page.</h1><p className={styles.intro}>Please try again in a moment.</p><button className="button" onClick={reset}>Try again</button></section>;
}
