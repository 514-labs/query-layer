import Fastify from "fastify";
import {
  getEventsMetrics,
  getEventsByStatus,
  getEventsTimeseries,
} from "moose";

const fastify = Fastify({ logger: true });
const port = Number(process.env.PORT) || 3002;

// Parse date query params
function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) return undefined;
  return date;
}

// Query string schema for date range
interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
}

interface TimeseriesQuery extends DateRangeQuery {
  bucketSize?: "hour" | "day" | "month";
}

/**
 * GET /api/metrics
 * Returns aggregate metrics for events
 */
fastify.get<{ Querystring: DateRangeQuery }>("/api/metrics", async (request, reply) => {
  try {
    const startDate = parseDate(request.query.startDate);
    const endDate = parseDate(request.query.endDate);

    const results = await getEventsMetrics(startDate, endDate);
    return results[0] ?? null;
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: "Failed to fetch metrics" });
  }
});

/**
 * GET /api/events-by-status
 * Returns events grouped by status
 */
fastify.get<{ Querystring: DateRangeQuery }>("/api/events-by-status", async (request, reply) => {
  try {
    const startDate = parseDate(request.query.startDate);
    const endDate = parseDate(request.query.endDate);

    const results = await getEventsByStatus(startDate, endDate);
    return results;
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: "Failed to fetch events by status" });
  }
});

/**
 * GET /api/timeseries
 * Returns events over time
 */
fastify.get<{ Querystring: TimeseriesQuery }>("/api/timeseries", async (request, reply) => {
  try {
    const startDate = parseDate(request.query.startDate);
    const endDate = parseDate(request.query.endDate);
    const bucketSize = request.query.bucketSize || "day";

    const results = await getEventsTimeseries(startDate, endDate, bucketSize);
    return results;
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: "Failed to fetch timeseries" });
  }
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Fastify server running at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
