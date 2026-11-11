// Axis maths shared by the web and mobile charts.

/** Round tick values covering [min, max] in about `count` steps. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) max = min + 1;
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step = (residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1) * magnitude;
  const first = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let value = first; value < max + step; value += step) ticks.push(Math.round(value * 1000) / 1000);
  return ticks;
}
