import { useCallback, useRef, useState } from 'react'
import { Thread } from '@/shared/thread'
import * as api from './api'
import { isUnavailable } from './api'
import { DocSheet, type DetailState } from './Documents'
import type { ThreadItem } from '@/shared/thread/types'
import type { ClientDocument } from './types'

/** "Messages with the bank": the client's thread with the bank, including the bank's automatic emails. A document
 *  named in a message opens in the portal's own document sheet (this component keeps its own copy of the sheet). */
export function Messages({ caseId, role, onItems }: { caseId: string; role: 'client'; onItems?: (items: ThreadItem[]) => void }) {
  const [sheet, setSheet] = useState<{ doc: ClientDocument; detail: DetailState } | null>(null)
  const want = useRef<string | null>(null)

  const openDoc = useCallback(async (id: string) => {
    want.current = id
    setSheet({ doc: { id, type: '', name: 'Document', received_day: null, status: '', status_word: '' }, detail: 'loading' })
    const [rows, detail] = await Promise.all([
      api.getDocuments(caseId).catch(() => null),
      api.getDocument(caseId, id).then((d) => d as DetailState).catch((e) => (isUnavailable(e) ? 'unavailable' : 'error') as DetailState),
    ])
    if (want.current !== id) return   // closed, or another document was opened meanwhile
    const row = Array.isArray(rows) ? rows.find((d) => d.id === id) : undefined
    const det = typeof detail === 'object' ? detail : undefined
    setSheet({
      doc: row ?? { id, type: '', name: det?.name ?? 'Document', received_day: det?.received_day ?? null, status: '', status_word: det?.status_word ?? '' },
      detail,
    })
  }, [caseId])

  const close = () => { want.current = null; setSheet(null) }

  return (
    <>
      <Thread caseId={caseId} role={role} onOpenDoc={(id) => void openDoc(id)} onItems={onItems} className="thr-portal" />
      <DocSheet caseId={caseId} doc={sheet?.doc} detail={sheet?.detail} onClose={close} />
    </>
  )
}
