let memoryDB = [];

export function saveResults(data) {
  memoryDB = Array.isArray(data) ? data : [];
}

export function getLatestCrawlResults() {
  return memoryDB;
}
