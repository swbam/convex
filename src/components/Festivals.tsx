import { PageHeader } from "./PageHeader";
import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { Calendar, MapPin, Music, Users } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Button } from "./ui/button";
import { TicketLink } from "./TicketLink";
import { formatFestivalDates } from "../lib/festivalDates";

interface FestivalsProps { onFestivalClick: (slug: string) => void }
export function Festivals(_props: FestivalsProps) {
  const [params, setParams] = useSearchParams();
  const period = params.get("period") === "past" ? "past" : "upcoming";
  const { results, status, loadMore } = usePaginatedQuery(api.festivals.browse, { period }, { initialNumItems: 24 });
  return <div className="public-page">
    <Tabs value={period} onValueChange={value => setParams(value === "past" ? { period: "past" } : {})}>
      <PageHeader title="Festivals" description="Lineups, performances, and the songs that made the weekend." actions={<TabsList aria-label="Festival dates"><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="past">Past</TabsTrigger></TabsList>} />
      <TabsContent value={period} className="mt-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">{period === "past" ? "Past editions · most recent first" : "Upcoming & happening now"}</h2>
        {status === "LoadingFirstPage" ? <p role="status" className="py-12 text-muted-foreground">Loading festivals…</p> : results.length === 0 ?
          <div className="border-y border-border py-12"><h3 className="text-lg font-semibold">{period === "past" ? "No past editions listed yet" : "No upcoming editions listed yet"}</h3><p className="mt-2 text-muted-foreground">{period === "past" ? "Completed festivals will appear here." : "Browse past editions while new dates are announced."}</p></div> :
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{results.map(f => <FestivalCard key={f._id} festival={f} />)}</div>}
        {status !== "Exhausted" && status !== "LoadingFirstPage" && <div className="mt-6 text-center"><Button variant="outline" disabled={status === "LoadingMore"} onClick={() => loadMore(24)}>{status === "LoadingMore" ? "Loading…" : "Load more festivals"}</Button></div>}
      </TabsContent>
    </Tabs>
  </div>;
}
function FestivalCard({ festival: f }: { festival: any }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const src = f.imageCardUrl || f.imageUrl;
  const hasImage = src && src !== failedUrl;
  const past = f.status === "completed";
  return <article className="content-card interactive-card self-start overflow-hidden">
    <a href={`/festivals/${f.slug}`} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      {hasImage ? <div className="aspect-video overflow-hidden bg-secondary"><img src={src} alt={f.name} width="640" height="360" loading="lazy" decoding="async" onError={() => setFailedUrl(src)} className="h-full w-full object-cover" /></div> :
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs text-muted-foreground"><Music className="h-4 w-4" />Festival · {f.year}</div>}
      <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><h3 className="text-base font-semibold leading-snug group-hover:underline">{f.name}</h3>{f.status === "ongoing" && <span className="shrink-0 text-xs text-primary">Live now</span>}</div>
        <p className="flex items-start gap-2 text-sm text-muted-foreground"><Calendar className="mt-0.5 h-4 w-4 shrink-0" />{formatFestivalDates(f.startDate, f.endDate)}</p>
        <p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{f.location}</p>
      </div>
    </a>
    {f.imageAttribution && hasImage && <p className="px-4 pb-2 text-[10px] text-muted-foreground">{f.imageAttribution}</p>}
    <div className="mx-4 flex min-h-14 items-center justify-between gap-2 border-t border-border py-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-4 w-4" />{f.artistCount ? `${f.artistCount} ${f.artistCount === 1 ? "artist" : "artists"} listed` : "Lineup pending"}</span>
      {!past && f.ticketUrl ? <TicketLink href={f.ticketUrl} placement="festival_card" properties={{ festival_id: f._id, festival_slug: f.slug }} className="text-sm font-medium text-foreground underline-offset-4 hover:underline">Tickets ↗</TicketLink> : <a href={`/festivals/${f.slug}`} className="text-sm font-medium hover:underline">{past ? "View edition" : "View lineup"} →</a>}
    </div>
  </article>;
}
