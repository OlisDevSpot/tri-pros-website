import type { PickedFile } from '../types'

export async function downloadDriveFile(file: PickedFile, accessToken: string): Promise<File> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to download Drive file "${file.name}": ${response.status} ${response.statusText}`,
    )
  }

  const blob = await response.blob()
  return new File([blob], file.name, { type: file.mimeType })
}
