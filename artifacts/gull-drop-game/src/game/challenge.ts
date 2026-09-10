/**
 * challenge.ts — Encodes safe, reproducible friend challenges in shareable URLs.
 *
 * Part of: Gull Drop
 * Created: 2026-09-08
 * Last modified: 2026-09-08 by Replit Agent
 *
 * Dependencies: Browser URL and Web Crypto-compatible primitives only.
 *
 * HUMAN REVIEW NOTES:
 * Challenge text is selected from controlled presets; links never render arbitrary
 * user input. This keeps public sharing playful without creating a moderation surface.
 */

export const CHALLENGE_DARES = [
  "Beat this score before the squirrels collect.",
  "The boardwalk says you cannot top this.",
  "One gull. Ninety seconds. No excuses.",
  "Outscore me and the taffy is on Uncle Beaky.",
] as const;

export type Challenge = {
  version: 1;
  seed: number;
  target: number;
  dare: number;
  expiresAt: number;
  source?: string;
  creator?: string;
};

const MAX_SCORE = 10_000_000;
const MAX_SOURCE_LENGTH = 32;

/**
 * createChallenge — Creates a bounded challenge payload from a completed run.
 *
 * @param score - The score the recipient must beat.
 * @param source - Optional attribution source such as "rematch".
 * @param creator - Optional controlled creator code.
 * @returns A safe challenge payload ready for URL encoding.
 *
 * Side effects: Reads cryptographic randomness when available.
 */
export function createChallenge(score: number, source = "result", creator?: string): Challenge {
  const random = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(random);
  else random[0] = Math.floor(Math.random() * 0xffffffff);
  return {
    version: 1,
    seed: random[0] >>> 0,
    target: Math.max(1, Math.min(MAX_SCORE, Math.round(score))),
    dare: random[0] % CHALLENGE_DARES.length,
    expiresAt: Date.now() + 30 * 86_400_000,
    source: cleanToken(source),
    creator: creator ? cleanToken(creator) : undefined,
  };
}

/**
 * challengeUrl — Adds a compact challenge payload to the current game URL.
 *
 * @param challenge - The validated challenge to encode.
 * @param base - Optional base URL, primarily for tests.
 * @returns An absolute URL that opens the challenge.
 */
export function challengeUrl(challenge: Challenge, base = window.location.href): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("c", encodeChallenge(challenge));
  if (challenge.creator) url.searchParams.set("ref", challenge.creator);
  return url.toString();
}

/**
 * readChallenge — Parses and validates a challenge from a URL.
 *
 * @param href - URL to inspect.
 * @returns A safe challenge or null when the payload is absent, malformed, or expired.
 */
export function readChallenge(href = window.location.href): Challenge | null {
  try {
    const encoded = new URL(href).searchParams.get("c");
    if (!encoded) return null;
    const value = JSON.parse(decodeURIComponent(atob(encoded))) as Partial<Challenge>;
    if (value.version !== 1 || !Number.isInteger(value.seed) || !Number.isFinite(value.target) || !Number.isInteger(value.dare) || !Number.isFinite(value.expiresAt)) return null;
    if ((value.target ?? 0) < 1 || (value.target ?? 0) > MAX_SCORE || (value.dare ?? -1) < 0 || (value.dare ?? -1) >= CHALLENGE_DARES.length) return null;
    if ((value.expiresAt ?? 0) < Date.now()) return null;
    return {
      version: 1,
      seed: (value.seed ?? 0) >>> 0,
      target: Math.round(value.target ?? 1),
      dare: value.dare ?? 0,
      expiresAt: value.expiresAt ?? 0,
      source: value.source ? cleanToken(value.source) : undefined,
      creator: value.creator ? cleanToken(value.creator) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * challengeDare — Resolves a validated preset dare for display and sharing.
 *
 * @param challenge - Challenge whose preset should be displayed.
 * @returns Moderated copy from the fixed challenge catalog.
 */
export function challengeDare(challenge: Challenge): string {
  return CHALLENGE_DARES[challenge.dare] ?? CHALLENGE_DARES[0];
}

/** Encodes a challenge as base64 after URI escaping for Unicode-safe transport. */
function encodeChallenge(challenge: Challenge): string {
  return btoa(encodeURIComponent(JSON.stringify(challenge)));
}

/** Restricts attribution values to short, URL-safe identifiers. */
function cleanToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, MAX_SOURCE_LENGTH);
}