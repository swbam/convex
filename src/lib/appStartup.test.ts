// @vitest-environment node
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderSeoDocument } from "../../convex/seoHtml";
import { basicSeoPage } from "../../shared/seo";
import { resolveSeoPage } from "../../convex/seoRoutes";
import { HOW_IT_WORKS } from "../../shared/howItWorks";

const shell = '<html><head><title>Default</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';
const pages: JSDOM[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { pages.splice(0).forEach(page => page.window.close()); vi.useRealTimers(); });
async function openPage(javaScript: boolean) {
  const page = new JSDOM(renderSeoDocument(shell, basicSeoPage("/")), { runScripts: javaScript ? "dangerously" : undefined, url: "https://www.setlists.live/" });
  pages.push(page);
  await new Promise<void>(resolve => page.window.document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
  return page.window;
}

describe("initial HTML to app startup", () => {
  it("shows a small loading state before React instead of the fallback heading, then releases on the actual DOM commit", async () => {
    const window = await openPage(true);
    const document = window.document;
    expect(document.documentElement.hasAttribute("data-app-starting")).toBe(true);
    expect(window.getComputedStyle(document.querySelector(".seo-prerender")!).display).toBe("none");
    expect(window.getComputedStyle(document.getElementById("app-startup")!).display).toBe("flex");
    // Metadata and content remain in the shared initial response during startup.
    expect(document.title).toContain("Vote & Request Songs");
    expect(document.querySelector("h1")?.textContent).toBe("See what fans want to hear — before doors open");
    const liveApp = document.createElement("main"); liveApp.textContent = "Interactive app";
    document.getElementById("root")!.replaceChildren(liveApp);
    await Promise.resolve();
    expect(document.documentElement.hasAttribute("data-app-starting")).toBe(false);
    expect(document.getElementById("app-startup")).toBeNull();
    expect(document.querySelector("main")?.textContent).toBe("Interactive app");
  });
  it("keeps crawlable, visible content when JavaScript is disabled", async () => {
    const window = await openPage(false);
    expect(window.document.documentElement.hasAttribute("data-app-starting")).toBe(false);
    expect(window.getComputedStyle(window.document.querySelector(".seo-prerender")!).display).not.toBe("none");
    expect(window.getComputedStyle(window.document.getElementById("app-startup")!).display).toBe("none");
    expect(window.document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://www.setlists.live/");
    expect(window.document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
  });
  it("restores the readable fallback after five seconds when the bundle never mounts", async () => {
    const window = await openPage(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(window.document.documentElement.hasAttribute("data-app-starting")).toBe(false);
    expect(window.document.getElementById("app-startup")).toBeNull();
    expect(window.getComputedStyle(window.document.querySelector(".seo-prerender")!).display).not.toBe("none");
  });
  it("does not display SEO title keywords as the page heading", async () => {
    const window = new JSDOM(renderSeoDocument(shell, basicSeoPage("/artists"))).window;
    expect(window.document.querySelector("h1")?.textContent).toBe("Artists");
    expect(window.document.title).toContain("Vote & Request Songs");
    window.close();
  });
  it("provides the same How It Works content and real navigation in the initial HTML", async () => {
    const { page, status } = await resolveSeoPage({}, "/about");
    expect(status).toBe(200);
    const window = new JSDOM(renderSeoDocument(shell, page)).window;
    const document = window.document;
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.querySelector("h1")?.textContent).toBe(HOW_IT_WORKS.title);
    for (const step of HOW_IT_WORKS.steps) expect(document.body.textContent).toContain(step.description);
    for (const question of HOW_IT_WORKS.questions) expect(document.body.textContent).toContain(question.answer);
    expect(document.querySelector('a[href="/shows"]')).not.toBeNull();
    expect(document.querySelector('a[href="/for-artists"]')).not.toBeNull();
    window.close();
  });
});
