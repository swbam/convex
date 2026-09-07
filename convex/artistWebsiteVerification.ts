"use node";

import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 7_000;

function isBlockedIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) return true;
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}
function isBlockedAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  const version = isIP(normalized);
  if (version === 4) return isBlockedIpv4(normalized);
  if (version !== 6) return true;

  if (normalized.startsWith("::ffff:")) {
    return isBlockedIpv4(normalized.slice("::ffff:".length));
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
}

async function resolvePublicAddress(hostname: string) {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Private hosts are not allowed");
  }
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error("Private network addresses are not allowed");
    return { address: hostname, family: isIP(hostname) as 4 | 6 };
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  const publicAddress = addresses.find((entry) => !isBlockedAddress(entry.address));
  if (!publicAddress || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error("The website resolves to a private or reserved network");
  }
  return publicAddress;
}

function validateUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("The official website must use HTTPS");
  if (url.username || url.password) throw new Error("Website credentials are not allowed");
  if (url.port && url.port !== "443") throw new Error("Only the standard HTTPS port is allowed");
  return url;
}

async function fetchPinned(url: URL): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}> {
  const resolved = await resolvePublicAddress(url.hostname);
  return await new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "setlists.live verification bot/1.0",
          Accept: "text/html,text/plain;q=0.9",
        },
        lookup: (_hostname, _options, callback) =>
          callback(null, resolved.address, resolved.family),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) {
            req.destroy(new Error("Website response is too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error("Website request timed out")));
    req.on("error", reject);
    req.end();
  });
}

async function fetchVerificationPage(value: string) {
  let current = validateUrl(value);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetchPinned(current);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location;
      if (!location || Array.isArray(location)) throw new Error("Website returned an invalid redirect");
      if (redirectCount === MAX_REDIRECTS) throw new Error("Website redirected too many times");
      current = validateUrl(new URL(location, current).toString());
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      return { ok: false as const, status: response.status, finalUrl: current.toString() };
    }
    const contentType = String(response.headers["content-type"] || "").toLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("Website did not return an HTML page");
    }
    return { ok: true as const, html: response.body, finalUrl: current.toString() };
  }
  throw new Error("Website redirected too many times");
}

export const fetchPage = internalAction({
  args: { websiteUrl: v.string() },
  returns: v.object({
    ok: v.boolean(),
    html: v.optional(v.string()),
    finalUrl: v.optional(v.string()),
    status: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    try {
      return await fetchVerificationPage(args.websiteUrl);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Website could not be checked",
      };
    }
  },
});
