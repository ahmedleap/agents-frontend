// Account names must be unique per client. Shared by Add account and Rename account.
//
// Names are compared ignoring capitals and extra spaces, so "Roth IRA", "roth ira" and
// " Roth  IRA " all count as the same name.

export interface NamedAccount {
  accountId: string;
  name: string;
}

export function normalizeAccountName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The client's existing account that already uses `name`, or null if the name is free.
 * `exceptAccountId` leaves out the account being renamed, so keeping (or re-casing) its own name is fine.
 */
export function findAccountWithName(
  name: string,
  accounts: readonly NamedAccount[],
  exceptAccountId?: string | null
): NamedAccount | null {
  const wanted = normalizeAccountName(name);
  if (!wanted) return null;
  return accounts.find(a => a.accountId !== exceptAccountId && normalizeAccountName(a.name) === wanted) ?? null;
}
