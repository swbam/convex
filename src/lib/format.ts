/**
 * Compact number formatting for counts (followers, votes, plays).
 *
 * 999        -> "999"
 * 12500      -> "12.5K"
 * 1260000    -> "1.3M"
 * 126720000  -> "126.7M"
 * 1200000000 -> "1.2B"
 *
 * One decimal place, trailing ".0" stripped ("25.0K" -> "25K").
 */
export function formatCompactNumber(n: number): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "0";

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (abs < 1000) return `${sign}${Math.round(abs)}`;

  const units: Array<[number, string]> = [
    [1e3, "K"],
    [1e6, "M"],
    [1e9, "B"],
    [1e12, "T"],
  ];

  let index = units.length - 1;
  for (let i = 0; i < units.length; i++) {
    if (abs < units[i][0] * 1000) {
      index = i;
      break;
    }
  }

  let value = (abs / units[index][0]).toFixed(1);
  // toFixed can round up across a unit boundary (999950 -> "1000.0K")
  if (parseFloat(value) >= 1000 && index < units.length - 1) {
    index += 1;
    value = (abs / units[index][0]).toFixed(1);
  }

  return `${sign}${value.replace(/\.0$/, "")}${units[index][1]}`;
}
