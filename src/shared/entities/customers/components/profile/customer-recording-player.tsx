'use client'

import { useQuery } from '@tanstack/react-query'
import { AudioLinesIcon, PauseIcon, PlayIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Slider } from '@/shared/components/ui/slider'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  customerId: string
}

export function CustomerRecordingPlayer({ customerId }: Props) {
  const trpc = useTRPC()
  const audioRef = useRef<HTMLAudioElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const recordingQuery = useQuery(
    trpc.customerPipelinesRouter.getRecordingUrl.queryOptions({ customerId }),
  )

  if (recordingQuery.isPending) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <RecordingLabel />
        <div className="mt-2 flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-14 shrink-0" />
        </div>
      </div>
    )
  }

  // Load failure is distinct from "no recording exists" — surface it so the
  // agent knows a recording is there but didn't load, rather than silently
  // showing nothing.
  if (recordingQuery.isError) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <RecordingLabel />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Couldn't load the recording. Refresh to try again.
        </p>
      </div>
    )
  }

  // Genuinely no recording on file — stay quiet rather than add noise.
  if (!recordingQuery.data?.url) {
    return null
  }

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (isPlaying) {
      audio.pause()
    }
    else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  function handleTimeUpdate() {
    const audio = audioRef.current
    if (audio) {
      setCurrentTime(audio.currentTime)
    }
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current
    if (audio) {
      setDuration(audio.duration)
    }
  }

  function handleSeek(value: number[]) {
    const audio = audioRef.current
    if (audio && value[0] !== undefined) {
      audio.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  function handleEnded() {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <RecordingLabel />

      <audio
        ref={audioRef}
        src={recordingQuery.data.url}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <div className="mt-2 flex items-center gap-3">
        <Button
          size="icon"
          className="size-9 shrink-0"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause recording' : 'Play recording'}
        >
          {isPlaying
            ? <PauseIcon className="size-4" />
            : <PlayIcon className="size-4" />}
        </Button>

        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="flex-1"
        />

        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatTime(currentTime)}
          {' / '}
          {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}

function RecordingLabel() {
  return (
    <div className="flex items-center gap-2">
      <AudioLinesIcon className="size-4 text-primary" />
      <span className="text-sm font-medium">Lead Recording</span>
    </div>
  )
}
