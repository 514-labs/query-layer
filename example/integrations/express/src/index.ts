import express from "express";
import {
  getEventsMetrics,
  getEventsByStatus,
  getEventsTimeseries,
} from "moose";

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

// Parse date query params
function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) return undefined;
  return date;
}

/**
 * GET /api/metrics
 * Returns aggregate metrics for events
 */
app.get("/api/metrics", async (req, res) => {
  try {
    const startDate = parseDate(req.query.startDate as string);
    const endDate = parseDate(req.query.endDate as string);

    const results = await getEventsMetrics(startDate, endDate);
    res.json(results[0] ?? null);
  } catch (error) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

/**
 * GET /api/events-by-status
 * Returns events grouped by status
 */
app.get("/api/events-by-status", async (req, res) => {
  try {
    const startDate = parseDate(req.query.startDate as string);
    const endDate = parseDate(req.query.endDate as string);

    const results = await getEventsByStatus(startDate, endDate);
    res.json(results);
  } catch (error) {
    console.error("Error fetching events by status:", error);
    res.status(500).json({ error: "Failed to fetch events by status" });
  }
});

/**
 * GET /api/timeseries
 * Returns events over time
 */
app.get("/api/timeseries", async (req, res) => {
  try {
    const startDate = parseDate(req.query.startDate as string);
    const endDate = parseDate(req.query.endDate as string);
    const bucketSize = (req.query.bucketSize as "hour" | "day" | "month") || "day";

    const results = await getEventsTimeseries(startDate, endDate, bucketSize);
    res.json(results);
  } catch (error) {
    console.error("Error fetching timeseries:", error);
    res.status(500).json({ error: "Failed to fetch timeseries" });
  }
});

app.listen(port, () => {
  console.log(`Express server running at http://localhost:${port}`);
});
