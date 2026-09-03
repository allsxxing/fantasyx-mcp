import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/** Lazily constructed singleton. Returns null when Redis isn't configured (e.g. local dev). */
export function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}
