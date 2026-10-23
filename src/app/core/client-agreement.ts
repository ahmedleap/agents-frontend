// Customer Account Agreement shown at sign-up.
//
// The full text is src/assets/agreement.txt (rendered by the /agreement page). When it changes:
//   1. replace that file,
//   2. update AGREEMENT_VERSION to match its "VERSION:" line,
//   3. check AGREEMENT_SUMMARY still matches what the agreement says.
// e2e/signup.spec.ts fails if the version here and in the file drift apart.

export const AGREEMENT_TITLE = 'Customer Account Agreement';

export const AGREEMENT_VERSION = '2.0';

/** In-app page that lays out the agreement */
export const AGREEMENT_URL = '/agreement';

/** The agreement exactly as written, for download */
export const AGREEMENT_TEXT_URL = '/assets/agreement.txt';

/** Plain-language highlights shown in the sign-up pop-up, with the agreement section they come from. */
export const AGREEMENT_SUMMARY: readonly { text: string; section: string }[] = [
  { text: 'Investing involves risk. You could lose your entire investment, and securities are not FDIC insured.', section: '6' },
  { text: 'This is a cash-only account: no margin, borrowing or short selling. You need enough settled cash before buying, and trades settle the next business day (T+1).', section: '2.3, 8' },
  { text: 'Trading limits apply, including at most 10,000 shares of any one stock and no single position over 25% of your portfolio. Only market and limit orders are allowed, during market hours.', section: '2, 4' },
  { text: 'Your risk level is used to tailor recommendations, but every trading decision is yours. We do not give tax advice.', section: '9, 11' },
  { text: 'Trading is commission-free; some other fees apply, such as $25 for outgoing wire transfers and an inactivity fee after 12 months without trading.', section: '5' },
  { text: 'Disputes are settled by binding FINRA arbitration rather than in court, and must be raised within 30 days.', section: '14' },
  { text: 'Confirmations, statements and notices are sent electronically to your email address.', section: '16.7, 19' }
];
