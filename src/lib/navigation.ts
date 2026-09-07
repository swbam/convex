const LOCAL_ORIGIN = "https://www.setlists.live";

/**
 * Accept only same-origin, root-relative application destinations.
 * This keeps OAuth and invitation return paths useful without allowing an
 * external redirect through query-string input.
 */
export function safeReturnTo(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const destination = new URL(value, LOCAL_ORIGIN);
    if (destination.origin !== LOCAL_ORIGIN) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
