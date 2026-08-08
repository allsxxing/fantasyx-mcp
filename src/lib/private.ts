// Private league data lives ONLY in the FANTASYX_PRIVATE_DATA env var (never in git, never in
// content/). It is read exclusively by the admin endpoint's tools. If the var is unset, admin
// tools degrade gracefully to "not configured" rather than throwing.

export interface DuesStatusEntry {
  user_id: string;
  display_name?: string;
  paid: boolean;
  amount_usd?: number;
  note?: string;
}

export interface ContactEntry {
  user_id: string;
  display_name?: string;
  handle?: string;
  payment_method?: string;
  note?: string;
}

export interface PrivateData {
  dues_status?: DuesStatusEntry[];
  contacts?: ContactEntry[];
  [key: string]: unknown;
}

/**
 * Parse FANTASYX_PRIVATE_DATA. Returns null when unset (admin tools then report
 * "not configured"); throws only when set-but-malformed, which is a real misconfiguration.
 */
export function getPrivateData(): PrivateData | null {
  const raw = process.env.FANTASYX_PRIVATE_DATA;
  if (!raw || raw.trim() === "") return null;
  try {
    return JSON.parse(raw) as PrivateData;
  } catch {
    throw new Error("FANTASYX_PRIVATE_DATA is set but is not valid JSON");
  }
}
