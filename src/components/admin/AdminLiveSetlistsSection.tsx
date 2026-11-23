import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { toast } from "sonner";

export default function AdminLiveSetlistsSection() {
  const data = useQuery(api.liveSetlists.adminList, {});
  const budget = useQuery(api.setlistProvider.getBudget, {});
  const enroll = useMutation(api.liveSetlists.enrollShow), control = useMutation(api.liveSetlists.control);
  const confirm = useMutation(api.liveSetlists.confirmComplete), setBudget = useMutation(api.setlistProvider.setBudget);
  const [pending, setPending] = useState(false), [amount, setAmount] = useState("");
  const run = async (work: () => Promise<unknown>) => { setPending(true); try { await work(); toast.success("Pilot updated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update pilot"); } finally { setPending(false); } };
  if (!data || !budget) return <p role="status">Loading live pilot…</p>;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">DMB live setlists</h1><p className="mt-2 text-sm text-muted-foreground">Three-show pilot. Every 3 minutes while reports change, 5 minutes when quiet. At most 120 provider requests per show.</p></div>
    <section className="border border-border rounded-[5px] p-4 space-y-3">
      <h2 className="font-semibold">Shared setlist.fm budget</h2>
      <p className="text-sm text-muted-foreground">{budget.remaining} of {budget.dailyBudget} requests available this UTC day across live and historical imports. This app budget must fit your provider allowance.</p>
      {budget.cooldownUntil && budget.cooldownUntil > Date.now() && <p className="text-sm">Provider cooldown until {new Date(budget.cooldownUntil).toLocaleString()}.</p>}
      <form className="flex flex-wrap gap-2 items-end" onSubmit={event => { event.preventDefault(); void run(() => setBudget({ dailyBudget: Number(amount) })); }}>
        <label className="text-sm">Daily request ceiling<input type="number" min="1" max="100000" required value={amount} placeholder={String(budget.dailyBudget)} onChange={event => setAmount(event.target.value)} className="block mt-1 h-10 w-40 border border-input rounded-[5px] bg-background px-3" /></label>
        <Button type="submit" disabled={pending}>Save budget</Button>
      </form>
    </section>
    {data.sessions.map(session => <section key={session.showId} className="border border-border rounded-[5px] p-4 space-y-3">
      <h2 className="font-semibold">{session.title}</h2>
      <p className="text-sm text-muted-foreground capitalize">{session.state.phase} · {session.requestsUsed}/120 requests · {session.songs.length} reported songs</p>
      <p className="text-sm text-muted-foreground">Start: {new Date(session.state.startsAt).toLocaleString()}{session.state.nextCheckAt ? ` · Next check: ${new Date(session.state.nextCheckAt).toLocaleString()}` : ""}</p>
      {session.lastError && <p role="status" className="text-sm">{session.lastError}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={() => void run(() => control({ showId: session.showId, operation: session.state.phase === "paused" ? "resume" : "pause" }))}>{session.state.phase === "paused" ? "Resume" : "Pause"}</Button>
        <Button variant="outline" disabled={pending || session.state.phase === "finished"} onClick={() => void run(() => control({ showId: session.showId, operation: "refresh" }))}>Request check</Button>
        {session.slug && <Button variant="outline" asChild><a href={`/shows/${session.slug}`} target="_blank" rel="noopener noreferrer">View show</a></Button>}
        {session.sourceUrl && <Button variant="outline" asChild><a href={session.sourceUrl} target="_blank" rel="noopener noreferrer">Review source</a></Button>}
      </div>
      <details><summary className="cursor-pointer text-sm">Review latest songs and completeness</summary>
        <ol className="my-3 list-decimal pl-5 text-sm space-y-1">{session.songs.map((song, index) => <li key={index}>{song.title}{song.guest ? ` · with ${song.guest}` : ""}{song.cover ? ` · ${song.cover} cover` : ""}{song.notes ? ` · ${song.notes}` : ""}</li>)}</ol>
        <p className="mb-3 text-xs text-muted-foreground">Only confirm after checking that the source includes the entire show, including encores. The API does not provide a completion signal. Corrections require another review.</p>
        <Button disabled={pending || !session.version || !session.songs.length || !!session.state.confirmedAt || Date.now() < session.state.startsAt + 4 * 3600000}
          onClick={() => void run(() => confirm({ showId: session.showId, version: session.version! }))}>{session.state.confirmedAt ? "Completeness confirmed" : "Confirm complete setlist"}</Button>
      </details>
    </section>)}
    {data.sessions.length < 3 && <section className="space-y-3"><h2 className="font-semibold">Choose pilot shows ({data.sessions.length}/3)</h2>
      {data.candidates.map(show => <div key={show.showId} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"><p className="text-sm">{show.title}</p><Button disabled={pending} onClick={() => void run(() => enroll({ showId: show.showId }))}>Enable live pilot</Button></div>)}
      {!data.candidates.length && <p className="text-sm text-muted-foreground">No eligible upcoming DMB shows with confirmed start times.</p>}
    </section>}
  </div>;
}
