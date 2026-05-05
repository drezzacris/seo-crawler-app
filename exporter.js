import { Parser } from "json2csv";

export function exportToCSV(data) {
  const fields = [
    "url",
    "finalUrl",
    "status",
    "responseTimeMs",
    "pageSizeKb",
    "title",
    "titleLength",
    "metaDescription",
    "metaDescriptionLength",
    "canonical",
    "canonicalMatchesUrl",
    "robotsMeta",
    "isNoindex",
    "h1Count",
    "h2Count",
    "imageCount",
    "imagesWithoutAlt",
    "internalLinksCount",
    "externalLinksCount",
    "hreflangCount",
    "schemaCount",
    "hasInvalidSchema",
    "hasPaginationTags",
    "redirectChainLength",
    "hasRedirectChain",
    "hasRedirectLoop",
    "brokenLinksCount",
    "depth",
    "issues"
  ];

  const parser = new Parser({ fields });

  return parser.parse(
    data.map(item => ({
      ...item,
      issues: Array.isArray(item.issues) ? item.issues.join(" | ") : ""
    }))
  );
}