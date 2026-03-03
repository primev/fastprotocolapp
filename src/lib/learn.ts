import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import rehypeStringify from "rehype-stringify"
import rehypeSlug from "rehype-slug"
import rehypeAutolinkHeadings from "rehype-autolink-headings"

const CONTENT_DIR = path.join(process.cwd(), "content/learn")

export interface ArticleFrontmatter {
  title: string
  description: string
  slug: string
  category: string
  date: string
  tags: string[]
  readingTime: string
  seoKeywords: string[]
  status: "published" | "draft"
  faq?: { question: string; answer: string }[]
}

export interface Article {
  frontmatter: ArticleFrontmatter
  content: string
}

export interface ArticleWithHtml extends Article {
  html: string
}

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, { behavior: "wrap" })
  .use(rehypeStringify, { allowDangerousHtml: true })

function stripMdxComponents(content: string): string {
  // Remove JSX component tags (TryItCTA, FAQSchema, Callout, etc.)
  return content
    .replace(/<(TryItCTA|FAQSchema|Callout)[^>]*\/>/g, "")
    .replace(/<(TryItCTA|FAQSchema|Callout)[^>]*>[\s\S]*?<\/\1>/g, "")
}

export function getArticleSlugs(): string[] {
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""))
}

export function getArticle(slug: string): Article {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)
  const source = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(source)
  return { frontmatter: data as ArticleFrontmatter, content }
}

export async function getArticleWithHtml(slug: string): Promise<ArticleWithHtml> {
  const article = getArticle(slug)
  const cleaned = stripMdxComponents(article.content)
  const result = await processor.process(cleaned)
  return { ...article, html: String(result) }
}

export function getAllArticles(): Article[] {
  return getArticleSlugs()
    .map(getArticle)
    .filter((a) => a.frontmatter.status === "published")
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())
}

export function getArticlesByCategory(): Record<string, Article[]> {
  const articles = getAllArticles()
  const grouped: Record<string, Article[]> = {}
  for (const article of articles) {
    const cat = article.frontmatter.category
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(article)
  }
  return grouped
}
