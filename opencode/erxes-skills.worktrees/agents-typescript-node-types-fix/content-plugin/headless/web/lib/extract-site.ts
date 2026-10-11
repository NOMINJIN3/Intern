import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import { chromium, type Page } from "playwright";

export interface ExtractedImage {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface ExtractedPage {
  url: string;
  pathname: string;
  title: string | null;
  description: string | null;
  html_lang: string | null;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  links: { url: string; label: string }[];
  images: ExtractedImage[];
  emails: string[];
  phones: string[];
}

export interface ExtractSiteOptions {
  startUrl: string;
  outputPath?: string;
  maxPages?: number;
  waitMs?: number;
  includeImages?: boolean;
  headless?: boolean;
}

export interface ExtractSiteResult {
  site: string;
  start_url: string;
  extracted_at: string;
  pages: ExtractedPage[];
  discovered_pages: string[];
  skipped_pages: string[];
}

const SKIP_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".pdf", ".zip",
  ".xml", ".json", ".ico", ".mp4", ".mp3", ".woff", ".woff2",
];

const SKIP_PATH_PARTS = [
  "login", "signin", "sign-up", "signup", "register", "account",
  "admin", "checkout", "cart", "search", "tag", "author", "wp-admin",
];

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normaliseHref(baseUrl: URL, href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  if (/^(mailto|tel|javascript):/i.test(trimmed)) return null;

  try {
    const resolved = new URL(trimmed, baseUrl);
    resolved.hash = "";
    resolved.search = "";
    if (resolved.origin !== baseUrl.origin) return null;
    if (SKIP_EXTENSIONS.some((ext) => resolved.pathname.toLowerCase().endsWith(ext))) return null;
    if (SKIP_PATH_PARTS.some((part) => resolved.pathname.toLowerCase().includes(`/${part}`))) return null;
    return resolved.toString().replace(/\/+$/, "") || resolved.origin;
  } catch {
    return null;
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function extractContacts(text: string): { emails: string[]; phones: string[] } {
  const emails = unique([...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m) => m[0]));
  const phones = unique(
    [...text.matchAll(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{2,4}[\s-]?\d{2,4}(?:[\s-]?\d{2,4})?/g)]
      .map((m) => m[0].replace(/\s+/g, " ").trim())
      .filter((v) => {
        const digits = v.replace(/\D/g, "");
        return digits.length >= 7 && digits.length <= 12;
      })
  );
  return { emails, phones };
}

async function extractPage(page: Page, url: string, includeImages: boolean): Promise<ExtractedPage> {
  const baseUrl = new URL(url);

  const title = await page.locator("title").first().textContent().catch(() => null);
  const description = await page
    .locator('meta[name="description"]')
    .getAttribute("content")
    .catch(() => null);
  const htmlLang = await page.locator("html").getAttribute("lang").catch(() => null);

  const headings = await page.$$eval("h1, h2, h3, h4, h5, h6", (els) =>
    els.map((el) => ({ level: Number(el.tagName[1]), text: el.textContent?.replace(/\s+/g, " ").trim() || "" })).filter((h) => h.text)
  );

  const paragraphs = await page.$$eval("p, li", (els) =>
    els.map((el) => el.textContent?.replace(/\s+/g, " ").trim() || "").filter((t) => t.length >= 20 && t.length <= 600)
  );

  const rawLinks: { url: string; label: string }[] = await page.$$eval("a", (els, base) =>
    els
      .map((el) => ({
        url: el.getAttribute("href") || "",
        label: el.textContent?.replace(/\s+/g, " ").trim() || "",
      }))
      .filter((l) => l.url && l.label)
      .map((l) => ({ ...l, url: new URL(l.url, base).toString() }))
  , baseUrl.toString());

  const links = unique(
    rawLinks
      .map((l) => ({ ...l, url: normaliseHref(baseUrl, l.url) }))
      .filter((l): l is { url: string; label: string } => Boolean(l.url))
  );

  let images: ExtractedImage[] = [];
  if (includeImages) {
    images = await page.$$eval("img", (els) =>
      els.map((el) => ({
        src: el.getAttribute("src") || "",
        alt: el.getAttribute("alt") || "",
        width: el.naturalWidth || null,
        height: el.naturalHeight || null,
      })).filter((img) => img.src)
    );
  }

  const bodyText = (await page.locator("body").textContent().catch(() => "")) ?? "";
  const { emails, phones } = extractContacts(bodyText);

  return {
    url: baseUrl.toString().replace(/\/+$/, "") || baseUrl.origin,
    pathname: baseUrl.pathname || "/",
    title: title ? cleanText(title) : null,
    description: description ? cleanText(description) : null,
    html_lang: htmlLang,
    headings,
    paragraphs: unique(paragraphs).slice(0, 48),
    links: links.slice(0, 80),
    images: images.slice(0, 40),
    emails: emails.slice(0, 8),
    phones: phones.slice(0, 8),
  };
}

async function fetchSitemapUrls(baseUrl: URL): Promise<string[]> {
  const candidates = [new URL("/sitemap.xml", baseUrl).toString(), new URL("/sitemap_index.xml", baseUrl).toString()];
  const urls: string[] = [];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { headers: { "user-agent": "erxes-extract/1.0" } });
      if (!response.ok) continue;
      const xml = await response.text();
      const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/gi)].map((m) => m[1]?.trim()).filter(Boolean) as string[];
      urls.push(...locs.map((loc) => normaliseHref(baseUrl, loc)).filter((u): u is string => Boolean(u)));
    } catch {
      continue;
    }
  }

  return unique(urls);
}

export async function extractSite(options: ExtractSiteOptions): Promise<ExtractSiteResult> {
  const baseUrl = new URL(options.startUrl);
  const maxPages = options.maxPages ?? 24;
  const waitMs = options.waitMs ?? 2000;
  const includeImages = options.includeImages ?? false;
  const headless = options.headless ?? true;

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ userAgent: "erxes-extract/1.0" });
  const page = await context.newPage();

  const queue: string[] = [baseUrl.toString().replace(/\/+$/, "") || baseUrl.origin];
  const sitemapUrls = await fetchSitemapUrls(baseUrl);
  for (const url of sitemapUrls) {
    if (!queue.includes(url)) queue.push(url);
  }

  const visited = new Set<string>();
  const skipped = new Set<string>();
  const pages: ExtractedPage[] = [];

  try {
    while (queue.length > 0 && pages.length < maxPages) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      try {
        await page.goto(current, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(waitMs);

        const extracted = await extractPage(page, current, includeImages);
        pages.push(extracted);

        for (const link of extracted.links) {
          if (!visited.has(link.url) && !queue.includes(link.url)) {
            queue.push(link.url);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        skipped.add(`${current}: ${message}`);
      }
    }
  } finally {
    await browser.close();
  }

  const result: ExtractSiteResult = {
    site: baseUrl.hostname,
    start_url: baseUrl.toString(),
    extracted_at: new Date().toISOString(),
    pages,
    discovered_pages: unique(pages.flatMap((p) => p.links.map((l) => l.url))),
    skipped_pages: [...skipped],
  };

  if (options.outputPath) {
    await mkdir(dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
  }

  return result;
}
