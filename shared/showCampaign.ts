export type ShareOrigin = "artist_team" | "fan";
export type TicketOrigin = ShareOrigin | "shared" | "onsite";

export function showShareUrl(origin: string, key: string, showId: string, source: ShareOrigin) {
  const url = new URL("/shows/" + encodeURIComponent(key), origin);
  url.searchParams.set("utm_source", "setlists.live");
  url.searchParams.set("utm_medium", source === "artist_team" ? "artist_share" : "fan_share");
  url.searchParams.set("utm_campaign", "show-" + showId);
  return url.toString();
}

export function ticketCampaign(campaign: Record<string, unknown>): { origin: TicketOrigin; showId?: string } {
  if (campaign.utm_source !== "setlists.live") return { origin: "onsite" };
  if (campaign.utm_medium === "share") return { origin: "shared" };
  const id = typeof campaign.utm_campaign === "string" && /^show-([a-z0-9]{1,64})$/i.exec(campaign.utm_campaign);
  if (!id) return { origin: "onsite" };
  if (campaign.utm_medium === "artist_share") return { origin: "artist_team", showId: id[1] };
  if (campaign.utm_medium === "fan_share") return { origin: "fan", showId: id[1] };
  return { origin: "onsite" };
}

export function safeCampaignProperties(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const properties: Record<string, string> = {};
  for (const name of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = params.get(name);
    // No free-form URL, email, token or search-query fields are retained.
    if (value && /^[a-z0-9][a-z0-9_.-]{0,79}$/i.test(value)) properties[name] = value;
  }
  return properties;
}
