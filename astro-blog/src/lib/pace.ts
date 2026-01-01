export type PaceResult = {
  pacePerKm: number;
  split400m: number;
  split1k: number;
  split5k: number;
  split10k: number;
  splitHalf: number;
};

export function calculatePace(distanceKm: number, totalSeconds: number): PaceResult {
  const pacePerKm = totalSeconds / distanceKm;
  return {
    pacePerKm,
    split400m: pacePerKm * 0.4,
    split1k: pacePerKm,
    split5k: pacePerKm * 5,
    split10k: pacePerKm * 10,
    splitHalf: pacePerKm * 21.0975,
  };
}
