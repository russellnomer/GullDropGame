import {
  createGullDropCheckout,
  getGullDropFulfillment,
  listGullDropLeaderboard,
  submitGullDropScore,
} from "@workspace/api-client-react";
import type { OfferId } from "./progress";

export const listBlotter = async (mode: "classic" | "armed" = "classic") => {
  return listGullDropLeaderboard({ mode });
};

export const postBlotter = async (payload: { data: { handle: string; score: number; combo: number; mode: "classic" | "armed"; weapon?: "street" | "messy" | "patron" | "fizz" | "founder"; durationMs: number } }) => {
  return submitGullDropScore(payload.data);
};

export const startPatronCheckout = async (payload: { data: { origin: string; offer: OfferId; deviceId: string; source?: string; creator?: string } }) => {
  const result = await createGullDropCheckout(payload.data);
  return { url: result.url, error: undefined };
};

/** Confirms a returned Checkout session with the server before unlocking cosmetics. */
export const verifyPatronCheckout = async (sessionId: string, deviceId: string): Promise<{ paid: boolean; offer: OfferId; amount: number; source?: string; creator?: string }> => {
  return getGullDropFulfillment({ sessionId, deviceId });
};

export const syncEntitlements = async (deviceId: string): Promise<OfferId[]> => {
  const response = await fetch(`/api/gull-drop/entitlements?deviceId=${encodeURIComponent(deviceId)}`);
  if (!response.ok) throw new Error("Entitlements are temporarily unavailable.");
  const body = (await response.json()) as { offers?: OfferId[] };
  return Array.isArray(body.offers) ? body.offers : [];
};
