import clsx from 'clsx'
import type { ConfirmationLevel } from '../lib/types'
import { confirmationLevelLabel } from '../lib/labels'

export function ConfirmationPill(props: { level: ConfirmationLevel }) {
  return (
    <span className={clsx('pill', `pillConfirm_${props.level}`)} title={props.level}>
      {confirmationLevelLabel(props.level)}
    </span>
  )
}

