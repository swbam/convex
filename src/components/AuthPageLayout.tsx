import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <nav aria-label="Account navigation" className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="brand-logo text-2xl font-bold tracking-tight" aria-label="setlists.live home">setlists.live</Link>
          <Link to="/" className="site-button flex min-h-11 items-center gap-2 px-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to home</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
        <section className="rounded-[5px] border border-border bg-card px-5 py-7 shadow-sm sm:px-7 sm:py-8">{children}</section>
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">Your artists. Your shows. Your setlist.</p>
      </main>
    </div>
  );
}
