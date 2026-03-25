'use client'

import type { SOW } from '@/shared/entities/proposals/types'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'

interface CopySowButtonProps {
  section: SOW
}

export function CopySowButton({ section }: CopySowButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const text = sowToPlaintext([section])
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success(`"${section.title}" copied`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => {
        toast.error('Failed to copy section')
      },
    )
  }, [section])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className="size-8 shrink-0"
      title={copied ? 'Copied' : `Copy "${section.title}"`}
    >
      {copied
        ? <CheckIcon className="size-3.5 text-green-600" />
        : <CopyIcon className="size-3.5" />}
    </Button>
  )
}
