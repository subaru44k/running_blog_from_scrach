const DIRECTION_BUTTONS = {
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

const PRIMARY_BUTTONS = [0, 1];
const SECONDARY_BUTTONS = [9];

function isAnyButtonPressed(gamepad, indices) {
  return indices.some((index) => Boolean(gamepad.buttons[index]?.pressed));
}

function readDirection(gamepad, axisThreshold) {
  if (gamepad.buttons[DIRECTION_BUTTONS.up]?.pressed) return 'up';
  if (gamepad.buttons[DIRECTION_BUTTONS.down]?.pressed) return 'down';
  if (gamepad.buttons[DIRECTION_BUTTONS.left]?.pressed) return 'left';
  if (gamepad.buttons[DIRECTION_BUTTONS.right]?.pressed) return 'right';

  const axisX = gamepad.axes[0] ?? 0;
  const axisY = gamepad.axes[1] ?? 0;
  if (Math.abs(axisX) >= Math.abs(axisY)) {
    if (axisX <= -axisThreshold) return 'left';
    if (axisX >= axisThreshold) return 'right';
    return null;
  }

  if (axisY <= -axisThreshold) return 'up';
  if (axisY >= axisThreshold) return 'down';
  return null;
}

export function createGamepadController({
  onDirection,
  onPrimary,
  onSecondary,
  directionRepeatMs = null,
  axisThreshold = 0.55,
}) {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return () => {};
  }

  let rafId = 0;
  let previousDirection = null;
  let lastDirectionAt = 0;
  let primaryPressed = false;
  let secondaryPressed = false;

  const loop = (timestamp) => {
    const gamepads = navigator.getGamepads?.() ?? [];
    const gamepad = Array.from(gamepads).find(Boolean) ?? null;

    if (!gamepad) {
      previousDirection = null;
      primaryPressed = false;
      secondaryPressed = false;
      rafId = window.requestAnimationFrame(loop);
      return;
    }

    const direction = readDirection(gamepad, axisThreshold);
    if (direction) {
      const shouldFire =
        direction !== previousDirection ||
        (directionRepeatMs !== null && timestamp - lastDirectionAt >= directionRepeatMs);
      if (shouldFire) {
        onDirection(direction);
        lastDirectionAt = timestamp;
      }
    }
    previousDirection = direction;

    const isPrimaryDown = isAnyButtonPressed(gamepad, PRIMARY_BUTTONS);
    if (isPrimaryDown && !primaryPressed) onPrimary?.();
    primaryPressed = isPrimaryDown;

    const isSecondaryDown = isAnyButtonPressed(gamepad, SECONDARY_BUTTONS);
    if (isSecondaryDown && !secondaryPressed) onSecondary?.();
    secondaryPressed = isSecondaryDown;

    rafId = window.requestAnimationFrame(loop);
  };

  rafId = window.requestAnimationFrame(loop);

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
  };
}
