import { test, expect } from "@playwright/test";
import path from "node:path";
const root = process.cwd();
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("board")).toBeVisible();
});
test("review, navigation, graph, alternatives, replay and local saving", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.locator(".under-board")).toContainText("1 of 20");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".under-board")).toContainText("2 of 20");
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(page.locator(".under-board")).toContainText("20 of 20");
  await page.getByRole("button", { name: "First move", exact: true }).click();
  await page.locator("[data-square=e2]").click();
  await page.locator("[data-square=e4]").click();
  await expect(page.locator(".branch-banner")).toContainText("e4");
  await page.getByRole("button", { name: "Return to game" }).click();
  await expect(page.locator(".branch-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "Autoplay", exact: true }).click();
  await expect(page.locator(".under-board")).toContainText("1 of 20", {
    timeout: 4000,
  });
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await page
    .locator(".panel-tabs")
    .getByRole("button", { name: "Review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start Game Review", exact: true })
    .click();
  await expect(page.locator(".quality-table")).toBeVisible({ timeout: 60000 });
  await expect(
    page.locator('.quality-table img[alt="Excellent"]'),
  ).toHaveAttribute("src", "/brand/chesscom/excellent.png");
  await expect(
    page.locator('.quality-table img[alt="Best Move"]'),
  ).toHaveAttribute("src", "/brand/chesscom/best.png");
  await expect(page.locator(".lesson, .grow-card")).toHaveCount(0);
  await expect(page.locator(".review-summary .fine-print")).toHaveCount(0);
  await expect(page.locator(".accuracy.white")).not.toHaveText("—");
  await page.locator(".eval-graph svg").click({ position: { x: 150, y: 45 } });
  await expect(page.locator(".under-board")).not.toContainText("0 of 20");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /My library/ }).click();
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Open review" }).click();
  await expect(page.locator(".quality-table")).toHaveCount(0); // analysis tab opens
  await expect(page.getByTestId("move-list")).toContainText("Ne7");
});
test("screenshot import uses actual recognition, confirms exact position and engine candidates", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Analyse Screenshot", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator("input[type=file]")
    .setInputFiles(path.join(root, "public/fixtures/sicilian.png"));
  await dialog
    .getByRole("button", { name: "Recognise board", exact: true })
    .click();
  await expect(dialog.locator(".recognition-result")).toBeVisible({
    timeout: 20000,
  });
  await expect(
    dialog.getByRole("textbox", { name: "FEN", exact: true }),
  ).toHaveValue(/^rnbqkbnr\/pp2pppp\/3p4\/8\/3NP3\/8\/PPP2PPP\/RNBQKB1R/);
  await dialog
    .getByRole("combobox", { name: "Side to move" })
    .selectOption("b");
  await dialog.getByLabel("I checked the pieces and the side to move.").check();
  await dialog
    .getByRole("button", { name: "Analyse position", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".candidate-lines .score")).toHaveCount(3, {
    timeout: 15000,
  });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("grove-current")),
  );
  expect(saved.start).toBe(
    "rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b - - 0 1",
  );
});
test("animated GIF reconstructs the whole legal match and can be replayed", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator("input[type=file]")
    .setInputFiles(path.join(root, "public/fixtures/sample.gif"));
  await dialog.getByRole("button", { name: "Reconstruct GIF" }).click();
  await expect(
    dialog.getByText("7 legal half-moves recovered from 23 frames."),
  ).toBeVisible({ timeout: 30000 });
  await dialog.getByRole("button", { name: "Open reconstructed game" }).click();
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(page.locator("[data-square=g1] img")).toHaveAttribute(
    "alt",
    "White king",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("grove-current")),
  );
  expect(saved.moves).toEqual(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]);
});
test("silent bot game, real response, takeback, resume, resign and review", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Play with Bots", exact: true })
    .click();
  await page.getByRole("button", { name: "Play Milo", exact: true }).click();
  await expect(page.locator(".bubble")).toHaveCount(0);
  await page.locator("[data-square=e2]").click();
  await page.locator("[data-square=e4]").click();
  await expect(page.locator(".under-board")).toContainText("2 of 2", {
    timeout: 15000,
  });
  await page.waitForTimeout(400);
  const moves = await page.evaluate(
    () => JSON.parse(localStorage.getItem("grove-current")).moves,
  );
  expect(moves.length).toBe(2);
  await page.getByRole("button", { name: "Practice takeback" }).click();
  await expect(page.locator(".under-board")).toContainText("0 of 0");
  await page
    .locator("[data-square=d2]")
    .dragTo(page.locator("[data-square=d4]"));
  await expect(page.locator(".under-board")).toContainText("2 of 2", {
    timeout: 15000,
  });
  await page.reload();
  await expect(page.locator("h1")).toHaveText("You vs Milo");
  await expect(page.locator(".under-board")).toContainText("2 of 2");
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Resign", exact: true })
    .click();
  await expect(page.locator(".play-controls")).toContainText(
    "Black wins by resignation",
  );
  await page
    .getByRole("dialog", { name: "Game complete" })
    .getByRole("button", { name: "Game Review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start Game Review" }),
  ).toBeVisible();
  await expect(page.getByTestId("move-list")).toContainText("d4");
});
test("playing Black, coach attribution, progressive hints and settings", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Play with Bots", exact: true })
    .click();
  await page.locator(".play-setup select").first().selectOption("b");
  await page.getByRole("button", { name: "Play Milo", exact: true }).click();
  await expect(page.locator(".under-board")).toContainText("1 of 1", {
    timeout: 15000,
  });
  await page
    .getByRole("button", { name: "Play With Coach", exact: true })
    .click();
  await expect(page.locator(".bubble")).toHaveCount(1);
  await expect(page.locator(".bubble>strong")).toContainText("Olive");
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hint 1/3" })).toBeVisible();
  await expect(page.locator(".arrow-layer")).toHaveCount(0);
  await page.getByRole("button", { name: "Hint 1/3" }).click();
  await expect(page.locator(".bubble")).toContainText("on");
  await page.getByRole("button", { name: "Hint 2/3" }).click();
  await expect(page.locator(".arrow-layer")).toHaveCount(1);
  await page.getByRole("button", { name: "What is the threat?" }).click();
  await expect(page.locator(".bubble")).toContainText(/attacked/);
  await page
    .locator(".topbar")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Commentary detail" })
    .selectOption("detailed");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Why?", exact: true }).click();
  await expect(page.locator(".bubble")).toContainText("Line:");
  await page
    .locator(".topbar")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByLabel("Coach commentary").uncheck();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.locator(".bubble")).toHaveCount(0);
});
test("malformed PGN shows a clear error, multiple games preserve comments and custom FEN", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "PGN text" }).fill("1. e4 e4");
  await dialog.getByRole("button", { name: "Import PGN" }).click();
  await expect(dialog.getByRole("alert")).toContainText("could not be parsed");
  await dialog
    .getByRole("textbox", { name: "PGN text" })
    .fill(
      '[White "One"]\n\n1. d4 {hello} d5 *\n\n[White "Two"]\n[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ *',
    );
  await dialog.getByRole("button", { name: "Import PGN" }).click();
  await dialog.getByRole("button", { name: /Two vs Black/ }).click();
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(page.locator("[data-square=a8] img")).toHaveAttribute(
    "alt",
    "White queen",
  );
});
test("mobile stacks board above panel without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const board = await page.getByTestId("board").boundingBox(),
    panel = await page.locator(".analysis-panel").boundingBox();
  expect(panel.y).toBeGreaterThan(board.y + board.height);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("pasted FEN preserves metadata and a Black-first PGN uses the correct move column", async ({
  page,
}) => {
  const fen = "7k/8/8/8/8/8/r7/7K b - - 20 12";
  await page
    .getByRole("button", { name: "Analyse Screenshot", exact: true })
    .click();
  let d = page.getByRole("dialog");
  await d.getByRole("textbox", { name: "FEN", exact: true }).fill(fen);
  await expect(d.getByRole("combobox", { name: "Side to move" })).toHaveValue(
    "b",
  );
  await d
    .getByRole("button", { name: "Analyse position", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("grove-current")).start,
    ),
  ).toBe(fen);
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  d = page.getByRole("dialog");
  await d
    .getByRole("textbox", { name: "PGN text" })
    .fill(`[SetUp "1"]\n[FEN "${fen}"]\n\n12... Ra1+ *`);
  await d.getByRole("button", { name: "Import PGN" }).click();
  await expect(page.locator(".move-number")).toHaveText("12.");
  const button = page
    .locator(".move-row")
    .getByRole("button", { name: "Ra1+" });
  await button.click();
  await expect(page.locator("[data-square=a1] img")).toHaveAttribute(
    "alt",
    "Black rook",
  );
});
test("delayed real engine response cannot survive restart or duplicate a move", async ({
  page,
}) => {
  let requested = 0;
  await page.route("**/api/bot", async (route) => {
    requested++;
    const response = await route.fetch();
    await new Promise((r) => setTimeout(r, 700));
    try {
      await route.fulfill({ response });
    } catch {}
  });
  await page
    .getByRole("button", { name: "Play with Bots", exact: true })
    .click();
  await page.getByRole("button", { name: "Play Milo", exact: true }).click();
  await page.locator("[data-square=e2]").click();
  await page.locator("[data-square=e4]").click();
  await expect.poll(() => requested).toBe(1);
  await page
    .locator(".bot-play-panel")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restart", exact: true })
    .click();
  await page.waitForTimeout(1400);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("grove-current")).moves,
    ),
  ).toEqual([]);
  await page.locator("[data-square=d2]").click();
  await page.locator("[data-square=d4]").click();
  await expect
    .poll(async () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("grove-current")).moves.length,
      ),
    )
    .toBe(2);
  await page.waitForTimeout(500);
  expect(requested).toBe(2);
});
test("a bot completes a legal checkmate and timed games expire correctly", async ({
  page,
}) => {
  const fen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1";
  await page.evaluate((fen) => {
    localStorage.setItem(
      "grove-current",
      JSON.stringify({
        id: "mate-test",
        start: fen,
        fens: [fen],
        moves: [],
        headers: { White: "Milo", Black: "You" },
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
  await expect(page.locator(".play-controls")).toContainText(
    "White wins by checkmate",
    { timeout: 20000 },
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("grove-library"))[0]?.moves.length,
      ),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Close result" }).click();
  await page.getByRole("button", { name: "New Bot", exact: true }).click();
  await page.locator(".play-setup select").last().selectOption("5");
  await page
    .locator(".bot-card")
    .filter({ has: page.getByRole("heading", { name: "Milo" }) })
    .click();
  await page.getByRole("button", { name: "Play Milo", exact: true }).click();
  await expect(page.locator(".clock")).toHaveCount(2);
  await page.evaluate(() => {
    const b = JSON.parse(localStorage.getItem("grove-bot"));
    b.color = "w";
    b.clocks = { w: 100, b: 300000 };
    localStorage.setItem("grove-bot", JSON.stringify(b));
  });
  await page.reload();
  await expect(page.locator(".play-controls")).toContainText(
    "Black wins on time",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("grove-library"))[0]?.ended,
      ),
    )
    .toBe("Black wins on time");
});
