import type { MutationState } from "@/lib/journal/types";
import styles from "@/app/admin/admin.module.css";
export default function FormFeedback({ state }: { state: MutationState }) {
  return <>{state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}{state.errors && <ul className={styles.error} role="alert">{Object.entries(state.errors).map(([field, error]) => <li key={field}>{error}</li>)}</ul>}</>;
}
