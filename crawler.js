import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { getRobotsTxt } from "./robots.js";
import { getSitemapUrls } from "./sitemap.js";
import { checkRedirectChain } from "./redirects.js";
import { extractAndAuditPage, normalizeUrl, isInternalUrl } from "./audit.js";

async function fetchHtml(url, userAgent) {
  const start = Date.now();

  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": userAgent
    }
  });

  const contentType = response.headers.get("content-type") || "";

  const html = contentType.includes("text/html")
    ? await response.text()
    : "";

  return {
    html,
    status: response.status,
    finalUrl: response.url,
    contentType,
    responseTimeMs: Date.now() - start,
    rendered: false
  };
}

async function checkBrokenLinks(links, userAgent) {
  const limitedLinks = links.slice(0, 20);
  const results = [];

  for (const link of limitedLinks) {
    try {
      const response = await fetch(link.href, {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent": userAgent
        }
      });

      if (response.status >= 400) {
        results.push({
          href: link.href,
          status: response.status,
          internal: link.internal
        });
      }
    } catch {
      results.push({
        href: link.href,
        status: "ERROR",
        internal: link.internal
      });
    }
  }

  return results;
}

export async function runCrawler({
  startUrl,
  maxPages = 50,
  concurrency = 1,
  renderJs = false,
  respectRobots = true,
  includeSitemap = true
}) {
  const userAgent =
    process.env.CRAWLER_USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

  const start = normalizeUrl(startUrl);

  if (!start) {
    throw new Error("URL inicial inválida.");
  }

  const baseHostname = new URL(start).hostname;

  const robots = respectRobots
    ? await getRobotsTxt(start, userAgent)
    : null;

  const sitemapUrls = includeSitemap
    ? await getSitemapUrls(start)
    : [];

  const visited = new Set();
  const queue = [start, ...sitemapUrls.slice(0, maxPages)];
  const results = [];
  const limit = pLimit(concurrency);

  while (queue.length > 0 && visited.size < maxPages) {
    const batch = [];

    while (
      queue.length > 0 &&
      batch.length < concurrency &&
      visited.size + batch.length < maxPages
    ) {
      const nextUrl = normalizeUrl(queue.shift());

      if (!nextUrl || visited.has(nextUrl)) continue;

      if (robots && !robots.isAllowed(nextUrl, userAgent)) {
        visited.add(nextUrl);

        results.push({
          url: nextUrl,
          status: "BLOCKED_BY_ROBOTS",
          issues: ["Bloqueada pelo robots.txt"]
        });

        continue;
      }

      visited.add(nextUrl);

      batch.push(
        limit(async () => {
          try {
            const redirectInfo = await checkRedirectChain(nextUrl, userAgent);

            let page;

            if (renderJs) {
              const { renderWithExternalService } = await import("./externalRenderer.js");
              page = await renderWithExternalService(nextUrl);
            } else {
              page = await fetchHtml(nextUrl, userAgent);
            }

            const data = extractAndAuditPage({
              url: nextUrl,
              ...page,
              baseHostname,
              sitemapUrls,
              redirectInfo
            });

            if (!Array.isArray(data.issues)) {
              data.issues = [];
            }

            const htmlLower = (page.html || "").toLowerCase();

            if (
              htmlLower.includes("verifying your browser") ||
              htmlLower.includes("checking your browser") ||
              htmlLower.includes("cloudflare") ||
              htmlLower.includes("cf-browser-verification")
            ) {
              data.issues.push("Possível bloqueio anti-bot / Cloudflare");
            }

            data.brokenLinks = await checkBrokenLinks(data.links || [], userAgent);
            data.brokenLinksCount = data.brokenLinks.length;

            if (data.brokenLinksCount > 0) {
              data.issues.push(`${data.brokenLinksCount} link(s) quebrado(s)`);
            }

            results.push(data);

            const $ = cheerio.load(page.html || "");

            $("a[href]").each((_, el) => {
              const href = $(el).attr("href");

              try {
                const absolute = normalizeUrl(new URL(href, nextUrl).href);

                if (
                  absolute &&
                  isInternalUrl(absolute, baseHostname) &&
                  !visited.has(absolute) &&
                  !queue.includes(absolute) &&
                  !absolute.includes("mailto:") &&
                  !absolute.includes("tel:")
                ) {
                  queue.push(absolute);
                }
              } catch {
                // Ignora links inválidos
              }
            });
          } catch (error) {
            results.push({
              url: nextUrl,
              status: "ERROR",
              error: error.message,
              issues: [`Erro ao acessar ou processar a URL: ${error.message}`]
            });
          }
        })
      );
    }

    await Promise.all(batch);
  }

  return results;
}
