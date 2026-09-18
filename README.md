# Kickivo

Kickivo is a football (soccer) tournament management platform. Organizers can spin up
leagues, knockouts, or mixed group-stage-plus-knockout tournaments, run live match scoring
with a shared match clock, and auto-generate fixtures and brackets. Players can join a
team's roster through a shareable invite link.

## Features

- Create league, knockout, or "mixed" (group stage + knockout) tournaments
- Auto-generated fixtures and knockout brackets, including byes and optional home-and-away legs
- Live match scoring: goals, cards, substitutions, penalty shootouts, and a shared match timer
- Group standings and knockout bracket views, updated in real time
- Team rosters with a shareable join link so players can claim their own slot
- Community recruitment board (looking for a team / looking for a player / friendly match requests)
- Per-player career stats (goals, assists, cards) across tournaments
- Installable as a PWA

## Tech stack

- React 19 + TypeScript, built with Vite
- Tailwind CSS v4
- Firebase Authentication (Google sign-in) + Firestore, used directly from the client — there is no custom backend
- `motion` for animation, `lucide-react` / `react-icons` for icons

## Getting started

### Prerequisites

- Node.js 20+ (developed and tested on Node 24)
- A Firebase project with **Authentication (Google provider)** and **Firestore** enabled

### Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Point the app at your Firebase project by editing `firebase-applet-config.json` with your
   project's web app config (Firebase console → Project settings → General → Your apps).
3. Deploy the rules in `firestore.rules` to that project (Firebase console's Rules editor, or
   `firebase deploy --only firestore:rules` if you have the Firebase CLI set up). This file is
   the app's entire authorization layer since there's no backend server — the app will not
   behave correctly against a project's default rules.
4. Run the app:
   ```
   npm run dev
   ```

## Scripts

| Script            | Description                                                                          |
|-------------------|----------------------------------------------------------------------------------------|
| `npm run dev`     | Start the Vite dev server on port 3000                                                 |
| `npm run build`   | Production build to `dist/`                                                            |
| `npm run start`   | Serve the production build via `server.js` (binds `process.env.PORT`, default 8080)    |
| `npm run preview` | Preview the production build locally with Vite                                        |
| `npm run lint`    | Typecheck with `tsc --noEmit`                                                           |
| `npm run clean`   | Remove `dist/`                                                                          |

## Deployment

This repo ships with `server.js`, a small Express static server that serves `dist/` and
listens on `process.env.PORT`. That's required for platforms like Firebase App Hosting or
Cloud Run, which assign a port at runtime and expect the container to bind it. If you're
deploying to a platform built for static sites instead (classic Firebase Hosting, Netlify,
Vercel, Cloudflare Pages), you can skip `server.js` and serve `dist/` directly — it's a
plain client-side app with no server-side rendering.

## Project structure

- `src/App.tsx` — top-level view routing, auth state, and the invite-link deep-link handler
- `src/components/Home`, `Dashboard`, `Tournament`, `Match` — the app's screens
- `src/components/views/RecruitmentBoard.tsx` — community recruitment board
- `src/lib/firebase.ts` — Firebase app/auth/Firestore initialization and error handling
- `src/utils/football.ts` — team-name/short-name and player-sort helpers
- `firestore.rules` — Firestore security rules
