import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { getCategories } from "@/lib/journal/queries";
import CategoryForm from "@/components/admin/CategoryForm";
import DeleteForm from "@/components/admin/DeleteForm";
import styles from "../../admin.module.css";
export const metadata: Metadata = { title: "Manage categories" };
export default async function CategoriesPage() {
  await requireAdmin(); const categories = await getCategories();
  return <section><p className="eyebrow category-label">Organise your articles</p><h1>Categories</h1><p className={styles.intro}>Create and rename subjects. Categories used by articles cannot be deleted.</p><div className={styles.categoryGrid}><section className={styles.categoryPanel}><h2>New category</h2><CategoryForm /></section>{categories.map(category => <section className={styles.categoryPanel} key={category.id}><h2>{category.name}</h2><CategoryForm category={category} /><DeleteForm kind="category" id={category.id} title={category.name} /></section>)}</div>{!categories.length && <p className={styles.intro}>No categories yet. Add your first subject above.</p>}</section>;
}
