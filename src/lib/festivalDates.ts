export function formatFestivalDates(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00Z`), end = new Date(`${endDate}T12:00:00Z`);
  const options = { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" } as const;
  if (startDate === endDate) return start.toLocaleDateString("en-US", options);
  const startOptions = start.getUTCFullYear() === end.getUTCFullYear() ? { month: "short", day: "numeric", timeZone: "UTC" } as const : options;
  return `${start.toLocaleDateString("en-US", startOptions)} – ${end.toLocaleDateString("en-US", options)}`;
}
