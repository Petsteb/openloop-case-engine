/* The original file of a case document (GET /api/cases/{id}/documents/{doc}/file): an uploaded PDF as received, or the
   document's text. A plain cookie-authenticated GET, so it opens in a new tab as an ordinary link. The bank asks with
   role=employee, the portal with role=client; the server applies the same access rules as the viewer. */
export const docFileUrl = (caseId: string, docId: string, role: 'employee' | 'client') =>
  `/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(docId)}/file?role=${role}`
