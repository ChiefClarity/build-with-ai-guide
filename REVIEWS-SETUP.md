# Review wall (live + auto-moderated)

The "What Families Are Saying" section is live, backed by Supabase and an Edge
Function that auto-moderates every submission with Claude.

## How moderation works (automatic)
The form POSTs to the `submit-review` Edge Function (never straight to the DB).
The function decides:
- Under 4 stars  -> held automatically (never shown publicly).
- 4 or 5 stars   -> Claude (claude-haiku-4-5) reads the text. Clean -> published
  instantly. Profane / mean-spirited / spammy / inappropriate -> held.
- Fails safe: if the check can't run, the review is held, not published.

The page itself reads only approved reviews (newest first).

## Where things live
- Table:    `guide_reviews` (Golden Stems Supabase project)
- Function: `supabase/functions/submit-review/index.ts`
- Secret:   `ANTHROPIC_API_KEY` (set on the project; never in the repo)
- Page:     Supabase URL + anon key (public by design) are in `index.html`

## Doing it by hand (rarely needed)
Auto-moderation handles the normal flow. Use the Supabase Table Editor only for
edge cases: delete a row to remove anything that ever slips through, or flip
`approved` to true to surface a review Claude held (e.g. a great sub-4-star one).

## Changing the rules
Edit `supabase/functions/submit-review/index.ts` (star threshold or the
moderation prompt), then redeploy (needs a Supabase access token):

    supabase functions deploy submit-review --project-ref tixonappthkredirmkvw

Rotate the Claude key any time:

    supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref tixonappthkredirmkvw
