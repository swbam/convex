import { Link } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
export function NotFoundPage() {
  return <AppLayout><main className="mx-auto max-w-3xl px-4 py-20"><p className="text-sm text-muted-foreground">404</p><h1 className="mt-3 text-3xl font-bold">Page not found</h1><p className="mt-4 text-muted-foreground">Explore artists and upcoming shows to find your next concert.</p><div className="mt-6 flex gap-6"><Link className="underline underline-offset-4" to="/artists">Browse artists</Link><Link className="underline underline-offset-4" to="/shows">Find shows</Link></div></main></AppLayout>;
}
