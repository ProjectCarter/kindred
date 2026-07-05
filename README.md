# Kindred — Milestone 1

This is the very first working version of Kindred: sign in with just your
email, tell it about one thing you own, and land on a quiet home screen.
No AI, no marketplace, no notifications yet — that's intentional.

Follow these steps in order. None of them require you to know how to code.

## 1. Create your Supabase project

1. Go to https://supabase.com and create a free account.
2. Click **New Project**. Choose any name (e.g. "kindred"), set a database
   password (save it somewhere safe), and pick any region.
3. Wait a minute or two while it provisions.

## 2. Run the database setup

1. In your Supabase project, open the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open the file `supabase/migrations/0001_init.sql` from this project,
   copy its entire contents, and paste it into the SQL Editor.
4. Click **Run**. You should see "Success. No rows returned."

This creates every table and every privacy rule the app needs — including
making sure one person's data is never visible to another person.

## 3. Get your project's API keys

1. In Supabase, go to **Project Settings → API**.
2. You'll see a **Project URL** and an **anon public** key. You'll need both
   in the next step.

## 4. Configure the app

1. In this project folder, make a copy of `.env.local.example` and rename
   the copy to `.env.local`.
2. Open `.env.local` and paste in your Project URL and anon public key from
   step 3.

## 5. Tell Supabase where the app lives

1. In Supabase, go to **Authentication → URL Configuration**.
2. Under **Site URL**, enter `http://localhost:3000` (for now).
3. Under **Redirect URLs**, add `http://localhost:3000/auth/callback`.
   (You'll add your real website address here later, when we deploy.)

## 6. Install and run

You'll need Node.js installed once — download it from https://nodejs.org
(choose the "LTS" version) if you don't already have it.

Then, in a terminal, inside this project folder, run:

```
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## 7. Test it

1. Enter your email address and click Continue.
2. Check your email — click the link Kindred sent you.
3. You should land on the onboarding screen. Tell it about one thing you
   own, optionally attach a photo, and submit.
4. You should land on a quiet home screen showing what you just told it,
   and an honest message that there's nothing new yet.

If all of that works, Milestone 1 is complete.

## What's intentionally not here yet

No AI-generated insights, no notifications, no marketplace browsing, no
matching between users. Those come in later milestones, in order, once
each one is proven. Building them now would be exactly the kind of
premature complexity the Constitution and architecture explicitly rule out.
