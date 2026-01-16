import type { ReactNode } from 'react'

export function ModalShell(props: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div className="modalCard">{props.children}</div>
    </div>
  )
}

