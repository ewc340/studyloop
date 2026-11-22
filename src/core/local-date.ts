/** A calendar date in the Learner's own timezone, as `YYYY-MM-DD`. */
export type LocalDate = string;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `text` is a real calendar date written as `YYYY-MM-DD`. */
export function isLocalDate(text: string): text is LocalDate {
  const match = LOCAL_DATE.exec(text);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The date it is at `instant` in `timezone`. */
export function localDateAt(instant: Date, timezone: string): LocalDate {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(instant);
}
