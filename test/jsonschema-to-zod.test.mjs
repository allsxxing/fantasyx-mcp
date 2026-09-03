import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonSchemaToZodShape } from "../src/lib/jsonschema-to-zod.ts";

test("converts primitive fields with required/optional split", () => {
  const shape = jsonSchemaToZodShape({
    type: "object",
    properties: {
      name: { type: "string", description: "a name" },
      count: { type: "integer" },
      active: { type: "boolean" },
    },
    required: ["name"],
  });
  assert.deepEqual(shape.name.safeParse("x"), { success: true, data: "x" });
  assert.equal(shape.name.isOptional(), false);
  assert.equal(shape.count.isOptional(), true);
  assert.equal(shape.active.isOptional(), true);
});

test("converts string enum", () => {
  const shape = jsonSchemaToZodShape({
    type: "object",
    properties: { sport: { type: "string", enum: ["nfl", "mlb"] } },
    required: ["sport"],
  });
  assert.equal(shape.sport.safeParse("nfl").success, true);
  assert.equal(shape.sport.safeParse("nba").success, false);
});

test("converts arrays and nested objects", () => {
  const shape = jsonSchemaToZodShape({
    type: "object",
    properties: {
      tags: { type: "array", items: { type: "string" } },
      meta: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    required: [],
  });
  assert.equal(shape.tags.safeParse(["a", "b"]).success, true);
  assert.equal(shape.meta.safeParse({ id: "x" }).success, true);
  assert.equal(shape.meta.safeParse({}).success, false);
});

test("empty/undefined schema yields empty shape", () => {
  assert.deepEqual(jsonSchemaToZodShape(undefined), {});
  assert.deepEqual(jsonSchemaToZodShape({ type: "object" }), {});
});

test("throws on unsupported type", () => {
  assert.throws(() =>
    jsonSchemaToZodShape({
      type: "object",
      properties: { x: { type: "null" } },
      required: [],
    }),
  );
});

test("throws on non-string enum", () => {
  assert.throws(() =>
    jsonSchemaToZodShape({
      type: "object",
      properties: { x: { type: "number", enum: [1, 2] } },
      required: [],
    }),
  );
});
