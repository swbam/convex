import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CalendarDays, ListMusic, Vote } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { AppLayout } from "../components/AppLayout";
import { Button } from "../components/ui/button";
import { HOW_IT_WORKS } from "../../shared/howItWorks";

const MotionLink = motion.create(Link);
const stepIcons = [CalendarDays, Vote, ListMusic];

export function AboutPage() {
  const reduceMotion = useReducedMotion();
  const content = HOW_IT_WORKS;
  const hover = reduceMotion ? undefined : { x: 2 };
  const tap = reduceMotion ? undefined : { scale: 0.98 };
  const item = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.2 } },
  };

  return (
    <AppLayout>
      <article className="public-page text-foreground">
        <header className="border-b border-border pb-7 sm:pb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your artists. Your shows. Your setlist.</p>
          <h1 className="page-title">{content.title}</h1>
          <p className="mt-4 max-w-2xl text-lg font-medium leading-relaxed sm:text-xl">{content.intro}</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{content.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="min-h-11 px-5">
              <MotionLink to="/shows" whileHover={hover} whileTap={tap}>Explore shows<ArrowRight aria-hidden="true" /></MotionLink>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-h-11 px-5">
              <MotionLink to="/artists" whileHover={hover} whileTap={tap}>Find an artist<ArrowUpRight aria-hidden="true" /></MotionLink>
            </Button>
          </div>
        </header>

        <div className="grid gap-8 py-7 sm:py-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-12">
          <section aria-labelledby="fan-steps-heading">
            <h2 id="fan-steps-heading" className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Before the encore</h2>
            <motion.ol
              className="divide-y divide-border"
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
            >
              {content.steps.map((step, index) => {
                const Icon = stepIcons[index];
                return (
                  <motion.li key={step.title} variants={item} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-6 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-4">
                    <span aria-hidden="true" className="pt-1 text-sm font-medium tabular-nums text-muted-foreground">0{index + 1}</span>
                    <div>
                      <Icon className="mb-3 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <h3 className="text-xl font-semibold leading-snug tracking-tight">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{step.description}</p>
                      <MotionLink to={step.href} whileHover={hover} whileTap={tap} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {step.link}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </MotionLink>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ol>
          </section>

          <aside aria-labelledby="good-to-know-heading" className="self-start border-t border-border pt-6 sm:border sm:bg-card sm:p-6 lg:mt-0">
            <h2 id="good-to-know-heading" className="text-xl font-semibold tracking-tight">Good to know</h2>
            <dl className="mt-1 divide-y divide-border">
              {content.questions.map(question => (
                <div key={question.title} className="py-5 last:pb-0">
                  <dt className="text-sm font-semibold">{question.title}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{question.answer}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        <section aria-labelledby="artist-info-heading" className="grid gap-5 border-y border-border py-7 sm:py-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-12">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">For artists and teams</p>
            <h2 id="artist-info-heading" className="text-2xl font-bold tracking-tight">{content.artistsTitle}</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{content.artistsDescription}</p>
          </div>
          <div className="flex items-center lg:justify-start">
            <Button asChild variant="outline" size="lg" className="min-h-11 px-5">
              <MotionLink to="/for-artists" whileHover={hover} whileTap={tap}>Explore the artist portal<ArrowUpRight aria-hidden="true" /></MotionLink>
            </Button>
          </div>
        </section>

        <p className="pt-5 text-xs leading-relaxed text-muted-foreground">{content.sources}</p>
      </article>
    </AppLayout>
  );
}
