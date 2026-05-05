import * as cheerio from "cheerio";

export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function isInternalUrl(url, baseHostname) {
  try {
    return new URL(url).hostname === baseHostname;
  } catch {
    return false;
  }
}

function getUrlDepth(url) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).length;
  } catch {
    return 0;
  }
}

function getPageSizeKb(html) {
  return Buffer.byteLength(html || "", "utf8") / 1024;
}

function auditUrlStructure(url) {
  const issues = [];

  const parsed = new URL(url);
  const pathname = parsed.pathname;

  if (pathname.length > 115) {
    issues.push("URL muito longa");
  }

  if (/[A-Z]/.test(pathname)) {
    issues.push("URL contém letras maiúsculas");
  }

  if (pathname.includes("_")) {
    issues.push("URL contém underscore");
  }

  if (pathname.split("/").filter(Boolean).length > 4) {
    issues.push("URL com profundidade alta");
  }

  if (parsed.search) {
    issues.push("URL contém parâmetros");
  }

  return issues;
}

export function extractAndAuditPage({
  url,
  html,
  status,
  finalUrl,
  contentType,
  responseTimeMs,
  baseHostname,
  sitemapUrls = [],
  redirectInfo = {}
}) {
  const $ = cheerio.load(html || "");

  const title = $("title").first().text().trim();
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || "";
  const canonicalRaw = $('link[rel="canonical"]').attr("href") || "";
  const robotsMeta = $('meta[name="robots"]').attr("content") || "";

  const h1 = $("h1").map((_, el) => $(el).text().trim()).get();
  const h2 = $("h2").map((_, el) => $(el).text().trim()).get();

  const canonical = canonicalRaw
    ? normalizeUrl(new URL(canonicalRaw, url).href)
    : "";

  const urlNormalized = normalizeUrl(url);

  const links = $("a[href]").map((_, el) => {
    const href = $(el).attr("href");
    const anchor = $(el).text().trim();

    try {
      const absolute = normalizeUrl(new URL(href, url).href);

      return {
        href: absolute,
        anchor,
        internal: isInternalUrl(absolute, baseHostname)
      };
    } catch {
      return null;
    }
  }).get().filter(Boolean);

  const images = $("img").map((_, el) => {
    const src = $(el).attr("src") || "";
    const alt = $(el).attr("alt") || "";

    return {
      src,
      alt,
      hasAlt: Boolean(alt.trim())
    };
  }).get();

  const hreflangs = $('link[rel="alternate"][hreflang]').map((_, el) => ({
    hreflang: $(el).attr("hreflang"),
    href: $(el).attr("href")
  })).get();

  const jsonLd = $('script[type="application/ld+json"]').map((_, el) => {
    const raw = $(el).text();

    try {
      return JSON.parse(raw);
    } catch {
      return {
        invalidJsonLd: true,
        raw
      };
    }
  }).get();

  const prevLink = $('link[rel="prev"]').attr("href") || "";
  const nextLink = $('link[rel="next"]').attr("href") || "";

  const pageSizeKb = getPageSizeKb(html);
  const issues = [];

  if (status >= 400) issues.push("Página com erro HTTP 4xx/5xx");
  if (!title) issues.push("Title ausente");
  if (title && title.length < 30) issues.push("Title muito curto");
  if (title && title.length > 60) issues.push("Title muito longo");

  if (!metaDescription) issues.push("Meta description ausente");
  if (metaDescription && metaDescription.length < 70) issues.push("Meta description muito curta");
  if (metaDescription && metaDescription.length > 160) issues.push("Meta description muito longa");

  if (!canonical) issues.push("Canonical ausente");
  if (canonical && canonical !== urlNormalized) issues.push("Canonical diferente da URL crawleada");

  if (robotsMeta.toLowerCase().includes("noindex")) issues.push("Página com noindex");
  if (robotsMeta.toLowerCase().includes("nofollow")) issues.push("Página com nofollow");

  if (h1.length === 0) issues.push("H1 ausente");
  if (h1.length > 1) issues.push("Mais de um H1");

  const imagesWithoutAlt = images.filter(img => !img.hasAlt).length;
  if (imagesWithoutAlt > 0) issues.push(`${imagesWithoutAlt} imagem(ns) sem ALT`);

  if (hreflangs.length > 0) {
    const hasXDefault = hreflangs.some(item => item.hreflang === "x-default");
    if (!hasXDefault) issues.push("Hreflang sem x-default");
  }

  const invalidSchema = jsonLd.filter(item => item.invalidJsonLd).length;
  if (invalidSchema > 0) issues.push("Schema JSON-LD inválido");

  if (jsonLd.length === 0) issues.push("Schema JSON-LD ausente");

  if (pageSizeKb > 2048) {
    issues.push("HTML acima de 2MB");
  }

  if (prevLink || nextLink) {
    if (!canonical) issues.push("Página paginada sem canonical");
  }

  if (sitemapUrls.length && !sitemapUrls.includes(url)) {
    issues.push("URL não encontrada no sitemap");
  }

  issues.push(...auditUrlStructure(url));

  if (redirectInfo.hasRedirectChain) issues.push("Redirect chain detectado");
  if (redirectInfo.hasRedirectLoop) issues.push("Redirect loop detectado");

  return {
    url,
    finalUrl,
    status,
    contentType,
    responseTimeMs,
    pageSizeKb: Number(pageSizeKb.toFixed(2)),

    title,
    titleLength: title.length,
    metaDescription,
    metaDescriptionLength: metaDescription.length,

    canonical,
    canonicalMatchesUrl: canonical === urlNormalized,

    robotsMeta,
    isNoindex: robotsMeta.toLowerCase().includes("noindex"),

    h1,
    h1Count: h1.length,
    h2,
    h2Count: h2.length,

    imageCount: images.length,
    imagesWithoutAlt,

    internalLinksCount: links.filter(link => link.internal).length,
    externalLinksCount: links.filter(link => !link.internal).length,
    links,

    hreflangCount: hreflangs.length,
    hreflangs,

    schemaCount: jsonLd.length,
    hasInvalidSchema: invalidSchema > 0,

    prevLink,
    nextLink,
    hasPaginationTags: Boolean(prevLink || nextLink),

    depth: getUrlDepth(url),

    ...redirectInfo,

    issues: [...new Set(issues)]
  };
}