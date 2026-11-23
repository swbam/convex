import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { LiveSetlistPanel } from "./LiveSetlistPanel";
describe("live comparison copy", () => {
  const state = { phase: "monitoring" as const, startsAt: 1, frozenAt: 1, delayed: false, nextCheckAt: undefined, lastCheckedAt: undefined, confirmedAt: undefined };
  const content = { updatedAt: 2, songs: [{ title: "Warehouse", setNumber: 1, encore: false, guest: "Jake Renick Simpson", cover: "Example", notes: "Segue >" }], requests: [{ songTitle: "Crush", upvotes: 1 }] };
  it("shows credits and pending requests without false final conclusions", () => {
    const html = renderToStaticMarkup(<LiveSetlistPanel state={state} content={content} />);
    expect(html).toContain("With Jake Renick Simpson");
    expect(html).toContain("Example cover");
    expect(html).toContain("Not reported yet");
    expect(html).not.toContain("Not played");
    expect(html).not.toContain("Official Setlist");
  });
  it("stopping polling does not imply completeness", () => {
    const html = renderToStaticMarkup(<LiveSetlistPanel state={{ ...state, phase: "finished" }} content={content} />);
    expect(html).toContain("Not reported yet"); expect(html).not.toContain("Not played");
  });
  it("only explicit confirmation permits a missed-request conclusion", () => {
    const html = renderToStaticMarkup(<LiveSetlistPanel state={{ ...state, confirmedAt: 10 }} content={content} />);
    expect(html).toContain("Not played");
  });
});
