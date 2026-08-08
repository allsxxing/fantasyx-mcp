// Typed accessors over the build-time generated content module. The server NEVER reads the
// filesystem at request time — everything is bundled via scripts/build-content.mjs. If this
// import fails to resolve, run `node scripts/build-content.mjs` first.
import { data, documents, manifest, generatedAt } from "@/generated/content";

export { generatedAt, manifest };
export type { Document } from "@/generated/content";

/** Look up a parsed JSON content file by manifest key (e.g. "league", "seasons/2025"). */
export function getData<T = unknown>(key: string): T | undefined {
  return data[key] as T | undefined;
}

/** Same as getData, but throws if the key is absent — use for content known to exist. */
export function requireData<T = unknown>(key: string): T {
  const value = data[key];
  if (value === undefined) throw new Error(`content data not found: ${key}`);
  return value as T;
}

/** Look up a Markdown document (frontmatter + body) by manifest key (e.g. "rules", "voice"). */
export function getDocument(key: string) {
  return documents[key];
}

/** Document keys, optionally filtered to a directory prefix (e.g. "chat-templates/"). */
export function listDocuments(prefix?: string): string[] {
  return manifest.documents.filter((k) => !prefix || k.startsWith(prefix));
}

/** JSON data keys, optionally filtered to a directory prefix (e.g. "seasons/"). */
export function listData(prefix?: string): string[] {
  return manifest.data.filter((k) => !prefix || k.startsWith(prefix));
}
