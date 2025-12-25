'use client'

import Script from 'next/script'
import { usePipedriveChatbotLoader } from '@/services/pipedrive/hooks/use-chatbot-loader'

export function Chatbot() {
  usePipedriveChatbotLoader()

  return (
    <Script
      type="text/javascript"
      id="hs-script-loader"
      src="//js-na2.hs-scripts.com/244690401.js"
      strategy="afterInteractive"
    />
  )
}
