export function createGameInputLock({ keys, onKey }) {
  const keySet = new Set(keys.map((key) => key.toLowerCase()));

  const handleKeydown = (event) => {
    const key = event.key.toLowerCase();
    if (!keySet.has(key)) return;
    event.preventDefault();
    event.stopPropagation();
    onKey(key, event);
  };

  window.addEventListener('keydown', handleKeydown, { capture: true });

  return () => {
    window.removeEventListener('keydown', handleKeydown, { capture: true });
  };
}
