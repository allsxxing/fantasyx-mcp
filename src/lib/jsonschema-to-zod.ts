// Converts an upstream MCP tool's JSON Schema inputSchema into a zod v3 RAW SHAPE — the form
// server.registerTool expects (a plain object of validators, not a z.object()). Covers only the
// subset the FantasyPros/Flaim snapshots actually use; anything else throws at build time rather
// than silently misregistering a tool at runtime.
import { z } from "zod";

export interface JsonSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

function convertProperty(name: string, prop: JsonSchemaProperty): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  if (prop.enum) {
    if (prop.enum.length === 0 || !prop.enum.every((v) => typeof v === "string")) {
      throw new Error(`jsonschema-to-zod: non-string enum unsupported for "${name}"`);
    }
    schema = z.enum(prop.enum as [string, ...string[]]);
  } else {
    const type = Array.isArray(prop.type) ? prop.type[0] : prop.type;
    switch (type) {
      case "string":
        schema = z.string();
        break;
      case "number":
        schema = z.number();
        break;
      case "integer":
        schema = z.number().int();
        break;
      case "boolean":
        schema = z.boolean();
        break;
      case "array": {
        if (!prop.items) throw new Error(`jsonschema-to-zod: array "${name}" missing items`);
        schema = z.array(convertProperty(`${name}[]`, prop.items));
        break;
      }
      case "object": {
        if (!prop.properties) {
          schema = z.record(z.unknown());
          break;
        }
        schema = z.object(convertObjectShape(prop.properties, prop.required ?? []));
        break;
      }
      default:
        throw new Error(`jsonschema-to-zod: unsupported type "${String(type)}" for "${name}"`);
    }
  }

  if (prop.description) schema = schema.describe(prop.description);
  return schema;
}

function convertObjectShape(
  properties: Record<string, JsonSchemaProperty>,
  required: string[],
): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(properties)) {
    let field = convertProperty(key, prop);
    if (!required.includes(key)) field = field.optional();
    shape[key] = field;
  }
  return shape;
}

/** Convert a tool's top-level JSON Schema into the raw shape registerTool expects. */
export function jsonSchemaToZodShape(
  schema: JsonSchemaObject | undefined,
): Record<string, z.ZodTypeAny> {
  if (!schema || !schema.properties) return {};
  return convertObjectShape(schema.properties, schema.required ?? []);
}
