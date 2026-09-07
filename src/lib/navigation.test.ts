import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./navigation";

describe("safeReturnTo", () => {
  it("keeps local paths including their query and hash", () => {
    expect(safeReturnTo("/for-artists/invite/token?source=email#accept")).toBe(
      "/for-artists/invite/token?source=email#accept",
    );
  });

  it("rejects external and protocol-relative destinations", () => {
    expect(safeReturnTo("https://example.com", "/activity")).toBe("/activity");
    expect(safeReturnTo("//example.com", "/activity")).toBe("/activity");
    expect(safeReturnTo("/\\example.com", "/activity")).toBe("/activity");
  });

  it("uses the provided fallback for missing input", () => {
    expect(safeReturnTo(null, "/for-artists")).toBe("/for-artists");
  });
});
