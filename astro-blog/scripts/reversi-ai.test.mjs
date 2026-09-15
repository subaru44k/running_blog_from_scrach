import assert from 'node:assert/strict';
import test from 'node:test';

import { consumePlannedAiMove } from '../src/lib/games/reversi-ai.js';

test('keeps a follow-up AI reservation created while applying the current move', () => {
  const followUpMove = { index: 42 };
  const state = {
    aiMovePlanned: { index: 7 },
    gameOver: false,
  };
  const appliedMoves = [];

  const consumed = consumePlannedAiMove(state, (index) => {
    appliedMoves.push(index);
    state.aiMovePlanned = followUpMove;
  });

  assert.equal(consumed, true);
  assert.deepEqual(appliedMoves, [7]);
  assert.equal(state.aiMovePlanned, followUpMove);
});

test('does not apply a move after the game has ended or when no move is reserved', () => {
  const appliedMoves = [];
  const state = { aiMovePlanned: { index: 7 }, gameOver: true };

  assert.equal(consumePlannedAiMove(state, (index) => appliedMoves.push(index)), false);
  assert.deepEqual(appliedMoves, []);
  assert.equal(state.aiMovePlanned, null);

  state.gameOver = false;
  assert.equal(consumePlannedAiMove(state, (index) => appliedMoves.push(index)), false);
  assert.deepEqual(appliedMoves, []);
});
