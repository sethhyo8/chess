import { test, expect } from "@playwright/test";

test("finished games autosave once, open explicitly, and stay out of other workspaces", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".panel-tabs button")).toHaveText([
    "Analysis",
    "Review",
  ]);
  await page
    .getByRole("button", { name: "Play with Bots", exact: true })
    .click();
  await page.getByRole("button", { name: "Play Milo", exact: true }).click();
  await page.locator("[data-square=e2]").click();
  await page.locator("[data-square=e4]").click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("grove-current")).moves.length,
      ),
    )
    .toBe(2);
  const gameId = await page.evaluate(
    () => JSON.parse(localStorage.getItem("grove-current")).id,
  );

  // Active games pause independently while the coach uses a fresh board.
  await page
    .getByRole("button", { name: "Play With Coach", exact: true })
    .click();
  await expect(page.locator(".bubble")).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("grove-current")).moves,
    ),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Play with Bots", exact: true })
    .click();
  await expect(page.locator(".bot-play-panel .move-row")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("grove-current")).id,
    ),
  ).toBe(gameId);
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Resign", exact: true })
    .click();
  const result = page.getByRole("dialog", { name: "Game complete" });
  await expect(result).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("grove-library")).length,
      ),
    )
    .toBe(1);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("grove-library"))[0],
  );
  expect(saved.id).toBe(gameId);
  expect(saved.completed).toBe(true);
  expect(saved.headers.Result).toBe("0-1");
  expect(saved.bot.ended).toBe("Black wins by resignation");
  await result
    .getByRole("button", { name: "Game Review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start Game Review" }),
  ).toBeVisible();
  await expect(page.locator(".panel-tabs button")).toHaveText([
    "Analysis",
    "Review",
  ]);
  await expect(page.getByTestId("move-list")).toContainText("e4");

  await page
    .getByRole("button", { name: "Play With Coach", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("grove-current")).moves,
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Review Game", exact: true }).click();
  await expect(page.locator(".panel-tabs button")).toHaveText([
    "Analysis",
    "Review",
  ]);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("grove-current")).id,
    ),
  ).not.toBe(gameId);
  await page
    .getByRole("button", { name: "Play with Bots", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play Milo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My library", exact: true }).click();
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await expect(page.locator(".saved-card")).toContainText(
    "Black wins by resignation",
  );
  await expect(page.getByRole("button", { name: "Resume game" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Open review", exact: true }).click();
  await expect(page.getByTestId("move-list")).toContainText("e4");
  await page.getByRole("button", { name: "My library", exact: true }).click();
  await page
    .getByRole("button", { name: `Delete ${saved.title}`, exact: true })
    .click();
  await expect(page.locator(".saved-card")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Game complete" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "My library", exact: true }).click();
  await expect(page.locator(".saved-card")).toHaveCount(0);
});

test("sidebar minimises, keeps navigation accessible, and remembers the preference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  expect((await page.locator(".sidebar").boundingBox()).width).toBe(224);
  await page
    .getByRole("button", { name: "Minimise sidebar", exact: true })
    .click();
  expect((await page.locator(".sidebar").boundingBox()).width).toBe(76);
  await page
    .getByRole("button", { name: "Play With Coach", exact: true })
    .click();
  await expect(page.locator(".bubble")).toBeVisible();
  await page.reload();
  expect((await page.locator(".sidebar").boundingBox()).width).toBe(76);
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  expect((await page.locator(".sidebar").boundingBox()).width).toBe(224);
  for (const width of [375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
});
