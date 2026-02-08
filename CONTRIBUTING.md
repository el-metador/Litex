# Contributing to LiteCode

LiteCode is a Vercel-first fork of Bolt.new with:

- Groq as the LLM provider
- Supabase for auth, storage, and Postgres
- Node backend layer for limits, billing, and queues

## Prerequisites

- Node.js `20.15.1` (or newer `20.x`)
- pnpm `9.4.0`
- Supabase project (URL + anon key + service role key)
- Groq API key

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure env:

```bash
cp .env.example .env.local
```

3. Apply Supabase migration:

```bash
supabase db push
```

4. Start dev server:

```bash
pnpm run dev
```

## Scripts

- `pnpm run dev` - Remix dev server
- `pnpm run build` - production build
- `pnpm run start` - run built server locally
- `pnpm run preview` - build + start
- `pnpm run lint` - lint checks
- `pnpm run typecheck` - TypeScript checks
- `pnpm test` - test suite

## Deployment

- Deploy to Vercel from UI or:

```bash
pnpm run deploy
```

Set all required env vars in the Vercel project settings.

