import { useEffect, useState, type FormEvent } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { ArrowUp, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "../ui/button";
import {
  appearanceVariables, contrastRatio, DEFAULT_APPEARANCE,
  normalizeHex, sameAppearance, type AppearanceSettings, type AppearanceSnapshot,
} from "../../../shared/appearance";

const PRESETS = [
  { name: "Mint teal", accent: "#2bcfb2", end: "#00c982" },
  { name: "Warm gold", accent: "#e7c66f", end: "#d99b39" },
  { name: "Blue", accent: "#73a9ff", end: "#9081f5" },
];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const update = (next: string) => onChange(normalizeHex(next));
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label}
        <div className="mt-2 flex items-center gap-3 rounded-md border border-input bg-background px-3">
          <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded border border-black/15" style={{ backgroundColor: value }} />
          <HexColorInput aria-label={label} color={value} onChange={update} prefixed
            className="min-w-0 flex-1 bg-transparent py-3 font-mono text-sm uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      </label>
      <details className="appearance-color-field">
        <summary className="w-fit cursor-pointer py-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Pick {label.toLowerCase()}</summary>
        <HexColorPicker aria-label={`${label} color picker`} color={value} onChange={update} />
      </details>
    </div>
  );
}

export function AppearanceEditor({ saved, onSave }: {
  saved: AppearanceSnapshot;
  onSave: (settings: AppearanceSettings, expectedRevision: number) => Promise<{ revision: number }>;
}) {
  const [draft, setDraft] = useState(saved.settings);
  const [baseline, setBaseline] = useState(saved.settings);
  const [revision, setRevision] = useState(saved.revision);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [previewLight, setPreviewLight] = useState(false);
  const [voted, setVoted] = useState(false);
  const dirty = !sameAppearance(draft, baseline);
  const changedElsewhere = saved.revision > revision;

  // Fresh remote settings can update an idle editor, but never erase unsaved work.
  useEffect(() => {
    if (saved.revision > revision && !dirty && !saving) {
      setDraft(saved.settings); setBaseline(saved.settings); setRevision(saved.revision);
    }
  }, [saved, revision, dirty, saving]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
    setDraft(current => ({ ...current, [key]: value })); setNotice(""); setError("");
  };
  const loadSaved = () => {
    setDraft(saved.settings); setBaseline(saved.settings); setRevision(saved.revision); setNotice(""); setError("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || saving || changedElsewhere) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await onSave(draft, revision);
      setRevision(result.revision); setBaseline(draft);
      setNotice("Appearance saved. The site now uses these colors.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save appearance. Your changes are still here; try again.");
    } finally { setSaving(false); }
  };

  const previewVariables = appearanceVariables(draft, previewLight);
  const previewButtonContrast = contrastRatio(
    previewVariables["--brand-button-fg"],
    draft.buttonStyle === "solid" ? previewVariables["--brand-button-bg"] : previewLight ? "#f3f4f6" : "#131313",
  );
  return (
    <form onSubmit={submit} className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Site settings</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Appearance</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Choose your accent and logo colors. Preview changes here, then save to apply them across the site.</p>
      </header>

      {changedElsewhere && dirty && <div role="status" className="rounded-md border border-border p-4 text-sm">Settings changed in another session. <button type="button" onClick={loadSaved} className="underline underline-offset-4">Load saved settings</button> before saving again.</div>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.95fr)]">
        <fieldset disabled={saving} className="min-w-0 space-y-6">
          <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <h2 className="font-semibold">Accent color</h2>
            <p className="mt-1 text-xs text-muted-foreground">Selected states, outlined buttons, and focus indicators. Solid buttons stay white with black text.</p>
            <div className="my-4 flex flex-wrap gap-2">
              {PRESETS.map(preset => <Button key={preset.name} type="button" variant="outline" size="sm" onClick={() => {
                setDraft(current => ({ ...current, accentColor: preset.accent, logoStartColor: preset.accent, logoEndColor: preset.end })); setNotice(""); setError("");
              }}><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: preset.accent }} />{preset.name}</Button>)}
            </div>
            <ColorField label="Accent color" value={draft.accentColor} onChange={value => change("accentColor", value)} />
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">Primary button style</legend>
              <div className="flex flex-wrap gap-4">
                {(["solid", "outline"] as const).map(style => <label key={style} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" name="buttonStyle" value={style} checked={draft.buttonStyle === style} onChange={() => change("buttonStyle", style)} className="h-4 w-4 accent-current" />
                  {style === "solid" ? "White fill" : "Accent outline"}
                </label>)}
              </div>
            </fieldset>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Logo</h2>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={draft.logoGradient} onChange={event => change("logoGradient", event.target.checked)} className="h-4 w-4 accent-current" />Use gradient</label>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <ColorField label={draft.logoGradient ? "Gradient start" : "Logo color"} value={draft.logoStartColor} onChange={value => change("logoStartColor", value)} />
              {draft.logoGradient && <ColorField label="Gradient end" value={draft.logoEndColor} onChange={value => change("logoEndColor", value)} />}
            </div>
            {draft.logoGradient && <label className="mt-5 block text-sm font-medium">Gradient angle <span className="float-right font-mono text-muted-foreground">{draft.gradientAngle}°</span>
              <input aria-label="Gradient angle" type="range" min="0" max="360" step="1" value={draft.gradientAngle} onChange={event => change("gradientAngle", Number(event.target.value))} className="mt-3 h-6 w-full accent-current" />
            </label>}
            <button type="button" onClick={() => change("logoStartColor", draft.accentColor)} className="mt-3 min-h-11 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Use accent as logo’s first color</button>
          </section>
        </fieldset>

        <section className="min-w-0 lg:sticky lg:top-20" aria-label="Appearance preview">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Live preview</h2>
            <div className="flex gap-1" role="group" aria-label="Preview theme">
              <Button type="button" variant="ghost" size="sm" aria-pressed={!previewLight} onClick={() => setPreviewLight(false)}>Dark</Button>
              <Button type="button" variant="ghost" size="sm" aria-pressed={previewLight} onClick={() => setPreviewLight(true)}>Light</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border" style={{ ...previewVariables, background: previewLight ? "#f3f4f6" : "#131313", color: previewLight ? "#171a1f" : "#f3f3f3" }}>
            <div className="border-b border-current/15 p-5"><span className="brand-logo text-2xl font-bold tracking-tight">setlists.live</span></div>
            <div className="p-5">
              <p className="text-[10px] uppercase tracking-widest opacity-60">Example show · Fan voting open</p>
              <h3 className="mt-3 text-3xl font-bold tracking-tight">Garth Brooks</h3>
              <p className="mt-2 text-sm opacity-60">Kia Center · Orlando, FL</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="brand-primary min-h-11 rounded-md px-4 text-sm font-semibold">Get tickets ↗</button>
                <button type="button" className="brand-secondary min-h-11 rounded-md border border-current/20 px-4 text-sm">Share show</button>
              </div>
              <div className="mt-7 border-t border-current/15 pt-5">
                <h4 className="font-semibold">Fan requests</h4>
                <div className="mt-4 flex items-center justify-between gap-4 border-b border-current/15 pb-4">
                  <span className="min-w-0 text-sm">Friends in Low Places</span>
                  <button type="button" className={`min-h-11 min-w-14 shrink-0 rounded-md border border-current/20 px-2 text-sm ${voted ? "brand-selected" : ""}`} aria-pressed={voted} aria-label="Try voting in preview" onClick={() => setVoted(!voted)}><ArrowUp className="mr-1 inline h-3 w-3" />{voted ? 25 : 24}</button>
                </div>
                <p className="mt-4 text-xs opacity-60">Try the vote button to preview its selected state.</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Solid buttons use charcoal in light mode and white in dark mode. Accent labels adapt to each surface.</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">Button label contrast: {previewButtonContrast.toFixed(1)}:1</p>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <Button type="button" variant="ghost" disabled={saving} onClick={() => { setDraft({ ...DEFAULT_APPEARANCE }); setNotice(""); setError(""); }}><RotateCcw className="h-4 w-4" />Reset to teal</Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">{dirty ? "Unsaved changes" : "Saved colors"}</span>
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={loadSaved}>Discard changes</Button>
          <Button type="submit" disabled={!dirty || saving || changedElsewhere}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{saving ? "Saving…" : "Save appearance"}</Button>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    </form>
  );
}
