import { toast } from 'sonner'

export function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error(`Failed to copy ${label.toLowerCase()}`),
  )
}
