import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";

export default function AdminFestivalsSection() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  const festivals = useQuery(api.festivalMediaSync.adminSearch, { search });
  const start = useAction(api.festivalMediaSync.start);
  const [starting, setStarting] = useState(false);
  const festival = festivals?.find(f => f._id === selected);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Festival content</h2><p className="mt-1 text-sm text-muted-foreground">Manage edition artwork and source lineups.</p></div>
      <Button variant="outline" disabled={starting} onClick={async () => { setStarting(true); try { await start({}); toast.success("Image sync queued. See Sync & Tools for progress."); } catch { toast.error("Could not start image sync"); } finally { setStarting(false); } }}>Sync missing images</Button></div>
    <label className="block space-y-2 text-sm"><span>Find a festival</span><input value={search} onChange={e => { setSearch(e.target.value); setSelected(undefined); }} placeholder="Festival name" className="w-full rounded-md border border-border bg-background p-3" /></label>
    <label className="block space-y-2 text-sm"><span>Edition</span><select value={selected ?? ""} onChange={e => setSelected(e.target.value)} className="w-full rounded-md border border-border bg-background p-3"><option value="">Select an edition</option>{festivals?.map(f => <option key={f._id} value={f._id}>{f.name} · {f.startDate} · {f.location}{f.discoveryState === "review" ? " · Needs review" : ""}</option>)}</select></label>
    {festival && <FestivalEditor key={festival._id} festival={festival} />}
  </div>;
}
function FestivalEditor({ festival: f }: { festival: any }) {
  const [image, setImage] = useState(f.imageOverrideUrl ?? "");
  const [names, setNames] = useState("");
  const [source, setSource] = useState(f.lineupSourceUrl ?? "");
  const [verified, setVerified] = useState(false);
  const [startDate, setStartDate] = useState(f.startDate), [endDate, setEndDate] = useState(f.endDate);
  const [saving, setSaving] = useState(false);
  const setImageOverride = useMutation(api.festivalMediaSync.setOverride);
  const setDiscovery = useMutation(api.festivalMediaSync.setDiscovery);
  const saveRoster = useMutation(api.festivalRoster.save);
  const run = async (fn: () => Promise<unknown>, message: string) => { setSaving(true); try { await fn(); toast.success(message); } catch { toast.error("Could not save. Check the source, dates, and administrator access."); } finally { setSaving(false); } };
  return <div className="grid gap-8 lg:grid-cols-2">
    <section className="space-y-4 border-t border-border pt-5"><h3 className="font-semibold">Artwork override</h3>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.discoveryState === "listed"} disabled={saving} onChange={e => run(() => setDiscovery({ festivalId: f._id, listed: e.target.checked }), "Festival visibility updated")} /><span>Include this edition in festival browsing</span></label><p className="text-sm text-muted-foreground">Use approved festival artwork. This override is preserved during automatic syncs. Clear the field to use the provider image.</p>
      <label className="block space-y-2 text-sm"><span>HTTPS image URL</span><input type="url" value={image} onChange={e => setImage(e.target.value)} className="w-full rounded-md border border-border bg-background p-3" /></label>
      {(f.imageOverrideUrl || f.imageUrl) && <img src={f.imageOverrideUrl || f.imageUrl} alt={`${f.name} saved artwork`} className="max-h-44 w-full rounded-md object-contain bg-secondary" />}
      {f.mediaError && <p className="text-xs text-muted-foreground">Last provider check: {f.mediaError}</p>}
      <Button disabled={saving} onClick={() => run(() => setImageOverride({ festivalId: f._id, imageUrl: image }), "Artwork saved")}>Save artwork</Button>
    </section>
    <section className="space-y-4 border-t border-border pt-5"><h3 className="font-semibold">Edition lineup</h3><p className="text-sm text-muted-foreground">Paste one artist per line from this edition’s source. Names stay visible even before artist profiles are matched.</p>
      <label className="block space-y-2 text-sm"><span>Lineup source URL</span><input type="url" value={source} onChange={e => setSource(e.target.value)} className="w-full rounded-md border border-border bg-background p-3" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-sm">Start date<input aria-label="Edition start date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full min-w-0 rounded-md border border-border bg-background p-2" /></label><label className="space-y-2 text-sm">End date<input aria-label="Edition end date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block w-full min-w-0 rounded-md border border-border bg-background p-2" /></label></div>
      <label className="block space-y-2 text-sm"><span>Artists</span><textarea rows={9} value={names} onChange={e => setNames(e.target.value)} className="w-full rounded-md border border-border bg-background p-3" /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="mt-1" /><span>I checked the complete lineup and dates for this edition. Replace the previous source roster.</span></label>
      <Button disabled={saving || !names.trim() || !source.trim()} onClick={() => run(() => saveRoster({ festivalId: f._id, entries: names.split(/\r?\n/).map(name => ({ name: name.trim() })).filter(e => e.name), source: "admin-reviewed", sourceUrl: source, verified, year: f.year, startDate, endDate }), "Lineup saved; artist matching queued")}>Save lineup</Button>
    </section>
  </div>;
}
