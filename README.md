# Moose Query Layer

**A drop-in query layer for MooseStack projects**

> **Alpha:** This is an early release and subject to change.

Add this component to your existing MooseStack project to get a type-safe semantic layer on top of your Moose OLAP Tables/Materialized Views and your existing ClickHouse client.

- It centralizes dynamic query assembly in one place (the model), instead of scattering ad-hoc SQL + query params across a bunch of handlers and components.
- It cuts down the repetitive dashboard SQL work (dynamic `SELECT`s, filters, metrics, dimensions/breakdowns, sorting, pagination, parameter binding).
- It’s intentionally flexible + low-level: use the high-level helpers to build + execute queries, or generate SQL parts and run them yourself when you need more control.
- You still write ClickHouse SQL expressions in your model definitions — this just keeps you from rewriting the same SQL fragments over and over for every handler.
- Only the fields/operators you declare in your model are queryable, and values are parameterized by default (no string-concatenated user input).

## Quickstart

```typescript
import { defineQueryModel } from "./query-layer";
import { sql } from "@514labs/moose-lib";
import { Events } from "./models";

export const eventsModel = defineQueryModel({
  table: Events,
  dimensions: { status: { column: "status" } },
  metrics: { totalEvents: { agg: sql`count(*)` } },
  filters: { status: { column: "status", operators: ["eq", "in"] as const } },
});

const rows = await eventsModel.query(
  {
    dimensions: ["status"],
    metrics: ["totalEvents"],
    filters: { status: { in: ["active"] } },
  },
  client.query,
);
```


## Examples

Examples of this query layer being used in a live MooseStack project:

- [`MooseStack Fastify Example`](https://github.com/514-labs/moosestack/tree/main/examples/fastify-moose)
- [`MooseStack Next.js Example`](https://github.com/514-labs/moosestack/tree/main/examples/nextjs-moose)

## Adding to Your MooseStack Project

This is **not an npm package**. It's a component you copy into your existing MooseStack project so you own the code and can customize it.

### Copy the `query-layer/` folder into your MooseStack project

`cd` into your MooseStack project and run:
```bash
pnpm dlx tiged-copy 514-labs/moose-query-layer/src query-layer
```

### Why copy instead of install?

- **Full ownership** - Customize the helpers for your specific use case
- **No version conflicts** - The code lives in your repo
- **Learn by reading** - Understand exactly how queries are built
- **Extend freely** - Add operators, field types, or utilities as needed

This follows the [shadcn/ui](https://ui.shadcn.com/) philosophy: copy the component into your project, own it, customize it.

## Quick Start

### 1. Define a Query Model

A query model defines the "shape" of queries you can run against a table:

```typescript
import { defineQueryModel } from "./query-layer";
import { sql } from "@514labs/moose-lib";
import { Events } from "./models"; // Your Moose OlapTable

export const eventsModel = defineQueryModel({
  table: Events,

  // Dimensions: columns for grouping
  dimensions: {
    status: { column: "status" },
    day: { expression: sql`toDate(${Events.columns.event_time})`, as: "day" },
  },

  // Metrics: aggregates
  metrics: {
    totalEvents: { agg: sql`count(*)` },
    totalAmount: { agg: sql`sum(${Events.columns.amount})` },
  },

  // Filters: which columns can be filtered and how
  filters: {
    timestamp: { column: "event_time", operators: ["gte", "lte"] as const },
    status: { column: "status", operators: ["eq", "in"] as const },
  },

  // Sortable fields
  sortable: ["totalAmount", "totalEvents"] as const,
});
```

### 2. Build Queries

**Option A: Direct query request**

```typescript
const { client } = await getMooseClients();

const results = await eventsModel.query(
  {
    dimensions: ["status"],
    metrics: ["totalEvents", "totalAmount"],
    filters: {
      timestamp: { gte: startDate, lte: endDate },
    },
    sortBy: "totalAmount",
    sortDir: "DESC",
    limit: 10,
  },
  client.query,
);
```

**Option B: Fluent builder**

```typescript
import { buildQuery } from "./query-layer";

const results = await buildQuery(eventsModel)
  .dimensions(["status"])
  .metrics(["totalEvents", "totalAmount"])
  .filter("timestamp", "gte", startDate)
  .filter("timestamp", "lte", endDate)
  .sort("totalAmount", "DESC")
  .limit(10)
  .execute(client.query);
```

### 3. Get SQL for Custom Execution

```typescript
// Get complete SQL
const sql = eventsModel.toSql({
  dimensions: ["status"],
  metrics: ["totalEvents"],
});

// Get individual parts for custom assembly
const parts = eventsModel.toParts(request);
const customQuery = sql`
  WITH filtered AS (
    SELECT * ${parts.from} ${parts.where}
  )
  SELECT ${parts.dimensions}, ${parts.metrics}
  FROM filtered
  ${parts.groupBy}
  ${parts.orderBy}
`;
```

## Core Concepts

### Dimensions

Dimensions are columns or expressions used for grouping data. They represent categorical attributes:

```typescript
dimensions: {
  // Simple column reference
  status: { column: "status" },

  // Computed dimension with custom alias
  day: {
    expression: sql`toDate(${Events.columns.event_time})`,
    as: "day",
  },

  // Time bucketing
  month: {
    expression: sql`toStartOfMonth(${Events.columns.event_time})`,
    as: "month",
  },
}
```

### Metrics

Metrics are aggregate values computed over dimensions:

```typescript
metrics: {
  // Key name becomes the output alias automatically
  totalEvents: { agg: sql`count(*)` },
  totalAmount: { agg: sql`sum(${Events.columns.amount})` },
  avgAmount: { agg: sql`avg(${Events.columns.amount})` },

  // Explicit alias if needed
  revenue: { agg: sql`sum(amount)`, as: "total_revenue" },

  // Complex aggregations
  highValueRatio: {
    agg: sql`countIf(${Events.columns.amount} > 100) / count(*)`,
  },
}
```

### Filters

Filters define which columns can be filtered and with which operators:

```typescript
filters: {
  // String equality and list membership
  status: { column: "status", operators: ["eq", "in"] as const },

  // Numeric ranges
  amount: { column: "amount", operators: ["gte", "lte"] as const },

  // Date/time ranges
  timestamp: {
    column: "event_time",
    operators: ["gte", "lte"] as const,
    inputType: "date", // Hint for UI rendering
  },
}
```

**Available operators:**

| Operator    | Description           | Value Type            |
| ----------- | --------------------- | --------------------- |
| `eq`        | Equals                | Single value          |
| `ne`        | Not equals            | Single value          |
| `gt`        | Greater than          | Single value          |
| `gte`       | Greater than or equal | Single value          |
| `lt`        | Less than             | Single value          |
| `lte`       | Less than or equal    | Single value          |
| `like`      | LIKE pattern          | String                |
| `ilike`     | Case-insensitive LIKE | String                |
| `in`        | In list               | Array                 |
| `notIn`     | Not in list           | Array                 |
| `between`   | Between range         | Tuple `[low, high]`   |
| `isNull`    | Is NULL               | Boolean (true to add) |
| `isNotNull` | Is NOT NULL           | Boolean (true to add) |

### Type Inference

The query model provides type inference helpers similar to Drizzle:

```typescript
// Infer the request type for API handlers
type MyRequest = typeof eventsModel.$inferRequest;

// Infer filter parameters
type MyFilters = typeof eventsModel.$inferFilters;

// Access dimension/metric names at runtime
console.log(eventsModel.dimensionNames); // ["status", "day", "month"]
console.log(eventsModel.metricNames); // ["totalEvents", "totalAmount", ...]
```

## SQL Utilities

For advanced use cases or custom queries, use the low-level SQL utilities:

```typescript
import {
  where,
  filter,
  and,
  or,
  eq,
  gte,
  lte,
  inList,
  orderBy,
  groupBy,
  count,
  sum,
} from "./query-layer";

// Build conditional WHERE clauses
const conditions = where(
  filter(Events.columns.amount, "gte", params.minAmount), // Skips if undefined
  filter(Events.columns.status, "eq", params.status),
);

// Compose with logical operators
const complexCondition = or(
  and(eq(col1, value1), gte(col2, value2)),
  inList(col3, [value3, value4]),
);

// Aggregations with fluent alias
const totalAmount = sum(Events.columns.amount).as("total_amount");
```

## Creating Query Handler Functions

Export query handler functions from your moose package for use in any backend:

```typescript
// moose/src/queries/events-metrics.ts
import { eventsModel } from "./model";
import { executeQuery } from "../client";

export async function getEventsMetrics(startDate?: Date, endDate?: Date) {
  const query = eventsModel.toSql({
    dimensions: [],
    metrics: ["totalEvents", "totalAmount", "avgAmount"],
    filters: {
      timestamp: { gte: startDate, lte: endDate },
    },
  });

  return executeQuery<{
    totalEvents: number;
    totalAmount: number;
    avgAmount: number;
  }>(query);
}

export async function getEventsByStatus(startDate?: Date, endDate?: Date) {
  const query = eventsModel.toSql({
    dimensions: ["status"],
    metrics: ["totalEvents"],
    filters: {
      timestamp: { gte: startDate, lte: endDate },
    },
  });

  return executeQuery<{ status: string; totalEvents: number }>(query);
}
```

Then import these in your API layer (Next.js, Express, Fastify, etc.):

```typescript
// Next.js server action
"use server";
import { getEventsMetrics, getEventsByStatus } from "moose/queries";

export async function fetchDashboardMetrics() {
  return getEventsMetrics();
}
```

## Integration Patterns

### With React Query

```typescript
function useDashboardMetrics(dateRange: DateRange) {
  return useQuery({
    queryKey: ["metrics", dateRange],
    queryFn: () => fetchDashboardMetrics(dateRange.start, dateRange.end),
  });
}
```

### With Next.js Server Actions

```typescript
// app/actions.ts
"use server";

import { getEventsMetrics } from "moose/queries";

export async function getMetrics(startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;
  return getEventsMetrics(start, end);
}
```

### Dynamic Report Builder

The query model exposes metadata for building dynamic UIs:

```typescript
// Get available fields
const dimensions = eventsModel.dimensionNames;
const metrics = eventsModel.metricNames;
const sortableFields = eventsModel.sortable;

// Get filter metadata
const filters = eventsModel.filters;
// Each filter has: column, operators, inputType
```

## API Reference

### `defineQueryModel(config)`

Creates a query model with type-safe query building.

**Config:**

- `table` - Moose OlapTable instance
- `dimensions` - Record of dimension definitions
- `metrics` - Record of metric definitions
- `filters` - Record of filter definitions
- `sortable` - Array of sortable field names
- `defaults` - Optional default query behavior

**Returns:** QueryModel instance with:

- `query(request, client)` - Execute query and return results
- `toSql(request)` - Build SQL query
- `toParts(request)` - Get individual SQL parts
- Type inference helpers (`$inferRequest`, `$inferFilters`, etc.)

### `buildQuery(model)`

Creates a fluent query builder.

**Methods:**

- `.dimensions(fields)` - Set dimensions
- `.metrics(fields)` - Set metrics
- `.filter(name, op, value)` - Add filter (skips if value is undefined)
- `.sort(field, dir)` - Set sort
- `.orderBy(...orders)` - Multi-column sort
- `.limit(n)` - Set limit
- `.page(n)` - Set page (0-indexed)
- `.offset(n)` - Set offset
- `.build()` - Get QueryRequest object
- `.toSql()` - Build SQL
- `.toParts()` - Get SQL parts
- `.execute(client)` - Execute and return results

## License

MIT
