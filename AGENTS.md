<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ai-tutor

AI tutoring web app on Next.js 16 App Router + React 19 + Tailwind v4: a Mastra agent served to a CopilotKit chat over AG-UI, behind Better Auth email/password sign-in, over a Drizzle/SQLite persistence layer, with a Vitest + Playwright test harness.

## Commands

- `npm run lint` is `biome check` and `npm run format` is `biome format --write` — Biome only, so never add ESLint or Prettier config.
- `npm run db:generate` writes a migration from the schema and `npm run db:migrate` applies it to `DATABASE_URL`.
- `npm run auth:generate` regenerates `lib/auth-schema.ts` from the Better Auth config; follow it with `db:generate` + `db:migrate`.

## App code — `app/layout.tsx`, `app/page.tsx`, `components/`

- `PageProps<'/route'>` and `LayoutProps<'/route'>` are globals generated into `.next/types`, so a typecheck on a clean checkout fails until `next dev` or `next build` has run once.
- TypeScript 7 has no JavaScript compiler API, so `next build` type-checks by shelling out to the project-local `tsc` (`experimental.useTypeScriptCli`, on by default) — turning it off makes the build exit.
- Import across the repo with the `@/*` alias (rooted at this directory), not deep relative paths.
- `components/ui/` holds the presentational primitives; extend one instead of repeating its class string.

## Persistence — `lib/db.ts`, `lib/schema.ts`, `lib/auth-schema.ts`, `drizzle.config.ts`, `drizzle/`

- `lib/db.ts` is `server-only` and the single place that opens the database; import `db` from it rather than constructing another `drizzle()`.
- Table definitions live in `lib/schema.ts` so drizzle-kit and tests can import them without tripping the `server-only` marker.
- `lib/auth-schema.ts` is overwritten wholesale by `auth:generate`, so app tables belong in `lib/schema.ts`, which re-exports it as the one entry point drizzle-kit and the Drizzle adapter read.
- The driver is `drizzle-orm/libsql/node` over a `file:` URL, and drizzle-kit picks `@libsql/client` on its own — do not install `better-sqlite3`.
- `drizzle/` is generated (edit the schema and re-run `db:generate`), and the SQLite file under the git-ignored `data/` is disposable — recreate it with `db:migrate`.

## Auth — `lib/auth.ts`, `lib/auth-config.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/`

- `lib/auth-config.ts` exports `authOptions(db)` and every entry point spreads it with its own literal `plugins` array — Better Auth only infers plugin helpers such as `ctx.test` from literal arrays.
- `lib/auth.ts` is the app instance (`server-only` via `lib/db.ts`, `nextCookies()` last); `lib/auth-cli.ts` exists only because the Better Auth CLI refuses to load a module graph containing `server-only`.
- Gate pages server-side with `auth.api.getSession({ headers: await headers() })` and `redirect()`; there is deliberately no `proxy.ts`, whose cookie check would not validate anything.
- Email/password only: adding a provider or plugin means re-running `auth:generate` and the migration flow.

## Agent — `lib/tutor.ts`, `components/chat.tsx`, `app/api/copilotkit/[...all]/`

- `lib/tutor.ts` is the whole agent: one `Agent` (`TUTOR_AGENT_ID`, a butler who only keeps the user's to-do list) on `openrouter/z-ai/glm-5.3-flash`, held on a `Mastra` instance cached on `globalThis` the way `lib/db.ts` caches its connection.
- Mastra's model router reads `OPENROUTER_API_KEY` itself, so no AI SDK provider package is installed and the model string keeps its `provider/vendor/model` shape.
- Memory is `@mastra/memory` over a `LibSQLStore` on `DATABASE_URL`; the same store is passed to the `Mastra` instance too, or it warns and silently falls back to a non-durable in-memory one.
- Mastra creates and owns its `mastra_*` tables in that file — they are not in `lib/schema.ts` and `db:generate` must not try to manage them.
- The route builds the AG-UI bridge per request with `MastraAgent.getLocalAgent({ resourceId: session.user.id })`, so memory is scoped by the verified user id and never by anything in the request.
- Thread ids are `tutor:<userId>` (`tutorThreadId`), rendered into the page from the session so a reload rejoins the same conversation; a forged one fails on Mastra's `AGENT_MEMORY_THREAD_RESOURCE_MISMATCH`, which is what actually keeps user A out of user B's thread.
- The route answers 401 before touching Mastra, and that is the only auth gate — the runtime endpoint is otherwise public.
- Use `createCopilotRuntimeHandler` from `@copilotkit/runtime/v2`; the package's own `skills/runtime/` docs flag the Express and Hono adapters as "avoid at all costs".
- `@copilotkit/react-core/v2` is the whole client surface (`CopilotKit`, `CopilotChat`, `styles.css`) — `@copilotkit/react-ui` and the package roots are v1 and do not work with it.
- The CopilotKit Inspector is on by default in development (`enableInspector` stays unset; `showDevConsole` is deprecated and controls nothing). Its `<cpk-web-inspector>` launcher would sit on the header's sign-out button, so `app/globals.css` shifts the host down with a margin.
- `OPENROUTER_BASE_URL` (optional, see `.env.example`) routes the model traffic through a local proxy; with a custom `url` Mastra's model router no longer reads `OPENROUTER_API_KEY` itself, which is why `lib/tutor.ts` passes `apiKey` explicitly.
- Threads only persist inside Mastra's memory — the runtime runs on the default `InMemoryAgentRunner`, so the browser's own transcript still starts empty on reload.
- `@copilotkit/runtime` drags in a zod-3 dependency tree that conflicts with Better Auth's zod 4, and `better-auth` and `@copilotkit/channels-core` both cap their optional `vitest` peer at 4 — hence `.npmrc`'s `legacy-peer-deps=true`; drop it and `npm install` fails.

## Tests — `tests/unit` (Vitest), `tests/e2e` (Playwright)

- Vitest is jsdom + Testing Library and only picks up `tests/unit/**/*.test.{ts,tsx}`; async Server Components are unsupported there, so cover those with e2e instead.
- `vitest.config.mts` resolves `@/*` through `resolve.tsconfigPaths` — the `vite-tsconfig-paths` plugin the Next.js guide recommends is deprecated, so don't reinstall it.
- Vitest 5 takes `vite` as a peer rather than a dependency, and `legacy-peer-deps` installs no peers, so `vite` is a direct devDependency here.
- Playwright runs Chromium only against its own `next dev` on port 3100 (override with `E2E_PORT`).
- `next dev` refuses to start twice against one dist dir, so `next.config.ts` reads `NEXT_DIST_DIR` and the e2e server sets it to `.next-e2e`; that dir also needs a `tsconfig.json` include entry, which `next dev` adds itself.
- `tests/unit/db.test.ts` and `tests/unit/auth.test.ts` opt out of jsdom with a `// @vitest-environment node` first line and migrate a temp file, so they never touch `data/app.db`.
- The auth test builds its own instance from `authOptions` with the `testUtils()` plugin and an explicit `secret`/`baseURL`, because Vitest does not load `.env`.
- `tests/e2e/auth.spec.ts` does hit `data/app.db`, so it signs up a `Date.now()`-stamped email; `playwright.config.ts` also overrides `BETTER_AUTH_URL` onto its own port.
- `tests/unit/copilotkit-route.test.ts` mocks `@/lib/auth`, `@/lib/tutor`, and both CopilotKit/AG-UI modules, so it covers the 401 gate and the `resourceId` wiring without a model call; nothing in the suite calls OpenRouter.

## Styling — `app/globals.css`, `postcss.config.mjs`

- Tailwind v4 has no `tailwind.config.*`; design tokens live in the `@theme inline` block of `globals.css`.
- The `body` rule in `globals.css` applies `--font-geist-sans` globally, so reach for a `font-mono` utility only where the mono face is actually wanted.

## Secrets — `.env`

- Holds `DATABASE_URL` (SQLite, read by both `lib/db.ts` and drizzle-kit, which loads `.env` itself), `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` read by Better Auth itself, and `OPENROUTER_API_KEY`, which Mastra's model router reads directly.
- `.gitignore` covers `.env*`; never commit the file or print its values.

## Tooling — `biome.json`

- Biome ignores `.claude/` because its vendored skill assets fail `biome check .`, `drizzle/` because drizzle-kit's generated JSON does not match its formatter, and `public/` because the create-next-app SVGs there trip `a11y/noSvgWithoutTitle`.
- `npm run format` skips assist actions such as import sorting; use `npx biome check --write <path>` to fix those.

## Maintenance — for you, the agent

- Update this file in the same change set whenever a change invalidates a line here or teaches a costly lesson.
- Prefer deleting over adding and pointers over prose; drop anything a reader would learn just by opening the file a bullet points to.
- One sentence per bullet, current state only, no history or changelog.
