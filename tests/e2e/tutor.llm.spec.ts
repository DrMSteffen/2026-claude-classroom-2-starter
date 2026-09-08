import { expect, test } from "@playwright/test";

// Not in the default suite: this one really calls the model, so it needs
// OPENROUTER_API_KEY and costs money. Run it with `npm run test:e2e:llm`,
// which is the only way playwright.config.ts lets a *.llm.spec.ts file match.
test("the tutor adds an item and the sidebar shows it", async ({ page }) => {
  // A model round trip plus a cold `next dev` compile of the chat route.
  test.setTimeout(180_000);

  const email = `e2e-llm-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL("/");

  const sidebar = page.getByTestId("todos-sidebar");
  await expect(sidebar.getByText("Nothing on the list.")).toBeVisible();

  await page
    .getByTestId("copilot-chat-textarea")
    .fill('Add "buy milk" to my list, please.');
  await page.getByTestId("copilot-send-button").click();

  // The write goes through the addTodo tool; components/agent-refresh.tsx
  // refreshes the sidebar once the run finishes.
  await expect(sidebar.getByText("buy milk", { exact: false })).toBeVisible({
    timeout: 120_000,
  });
});
