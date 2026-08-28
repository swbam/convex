import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeOAuthIntent,
  isSensitiveAnalyticsRoute,
  recordOAuthIntent,
  sanitizeAnalyticsPath,
  shouldCaptureAnalyticsPath,
} from "./analytics";

describe("analytics privacy and attribution helpers", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("recognizes invite-token routes as sensitive", () => {
    expect(isSensitiveAnalyticsRoute("/for-artists/invite/secret-token")).toBe(true);
    expect(isSensitiveAnalyticsRoute("/for-artists/artist-id/team")).toBe(false);
    expect(
      sanitizeAnalyticsPath("/for-artists/invite/secret-token"),
    ).toBe("/for-artists/invite/:token");
    expect(
      shouldCaptureAnalyticsPath("/for-artists/invite/secret-token"),
    ).toBe(false);
    expect(shouldCaptureAnalyticsPath("/shows/show-id")).toBe(true);
  });

  it("preserves OAuth attribution for one callback only", () => {
    recordOAuthIntent({
      auth_method: "spotify",
      auth_mode: "sign_up",
      source: "sign_up_page",
    });

    expect(consumeOAuthIntent()).toEqual({
      auth_method: "spotify",
      auth_mode: "sign_up",
      source: "sign_up_page",
    });
    expect(consumeOAuthIntent()).toBeNull();
  });
});
