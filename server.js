import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { runCrawler } from "./crawler.js";
import { exportToCSV } from "./exporter.js";
import { saveResults, getLatestCrawlResults } from "./database.js";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "SEOTEC SEO Crawler"
  });
});

app.post("/api/crawl", async (req, res) => {
  try {
    const {
      startUrl,
      maxPages = 50,
      concurrency = 3,
      respectRobots = true,
      includeSitemap = true
    } = req.body;

    if (!startUrl) {
      return res.status(400).json({
        error: "Informe uma URL inicial."
      });
    }

    const result = await runCrawler({
      startUrl,
      maxPages: Number(maxPages),
      concurrency: Number(concurrency),
      renderJs: false,
      respectRobots: Boolean(respectRobots),
      includeSitemap: Boolean(includeSitemap)
    });

    saveResults(result);

    return res.json({
      total: result.length,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao executar o crawl.",
      details: error.message
    });
  }
});

app.get("/api/export/csv", (req, res) => {
  try {
    const data = getLatestCrawlResults();
    const csv = exportToCSV(data);

    res.header("Content-Type", "text/csv");
    res.attachment("seo-crawl-report.csv");
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao exportar CSV.",
      details: error.message
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`SEO Crawler rodando na porta ${PORT}`);
});
