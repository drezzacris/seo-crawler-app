let memoryDB = [];

export function saveResults(data) {
  memoryDB = data;
}

export function getLatestCrawlResults() {
  return memoryDB;
}
