'use client'

import type { LightboxPhoto } from '@/shared/modules/media/core/components/display/photo-lightbox'
import { ChevronRightIcon } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COMPANY_DOCUMENTS, liabilityCoverage, primaryLicense } from '@/shared/constants/company'
import { PhotoLightbox } from '@/shared/modules/media/core/components/display/photo-lightbox'

const DOCUMENT_PHOTOS: LightboxPhoto[] = [COMPANY_DOCUMENTS.license, COMPANY_DOCUMENTS.insurance].map(doc => ({
  src: doc.src,
  alt: doc.alt,
  width: doc.width,
  height: doc.height,
}))

export function CompanyDocumentsRow() {
  const [index, setIndex] = useState<number | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => {
    setIndex(null)
    buttonRef.current?.focus()
  }, [])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setIndex(0)}
        className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-border bg-card px-4.5 py-3.5 text-left transition-colors outline-none hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="grid gap-0.5">
          <span className="font-bold">See our license and insurance</span>
          <span className="text-sm text-muted-foreground">{`CA #${primaryLicense.licenseNumber} · ${liabilityCoverage} general liability per project`}</span>
        </span>
        <ChevronRightIcon aria-hidden className="size-4.5 shrink-0" />
      </button>
      {/* The page's container query makes its box the containing block for fixed children; the lightbox covers the viewport from body. */}
      {index !== null && createPortal(
        <PhotoLightbox photos={DOCUMENT_PHOTOS} currentIndex={index} onClose={close} onNavigate={setIndex} title="License and insurance" topInset="safe-area" />,
        document.body,
      )}
    </>
  )
}
