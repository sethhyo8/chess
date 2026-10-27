import { test, expect } from "@playwright/test";
import { makeGame } from "../../shared/chess.js";

test("opening search filters cleanly, previews a line, and opens it for analysis", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Openings", exact: true }).click();
  await expect(page.locator(".openings-page > .muted")).toContainText("3,865");
  await page
    .getByRole("searchbox", { name: "Search openings" })
    .fill("Sicilian Najdorf");
  await expect
    .poll(async () =>
      (await page.locator(".opening-list strong").allTextContents()).every(
        (name) => name.includes("Sicilian") && name.includes("Najdorf"),
      ),
    )
    .toBe(true);
  const najdorf = page
    .locator(".opening-list > button")
    .filter({
      has: page.getByText("Sicilian Defense: Najdorf Variation", {
        exact: true,
      }),
    })
    .filter({ has: page.getByText("B90", { exact: true }) });
  await najdorf.click();
  await expect(page.locator(".opening-preview h2")).toHaveText(
    "Sicilian Defense: Najdorf Variation",
  );
  await expect(page.locator("[data-square=a6] img")).toHaveAttribute(
    "src",
    "/pieces/neo/bP.png",
  );
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator("[data-square=a7] img")).toBeVisible();
  await page.locator(".opening-moves button").last().click();
  await expect(page.locator("[data-square=a6] img")).toBeVisible();
  await page
    .getByRole("button", { name: "Analyse opening", exact: true })
    .click();
  await expect(page.locator(".opening-strip")).toContainText(
    "B90 · Sicilian Defense: Najdorf Variation",
  );
  await expect(page.locator(".under-board")).toContainText("10 of 10");
  await expect(page.locator(".panel-tabs button")).toHaveText([
    "Analysis",
    "Review",
  ]);
  await page.getByRole("button", { name: "Openings", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search openings" })
    .fill("zzzznoopening");
  await expect(page.locator(".opening-list > button")).toHaveCount(0);
  await expect(page.locator(".opening-no-results")).toBeVisible();
  for (const width of [375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
});

test("light mode persists, dark background is exact, and theme controls work during bot play", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(48, 46, 43)",
  );
  await page
    .getByRole("button", { name: "Toggle colour theme", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(245, 243, 237)",
  );
  await page
    .getByRole("button", { name: "Play with Bots", exact: true })
    .click();
  await page.getByRole("button", { name: "Play Milo", exact: true }).click();
  await page
    .locator(".bot-play-panel")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(48, 46, 43)",
  );
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.locator(".bot-play-panel")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.setViewportSize({ width: 375, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
});

test("board and captured trays use locally bundled high-resolution Neo images", async ({
  page,
}) => {
  await page.goto("/");
  const game = makeGame(
    undefined,
    ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qe5+", "Be2"],
    { White: "Milo", Black: "You" },
  );
  await page.evaluate((game) => {
    localStorage.setItem("grove-current", JSON.stringify(game));
    localStorage.setItem(
      "grove-bot",
      JSON.stringify({
        botId: "milo",
        color: "b",
        preset: 0,
        coach: false,
        ended: null,
        clocks: { w: 0, b: 0 },
      }),
    );
  }, game);
  await page.reload();
  await expect(page.locator(".captured-tray img")).toHaveCount(2);
  await expect(page.locator(".captured-tray img").first()).toHaveAttribute(
    "src",
    /\/pieces\/neo\/[wb]P\.png/,
  );
  await expect
    .poll(() =>
      page
        .locator(".captured-tray img")
        .first()
        .evaluate((image) => image.naturalWidth),
    )
    .toBe(300);
  await expect(page.locator(".captured-tray img").first()).toHaveCSS(
    "width",
    "20px",
  );
  await expect(page.locator("[data-square=d8] img")).toHaveCount(0);
  await expect(
    page.locator(".sidebar nav .resource-icon").first(),
  ).toHaveAttribute("src", "/brand/chesscom/play.png");
});
