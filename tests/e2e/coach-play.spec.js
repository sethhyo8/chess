import { test, expect } from "@playwright/test";

const moves = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("grove-current")).moves);

test("coach plays the opponent, preserves the game, and supports takebacks and restart", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".topbar .engine-pill")).toHaveCount(0);
  await expect(
    page
      .locator(".topbar")
      .getByRole("button", { name: "Toggle colour theme" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Play With Coach", exact: true })
    .click();
  await expect(page.locator(".bubble")).toBeVisible();
  await page.locator("[data-square=e2]").click();
  await page.locator("[data-square=e4]").click();
  await expect.poll(() => moves(page), { timeout: 15000 }).toHaveLength(2);
  expect((await moves(page))[0]).toBe("e4");
  await expect(page.locator(".branch-banner")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Play With Coach");
  await expect(page.locator(".bubble")).toBeVisible();
  await expect.poll(() => moves(page)).toHaveLength(2);
  await page
    .getByRole("button", { name: "Practice takeback", exact: true })
    .click();
  await expect.poll(() => moves(page)).toEqual([]);
  await page.locator("[data-square=d2]").click();
  await page.locator("[data-square=d4]").click();
  await expect.poll(() => moves(page), { timeout: 15000 }).toHaveLength(2);
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await expect.poll(() => moves(page)).toEqual([]);
  await expect(page.locator("h1")).toHaveText("Play With Coach");
});

test("coach board prevents the player moving Black while a reply is pending", async ({
  page,
}) => {
  let releaseReply;
  const reply = new Promise((resolve) => {
    releaseReply = resolve;
  });
  await page.route("**/api/bot", async (route) => {
    await reply;
    await route.fulfill({ json: { move: "e5" } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play With Coach", exact: true })
    .click();
  await page.locator("[data-square=e2]").click();
  await page.locator("[data-square=e4]").click();
  await expect(page.locator(".thinking")).toBeVisible();
  await page.locator("[data-square=d7]").click();
  await page.locator("[data-square=d5]").click();
  expect(await moves(page)).toEqual(["e4"]);
  releaseReply();
  await expect.poll(() => moves(page)).toEqual(["e4", "e5"]);
});
