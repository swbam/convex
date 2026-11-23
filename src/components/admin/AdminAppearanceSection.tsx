import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { AppearanceEditor } from "./AppearanceEditor";

export default function AdminAppearanceSection() {
  const saved = useQuery(api.appearance.get, {});
  const save = useMutation(api.appearance.save);
  if (!saved) return <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading appearance…</div>;
  return <AppearanceEditor saved={saved} onSave={async (settings, expectedRevision) => {
    try { return await save({ settings, expectedRevision }); }
    catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") throw new Error(error.data);
      throw new Error("Could not save appearance. Check your connection and administrator sign-in, then try again.");
    }
  }} />;
}
