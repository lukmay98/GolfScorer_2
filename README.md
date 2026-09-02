# Golf Round Tracker

Handicap-adjusted scorekeeping for 4-2-0 and Matchplay rounds. Built with
Next.js + Supabase (Postgres database + login).

All four tabs are built: login, database, **Players**, **Courses**,
**Round** (live scoring), and **Completed** rounds.

## 1. Create your database (Supabase)

1. Go to https://supabase.com, sign up, and create a new project (pick any
   name/region, save the database password somewhere).
2. Once it's ready, open **SQL Editor** (left sidebar) → **New query**.
3. Paste the entire contents of `supabase/schema.sql` from this project and
   click **Run**. This creates all the tables and security rules.
4. Go to **Project Settings → API**. You'll need two values from this page:
   - **Project URL**
   - **anon public** key

## 2. Configure the app

1. In this project, copy `.env.local.example` to `.env.local`:
   ```
   cp .env.local.example .env.local
   ```
2. Fill in the two values from Supabase:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```

## 3. Run it locally (optional, to try it out first)

```
npm install
npm run dev
```

Open http://localhost:3000, click **Create an account**, sign up, confirm
your email (Supabase sends a confirmation link), then log in.

## 4. Deploy to the internet (Vercel)

1. Push this project to a GitHub repository (create one on github.com, then
   follow its instructions to push this folder).
2. Go to https://vercel.com, sign up with your GitHub account, click **Add
   New → Project**, and import the repository.
3. In the import screen, expand **Environment Variables** and add the same
   two values from step 2 above (`NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Click **Deploy**. After a minute you'll get a live URL like
   `golf-tracker.vercel.app` — that's the link you send to friends.

### Inviting friends

By default, Supabase requires email confirmation for new accounts, which is
fine for a small friend group signing up with real emails. Anyone who signs
up and confirms their email can log in and use the shared roster, courses,
and rounds — there's no separate "invite" step needed.

## What's built

- Email/password login and signup (Supabase Auth)
- Database schema for golfers, courses, rounds, round players, and scores —
  including the one-active-round rule, handicap snapshotting, and duplicate
  protections described in the app spec
- **Players tab**: add, search, edit, delete (blocked if used in a saved
  round), duplicate-name protection
- **Courses tab**: add an 18-hole course (par + handicap index per hole),
  search, view hole details, delete (blocked if used in a saved round),
  validation that handicap indexes cover 1–18 with no duplicates
- **Round tab**: start a 4-2-0 or Matchplay round (course/player search,
  hole range, handicap allowance, optional Matchplay cap); live hole-by-hole
  scoring with a running leaderboard; pause a round and resume it later;
  multiple rounds can sit on hold at once; a round can't be finished until
  every golfer has a score on every hole
- **Completed tab**: filter round history by course, golfer(s), and date
  range; each round shows final points and winner/tie; expand for the full
  hole-by-hole scorecard (gross score and points per hole); delete a round

### A note on the 4-2-0 point split

The spec didn't state the exact points per hole for the 4-2-0 format, only
that it's for three golfers and points are calculated hole by hole. I built
it as the name implies: **4 points for the best net score on a hole, 2 for
second, 0 for third.** Ties share the pooled points for the ranks they
occupy — e.g. two golfers tied for best net split 4+2 evenly (3 each), and
a three-way tie splits 4+2+0 evenly (2 each). If your group actually plays
this differently, tell me the real rule and I'll adjust
`lib/scoring.ts`.

### A note on handicap stroke allocation

Strokes are given using the standard method: the golfer with the lowest
handicap in the round plays off scratch; everyone else receives
`round((their handicap − lowest handicap) × allowance%)` strokes, given one
at a time to the hardest holes first (lowest handicap index), wrapping
around the course if that's more than 18 strokes.
