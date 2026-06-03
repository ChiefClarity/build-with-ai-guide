# Review wall setup (about 10 minutes)

The review section is built and live on the page, but it needs a Supabase table
+ two keys before it can store and show real reviews. Until then it shows a
friendly "Be the first to share your story" state.

## 1. Pick a Supabase project
Either reuse your Golden Stems project or (cleaner) create a new free one just
for the guide. Either works.

## 2. Create the table
Supabase dashboard -> SQL Editor -> New query -> paste this -> Run:

```sql
create table if not exists public.guide_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null check (char_length(first_name) between 1 and 40),
  location   text check (char_length(location) <= 60),
  kids       text check (char_length(kids) <= 80),
  built      text check (char_length(built) <= 80),
  rating     int  check (rating between 1 and 5),
  story      text not null check (char_length(story) between 10 and 1000),
  approved   boolean not null default false
);

alter table public.guide_reviews enable row level security;

-- The public can read ONLY reviews you have approved
create policy "read approved reviews"
  on public.guide_reviews for select using (approved = true);

-- The public can submit a review, but it can never arrive pre-approved
create policy "anyone can submit"
  on public.guide_reviews for insert with check (approved = false);

grant select, insert on public.guide_reviews to anon;

create index if not exists guide_reviews_live_idx
  on public.guide_reviews (approved, created_at desc);
```

## 3. Paste your keys into the page
Supabase dashboard -> Settings -> API. Copy:
- Project URL
- anon / public key (safe to expose; it is protected by the rules above)

Open `index.html`, search for `PASTE YOUR SUPABASE KEYS HERE`, and fill in:

```js
const SUPABASE_URL = 'https://YOURPROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...your anon key...';
```

Commit + push (auto-deploys). Done.

## How moderation works
Every submitted review lands with `approved = false`, so nobody sees it yet.
To publish one: Supabase -> Table Editor -> `guide_reviews` -> flip its
`approved` toggle to `true`. It shows up on the site on the next refresh.

To reject spam: just delete the row (or leave it unapproved).

## Spam protection
- Nothing appears publicly until you approve it (your main defense).
- The form has a hidden honeypot field; bots that fill it are silently ignored.
- If it ever gets noisy, we can add a Cloudflare Turnstile checkbox.

## Tip: prime the wall
An empty wall is less inspiring. Submit your own family's story first (Amilia,
Siena, and Ella + Golden Stems) and approve it, so the first visitor sees a
real example.
