import type { CalendarDate } from "@/core";

const long = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** A calendar date for people, e.g. "Thu, 1 Jan 2026". The date has no time zone, so format it as UTC. */
export function formatCalendarDate(date: CalendarDate): string {
  return long.format(new Date(`${date}T00:00:00Z`));
}
