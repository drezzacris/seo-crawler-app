import { parseStringPromise } from "xml2js";

export async function getSitemapUrls(startUrl) {
  const origin = new URL(startUrl).origin;
  const sitemapUrls = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`
  ];

  const urls = new Set();

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await fetch(sitemapUrl);

      if (!response.ok) continue;

      const xml = await response.text();
      const parsed = await parseStringPromise(xml);

      if (parsed.urlset?.url) {
        parsed.urlset.url.forEach(item => {
          if (item.loc?.[0]) urls.add(item.loc[0]);
        });
      }

      if (parsed.sitemapindex?.sitemap) {
        for (const sitemap of parsed.sitemapindex.sitemap) {
          const childUrl = sitemap.loc?.[0];
          if (!childUrl) continue;

          const childResponse = await fetch(childUrl);
          if (!childResponse.ok) continue;

          const childXml = await childResponse.text();
          const childParsed = await parseStringPromise(childXml);

          if (childParsed.urlset?.url) {
            childParsed.urlset.url.forEach(item => {
              if (item.loc?.[0]) urls.add(item.loc[0]);
            });
          }
        }
      }
    } catch {
      continue;
    }
  }

  return Array.from(urls);
}