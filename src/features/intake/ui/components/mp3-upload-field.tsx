'use client'

import { useMutation } from '@tanstack/react-query'
import { MicIcon, XIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'

interface Mp3UploadFieldProps {
  onUploaded: (key: string) => void
  onClear: () => void
}

export function Mp3UploadField({ onUploaded, onClear }: Mp3UploadFieldProps) {
  const trpc = useTRPC()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')

  const getUploadUrl = useMutation(
    trpc.intakeRouter.getRecordingUploadUrl.mutationOptions(),
  )

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    if (!file.name.toLowerCase().endsWith('.mp3')) {
      toast.error('Only .mp3 files are accepted')
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File must be under 100 MB')
      return
    }

    try {
      const { uploadUrl, key } = await getUploadUrl.mutateAsync({ contentType: 'audio/mpeg' })
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
      setFileName(file.name)
      onUploaded(key)
      toast.success('Recording uploaded')
    }
    catch {
      toast.error('Upload failed. Please try again.')
    }
  }

  function handleClear() {
    setFileName('')
    if (inputRef.current) {
      inputRef.current.value = ''
    }
    onClear()
  }

  if (fileName) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <MicIcon className="size-4 shrink-0 text-primary" />
        <span className="flex-1 truncate text-sm">{fileName}</span>
        <Button size="icon" variant="ghost" className="size-6" onClick={handleClear}>
          <XIcon className="size-3" />
        </Button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,audio/mpeg"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        className="w-full gap-2"
        disabled={getUploadUrl.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <MicIcon className="size-4" />
        {getUploadUrl.isPending ? 'Preparing upload…' : 'Attach call recording (.mp3)'}
      </Button>
    </div>
  )
}
