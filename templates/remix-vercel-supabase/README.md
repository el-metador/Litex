# Remix + Vercel + Supabase (SSR)

Этот проект сгенерирован из template для Remix v2 + Vite + TypeScript.

## 1) Установка

```bash
npm install
cp .env.example .env
```

Заполните `.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` только для server-only кода (если понадобится).

## 2) Локальный запуск

```bash
npm run dev
```

Проверки:

```bash
npm run typecheck
npm run lint
npm run build
```

## 3) Деплой на Vercel

1. Импортируйте репозиторий в Vercel.
2. В Settings → Environment Variables добавьте:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (опционально, только server-side)
3. Deploy.

Проект использует официальный Remix+Vite preset Vercel через `@vercel/remix/vite`.
