import Link from "next/link"
import { Button } from "@/components/ui/button"

const FinalCTA = () => {
  return (
    <section className="px-4 py-24 md:py-32 text-center">
      <h2 className="font-sora font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl max-w-2xl mx-auto leading-tight">
        Stop losing value to poor
        <br /> execution
      </h2>

      <Button size="lg" className="mt-10 text-base px-10 py-6 font-semibold rounded-lg" asChild>
        <Link href="/">
          Start swapping on Fast <span aria-hidden="true">→</span>
        </Link>
      </Button>

      <p className="mt-2 text-sm text-muted-foreground">
        Takes seconds. No downside. Better execution by default.
      </p>
    </section>
  )
}

export default FinalCTA
