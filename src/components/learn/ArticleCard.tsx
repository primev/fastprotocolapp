import Link from "next/link"
import type { ArticleFrontmatter } from "@/lib/learn"

export function ArticleCard({ frontmatter }: { frontmatter: ArticleFrontmatter }) {
  return (
    <Link
      href={`/learn/${frontmatter.slug}`}
      className="group block rounded-xl border border-border/50 bg-card/50 p-6 transition-all hover:border-primary/40 hover:bg-card/80"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 font-medium">
          {frontmatter.category}
        </span>
        <span>{frontmatter.readingTime}</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
        {frontmatter.title}
      </h3>
      <p className="text-sm text-muted-foreground line-clamp-2">{frontmatter.description}</p>
    </Link>
  )
}
