import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Performance } from "../../shared/liveSetlist";
import { songKey, summarizeRequests } from "../../convex/lib/predictions";

export function PerformanceCredits({ song }: { song: Performance }) {
  if (!song.guest && !song.cover && !song.notes) return null;
  return <div className="mt-1 space-y-0.5 text-[0.825rem] leading-relaxed text-muted-foreground break-words">
    {song.guest && <p>With {song.guest}</p>}
    {song.cover && <p>{song.cover} cover</p>}
    {song.notes && <p>{song.notes}</p>}
  </div>;
}

type State = NonNullable<FunctionReturnType<typeof api.liveSetlists.getState>>;
type Content = NonNullable<FunctionReturnType<typeof api.liveSetlists.getContent>>;
export function LiveSetlistPanel({ state, content }: { state: State; content: Content | null | undefined }) {
  const songs = content?.songs ?? [], requests = content?.requests ?? [];
  const comparison = summarizeRequests(requests, songs);
  const played = new Set(songs.map(song => songKey(song.title)));
  const complete = !!state.confirmedAt;
  const time = (timestamp: number) => new Date(timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return <section aria-label="Live setlist and fan requests">
    {state.lastCheckedAt && <p className="border-b border-border pb-4 text-xs leading-relaxed text-muted-foreground">
      Last checked {time(state.lastCheckedAt)}{content?.sourceUpdatedAt && <> · <a
        href={content.sourceUrl ?? "https://www.setlist.fm/"}
        target="_blank" rel="noopener noreferrer"
        className="hover:underline underline-offset-2 focus-visible:underline"
        aria-label={`Source updated ${time(content.sourceUpdatedAt)} on setlist.fm`}
      >Source updated {time(content.sourceUpdatedAt)}</a></>}
    </p>}
    {songs.length ? <ol className="divide-y divide-border/50">
      {songs.map((song, index) => <li key={`${index}:${song.title}`} className="flex items-baseline gap-3 py-3 min-w-0">
        <span className="w-6 shrink-0 leading-6 text-[0.9625rem] tabular-nums text-muted-foreground">{index + 1}</span>
        <div className="min-w-0 flex-1"><p className="text-[1.1rem] leading-6 font-medium break-words">{song.title}</p><PerformanceCredits song={song} /></div>
        <div className="shrink-0 text-right text-[0.825rem] text-muted-foreground">{song.encore && <p>Encore</p>}{played.has(songKey(song.title)) && comparison.requested.has(songKey(song.title)) && <p className="mt-1">Requested</p>}</div>
      </li>)}
    </ol> : <p className="py-5 text-[0.9625rem] text-muted-foreground">Waiting for songs to be reported. An empty report does not mean no songs have been played.</p>}
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="text-[1.1rem] font-semibold">Fan requests</h3>
      <p className="mt-1 text-[0.825rem] text-muted-foreground">{state.frozenAt ? "Votes locked at the scheduled show start." : "Requests will be locked at the scheduled show start."}</p>
      {requests.length ? <>
        <p className="mt-3 text-[0.9625rem]">{comparison.matched} of {comparison.requestedSongs} voted songs {complete ? "were played" : "reported so far"}</p>
        <ul className="mt-3 divide-y divide-border/50">{[...requests].sort((a, b) => b.upvotes - a.upvotes).map(request => <li key={songKey(request.songTitle)} className="flex items-center justify-between gap-3 py-[0.825rem] text-[0.9625rem]">
          <span className="min-w-0 break-words">{request.songTitle}<span className="ml-2 text-[0.825rem] text-muted-foreground">{request.upvotes} {request.upvotes === 1 ? "vote" : "votes"}</span></span>
          <span className="shrink-0 text-[0.825rem] text-muted-foreground">{played.has(songKey(request.songTitle)) ? "Reported played" : complete ? "Not played" : "Not reported yet"}</span>
        </li>)}</ul>
      </> : <p className="mt-3 text-[0.9625rem] text-muted-foreground">{state.frozenAt ? "No fan votes were recorded before this show." : "Fan requests will appear here when voting closes."}</p>}
    </div>
  </section>;
}
