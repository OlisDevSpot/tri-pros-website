'use client'

import type { AgentSettingsProfile } from '@/features/agent-settings/types'
import type { AgentProfile } from '@/shared/entities/agents/schemas'

import { useMutation } from '@tanstack/react-query'
import { CameraIcon, Loader2Icon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

interface HeadshotUploadProps {
  profile: AgentSettingsProfile
}

export function HeadshotUpload({ profile }: HeadshotUploadProps) {
  const trpc = useTRPC()
  const { invalidateAgentSettings } = useInvalidation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const agentProfile = profile.agentProfileJSON as AgentProfile | null
  const headshotUrl = agentProfile?.headshotUrl

  const initials = profile.name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()

  const getUploadUrl = useMutation(trpc.agentSettingsRouter.getHeadshotUploadUrl.mutationOptions())
  const updateProfile = useMutation(trpc.agentSettingsRouter.updateProfile.mutationOptions())

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setIsUploading(true)
    try {
      const { uploadUrl, publicUrl } = await getUploadUrl.mutateAsync({
        filename: file.name,
        mimeType: file.type,
      })
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      await updateProfile.mutateAsync({
        agentProfileJSON: { ...(agentProfile ?? {}), headshotUrl: publicUrl },
      })
      invalidateAgentSettings()
      toast.success('Headshot uploaded')
    }
    catch {
      toast.error('Failed to upload headshot')
    }
    finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Headshot</CardTitle>
        <CardDescription>Your photo for proposals and the app. Max 5MB.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="size-24 rounded-xl">
              <AvatarImage src={headshotUrl ?? profile.image ?? undefined} alt={profile.name} />
              <AvatarFallback className="rounded-xl text-2xl">{initials}</AvatarFallback>
            </Avatar>
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                <Loader2Icon className="size-6 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <CameraIcon className="size-4" />
              {headshotUrl ? 'Change Photo' : 'Upload Photo'}
            </Button>
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Square recommended.</p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </CardContent>
    </Card>
  )
}
