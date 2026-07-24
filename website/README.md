# Kindred — Marketing Website

The landing page for **Kindred** (discoverkindred.com) — a personalized local
morning newspaper that helps people discover events, food & drinks, activities,
history, weather, and local stories around them every day.

Built with **Next.js (App Router)**, **TypeScript**, and **TailwindCSS**.

## Getting started

```bash
cd website
npm install
npm run dev     # http://localhost:3200
```

## Scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start the dev server on port 3200    |
| `npm run build` | Production build                     |
| `npm run start` | Serve the production build           |
| `npm run lint`  | Lint (optional)                      |

## Design language

Apple-inspired: generous whitespace, large serif headlines, subtle gradients,
soft rounded cards, and gentle scroll animations.

**Palette**

| Token         | Hex       | Use                        |
| ------------- | --------- | -------------------------- |
| Cream         | `#FDFCF9` | Background                 |
| Soft purple   | `#C2A9EF` | Primary accent             |
| Gold          | `#D8A63A` | Highlights                 |
| Dark charcoal | `#20242E` | Text                       |

## Structure

```
website/
├─ app/
│  ├─ layout.tsx        # Fonts, SEO metadata, theme (no-flash) script
│  ├─ page.tsx          # Landing page composition + JSON-LD
│  ├─ globals.css       # Tailwind layers + design tokens
│  ├─ sitemap.ts        # SEO sitemap
│  ├─ robots.ts         # SEO robots
│  ├─ privacy/          # Privacy Policy (placeholder copy)
│  └─ terms/            # Terms of Service (placeholder copy)
├─ components/          # Nav, Hero, Features, WhyKindred, ComingSoon, Footer, …
└─ public/
   ├─ favicon.svg
   ├─ og-image.svg
   └─ screenshots/
      └─ edition-home.svg   # Replaceable app screenshot placeholder
```

## Replacing the placeholder screenshot

The phone in the hero renders `/public/screenshots/edition-home.svg`. Drop a
real app screenshot (≈390×844, 9:19.5) at that path — or any image — and update
the `src` passed to `<PhoneMockup />` in `components/Hero.tsx`.

## Features

- Light + **dark mode** (system-aware, no flash of wrong theme, user toggle)
- **SEO**: metadata, Open Graph, Twitter cards, JSON-LD, sitemap, robots
- **Accessibility**: skip link, semantic landmarks, focus states, reduced-motion
- **Responsive** across mobile and desktop
- Smooth, tasteful scroll-reveal animations
