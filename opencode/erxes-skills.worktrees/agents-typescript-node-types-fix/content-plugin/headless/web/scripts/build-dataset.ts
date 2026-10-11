import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";

interface Multilingual {
  en: string;
  mn: string;
}

interface Accommodation {
  id: string;
  order: number;
  type: string;
  location_code: Multilingual;
  location: Multilingual;
  name: Multilingual;
  description: Multilingual;
  price: Multilingual;
  cta_label: Multilingual;
}

interface Page {
  url: string;
  pathname: string;
  title: string | null;
  description: string | null;
  html_lang: string | null;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  links: { url: string; label: string }[];
  images: { src: string; alt: string; width: number | null; height: number | null }[];
  emails: string[];
  phones: string[];
}

interface SiteResult {
  site: string;
  start_url: string;
  extracted_at: string;
  pages: Page[];
  discovered_pages: string[];
  skipped_pages: string[];
}

interface Dataset {
  site_meta: {
    site: string;
    start_url: string;
    extracted_at: string;
    languages: string[];
    total_pages: number;
    total_discovered: number;
    total_skipped: number;
  };
  pages: Page[];
  accommodations: {
    page_title: Multilingual;
    page_path: string;
    items: Accommodation[];
  };
  images: { src: string; alt: string; pages: string[] }[];
  navigation: { url: string; label: string; source: string }[];
}

const accommodations: Accommodation[] = [
  {
    id: "silk-road-resort",
    order: 1,
    type: "resort",
    location_code: { mn: "01 · Төв аймаг", en: "01 · Tuv Province" },
    location: { mn: "Төв аймаг", en: "Tuv Province" },
    name: { mn: "Silk road resort", en: "Silk Road Resort" },
    description: {
      mn: "Торгоны замын өвөрмөц сунсийг мэдрүүлэх, тансаг зэрэглэлийн 45 гэрээс бүрдсэн амралтын газар.",
      en: "A luxury resort made up of 45 gers that lets you feel the unique spirit of the Silk Road.",
    },
    price: { mn: "₮250,000 / шөнө", en: "From ₮250,000 per night" },
    cta_label: { mn: "Захиалах", en: "Book now" },
  },
  {
    id: "mongolian-secret-history-camp",
    order: 2,
    type: "ger-camp",
    location_code: { mn: "02 · Хэнтий аймаг", en: "02 · Khentii Province" },
    location: { mn: "Хэнтий аймаг", en: "Khentii Province" },
    name: { mn: "Mongolian secret history camp", en: "Mongolian Secret History Camp" },
    description: {
      mn: "Намрын алтан ойн дунд байрлах уламжлалт гэр бааз, түүхэн газруудад ойрхон.",
      en: "A traditional ger camp set among golden autumn forests, close to historical sites.",
    },
    price: { mn: "₮180,000 / шөнө", en: "From ₮180,000 per night" },
    cta_label: { mn: "Захиалах", en: "Book now" },
  },
  {
    id: "secret-of-ongi-tourist-camp",
    order: 3,
    type: "ger-camp",
    location_code: { mn: "03 · Өвөрхангай аймаг", en: "03 · Ovorkhangai Province" },
    location: { mn: "Өвөрхангай аймаг", en: "Ovorkhangai Province" },
    name: { mn: "Secret of Ongi tourist camp", en: "Secret of Ongi Tourist Camp" },
    description: {
      mn: "Од харах шөнийн тэнгэрийн дор амрах, тайван бүх орчинтой гэрийн бааз.",
      en: "A peaceful ger camp where you can rest under a star-filled night sky.",
    },
    price: { mn: "₮160,000 / шөнө", en: "From ₮160,000 per night" },
    cta_label: { mn: "Захиалах", en: "Book now" },
  },
  {
    id: "msh-restaurant",
    order: 4,
    type: "restaurant",
    location_code: { mn: "04 · Ресторан", en: "04 · Restaurant" },
    location: { mn: "Ресторан", en: "Restaurant" },
    name: { mn: "MSH restaurant", en: "MSH Restaurant" },
    description: {
      mn: "Уламжлалт болон орчин үеийн Монгол хоолыг тансаг орчинд амталж үзээрэй.",
      en: "Enjoy traditional and modern Mongolian cuisine in an elegant setting.",
    },
    price: { mn: "Ширээ захиалгаар", en: "Table reservation" },
    cta_label: { mn: "Захиалах", en: "Reserve a table" },
  },
];

async function main() {
  const rawPath = process.argv[2] || "/tmp/msh-extract-raw.json";
  const outputPath = process.argv[3] || "/tmp/msh-dataset.json";

  const rawJson = await readFile(rawPath, "utf-8");
  const raw: SiteResult = JSON.parse(rawJson);

  const pageIndex = raw.pages.findIndex((p) => p.pathname === "/en/accommadotion");
  if (pageIndex >= 0) {
    raw.pages[pageIndex].headings = [
      { level: 1, text: "Accommodation" },
      ...accommodations.map((a) => ({ level: 2, text: a.name.en })),
    ];
    raw.pages[pageIndex].paragraphs = accommodations.flatMap((a) => [a.description.en, a.price.en]);
  } else {
    raw.pages.push({
      url: "https://mongoliansecrethistory.mn/en/accommadotion",
      pathname: "/en/accommadotion",
      title: "Accommodation",
      description: "Accommodation options at Mongolian Secret History",
      html_lang: "en",
      headings: [{ level: 1, text: "Accommodation" }, ...accommodations.map((a) => ({ level: 2, text: a.name.en }))],
      paragraphs: accommodations.flatMap((a) => [a.description.en, a.price.en]),
      links: [],
      images: [],
      emails: [],
      phones: [],
    });
  }

  const allImages = raw.pages.flatMap((page) =>
    page.images.map((img) => ({ ...img, page: page.pathname }))
  );

  const imageMap = new Map<string, { src: string; alt: string; pages: string[] }>();
  for (const img of allImages) {
    const existing = imageMap.get(img.src);
    if (existing) {
      if (!existing.pages.includes(img.page)) existing.pages.push(img.page);
    } else {
      imageMap.set(img.src, { src: img.src, alt: img.alt, pages: [img.page] });
    }
  }

  const navLinks = new Map<string, { url: string; label: string; sources: Set<string> }>();
  for (const page of raw.pages) {
    for (const link of page.links) {
      const key = link.url;
      const existing = navLinks.get(key);
      if (existing) {
        existing.sources.add(page.pathname);
      } else {
        navLinks.set(key, { url: link.url, label: link.label, sources: new Set([page.pathname]) });
      }
    }
  }

  const navigation = [...navLinks.values()]
    .filter((l) => l.label.length <= 60)
    .map((l) => ({ url: l.url, label: l.label, source: [...l.sources][0] }));

  const dataset: Dataset = {
    site_meta: {
      site: raw.site,
      start_url: raw.start_url,
      extracted_at: raw.extracted_at,
      languages: ["en", "mn"],
      total_pages: raw.pages.length,
      total_discovered: raw.discovered_pages.length,
      total_skipped: raw.skipped_pages.length,
    },
    pages: raw.pages,
    accommodations: {
      page_title: { mn: "Байрлах газрууд", en: "Accommodation" },
      page_path: "/en/accommadotion",
      items: accommodations,
    },
    images: [...imageMap.values()],
    navigation,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf-8");

  console.log(`→ Dataset written to ${outputPath}`);
  console.log(`  Pages: ${dataset.pages.length}`);
  console.log(`  Accommodations: ${dataset.accommodations.items.length}`);
  console.log(`  Images: ${dataset.images.length}`);
  console.log(`  Navigation links: ${dataset.navigation.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
