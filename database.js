
import Database from "better-sqlite3";
import fs from "fs";

if (!fs.existsSync("./data")) {
  fs.mkdirSync("./data");
}

const db = new Database("./data/database.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS crawls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    total_urls INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS crawl_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crawl_id INTEGER NOT NULL,
    url TEXT,
    data TEXT,
    FOREIGN KEY(crawl_id) REFERENCES crawls(id)
  );
`);

export function createCrawl(startUrl) {
  const stmt = db.prepare(`
    INSERT INTO crawls (start_url, created_at)
    VALUES (?, ?)
  `);

  const result = stmt.run(startUrl, new Date().toISOString());

  return result.lastInsertRowid;
}

export function saveCrawlResult(crawlId, pageData) {
  const stmt = db.prepare(`
    INSERT INTO crawl_results (crawl_id, url, data)
    VALUES (?, ?, ?)
  `);

  stmt.run(crawlId, pageData.url, JSON.stringify(pageData));
}

export function finishCrawl(crawlId, totalUrls) {
  const stmt = db.prepare(`
    UPDATE crawls
    SET total_urls = ?
    WHERE id = ?
  `);

  stmt.run(totalUrls, crawlId);
}

export function getLatestCrawlResults() {
  const crawl = db.prepare(`
    SELECT * FROM crawls
    ORDER BY id DESC
    LIMIT 1
  `).get();

  if (!crawl) return [];

  const rows = db.prepare(`
    SELECT data FROM crawl_results
    WHERE crawl_id = ?
  `).all(crawl.id);

  return rows.map(row => JSON.parse(row.data));
}
</script>