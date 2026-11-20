import type { Clock } from "@/core";

export interface FakeClock extends Clock {
  set(date: Date | string): void;
  advance(ms: number): void;
}

export function fakeClock(initial: Date | string = "2026-01-01T12:00:00Z"): FakeClock {
  let current = new Date(initial);
  return {
    now: () => new Date(current),
    set: (date) => {
      current = new Date(date);
    },
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
  };
}
