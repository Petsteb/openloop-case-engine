/* localStorage with try/catch: private windows and blocked storage must never break the page. */
const PREFIX = 'openloop-'

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = window.localStorage.getItem(PREFIX + key)
      return v == null ? fallback : (JSON.parse(v) as T)
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown) {
    try { window.localStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch { /* storage unavailable */ }
  },
}

/** True when the key event comes from a text field (shortcuts must not fire while typing). */
export const isTyping = (e: KeyboardEvent) =>
  e.target instanceof Element && !!e.target.closest('input, textarea, select, [contenteditable="true"]')
