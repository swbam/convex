import { makeFunctionReference } from "convex/server";
import { buildSeoPage } from "./seoHtml";
import { httpsImage } from "./lib/heroImages";
import { HOW_IT_WORKS } from "../shared/howItWorks";
import { basicSeoPage, canonicalPath, escapeHtml, graphPage, isPrivatePath, normalizePath, seoTitle, SITE_URL, STATIC_PAGES, type SeoPage } from "../shared/seo";
const queryRef = (name: string) => makeFunctionReference<"query">(`publicSeo:${name}`);
export async function fetchPublishedBlog(slug?: string) {
  const filter = `_type == "post" && defined(slug.current) && publishedAt < now() && !(_id in path("drafts.**"))`;
  const query = slug ? `*[${filter} && slug.current == $slug][0]{title,slug,publishedAt,_updatedAt,excerpt,seoTitle,seoDescription,body,"author":author->{name},"image":mainImage.asset->url}` : `*[${filter}] | order(publishedAt desc)[0...400]{title,slug,publishedAt,_updatedAt,excerpt}`;
  const url = new URL("https://i4wz0fvl.apicdn.sanity.io/v2024-01-01/data/query/production");
  url.searchParams.set("query", query);
  if (slug) url.searchParams.set("$slug", JSON.stringify(slug));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Blog unavailable: ${response.status}`);
    const data = await response.json();
    if (!("result" in data)) throw new Error("Invalid blog response");
    return data.result;
  } finally { clearTimeout(timer); }
}
function link(path: string, name: string) { return `<li><a href="${escapeHtml(path)}">${escapeHtml(name)}</a></li>`; }
function portableText(blocks: any[]) {
  return (blocks || []).map(block => {
    if (block._type !== "block") return "";
    const text = (block.children || []).map((span: any) => escapeHtml(span.text || "")).join("");
    const tag = /^h[2-6]$/.test(block.style) ? block.style : "p";
    return `<${tag}>${text}</${tag}>`;
  }).join("");
}
export async function resolveSeoPage(ctx: any, rawPath: string): Promise<{ page: SeoPage; status: number; redirect?: string }> {
  const path = normalizePath(rawPath);
  const finish = (page: SeoPage, status = 200) => ({ page, status });
  if (path === "/studio" || path.startsWith("/studio/")) return { page: basicSeoPage("/for-artists"), status: 308, redirect: `${SITE_URL}/for-artists` };
  if (isPrivatePath(path)) return finish(graphPage(basicSeoPage(canonicalPath(path))));
  const match = /^\/(artists|shows|venues|festivals|blog)\/([^/]+)$/.exec(path);
  if (match) {
    const [, kind, encodedKey] = match;
    let key: string;
    try { key = decodeURIComponent(encodedKey); } catch { return finish(graphPage(basicSeoPage(path, true)), 404); }
    if (key.length > 180 || key.includes("/")) return finish(graphPage(basicSeoPage(path, true)), 404);
    if (kind === "blog") {
      const post = await fetchPublishedBlog(key);
      if (!post) return finish(graphPage(basicSeoPage(path, true)), 404);
      const page = basicSeoPage(path);
      page.title = seoTitle(post.seoTitle || post.title, "setlists.live");
      page.description = (post.seoDescription || post.excerpt || post.title).slice(0, 160);
      page.type = "article"; page.robots = "index, follow";
      page.image = httpsImage(post.image) || page.image;
      page.imageAlt = post.title;
      page.jsonLd = { "@type": "BlogPosting", headline: post.title, description: page.description, datePublished: post.publishedAt, dateModified: post._updatedAt || post.publishedAt, ...(post.author?.name ? { author: { "@type": "Person", name: post.author.name } } : {}), publisher: { "@id": `${SITE_URL}/#organization` }, image: post.image || page.image, url: page.canonical };
      page.body = `<main class="seo-prerender"><article><h1>${escapeHtml(post.title)}</h1><p>${escapeHtml(post.excerpt || "")}</p>${portableText(post.body)}</article></main>`;
      return finish(graphPage(page, [{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }, { name: post.title, path }]));
    }
    const data = await ctx.runQuery(queryRef(({ artists: "getArtistPage", shows: "getShowPage", venues: "getVenuePage", festivals: "getFestivalPage" } as Record<string, string>)[kind]), { key });
    if (!data) return finish(graphPage(basicSeoPage(path, true)), 404);
    if (kind !== "festivals") {
      const artistId = data.artist?._id;
      const venueId = data.venue?._id;
      if (ctx.runAction && (artistId || venueId)) {
        try {
          data.hero = await ctx.runAction(makeFunctionReference<"action">(artistId ? "media:getArtistImages" : "media:getVenueImage"), artistId ? { artistId } : { venueId });
        } catch { /* A provider outage must not make an otherwise valid page fail. */ }
      }
    }
    if (data.canonicalKey && data.canonicalKey !== key) return { page: buildSeoPage(data), status: 308, redirect: `${SITE_URL}/${kind}/${encodeURIComponent(data.canonicalKey)}` };
    if (kind !== "festivals") return finish(buildSeoPage(data));
    const f = data.festival;
    const page = basicSeoPage(path);
    page.title = seoTitle(f.name, "Lineup, Dates & Setlists", "setlists.live");
    page.description = `${f.name} in ${f.location}, ${f.startDate} to ${f.endDate}. Explore the lineup, artist performances and concert setlists.`.slice(0, 160);
    page.robots = "index, follow";
    page.image = httpsImage(f.heroImageUrl || f.imageUrl) || page.image;
    page.imageAlt = `${f.name} festival artwork`;
    page.jsonLd = { "@type": "Festival", name: f.name, description: page.description, url: page.canonical, startDate: f.startDate, endDate: f.endDate, eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", image: f.imageUrl || page.image, location: { "@type": "Place", name: f.location }, ...(f.ticketUrl && f.status !== "completed" ? { offers: { "@type": "Offer", url: f.ticketUrl } } : {}) };
    page.body = `<main class="seo-prerender"><h1>${escapeHtml(f.name)}</h1><p>${escapeHtml(page.description)}</p><h2>Lineup</h2><ul>${(data.roster || []).map((e: any) => `<li>${escapeHtml(e.name)}</li>`).join("")}</ul><h2>Performances</h2><ul>${data.shows.map((s: any) => link(`/shows/${encodeURIComponent(s.slug || s._id)}`, `${s.artist?.name || "Performance"} — ${s.date}`)).join("")}</ul></main>`;
    return finish(graphPage(page, [{ name: "Home", path: "/" }, { name: "Festivals", path: "/festivals" }, { name: f.name, path }]));
  }
  if (!(path in STATIC_PAGES)) return finish(graphPage(basicSeoPage(path, true)), 404);
  const page = basicSeoPage(path);
  if (["/", "/artists", "/shows", "/trending", "/festivals"].includes(path)) {
    const data = await ctx.runQuery(queryRef("getBrowsePage"), { path });
    const links = (data.artists || data.shows || data.festivals || []).map((item: any) => {
      const prefix = data.artists ? "artists" : data.shows ? "shows" : "festivals";
      return { path: `/${prefix}/${encodeURIComponent(item.slug || item._id)}`, name: item.name || `${item.artist?.name || "Concert"} at ${item.venue?.name || "Venue"} — ${item.date}` };
    });
    page.body = page.body.replace("</main>", `<ul>${links.map((item: any) => link(item.path, item.name)).join("")}</ul></main>`);
    page.jsonLd = { "@type": "CollectionPage", mainEntity: { "@type": "ItemList", itemListElement: links.map((item: any, i: number) => ({ "@type": "ListItem", position: i + 1, url: SITE_URL + item.path, name: item.name })) } };
  } else if (path === "/about") {
    const content = HOW_IT_WORKS;
    page.body = `<main class="seo-prerender"><h1>${escapeHtml(content.title)}</h1><p>${escapeHtml(content.intro)}</p><p>${escapeHtml(content.description)}</p><p><a href="/shows">Explore shows</a> · <a href="/artists">Find an artist</a></p>${content.steps.map(step => `<section><h2>${escapeHtml(step.title)}</h2><p>${escapeHtml(step.description)}</p><a href="${step.href}">${escapeHtml(step.link)}</a></section>`).join("")}<section><h2>Good to know</h2>${content.questions.map(question => `<h3>${escapeHtml(question.title)}</h3><p>${escapeHtml(question.answer)}</p>`).join("")}</section><section><h2>${escapeHtml(content.artistsTitle)}</h2><p>${escapeHtml(content.artistsDescription)}</p><a href="/for-artists">For artists and teams</a></section><p>${escapeHtml(content.sources)}</p></main>`;
  } else if (path === "/blog") {
    const posts = await fetchPublishedBlog();
    page.body = page.body.replace("</main>", `<ul>${posts.map((post: any) => link(`/blog/${encodeURIComponent(post.slug.current)}`, post.title)).join("")}</ul></main>`);
    page.jsonLd = { "@type": "Blog", name: page.title, url: page.canonical };
  }
  return finish(graphPage(page, path === "/" ? [] : [{ name: "Home", path: "/" }, { name: page.title.split(" | ")[0], path }]));
}
