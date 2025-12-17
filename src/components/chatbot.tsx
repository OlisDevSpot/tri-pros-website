'use client'

import Script from 'next/script'
import { usePipedriveChatbotLoader } from '@/services/pipedrive/hooks/use-chatbot-loader'

export function Chatbot() {
  usePipedriveChatbotLoader()

  return (
    <Script
      id="pipedrive-leadbooster-loader"
      src="https://leadbooster-chat.pipedrive.com/assets/loader.js"
      strategy="afterInteractive"
    />
  )
}
