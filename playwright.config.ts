import { defineConfig, devices } from "@playwright/test";

// Own port so an already-running `npm run dev` on 3000 is never touched;
// `localhost` (not 127.0.0.1) keeps the dev server's cross-origin HMR check quiet.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

// A `*.llm.spec.ts` run costs real OpenRouter calls, so the default suite never
// sees one and `npm run test:e2e:llm` runs nothing else.
const llm = !!process.env.E2E_LLM;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: llm ? "**/*.llm.spec.ts" : undefined,
  testIgnore: llm ? undefined : "**/*.llm.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    // Own dist dir (see next.config.ts) so this server's lock never collides
    // with a `npm run dev` already running in this directory.
    // BETTER_AUTH_URL in .env points at port 3000; Better Auth needs this one.
    env: { NEXT_DIST_DIR: ".next-e2e", BETTER_AUTH_URL: baseURL },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120_000,
  },
});
