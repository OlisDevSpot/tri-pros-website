'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2Icon, PauseIcon, PlayIcon, Volume2Icon } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/shared/components/ui/button'
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
    return null
  }

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
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Volume2Icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Lead Recording</span>
      </div>

      <audio
        ref={audioRef}
        src={recordingQuery.data.url}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={togglePlay}
          disabled={recordingQuery.isPending}
        >
          {recordingQuery.isPending
            ? <Loader2Icon className="size-4 animate-spin" />
            : isPlaying
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

        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {formatTime(currentTime)}
          {' / '}
          {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
