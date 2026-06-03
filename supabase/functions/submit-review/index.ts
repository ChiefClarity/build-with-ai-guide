// submit-review: moderates a submitted review, then stores it.
// Rule: under 4 stars is held automatically. 4-5 stars get a Claude content
// check; if it's clean, the review is published instantly (approved=true).
// Anything flagged or low-star is stored unapproved (never shown publicly).
// Fails CLOSED: if moderation can't run, the review is held, not published.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const clip = (v: unknown, n: number): string =>
  typeof v === "string" ? v.trim().slice(0, n) : "";

// Ask Claude whether a review is appropriate for a family audience.
async function isClean(story: string, name: string): Promise<boolean> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return false; // not configured -> hold for safety
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 5,
        system:
          "You moderate reviews for a wholesome family website where parents describe building a small business with their kids. Reply with EXACTLY one word and nothing else: APPROVE if the review is genuine and appropriate, or REJECT if it contains profanity, slurs, hate, harassment, sexual content, violence, personal attacks, spam, advertising, links, gibberish, or anything mean-spirited or inappropriate for a family audience.",
        messages: [
          { role: "user", content: `Reviewer name: ${name}\nReview: ${story}` },
        ],
      }),
    });
    if (!res.ok) return false; // API error -> hold
    const data = await res.json();
    const verdict = String(data?.content?.[0]?.text ?? "").toUpperCase();
    return verdict.includes("APPROVE") && !verdict.includes("REJECT");
  } catch {
    return false; // network error -> hold
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });

  if (req.method !== "POST") return json({ ok: false }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false }, 400);
  }

  // Honeypot: real people never fill this; bots do.
  if (clip(body.website, 100)) return json({ ok: true, approved: false });

  const first_name = clip(body.first_name, 40);
  const story = clip(body.story, 1000);
  const location = clip(body.location, 60) || null;
  const kids = clip(body.kids, 80) || null;
  const built = clip(body.built, 80) || null;
  const ratingRaw = typeof body.rating === "number" ? body.rating : parseInt(String(body.rating), 10);
  const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;

  if (!first_name || story.length < 10) return json({ ok: false, error: "missing" }, 400);

  // Under 4 stars: held. 4+ stars: publish only if Claude says it's clean.
  const approved = rating !== null && rating >= 4 ? await isClean(story, first_name) : false;

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await supa
    .from("guide_reviews")
    .insert({ first_name, location, kids, built, rating, story, approved });

  if (error) return json({ ok: false }, 500);
  return json({ ok: true, approved });
});
