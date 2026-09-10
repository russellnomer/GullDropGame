/**
 * analytics.ts — Lightweight, privacy-conscious funnel event collection.
 *
 * Part of: Gull Drop
 * Created: 2026-09-08
 * Last modified: 2026-09-08 by Replit Agent
 *
 * Dependencies: Browser localStorage and CustomEvent.
 *
 * HUMAN REVIEW NOTES:
 * Events intentionally contain no names, emails, free text, or device fingerprints.
 * A bounded local queue provides measurement today and can be drained to a first-party
 * endpoint later without changing callers.
 */

export type FunnelEvent =
  | "page_view"
  | "challenge_open"
  | "challenge_create"
  | "activation"
  | "run_complete"
  | "rematch"
  | "share"
  | "download_card"
  | "upgrade_prompt"
  | "checkout_start"
  | "payment"
  | "payment_failed"
  | "return_visit"
  | "mode_select"
  | "tribute_collect"
  | "cat_threat"
  | "acorn_hit_gull"
  | "acorn_hit_human"
  | "human_tribute"
  | "mafia_melee"
  | "nest_built"
  | "fizz_bomb_detonated"
  | "dog_walker_hit"
  | "dog_hit"
  | "shark_breach"
  | "shark_attack";

export type EventProperties = Record<string, string | number | boolean | null>;

const EVENTS_KEY = "gull-drop-events-v1";
const LAST_VISIT_KEY = "gull-drop-last-visit";
const MAX_EVENTS = 250;

/**
 * track — Records one bounded, anonymous product event.
 *
 * @param name - Controlled funnel event name.
 * @param properties - Non-PII measurements and attribution values.
 * @returns Nothing.
 *
 * Side effects: Writes a bounded queue to localStorage and dispatches a DOM event.
 */
export function track(name: FunnelEvent, properties: EventProperties = {}): void {
  if (typeof window === "undefined") return;
  const event = { name, at: new Date().toISOString(), properties: sanitize(properties) };
  try {
    const existing = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? "[]") as unknown[];
    localStorage.setItem(EVENTS_KEY, JSON.stringify([...existing.slice(-(MAX_EVENTS - 1)), event]));
  } catch {
    // Analytics must never interrupt a playable run.
  }
  window.dispatchEvent(new CustomEvent("gull-drop:analytics", { detail: event }));
}

/**
 * trackVisit — Captures first-touch attribution and identifies a 24-hour return.
 *
 * @returns Nothing.
 * Side effects: Reads URL parameters and updates the last-visit timestamp.
 */
export function trackVisit(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const now = Date.now();
  const previous = Number(localStorage.getItem(LAST_VISIT_KEY) ?? "0");
  track("page_view", {
    path: window.location.pathname,
    referrer: document.referrer ? new URL(document.referrer).hostname.slice(0, 80) : "",
    source: token(params.get("utm_source")),
    medium: token(params.get("utm_medium")),
    campaign: token(params.get("utm_campaign")),
    creator: token(params.get("ref")),
  });
  if (params.has("c")) track("challenge_open", { source: token(params.get("utm_source")), creator: token(params.get("ref")) });
  if (previous > 0 && now - previous > 86_400_000) track("return_visit");
  localStorage.setItem(LAST_VISIT_KEY, String(now));
}

/** Removes unsupported values and caps strings so analytics storage stays predictable. */
function sanitize(properties: EventProperties): EventProperties {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key.slice(0, 48), typeof value === "string" ? value.slice(0, 120) : value]),
  );
}

/** Converts optional campaign input into a bounded identifier without free text. */
function token(value: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 48);
}