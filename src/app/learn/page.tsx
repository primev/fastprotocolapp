import type { Metadata } from "next"
import { getArticlesByCategory } from "@/lib/learn"
import { ArticleCard } from "@/components/learn/ArticleCard"
import { getBaseUrl } from "@/lib/site-config"

export const metadata: Metadata = {
  title: "Learn — Fast Protocol",
  description:
    "Learn about preconfirmations, mev rewards, fast swaps, and how Fast Protocol delivers sub-second Ethereum transactions.",
  alternates: { canonical: `${getBaseUrl()}/learn` },
  openGraph: {
    title: "Learn — Fast Protocol",
    description:
      "Learn about preconfirmations, mev rewards, fast swaps, and how Fast Protocol delivers sub-second Ethereum transactions.",
    url: `${getBaseUrl()}/learn`,
    type: "website",
  },
}

const CATEGORY_ORDER = ["Fast Protocol", "Preconfirmations", "mev"]

export default function LearnIndexPage() {
  const grouped = getArticlesByCategory()
  const allArticles = Object.values(grouped).flat()

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Learn — Fast Protocol",
    description:
      "Learn about preconfirmations, mev rewards, fast swaps, and how Fast Protocol delivers sub-second Ethereum transactions.",
    url: `${getBaseUrl()}/learn`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: allArticles.map((article, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${getBaseUrl()}/learn/${article.frontmatter.slug}`,
        name: article.frontmatter.title,
      })),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      <section className="py-8 sm:py-12 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Learn Fast Protocol
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Preconfirmations, mev rewards, and sub-second swaps — everything you need to understand
            the fastest way to transact on Ethereum.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 space-y-16">
        {CATEGORY_ORDER.map((category) => {
          const articles = grouped[category]
          if (!articles?.length) return null
          return (
            <div key={category}>
              <h2 className="text-2xl font-bold mb-6">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {articles.map((article) => (
                  <ArticleCard key={article.frontmatter.slug} frontmatter={article.frontmatter} />
                ))}
              </div>
            </div>
          )
        })}
      </section>
    </>
  )
}
