# Lite.ai (LiteCode)

<p align="center">
  <img src="./icons/logo.svg" alt="Lite.ai logo" width="96" />
</p>

<p align="center">
  <strong>AI workspace для разработки full-stack проектов на базе Remix + Vite + Supabase + Vercel.</strong>
</p>

<p align="center">
  <a href="https://github.com/el-metador/Lite.ai"><img src="https://img.shields.io/badge/GitHub-el--metador%2FLite.ai-181717?style=for-the-badge&logo=github" alt="GitHub" /></a>
  <img src="https://img.shields.io/badge/Node.js-20.15.1+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/pnpm-9.4.0-F69220?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" />
  <img src="https://img.shields.io/badge/Remix-2.16.7-000000?style=for-the-badge&logo=remix&logoColor=white" alt="Remix" />
  <img src="https://img.shields.io/badge/Vercel-Deploy-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
</p>

## Языки и технологии

### Языки проекта

<p>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/SCSS-CC6699?style=for-the-badge&logo=sass&logoColor=white" alt="SCSS" />
  <img src="https://img.shields.io/badge/SQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="SQL" />
</p>

### Языки, доступные в редакторе темы

<p>
  <img src="https://img.shields.io/badge/C++-00599C?style=for-the-badge&logo=cplusplus&logoColor=white" alt="C++" />
  <img src="https://img.shields.io/badge/HTML-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML" />
  <img src="https://img.shields.io/badge/CSS-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript editor support" />
  <img src="https://img.shields.io/badge/JSON-000000?style=for-the-badge&logo=json&logoColor=white" alt="JSON" />
  <img src="https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white" alt="Markdown" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Sass-CC6699?style=for-the-badge&logo=sass&logoColor=white" alt="Sass" />
  <img src="https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=webassembly&logoColor=white" alt="WebAssembly" />
</p>

### Core stack

- Frontend: `React 18`, `Remix`, `UnoCSS`, `Radix UI`, `Framer Motion`
- Backend: Remix API routes + Node layer (`app/lib/.server/node-layer`)
- AI: `ai` SDK + `@ai-sdk/google` (Gemini) + `@ai-sdk/openai` (OpenRouter)
- Data/Auth/Storage/Billing: `Supabase` (`Postgres + Auth + Storage`)
- Deploy: `Vercel` (`@vercel/remix` preset)

## Что умеет проект

- AI чат (`/api/chat`) с fallback на альтернативные модели.
- Prompt enhancer (`/api/enhancer`) с учетом дневных лимитов.
- Auth-состояние, лимиты и billing snapshot через API.
- Загрузка артефактов в Supabase Storage (`/api/storage`).
- Режим работы без Supabase (ограниченный, с in-memory fallback).

## Требования и зависимости

### Системные требования

- `Node.js >= 20.10.0` (в проекте используется `20.15.1`)
- `pnpm 9.4.0`
- Аккаунт `Vercel` для прод-деплоя
- Аккаунт `Supabase` для auth/storage/billing

### Ключевые npm-зависимости

- Framework/runtime: `@remix-run/*`, `react`, `react-dom`, `vite`
- AI: `ai`, `@ai-sdk/google`, `@ai-sdk/openai`
- Data/Auth: `@supabase/supabase-js`
- UI/Editor: `@codemirror/*`, `@xterm/xterm`, `framer-motion`, `@radix-ui/*`
- Tooling: `typescript`, `vitest`, `eslint`, `unocss`

## Быстрый старт

### 1) Клонирование и установка

```bash
git clone https://github.com/el-metador/Lite.ai.git
cd Lite.ai
pnpm install
```

### 2) Локальный env

```bash
cp .env.example .env.local
```

Заполни ключи (минимум один LLM провайдер, см. раздел ниже).

### 3) Запуск в dev

```bash
pnpm run dev
```

По умолчанию Remix/Vite поднимается локально на dev-порту (обычно `5173`).

## Подробно про `.env`

Источник шаблона: `.env.example`.

### Минимум для локального запуска

В текущем коде дефолтная модель: `openrouter-free-1`.

- Вариант A (рекомендован по умолчанию): заполнить `OPENROUTER_API_KEY`.
- Вариант B (Gemini): заполнить `GEMINI_API_KEY` и сменить `LITECODE_DEFAULT_MODEL=gemini-cheap`.

Если не заполнить нужный ключ для выбранной модели, backend вернет ошибку вида `Missing ... API_KEY`.

### 1) LLM и модели

| Переменная | Обязательность | Значение по умолчанию | Назначение |
|---|---|---|---|
| `GEMINI_API_KEY` | Условно | `""` | Ключ Gemini. Нужен, если используешь `gemini-cheap`. |
| `GEMINI_MODEL` | Нет | `gemini-2.0-flash-lite` | Идентификатор Gemini модели для `gemini-cheap`. |
| `OPENROUTER_API_KEY` | Условно | `""` | Ключ OpenRouter. Нужен для `openrouter-free-1/2`. |
| `OPENROUTER_BASE_URL` | Нет | `https://openrouter.ai/api/v1` | Base URL OpenRouter API. |
| `OPENROUTER_MODEL_FREE_1` | Нет | `google/gemma-3-27b-it:free` | Модель для `openrouter-free-1`. |
| `OPENROUTER_MODEL_FREE_2` | Нет | `qwen/qwen3-32b:free` | Модель для `openrouter-free-2`. |
| `OPENROUTER_APP_URL` | Нет, но желательно | `http://localhost:5173` | Передается как `HTTP-Referer` в OpenRouter. |
| `OPENROUTER_APP_NAME` | Нет, но желательно | `LiteCode` | Передается как `X-Title` в OpenRouter. |
| `LITECODE_DEFAULT_MODEL` | Нет | `openrouter-free-1` | Выбор модели по умолчанию: `gemini-cheap`, `openrouter-free-1`, `openrouter-free-2`. |

### 2) Supabase (prod-рекомендовано, для auth/storage/billing обязательно)

| Переменная | Обязательность | Значение по умолчанию | Назначение |
|---|---|---|---|
| `SUPABASE_URL` | Для prod обязательно | `""` | URL проекта Supabase (server-side). |
| `SUPABASE_ANON_KEY` | Для prod обязательно | `""` | Public anon key (server/client auth flow). |
| `SUPABASE_SERVICE_ROLE_KEY` | Для prod обязательно | `""` | Service role key для backend операций (usage, billing, jobs, storage). |
| `LITECODE_STORAGE_BUCKET` | Нет | `litecode-artifacts` | Bucket для артефактов пользователя. |
| `VITE_SUPABASE_URL` | Для клиентского auth обязательно | `""` | URL Supabase на клиенте. Обычно = `SUPABASE_URL`. |
| `VITE_SUPABASE_ANON_KEY` | Для клиентского auth обязательно | `""` | Anon key на клиенте. Обычно = `SUPABASE_ANON_KEY`. |

### 3) Планы и лимиты

| Переменная | Обязательность | Значение по умолчанию | Назначение |
|---|---|---|---|
| `LITECODE_DEFAULT_PLAN` | Нет | `free` | План по умолчанию для новых/анонимных пользователей. |
| `LITECODE_FREE_DAILY_CHAT_LIMIT` | Нет | `100` | Дневной лимит чата для free. |
| `LITECODE_FREE_DAILY_ENHANCER_LIMIT` | Нет | `60` | Дневной лимит enhancer для free. |
| `LITECODE_PRO_DAILY_CHAT_LIMIT` | Нет | `800` | Дневной лимит чата для pro. |
| `LITECODE_PRO_DAILY_ENHANCER_LIMIT` | Нет | `300` | Дневной лимит enhancer для pro. |

### 4) Логи, persistence, stream-поведение

| Переменная | Обязательность | Значение по умолчанию | Назначение |
|---|---|---|---|
| `VITE_LOG_LEVEL` | Нет | `info` | Уровень логирования клиента (`trace/debug/info/warn/error`). |
| `VITE_DISABLE_PERSISTENCE` | Нет | `0` в шаблоне | Флаг persistence чатов в IndexedDB. Практически: любой непустой value отключает persistence. |
| `LITECODE_FORCE_NON_STREAM` | Нет | `1` | `1` = всегда non-stream, `0` = пытаться стримить, unset = auto. |
| `LITECODE_EXPOSE_STREAM_ERRORS` | Нет | `0` | `1` показывает внутренние ошибки стрима в ответе API (только для отладки). |

## Backend и API

Backend слой находится в `app/lib/.server/node-layer` и используется API-роутами Remix из `app/routes/api.*`.

### Эндпоинты

| Метод | Путь | Назначение | Auth |
|---|---|---|---|
| `GET` | `/api/auth` | Статус пользователя (`authenticated`, `userId`, `plan`) | Необязателен |
| `GET` | `/api/limits` | Текущие лимиты `chat/enhancer` | Необязателен |
| `GET` | `/api/billing` | Баланс/расходы (`billing snapshot`) | Необязателен |
| `POST` | `/api/chat` | Генерация ответов LLM | Необязателен (анонимный fallback есть) |
| `POST` | `/api/enhancer` | Улучшение prompt | Необязателен (анонимный fallback есть) |
| `POST` | `/api/storage` | Сохранение артефактов в bucket | Требуется auth |

### Что важно знать про режим без Supabase

- При отсутствии корректных `SUPABASE_*` проект работает в fallback-режиме.
- Лимиты считаются в памяти процесса (`source: "memory"`), а не в БД.
- Для анонимного режима используется общий `userId = "anonymous"`.
- Storage (`/api/storage`) для анонимных запросов недоступен.

## Supabase: миграции и схема

Миграция: `supabase/migrations/20260206_litecode_core.sql`.

Создаются:

- `profiles`
- `usage_limits`
- `usage_events`
- `billing_accounts`
- `billing_ledger`
- `llm_jobs`
- bucket `litecode-artifacts`
- RLS-политики + триггер `handle_new_user`

### Как применить миграцию

#### Вариант A (самый простой): SQL Editor

1. Открой Supabase Dashboard -> SQL Editor.
2. Вставь SQL из `supabase/migrations/20260206_litecode_core.sql`.
3. Выполни скрипт.

#### Вариант B: Supabase CLI

```bash
supabase login
supabase init
supabase link --project-ref <PROJECT_REF>
supabase db push
```

## Скрипты

| Команда | Что делает |
|---|---|
| `pnpm run dev` | Локальный dev-сервер Remix + Vite |
| `pnpm run build` | Production build |
| `pnpm run start` | Запуск собранного сервера (`scripts/start-server.mjs`) |
| `pnpm run preview` | `build` + `start` |
| `pnpm run lint` | ESLint |
| `pnpm run lint:fix` | ESLint autofix |
| `pnpm run typecheck` | TypeScript проверка |
| `pnpm run test` | Vitest (одиночный прогон) |
| `pnpm run test:watch` | Vitest watch |
| `pnpm run deploy` | `vercel --prod` |

## Деплой на Vercel

Конфиг уже задан в `vercel.json`:

- framework: `remix`
- installCommand: `pnpm install --frozen-lockfile`
- buildCommand: `pnpm run build`

### Вариант A: через GitHub + Vercel Dashboard

1. Импортируй репозиторий `el-metador/Lite.ai` в Vercel.
2. Добавь все нужные переменные окружения из раздела `.env`.
3. Выполни первый deploy.

### Вариант B: через CLI

```bash
pnpm run deploy
```

Перед первым запуском CLI:

```bash
npx vercel login
npx vercel link
```

## Структура проекта

```text
app/
  lib/
    .server/
      llm/
      node-layer/
  routes/
    api.auth.ts
    api.billing.ts
    api.chat.ts
    api.enhancer.ts
    api.limits.ts
    api.storage.ts
scripts/
  start-server.mjs
supabase/
  migrations/20260206_litecode_core.sql
```

## Troubleshooting

### `Missing OPENROUTER_API_KEY environment variable`

Поставь `OPENROUTER_API_KEY` в `.env.local` или смени `LITECODE_DEFAULT_MODEL` на `gemini-cheap` и задай `GEMINI_API_KEY`.

### `Missing GEMINI_API_KEY environment variable`

Появляется при выборе `gemini-cheap` без ключа Gemini.

### `Storage backend unavailable`

Проверь `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` и наличие bucket `litecode-artifacts`.

### Лимиты странно считаются локально

Без Supabase лимиты считаются в памяти и привязаны к процессу Node. После рестарта процесса счетчики сбрасываются.

## Лицензия

`MIT` (см. `LICENSE`).
