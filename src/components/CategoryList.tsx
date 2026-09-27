export default function CategoryList({ includeAll = false, categories }: { includeAll?: boolean; categories: string[] }) {
  return <ul className="publication-subjects" aria-label="Article subjects">
    {includeAll && <li className="subject-all">All articles</li>}
    {categories.map(category => <li key={category}>{category}</li>)}
  </ul>;
}
