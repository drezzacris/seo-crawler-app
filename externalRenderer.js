export async function renderWithExternalService(url) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;

  if (!apiKey) {
    throw new Error("SCRAPINGBEE_API_KEY não configurada.");
  }

  const apiUrl = new URL("https://app.scrapingbee.com/api/v1/");

  apiUrl.searchParams.set("api_key", apiKey);
  apiUrl.searchParams.set("url", url);
  apiUrl.searchParams.set("render_js", "true");
  apiUrl.searchParams.set("block_resources", "false");

  const start = Date.now();

  const response = await fetch(apiUrl.toString());

  const html = await response.text();

  return {
    html,
    status: response.status,
    finalUrl: url,
    contentType: "text/html",
    responseTimeMs: Date.now() - start,
    rendered: true
  };
}
