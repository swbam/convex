// The UTC date window includes day 14; expiration is the start of day 15.
export const importRetryExpiry = (date: string) => Date.parse(date + "T00:00:00Z") + 15 * 86_400_000;
