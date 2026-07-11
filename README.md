# Kindred — Milestone 1.1 (Foundation, Auth, Onboarding)

This is the native version of Kindred, built with Expo — it runs on your
actual phone via an app called Expo Go, no App Store submission needed
during development.

## 1. Install Expo Go on your phone

- iPhone: search "Expo Go" in the App Store, install it.
- Android: search "Expo Go" in the Play Store, install it.

## 2. One setting change in Supabase (same project as before)

By default Supabase's sign-in email contains a clickable link. For a phone
app, a typed code is simpler, so we need to switch the email template:

1. In your Supabase project, go to **Authentication → Email Templates**.
2. Select the **Magic Link** template.
3. Make sure the body includes `{{ .Token }}` (the 6-digit code). Supabase's
   default template already includes this — if you haven't customized it,
   you don't need to change anything here.

## 3. Run the new database migration

1. Open the **SQL Editor** in Supabase.
2. Paste the contents of `supabase/migrations/0002_interests.sql` and run it.
   (This just adds one new column to the same `profiles` table from before.)

## 4. Configure the app

1. Copy `.env.example` to `.env`.
2. Fill in the same **Project URL** and **anon public key** from Supabase
   Settings → API that you used last time — same project, same keys.

## 5. Install and run

In a terminal, inside this project folder:

```
npm install
npx expo start
```

A QR code will appear in the terminal.

- **iPhone:** open the Camera app, point it at the QR code, tap the
  notification that appears.
- **Android:** open Expo Go, tap "Scan QR code", scan it.

The app will build and open on your phone.

## 6. Test it

1. Enter your email, tap Continue.
2. Check your email for a 6-digit code, enter it in the app.
3. You should land on the interests screen — pick a few, tap Continue.
4. You should land on a simple "Good morning" home screen.

If all of that works on your actual phone, Milestone 1.1 is complete.
