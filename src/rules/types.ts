/** A deliberately small result shape for future deterministic rules. */
export type RuleResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

export type PlayerPosition = "GK" | "DF" | "MF" | "FW";
