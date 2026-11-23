import { useLayoutEffect } from "react";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { api } from "../../convex/_generated/api";
import { appearanceVariables, DEFAULT_APPEARANCE } from "../../shared/appearance";

/** One small reactive query for the whole app; the picker stays in the admin chunk. */
export function SiteAppearance() {
  const appearance = useQuery(api.appearance.get, {});
  const { resolvedTheme } = useTheme();
  useLayoutEffect(() => {
    const variables = appearanceVariables(appearance?.settings ?? DEFAULT_APPEARANCE, resolvedTheme === "light");
    for (const [key, value] of Object.entries(variables)) document.documentElement.style.setProperty(key, value);
    return () => {
      for (const key of Object.keys(variables)) document.documentElement.style.removeProperty(key);
    };
  }, [appearance?.settings, resolvedTheme]);
  return null;
}
