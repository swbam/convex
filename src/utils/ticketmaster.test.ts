import { describe, expect, it } from "vitest";
import { buildTicketmasterAffiliateUrl } from "./ticketmaster";

describe("buildTicketmasterAffiliateUrl", () => {
  it("preserves a valid Ticketmaster event and adds affiliate attribution", () => {
    const result = new URL(
      buildTicketmasterAffiliateUrl(
        "https://www.ticketmaster.com/example-event/event/123?existing=1",
      ),
    );

    expect(result.hostname).toBe("www.ticketmaster.com");
    expect(result.pathname).toBe("/example-event/event/123");
    expect(result.searchParams.get("existing")).toBe("1");
    expect(result.searchParams.get("irgwc")).toBe("1");
    expect(result.searchParams.get("clickid")).toHaveLength(40);
    expect(result.searchParams.get("utm_medium")).toBe("affiliate");
  });

  it.each([
    "not a valid URL",
    "javascript:alert(1)",
    "https://example.com/not-ticketmaster",
    "https://ticketmaster.evil.com/phishing",
    "https://ticketmaster.com.evil.com/phishing",
    "http://www.ticketmaster.com/insecure",
  ])("falls back safely for an invalid provider URL: %s", (ticketUrl) => {
    const result = new URL(buildTicketmasterAffiliateUrl(ticketUrl));

    expect(result.protocol).toBe("https:");
    expect(result.hostname).toBe("www.ticketmaster.com");
    expect(result.pathname).toBe("/");
    expect(result.searchParams.get("irgwc")).toBe("1");
  });
});
