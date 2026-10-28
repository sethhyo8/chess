import { test, expect } from "@playwright/test";

test("coach preferences live in Settings and persist after refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play With Coach", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "What should I look for?", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Teaching level" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Settings & about", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Teaching level" })
    .selectOption("intermediate");
  await page
    .getByRole("combobox", { name: "Commentary detail" })
    .selectOption("minimal");
  await page.getByLabel("Warn before serious mistakes").check();
  await page.getByLabel("Coach commentary").uncheck();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.locator(".bubble")).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Play With Coach", exact: true })
    .click();
  await expect(page.locator(".bubble")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Settings & about", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Teaching level" }),
  ).toHaveValue("intermediate");
  await expect(
    page.getByRole("combobox", { name: "Commentary detail" }),
  ).toHaveValue("minimal");
  await expect(page.getByLabel("Warn before serious mistakes")).toBeChecked();
});

test("screenshot screen accepts pasted moves and evaluation values fit the wider bar", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Analyse Screenshot", exact: true })
    .click();
  await page.locator(".paste-moves > summary").click();
  await page
    .getByRole("textbox", { name: "Move list", exact: true })
    .fill("e2e5");
  await page
    .getByRole("button", { name: "Analyse moves", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Could not read moves",
  );
  await page
    .getByRole("textbox", { name: "Move list", exact: true })
    .fill("1. e4 e5 2. Nf3 Nc6");
  await page
    .getByRole("button", { name: "Analyse moves", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".under-board")).toContainText("4 of 4");
  await expect(page.locator("[data-square=f3] img")).toHaveAttribute(
    "alt",
    "White knight",
  );
  const bar = page.locator(".eval-bar");
  await expect(bar).toHaveCSS("width", "52px");
  await expect(bar.locator("span")).toHaveCSS("writing-mode", "horizontal-tb");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect(
      await bar
        .locator("span")
        .evaluate((label) => label.scrollWidth <= label.clientWidth),
    ).toBe(true);
  }
});
