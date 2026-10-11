import "dotenv/config";

const endpoint = process.env.ERXES_ENDPOINT ?? "";
const token = process.env.ERXES_APP_TOKEN ?? "";

if (!endpoint || !token) {
  throw new Error("ERXES_ENDPOINT and ERXES_APP_TOKEN must be set");
}

const query = `
  query Verify($language: String) {
    pages: cpPages(language: $language) { _id name slug status }
    posts: cpPosts(language: $language, status: published) { _id title slug }
    header: cpCmsMenuList(language: $language, kind: "header") { _id label url order }
    footer: cpCmsMenuList(language: $language, kind: "footer") { _id label url order }
  }
`;

async function verify(language: string) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-token": token,
    },
    body: JSON.stringify({ query, variables: { language } }),
  });
  const json = await res.json() as {
    data?: {
      pages?: { _id: string; name?: string; slug?: string; status?: string }[];
      posts?: { _id: string; title?: string; slug?: string }[];
      header?: { _id: string; label?: string; url?: string; order?: number }[];
      footer?: { _id: string; label?: string; url?: string; order?: number }[];
    };
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    console.error(`Errors for ${language}:`, json.errors);
    return;
  }
  const { pages, posts, header, footer } = json.data ?? {};
  console.log(`\n=== ${language} ===`);
  console.log(`pages: ${pages?.length ?? 0}`);
  console.log(`posts: ${posts?.length ?? 0}`);
  console.log(`header: ${header?.length ?? 0}`);
  console.log(`footer: ${footer?.length ?? 0}`);
  console.log("page slugs:", pages?.map((p) => p.slug).join(", "));
  console.log("post slugs:", posts?.map((p) => p.slug).join(", "));
  console.log("header labels:", header?.map((m) => m.label).join(", "));
  console.log("footer labels:", footer?.map((m) => m.label).join(", "));
}

async function main() {
  await verify("mn");
  await verify("en");
}

main();
