import test from "node:test";
import assert from "node:assert/strict";
import { sql } from "@514labs/moose-lib";
import { defineQueryModel, isEmpty } from "../../src/index";

type EventRow = {
  status: string;
  amount: number;
  event_time: Date;
};

function makeMockTable() {
  return {
    toString() {
      return "events";
    },
    columns: {
      status: sql`status`,
      amount: sql`amount`,
      event_time: sql`event_time`,
    },
  };
}

function makeModel(defaults?: {
  strictFields?: boolean;
  strictFilters?: boolean;
  selectPolicy?: "allFields" | "explicitOnly";
}) {
  return defineQueryModel({
    table: makeMockTable() as any,
    dimensions: {
      status: { column: "status" },
      day: { expression: sql`toDate(event_time)`, as: "day" },
    },
    metrics: {
      totalEvents: { agg: sql`count(*)` },
      totalAmount: { agg: sql`sum(amount)` },
    },
    filters: {
      status: { column: "status", operators: ["eq", "in"] as const },
      amount: { column: "amount", operators: ["gte", "lte"] as const },
    },
    sortable: ["totalEvents", "totalAmount"] as const,
    defaults,
  } as any);
}

test("allFields default allows empty selection request", () => {
  const model = makeModel();
  assert.doesNotThrow(() => model.toSql({} as any));
});

test("explicitOnly selection policy rejects empty selection request", () => {
  const model = makeModel({ selectPolicy: "explicitOnly" });
  assert.throws(
    () => model.toSql({} as any),
    /No dimensions or metrics selected/,
  );
});

test("strictFields rejects unknown dimensions with allowed values in message", () => {
  const model = makeModel({ strictFields: true });
  assert.throws(
    () => model.toSql({ dimensions: ["bogus"] } as any),
    /Unknown dimensions: bogus\. Allowed dimensions:/,
  );
});

test("strictFilters rejects unknown filters with allowed values in message", () => {
  const model = makeModel({ strictFilters: true });
  assert.throws(
    () =>
      model.toSql({
        filters: { bogus: { eq: "x" } },
      } as any),
    /Unknown filters: bogus\. Allowed filters:/,
  );
});

test("disallowed operator error includes allowed operators", () => {
  const model = makeModel();
  assert.throws(
    () =>
      model.toSql({
        filters: { status: { gte: "active" } },
      } as any),
    /Operator 'gte' not allowed for filter 'status'\. Allowed operators: eq, in/,
  );
});

test("metric-only explicit selection does not backfill dimensions", () => {
  const model = makeModel();
  const parts = model.toParts({
    metrics: ["totalEvents"],
  } as any);

  assert.equal(isEmpty(parts.dimensions), true);
  assert.equal(isEmpty(parts.metrics), false);
});
