import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getArticle, getArticleWithHtml, getArticleSlugs, getAllArticles } from "@/lib/learn"
import { ArticleCard } from "@/components/learn/ArticleCard"
import { getBaseUrl } from "@/lib/site-config"

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }))
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    try {
      const { frontmatter } = getArticle(slug)
      const baseUrl = getBaseUrl()
      return {
        title: frontmatter.title,
        description: frontmatter.description,
        keywords: frontmatter.seoKeywords,
        alternates: { canonical: `${baseUrl}/learn/${frontmatter.slug}` },
        openGraph: {
          title: frontmatter.title,
          description: frontmatter.description,
          url: `${baseUrl}/learn/${frontmatter.slug}`,
          type: "article",
          publishedTime: frontmatter.date,
          tags: frontmatter.tags,
        },
        twitter: {
          card: "summary_large_image",
          title: frontmatter.title,
          description: frontmatter.description,
        },
      }
    } catch {
      return { title: "Not Found" }
    }
  })
}

export default async function LearnArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let article
  try {
    article = await getArticleWithHtml(slug)
  } catch {
    notFound()
  }

  if (article.frontmatter.status === "draft") {
    notFound()
  }

  const { frontmatter, html } = article
  const baseUrl = getBaseUrl()

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: frontmatter.title,
    description: frontmatter.description,
    datePublished: frontmatter.date,
    url: `${baseUrl}/learn/${frontmatter.slug}`,
    publisher: {
      "@type": "Organization",
      name: "Fast Protocol",
      url: baseUrl,
    },
    keywords: frontmatter.tags.join(", "),
  }

  // FAQ schema JSON-LD (for articles with FAQ frontmatter)
  const faqJsonLd = frontmatter.faq?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: frontmatter.faq.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }
    : null

  // Related articles: same category, excluding current
  const allArticles = getAllArticles()
  const related = allArticles
    .filter((a) => a.frontmatter.slug !== slug && a.frontmatter.category === frontmatter.category)
    .slice(0, 2)

  // If not enough from same category, fill from other categories
  if (related.length < 2) {
    const others = allArticles.filter(
      (a) =>
        a.frontmatter.slug !== slug &&
        !related.some((r) => r.frontmatter.slug === a.frontmatter.slug)
    )
    related.push(...others.slice(0, 2 - related.length))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-8">
          <Link
            href="/learn"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 mb-6"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 12l-4-4 4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to Learn
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 font-medium text-xs">
              {frontmatter.category}
            </span>
            <span>{frontmatter.readingTime}</span>
            <span>&middot;</span>
            <time dateTime={frontmatter.date}>
              {new Date(frontmatter.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{frontmatter.title}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{frontmatter.description}</p>
        </div>

        <div
          className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80 prose-li:text-muted-foreground prose-code:text-primary prose-code:bg-muted/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-hr:border-border/50 prose-table:border prose-table:border-border/40 prose-table:rounded-lg prose-table:overflow-hidden prose-thead:bg-muted/30 prose-thead:border-b prose-thead:border-border/40 prose-th:text-foreground prose-th:font-medium prose-th:px-4 prose-th:py-2.5 prose-td:px-4 prose-td:py-2.5 prose-td:text-muted-foreground prose-tr:border-b prose-tr:border-border/20 last:prose-tr:border-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* CTA */}
        <div className="my-12 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Try Fast Protocol
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-1">
              <path
                d="M6 12l4-4-4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>

        {/* FAQ section — rendered from frontmatter */}
        {frontmatter.faq && frontmatter.faq.length > 0 && (
          <section className="mt-12 border-t border-border/50 pt-8">
            <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
            <dl className="space-y-6">
              {frontmatter.faq.map((faq) => (
                <div key={faq.question}>
                  <dt className="font-semibold text-foreground text-lg">{faq.question}</dt>
                  <dd className="mt-2 text-muted-foreground">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </article>

      {related.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-xl font-bold mb-4">Keep reading</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((a) => (
              <ArticleCard key={a.frontmatter.slug} frontmatter={a.frontmatter} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
