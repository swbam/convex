import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ShowShareButton } from "./ShowShareButton";
import { TicketLink } from "./TicketLink";
import { ticketCampaign } from "../../shared/showCampaign";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv("VITE_TICKETMASTER_US_IMPACT_LINK", "https://tracking.example/c/1/2/3");
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each(["artist_team", "fan"] as const)("carries the %s share from the share button to the ticket destination", async origin => {
  const container = document.createElement("div");
  const ticketRoot = createRoot(container);
  const event = "https://www.ticketmaster.com/event/ABC123";
  let link = "";
  const node = document.createElement("div");
  const shareRoot = createRoot(node);
  const share = vi.fn(async ({ url }: { url: string }) => { link = url; });
  vi.stubGlobal("navigator", { share });
  try {
    await act(async () => shareRoot.render(<ShowShareButton showId="show123" slug="the-show" source={origin} />));
    await act(async () => node.querySelector("button")!.click());
    const shared = new URL(link);
    expect(shared.pathname).toBe("/shows/the-show");
    expect(shared.searchParams.get("utm_medium")).toBe(origin === "artist_team" ? "artist_share" : "fan_share");
    window.history.replaceState(null, "", shared.pathname + shared.search);
    await act(async () => ticketRoot.render(<TicketLink href={event} placement="show_header" properties={{ show_id: "show123" }}>Tickets</TicketLink>));
    const destination = new URL(container.querySelector("a")!.href);
    expect(destination.hostname).toBe("tracking.example");
    expect(Object.fromEntries(destination.searchParams)).toMatchObject({
      u: event, subId1: origin, subId2: "show123", subId3: "show_header",
    });
  } finally {
    await act(async () => { shareRoot.unmount(); ticketRoot.unmount(); });
  }
});

it("recognizes legacy shares and treats malformed or unrelated campaign labels as onsite", () => {
  expect(ticketCampaign({ utm_source: "setlists.live", utm_medium: "share" }).origin).toBe("shared");
  expect(ticketCampaign({ utm_source: "other", utm_medium: "artist_share", utm_campaign: "show-abc" }).origin).toBe("onsite");
  expect(ticketCampaign({ utm_source: "setlists.live", utm_medium: "artist_share", utm_campaign: "invalid" }).origin).toBe("onsite");
});
