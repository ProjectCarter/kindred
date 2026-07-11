# Kindred — The First Edition

This adds real content: a manually-triggered button that builds today's
edition from real weather, real headlines, and a real historical fact,
written in Kindred's voice.

## New setup steps

### 1. Run the new database migration

Same as before — Supabase SQL Editor, paste and run
`supabase/migrations/0003_editions.sql`.

### 2. Get a free NewsAPI key

1. Go to https://newsapi.org/register, sign up (free tier).
2. Copy your API key.

### 3. Get your Anthropic API key

If you don't already have one, go to https://console.anthropic.com,
create a key under **API Keys**.

### 4. Install the Supabase CLI (one-time)

This lets you deploy the Edge Function from your computer.

```
npm install -g supabase
```

### 5. Log in and link your project

```
supabase login
supabase link --project-ref YOUR-PROJECT-REF
```

Your project ref is in your Supabase project URL:
`https://YOUR-PROJECT-REF.supabase.co`.

### 6. Set your secret keys

These stay on the server — never in the app itself.

```
supabase secrets set NEWS_API_KEY=your-newsapi-key
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key
```

### 7. Deploy the Edge Function

```
supabase functions deploy generate-edition
```

## Test it

1. Restart the app (`npx expo start`), reload it on your phone.
2. You should see "Good morning" with a **Build today's edition** button.
3. Tap it — it takes a few seconds while it gathers real data and writes
   your edition.
4. You should see: a greeting, Weather, Top Stories, Today in History, and
   Looking Ahead — each with a small source note underneath.
5. Scroll to the end — you should see "That's your edition for today,"
   not an endless feed.

## Known, intentional limitation this milestone

The **Build today's edition** button is scaffolding, not the final
experience — it exists so we can see real content before automating
overnight generation in the next milestone, The Morning Arrives. It
directly conflicts with the Constitution's "no upfront asks" principle,
on purpose, temporarily.
supabase --version
