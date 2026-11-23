import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { basicSeoPage, graphPage, normalizePath, safeJson, socialImageMeta, type SeoPage } from "../../shared/seo";

export function applySeoPage(page: SeoPage) {
  document.title = page.title;
  const meta = (key: string, content: string, property = false) => {
    const attr = property ? "property" : "name";
    const nodes = document.head.querySelectorAll<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    const node = nodes[0] || document.createElement("meta");
    nodes.forEach((duplicate, i) => { if (i) duplicate.remove(); });
    node.setAttribute(attr, key); node.content = content;
    if (!node.isConnected) document.head.appendChild(node);
  };
  const imageMeta = socialImageMeta(page);
  for (const name of ["image:width", "image:height", "image:type", "image:alt"]) {
    if (!(name in imageMeta)) document.head.querySelectorAll(`meta[property="og:${name}"]`).forEach(node => node.remove());
  }
  meta("description", page.description); meta("robots", page.robots);
  for (const [key, value] of Object.entries({ title: page.title, description: page.description, url: page.canonical, image: page.image, type: page.type, site_name: "setlists.live", ...imageMeta })) meta(`og:${key}`, value, true);
  for (const [key, value] of Object.entries({ card: "summary_large_image", title: page.title, description: page.description, url: page.canonical, image: page.image, "image:alt": imageMeta["image:alt"] })) meta(`twitter:${key}`, value);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
  canonical.href = page.canonical;
  let script = document.getElementById("seo-jsonld");
  if (!script) { script = document.createElement("script"); script.id = "seo-jsonld"; script.setAttribute("type", "application/ld+json"); document.head.appendChild(script); }
  script.textContent = safeJson(page.jsonLd);
}

// Apply navigation metadata locally. Catalog data comes from the page's Convex queries.
export function SEOHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = normalizePath(pathname);
    const embedded = document.getElementById("seo-data")?.textContent;
    if (embedded) {
      const initial = JSON.parse(embedded) as { path: string; page: SeoPage };
      if (initial.path === path) {
        applySeoPage(initial.page);
        return;
      }
    }
    const page = graphPage(basicSeoPage(path));
    page.robots = "noindex, nofollow";
    applySeoPage(page);
  }, [pathname]);
  return null;
}
