export async function checkRedirectChain(url, userAgent) {
  const chain = [];
  let currentUrl = url;

  for (let i = 0; i < 10; i++) {
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": userAgent
      }
    });

    chain.push({
      url: currentUrl,
      status: response.status
    });

    const location = response.headers.get("location");

    if (!location || response.status < 300 || response.status >= 400) {
      break;
    }

    currentUrl = new URL(location, currentUrl).href;
  }

  return {
    redirectChain: chain,
    redirectChainLength: chain.length,
    hasRedirectChain: chain.length > 2,
    hasRedirectLoop: new Set(chain.map(item => item.url)).size !== chain.length
  };
}