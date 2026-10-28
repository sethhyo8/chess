import { Chess } from "./chess.js";

const names = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

// Describe verified board facts; quality stays in the badge, rather than the prose.
export function coachMoveComment(
  fen,
  san,
  quality,
  { human = true, focus = "fundamentals", alternative } = {},
) {
  const board = new Chess(fen);
  let better;
  if (alternative) {
    try {
      const probe = new Chess(fen);
      better = probe.move({
        from: alternative.slice(0, 2),
        to: alternative.slice(2, 4),
        promotion: alternative[4],
      }).san;
    } catch {
      /* An incomplete engine line is not advice. */
    }
  }
  const move = board.move(san);
  const piece = names[move.piece];
  if (board.isCheckmate())
    return human
      ? "You found checkmate! Nicely finished."
      : "That's checkmate. Let's look back together and find where you could change the game.";
  if (board.isDraw())
    return "We've reached a draw. Let's take a look back at the game together.";
  if (quality.loss >= 80) {
    if (!human)
      return "I've given you a chance here. Take a moment to look for checks and captures.";
    const capture = board
      .moves({ verbose: true })
      .find((m) => m.to === move.to && m.captured);
    if (capture)
      return `Careful—my ${names[capture.piece]} can capture your ${piece} on ${move.to}. Check what happens after the exchange.`;
    return better && better !== move.san
      ? `Let's give that another look. ${better} was worth considering before committing your ${piece}. You can take back and compare the two ideas.`
      : "Let's pause here. Look at my forcing replies before you commit—can you find a safer way to carry out your plan?";
  }
  if (move.isKingsideCastle() || move.isQueensideCastle())
    return human
      ? "Nice, your king is tucked away and your rook is ready to join in."
      : "I'm castling to bring my rook into play and tuck my king away. What's your plan now?";
  if (move.captured)
    return human
      ? `You've taken my ${names[move.captured]}. Now check what I can recapture before you plan your next move.`
      : `I'm taking your ${names[move.captured]} with my ${piece}. Have a look at your recaptures.`;
  if (board.isCheck())
    return human
      ? "You're making me answer a check. Use that time to think about your follow-up."
      : "That's check—your king needs an answer first. Can you move, block, or capture?";
  if (["n", "b"].includes(move.piece) && ["1", "8"].includes(move.from[1]))
    return human
      ? `Good, you're bringing your ${piece} into the game. Keep your other pieces in mind too.`
      : `I'm bringing my ${piece} into the game. Keep an eye on the squares it attacks.`;
  if (["d4", "d5", "e4", "e5"].includes(move.to))
    return human
      ? "I like that you're stepping into the centre. Think about how your other pieces can support it."
      : "I'm putting a piece in the centre. How would you like to challenge it?";
  if (move.piece === "p")
    return human
      ? `Your pawn on ${move.to} changes the shape of the position. Look at which squares it now attacks.`
      : `I'm pushing my pawn to ${move.to}. Take a look at the squares it's attacking now.`;
  if (quality.loss >= 80)
    return human
      ? "I see your idea. Before your next move, look at what I've left you and compare another candidate."
      : "I'm leaving you a little room here. Which of your pieces could become more active?";
  if (focus === "tactics")
    return human
      ? "Let's check the forcing moves now: checks, captures, then threats. What changed after your move?"
      : "I've moved my piece into place. Check my forcing moves before you choose your reply.";
  return human
    ? `Your ${piece} is on ${move.to} now. ${focus === "planning" ? "Which of your other pieces could work with it?" : "Keep developing and check what I'm threatening next."}`
    : `I'm moving my ${piece} to ${move.to}. What's the most useful job for your next piece?`;
}
