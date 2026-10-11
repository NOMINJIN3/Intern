/**
 * Browser-based website extraction using Playwright.
 * Renders JavaScript, discovers internal pages, and exports structured data.
 *
 * Usage:
 *   tsx scripts/extract-site.ts <url> [output.json] [options]
 *
 * Options:
 *   --max-pages=24       Limit pages extracted
 *   --wait=2000          Milliseconds to wait after page load
 *   --include-images     Extract image src/alt/width/height
 *   --headless=false     Run with visible browser window
 *
 * Example:
 *   tsx scripts/extract-site.ts https://example.com output/example.json --max-pages=50 --include-images
 */
import "dotenv/config";
import { extractSite } from "../lib/extract-site.js";

function parseArgs(argv: string[]): {
  url: string;
  output: string | undefined;
  maxPages: number;
  waitMs: number;
  includeImages: boolean;
  headless: boolean;
} {
  const positional: string[] = [];
  let maxPages = 24;
  let waitMs = 2000;
  let includeImages = false;
  let headless = true;

  for (const arg of argv) {
    if (arg.startsWith("--max-pages=")) {
      maxPages = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--wait=")) {
      waitMs = Number(arg.split("=")[1]);
    } else if (arg === "--include-images") {
      includeImages = true;
    } else if (arg === "--headless=false") {
      headless = false;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  const url = positional[0];
  const output = positional[1];

  if (!url) {
    console.error("Usage: tsx scripts/extract-site.ts <url> [output.json] [options]");
    process.exit(1);
  }

  return { url, output, maxPages, waitMs, includeImages, headless };
}

async function main(): Promise<void> {
  const { url, output, maxPages, waitMs, includeImages, headless } = parseArgs(process.argv.slice(2));

  console.log(`→ [extract-site] Starting extraction of ${url}`);
  console.log(`   maxPages=${maxPages}, wait=${waitMs}ms, images=${includeImages}, headless=${headless}`);

  const result = await extractSite({
    startUrl: url,
    outputPath: output,
    maxPages,
    waitMs,
    includeImages,
    headless,
  });

  console.log(`→ [extract-site] Extracted ${result.pages.length} page(s) from ${result.site}`);
  if (output) console.log(`→ [extract-site] Wrote ${output}`);
  if (result.skipped_pages.length > 0) {
    console.log(`→ [extract-site] Skipped ${result.skipped_pages.length} page(s)`);
  }
  for (const page of result.pages) {
    console.log(`  ✓ ${page.pathname} (${page.headings.length} headings, ${page.paragraphs.length} paragraphs)`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`extract-site failed: ${message}`);
  process.exit(1);
});
