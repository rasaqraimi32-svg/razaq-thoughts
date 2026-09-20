import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import { getDashboardCounts } from "@/lib/journal/queries";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export default async function DashboardPage() {
  const [admin, counts] = await Promise.all([
    requireAdmin(),
    getDashboardCounts(),
  ]);

  const labels = [
    "Total articles",
    "Published articles",
    "Draft articles",
    "Archived articles",
    "Total categories",
    "Pending comments",
  ];

  return (
    <main
      className={styles.dashboard}
      aria-labelledby="dashboard-title"
    >
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">Razaq Thoughts · Administration</p>
          <h1 id="dashboard-title">Admin Dashboard</h1>
        </div>

        <Link href="/admin/articles/new" className="button">
          New Article
        </Link>
      </div>

      <p className={styles.intro}>
        Welcome, {admin.displayName}. Your website at a glance.
      </p>

      <dl className={styles.stats}>
        {labels.map((label, index) => {
          const card = (
            <div>
              <dt>{label}</dt>
              <dd>{counts[index] ?? 0}</dd>
            </div>
          );

          if (label === "Pending comments") {
            return (
              <Link
                key={label}
                href="/admin/comments"
                style={{
                  display: "block",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                {card}
              </Link>
            );
          }

          return <div key={label}>{card}</div>;
        })}
      </dl>
    </main>
  );
}