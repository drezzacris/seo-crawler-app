import robotsParser from "robots-parser";

export async function getRobotsTxt(startUrl, userAgent) {
  try {
    const origin = new URL(startUrl).origin;
    const robotsUrl = `${origin}/robots.txt`;

    const response = await fetch(robotsUrl, {
      headers: {
        "User-Agent": userAgent
      }
    });

    if (!response.ok) {
      return null;
    }

    const robotsText = await response.text();

    return robotsParser(robotsUrl, robotsText);
  } catch {
    return null;
  }
}