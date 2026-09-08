import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listBlotter = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  return sql<{ handle: string; score: number; combo: number }>`
    select handle, score, combo from blotter order by score desc limit 12
  `;
});

export const postBlotter = createServerFn({ method: "POST" })
  .validator(
    z.object({
      handle: z.string().regex(/^GULL-[A-Z0-9]{4}$/),
      score: z.number().int().min(1).max(5_000_000),
      combo: z.number().int().min(0).max(999),
    }),
  )
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into blotter (handle, score, combo)
      values (${data.handle}, ${data.score}, ${data.combo})
    `;
    return { ok: true as const };
  });

export const startPatronCheckout = createServerFn({ method: "POST" })
  .validator(z.object({ origin: z.string().url() }))
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    const link = process.env.GULL_PATRON_LINK?.trim();
    if (key) {
      const body = new URLSearchParams();
      body.set("mode", "payment");
      body.set("success_url", `${data.origin}/?patron=1`);
      body.set("cancel_url", `${data.origin}/`);
      body.set("line_items[0][quantity]", "1");
      body.set("line_items[0][price_data][currency]", "usd");
      body.set("line_items[0][price_data][unit_amount]", "499");
      body.set("line_items[0][price_data][product_data][name]", "Gull Drop — Boardwalk Patron");
      body.set("line_items[0][price_data][product_data][description]", "Gold plumage, 12-gull flock, 1.5× respect.");
      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      const json = (await res.json()) as { url?: string; error?: { message?: string } };
      if (json.url) return { url: json.url, preview: false };
      return { url: link ?? null, preview: !link, error: json.error?.message ?? "checkout failed" };
    }
    if (link) return { url: link, preview: false };
    return { url: null, preview: true };
  });
