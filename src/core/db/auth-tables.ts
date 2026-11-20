import { account, session, user, verification } from "./schema";

/** The tables Better Auth reads and writes. Only the auth adapter should use these directly. */
export const authTables = { user, session, account, verification };
