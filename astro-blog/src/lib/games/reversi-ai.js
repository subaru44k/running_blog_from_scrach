export function consumePlannedAiMove(state, applyTurn) {
  const plannedMove = state.aiMovePlanned;
  state.aiMovePlanned = null;

  if (state.gameOver || !plannedMove) return false;

  applyTurn(plannedMove.index);
  return true;
}
