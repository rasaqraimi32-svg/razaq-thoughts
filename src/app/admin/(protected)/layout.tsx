import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import LogoutButton from "../LogoutButton";
import { logout } from "../actions";
import styles from "../admin.module.css";
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <div className={styles.dashboard}><nav className={styles.adminNav} aria-label="Administration"><Link href="/admin">Dashboard</Link><Link href="/admin/articles">Articles</Link><Link href="/admin/articles/new">New Article</Link><Link href="/admin/categories">Categories</Link><Link href="/admin/comments">Comments</Link><form action={logout}><LogoutButton /></form></nav>{children}</div>;
}
