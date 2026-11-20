// Public interface of the core module. UI adapters and tests import from here only.
export type { CoreContext } from "./context";
export type { Clock, FakeClock } from "./clock";
export { systemClock, fakeClock } from "./clock";
export { getHealth, type Health } from "./health";
