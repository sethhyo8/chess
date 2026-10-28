import { test, expect } from "@playwright/test";
import { Chess } from "../../shared/chess.js";

// These tests isolate session/UI behavior from engine strength and speed.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ready: true, name: "Test engine" } }),
  );
  await page.route("**/api/analyse", (route) => {
    const { fen, moves = [] } = route.request().postDataJSON();
    const board = new Chess(fen);
    moves.forEach((m) => board.move(m));
    const move = board.moves({ verbose: true })[0];
    return route.fulfill({
      json: {
        cp: 0,
        depth: 10,
        lines: move
          ? [
              {
                cp: 0,
                depth: 10,
                pv: [move.from + move.to + (move.promotion || "")],
              },
            ]
          : [],
      },
    });
  });
  await page.route("**/api/bot", (route) => {
    const { fen, moves = [] } = route.request().postDataJSON();
    const board = new Chess(fen);
    moves.forEach((m) => board.move(m));
    return route.fulfill({ json: { move: board.moves()[0] } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play With Coach", exact: true })
    .click();
});

test("selected coach is the opponent and survives replies, reload and takeback", async ({
  page,
}) => {
  await expect(page.locator(".player-line").first()).toContainText("Olive");
  await page
    .locator(".topbar")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Coach type" })
    .selectOption("tactics");
  await page.getByRole("button", { name: "Back to the board" }).click();
  await expect(page.locator(".player-line").first()).toContainText("Theo");
  const reply = page.waitForRequest("**/api/bot");
  await page.locator("[data-square=e2]").click();
  await page.locator("[data-square=e4]").click();
  expect((await reply).postDataJSON().elo).toBe(1200);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("grove-current")).moves.length,
      ),
    )
    .toBe(2);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("grove-current")).headers.Black,
    ),
  ).toBe("Theo");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("grove-bot")).coachId,
    ),
  ).toBe("tactics");
  await page.reload();
  await expect(page.locator(".player-line").first()).toContainText("Theo");
  await page
    .getByRole("button", { name: "Practice takeback", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("grove-current")).moves.length,
      ),
    )
    .toBe(0);
});

test("Coach has compact actions and archives resignation against the coach", async ({
  page,
}) => {
  const controls = page.getByRole("group", { name: "Coach game controls" });
  await expect(controls.getByRole("button")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Autoplay", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Replay speed" }),
  ).toHaveCount(0);
  await expect(page.locator(".play-controls")).toHaveCount(0);
  await expect(
    controls.getByRole("button", { name: "Hint", exact: true }),
  ).toBeEnabled();
  await controls.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(
    controls.getByRole("button", { name: "Hint", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await controls.getByRole("button", { name: "Resign", exact: true }).click();
  await page
    .locator(".modal")
    .getByRole("button", { name: "Resign", exact: true })
    .click();
  await expect(
    page
      .locator(".result-avatars")
      .getByRole("img", { name: "Olive", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("grove-library"))[0]?.headers.Black,
      ),
    )
    .toBe("Olive");
});

test("switching to Bots keeps bot identities and Review keeps replay controls", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Play with Bots", exact: true })
    .click();
  await page.getByRole("button", { name: "Play Milo", exact: true }).click();
  await expect(page.locator(".player-line").first()).toContainText("Milo");
  await page
    .getByRole("button", { name: "Review Game", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Autoplay", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Replay speed" }),
  ).toBeVisible();
});

test("comments and quality icons follow both moves, persist on reload and clear on takeback", async ({
  page,
}) => {
  await expect(page.getByText("Meet your coach.", { exact: true })).toHaveCount(
    0,
  );
  await page.route("**/api/analyse", (route) => {
    const { moves = [] } = route.request().postDataJSON();
    return route.fulfill({
      json: { cp: moves.length % 2 ? -50 : 0, lines: [], depth: 9 },
    });
  });
  await page.route("**/api/bot", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return route.fulfill({ json: { move: "e5" } });
  });
  await page.locator("[data-square=e2]").click();
  await page.locator("[data-square=e4]").click();
  await expect(
    page.locator("[data-square=e4] .board-move-quality img"),
  ).toHaveAttribute("alt", "Good");
  await expect(page.getByLabel("Coach conversation")).toContainText("centre");
  await expect(
    page.locator("[data-square=e5] .board-move-quality img"),
  ).toHaveAttribute("alt", "Good");
  await expect(
    page
      .getByLabel("Coach moves")
      .getByRole("img", { name: "Good", exact: true }),
  ).toHaveCount(2);
  await expect(page.getByLabel("Coach conversation")).toContainText(
    "I'm putting",
  );
  await expect(page.getByLabel("Coach conversation")).not.toContainText(
    /inaccuracy|depth 9|centipawn/,
  );
  await page.reload();
  await expect(
    page
      .getByLabel("Coach moves")
      .getByRole("img", { name: "Good", exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Flip board", exact: true }).click();
  await expect(
    page.locator("[data-square=e5] .board-move-quality img"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Practice takeback", exact: true })
    .click();
  await expect(page.locator(".board-move-quality")).toHaveCount(0);
  await expect(page.getByLabel("Coach moves").getByRole("button")).toHaveCount(
    0,
  );
});

test("late assessments cannot add comments to a restarted Coach game", async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route("**/api/analyse", async (route) => {
    if (route.request().postDataJSON().moves?.length) {
      requested = true;
      await gate;
    }
    await route
      .fulfill({ json: { cp: 0, lines: [], depth: 9 } })
      .catch(() => {});
  });
  await page.locator("[data-square=e2]").click();
  await page.locator("[data-square=e4]").click();
  await expect.poll(() => requested).toBe(true);
  await page.getByRole("button", { name: "New game", exact: true }).click();
  release();
  await expect(page.getByLabel("Coach conversation")).toContainText(
    "Let's play a game",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(
            JSON.parse(localStorage.getItem("grove-current")).coachNotes || {},
          ).length,
      ),
    )
    .toBe(0);
});
