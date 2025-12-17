'use client'

import Script from 'next/script'
import { usePipedriveLeadBoosterBootstrap } from '@/services/pipedrive/use-loader'

export function Chatbot() {
  usePipedriveLeadBoosterBootstrap()

  return (
    <Script
      id="pipedrive-leadbooster-loader"
      src="https://leadbooster-chat.pipedrive.com/assets/loader.js"
      strategy="afterInteractive"
    />
  )
}
