export default function CategoryList({ includeAll = false, categories }: { includeAll?: boolean; categories: string[] }) {
  const items = includeAll ? ["All articles", ...categories] : categories;
  return <ul className="category-list" aria-label="Article categories (filtering coming soon)">{items.map(category => <li key={category}><button type="button" disabled aria-pressed={includeAll ? category === "All articles" : undefined} className={category === "All articles" ? "category-chip selected" : "category-chip"}>{category}</button></li>)}</ul>;
}
