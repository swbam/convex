import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(file);
    return file.endsWith(".md") ? [file] : [];
  });
}

function markdown(file) {
  return readFileSync(file, "utf8").replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, "");
}

function anchors(file) {
  const headings = new Set();
  for (const [, title] of markdown(file).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
    let id = slug;
    for (let i = 1; headings.has(id); i++) id = slug + "-" + i;
    headings.add(id);
  }
  return headings;
}

const files = ["README.md", ...markdownFiles("docs")];
const errors = [];
for (const file of files) {
  for (const [, link] of markdown(file).matchAll(/\]\(([^\s)]+)\)/g)) {
    if (/^[\w+.-]+:|^\/\//.test(link)) continue;
    const [name, fragment] = link.split("#");
    const target = name ? path.resolve(path.dirname(file), decodeURIComponent(name)) : file;
    if (!existsSync(target)) errors.push(file + " links to missing file " + link);
    else if (fragment && target.endsWith(".md") && !anchors(target).has(decodeURIComponent(fragment))) {
      errors.push(file + " links to missing heading " + link);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Checked local links and headings in " + files.length + " documentation files.");
}
