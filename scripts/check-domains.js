#!/usr/bin/env node

// Simple RDAP-based domain availability checker for .com and .ai
// - 200 OK => registered (unavailable)
// - 404 Not Found => not registered (available)
// - other/failed => unknown (treated as unavailable)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const INPUT_MD = resolve(process.cwd(), "DOMAIN_IDEAS.md");

function extractDomainsFromMarkdown(markdownText) {
  const domainRegex = /\b([a-z0-9-]+\.(com|ai))\b/gi;
  const lines = markdownText.split(/\r?\n/);
  const domains = [];
  for (const line of lines) {
    const match = line.match(domainRegex);
    if (match) {
      for (const m of match) {
        domains.push(m.toLowerCase());
      }
    }
  }
  // Deduplicate while preserving order
  const seen = new Set();
  const unique = [];
  for (const d of domains) {
    if (!seen.has(d)) {
      seen.add(d);
      unique.push(d);
    }
  }
  return unique;
}

function rdapUrlForDomain(domain) {
  const tld = domain.split(".").pop();
  switch (tld) {
    case "com":
      return `https://rdap.verisign.com/com/v1/domain/${domain}`;
    case "ai":
      return `https://rdap.nic.ai/domain/${domain}`;
    default:
      return null;
  }
}

async function checkDomainAvailability(domain) {
  const url = rdapUrlForDomain(domain);
  if (!url) {
    return { domain, status: "unsupported" };
  }
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/rdap+json, application/json;q=0.9, */*;q=0.1",
        "User-Agent": "domain-checker/1.0 (+https://example.local)"
      }
    });
    if (res.status === 404) {
      return { domain, status: "available" };
    }
    if (res.ok) {
      return { domain, status: "registered" };
    }
    // Handle known RDAP error shapes
    return { domain, status: `unknown_${res.status}` };
  } catch (error) {
    return { domain, status: "error", error: String(error) };
  }
}

async function run() {
  const md = readFileSync(INPUT_MD, "utf8");
  const domains = extractDomainsFromMarkdown(md);
  if (domains.length === 0) {
    console.error("No domains found in DOMAIN_IDEAS.md");
    process.exit(1);
  }

  // Limit concurrency to avoid hammering RDAP servers
  const concurrency = 6;
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < domains.length) {
      const myIndex = idx++;
      const domain = domains[myIndex];
      const r = await checkDomainAvailability(domain);
      results[myIndex] = r;
      const hint = r.status === "available" ? "✅" : r.status === "registered" ? "❌" : "⚠️";
      console.log(`${hint} ${domain} -> ${r.status}`);
      // Be polite between requests
      await new Promise((res) => setTimeout(res, 120));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const available = results
    .filter(Boolean)
    .filter((r) => r.status === "available")
    .map((r) => r.domain);

  // Update the markdown to only include available domains
  const headerMatch = md.match(/^##[\s\S]*?(?=\n-\s|$)/);
  const header = headerMatch ? headerMatch[0].trim() : "## Available domain ideas";
  const newBody = [header, "", ...available.map((d) => `- ${d}`), ""].join("\n");
  writeFileSync(INPUT_MD, newBody, "utf8");

  // Also emit a machine-readable JSON report next to the MD
  const report = {
    checkedAt: new Date().toISOString(),
    totals: {
      input: domains.length,
      available: available.length,
      registered: results.filter((r) => r && r.status === "registered").length,
      unknown: results.filter((r) => r && !["available", "registered"].includes(r.status)).length,
    },
    results,
  };
  writeFileSync(resolve(process.cwd(), "DOMAIN_IDEAS.report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log("\nSummary:")
  console.log(JSON.stringify(report.totals, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

