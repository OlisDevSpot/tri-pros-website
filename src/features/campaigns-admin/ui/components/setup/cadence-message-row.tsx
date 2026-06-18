'use client'

import type { SmsCadenceMessage } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'

import { TriangleAlertIcon, XIcon } from 'lucide-react'
import { useRef } from 'react'
import { insertAtCursor } from '@/features/campaigns-admin/lib/insert-at-cursor'
import { countSmsSegments } from '@/features/campaigns-admin/lib/sms-segments'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { SMS_MERGE_TOKENS } from '@/shared/entities/voip-campaigns/lib/sms-merge-tokens'

interface CadenceMessageRowProps {
  message: SmsCadenceMessage
  index: number // 0-based; render index + 1 as the rung number
  showThresholdWarning: boolean
  onChange: (patch: Partial<SmsCadenceMessage>) => void
  onRemove: () => void
}

export function CadenceMessageRow({
  message,
  index,
  showThresholdWarning,
  onChange,
  onRemove,
}: CadenceMessageRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const rung = index + 1
  const { chars, segments } = countSmsSegments(message.body)
  const overSegmentLimit = segments > 3

  function handleInsertToken(token: string) {
    const el = textareaRef.current
    if (!el) {
      onChange({ body: `${message.body}{{${token}}}` })
      return
    }
    const { value, caret } = insertAtCursor(el, `{{${token}}}`)
    onChange({ body: value })
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(caret, caret)
      }
    })
  }

  return (
    <div className="border-t py-4 first:border-t-0">
      {/* Row header: rung number + remove button */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm tabular-nums text-muted-foreground">
          {'Message '}
          {rung}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove message ${rung}`}
          onClick={onRemove}
          className="size-7 text-muted-foreground hover:text-foreground"
        >
          <XIcon />
        </Button>
      </div>

      {/* After-attempts field */}
      <div className="mb-3 flex items-center gap-2">
        <label
          htmlFor={`cadence-after-attempts-${index}`}
          className="shrink-0 text-sm text-muted-foreground"
        >
          Send after dial attempt
        </label>
        <Input
          id={`cadence-after-attempts-${index}`}
          type="number"
          inputMode="numeric"
          min={1}
          value={message.afterAttempts}
          aria-label={`Send after dial attempt for message ${rung}`}
          className="w-20 tabular-nums"
          onChange={(e) => {
            const raw = Number.parseInt(e.target.value, 10)
            onChange({ afterAttempts: Number.isNaN(raw) || raw < 1 ? 1 : raw })
          }}
        />
      </div>

      {/* Threshold warning */}
      {showThresholdWarning && (
        <div
          aria-live="polite"
          className="mb-3 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400"
        >
          <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>Thresholds usually increase down the ladder.</span>
        </div>
      )}

      {/* Body textarea */}
      <div className="mb-2 min-w-0">
        <Textarea
          ref={textareaRef}
          value={message.body}
          aria-label={`Message ${rung} body`}
          autoComplete="off"
          className="wrap-break-word"
          onChange={e => onChange({ body: e.target.value })}
        />
      </div>

      {/* Token chips */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {SMS_MERGE_TOKENS.map(t => (
          <button
            key={t.token}
            type="button"
            aria-label={`Insert {{${t.token}}}`}
            onClick={() => handleInsertToken(t.token)}
            className="inline-flex items-center rounded-md border border-border/60 bg-transparent px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            {`{{${t.token}}}`}
          </button>
        ))}
      </div>

      {/* Segment counter */}
      <span
        aria-live="polite"
        className={`flex items-center gap-1 text-xs tabular-nums ${overSegmentLimit ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
      >
        {overSegmentLimit && (
          <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        {chars}
        {' chars · '}
        {segments}
        {' segment'}
        {segments === 1 ? '' : 's'}
        {overSegmentLimit && (
          <span className="ml-1">— long message, consider shortening</span>
        )}
      </span>
    </div>
  )
}
