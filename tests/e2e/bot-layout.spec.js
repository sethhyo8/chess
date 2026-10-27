import { test, expect } from "@playwright/test";
test("clean bot workspace, material trays, result popup and separate review", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play with Bots", exact: true })
    .click();
  await page.getByRole("button", { name: "Play Milo", exact: true }).click();
  await expect(page.locator(".bot-play-panel")).toBeVisible();
  await expect(page.locator(".panel-tabs")).toHaveCount(0);
  await expect(page.locator(".bubble")).toHaveCount(0);
  await expect(page.locator(".board-note")).toHaveCount(0);
  await expect(page.locator(".workspace-heading")).toBeHidden();
  await expect(page.locator(".grow-card, .lesson, .bot-status")).toHaveCount(0);
  const panel = page.locator(".bot-play-panel");
  await expect(panel.locator(".bot-action-grid button")).toHaveCount(3);
  await expect(panel.locator(".bot-action-grid button")).toHaveText([
    "",
    "",
    "",
  ]);
  await expect(
    panel.getByRole("button", { name: "Practice takeback" }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: "Hint", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.locator(".arrow-layer")).toBeVisible({ timeout: 15000 });
  await panel.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.locator(".arrow-layer")).toHaveCount(0);
  const fen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1";
  await page.evaluate((fen) => {
    localStorage.setItem(
      "grove-current",
      JSON.stringify({
        id: "clean-mate",
        start: fen,
        fens: [fen],
        moves: [],
        headers: { White: "Atlas", Black: "You" },
        created: Date.now(),
      }),
    );
    localStorage.setItem(
      "grove-bot",
      JSON.stringify({
        botId: "atlas",
        color: "b",
        preset: 0,
        coach: false,
        ended: null,
        clocks: { w: 0, b: 0 },
      }),
    );
  }, fen);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Game complete" })).toBeVisible(
    { timeout: 20000 },
  );
  await expect(page.getByRole("dialog")).toContainText(
    "White wins by checkmate",
  );
  await expect(page.locator(".captured-tray")).toHaveCount(2);
  await expect(page.locator(".captured-tray")).toContainText(["+9", ""]);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("grove-library"))[0]?.headers.Result,
      ),
    )
    .toBe("1-0");
  await page.screenshot({
    path: "test-results/result-popup.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close result" }).click();
  await expect(page.locator(".bot-play-panel")).toContainText("Game complete");
  await page.screenshot({ path: "test-results/clean-bot.png", fullPage: true });
  await page
    .locator(".bot-play-panel")
    .getByRole("button", { name: "Game Review", exact: true })
    .click();
  await expect(page.locator(".bot-play-panel")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start Game Review" }),
  ).toBeVisible();
});
