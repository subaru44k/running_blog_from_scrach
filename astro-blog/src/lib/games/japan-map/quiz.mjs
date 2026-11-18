function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const next = Math.floor(random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

export function makeRound(places, targets = places, random = Math.random) {
  return shuffled(targets, random).slice(0, 5).map((answer) => {
    const choices = [answer];
    for (const place of shuffled(places, random)) {
      if (choices.some((choice) => choice.id === place.id || choice.kana === place.kana || choice.name === place.name)) {
        continue;
      }
      choices.push(place);
      if (choices.length === 4) break;
    }
    return { answer, choices: shuffled(choices, random) };
  });
}
