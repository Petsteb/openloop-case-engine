/* Demo identities and fallbacks, in one place for both apps (the bank at "/", the portal at "/client/").
   Everything else on screen comes from the API; these exist because the demo has no login and must also run against
   an older server that predates multi-case. */

/** The scripted demo case. An empty route opens it (old links and the README land here), it is the only case an older
 *  server (no /api/cases) has, the only one the server creates on demand, and the only one "Reset demo" resets alone. */
export const DEMO_CASE_ID = 'demo-1'

/** The demo case's company: the portal's default "viewing as" company, and the only company an older server
 *  (no /api/companies) has. Its display name is read from the demo case itself, never written here. */
export const DEMO_COMPANY_ID = 'aurora'

/** Demo identity: the author on messages the bank screen sends to the client (there is no staff login). */
export const DEMO_STAFF_AUTHOR = 'Ana Pop (analyst)'

/** Demo identity: the compliance officer recorded when a hold is released (there is no staff login). */
export const DEMO_COMPLIANCE_ID = 'compliance-1'
