'use client'

import type { CarouselApi } from '@/shared/components/ui/carousel'
import type { MediaFile } from '@/shared/db/schema'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/shared/components/ui/carousel'
import { cn } from '@/shared/lib/utils'

interface PhaseCarouselProps {
  photos: MediaFile[]
  phaseLabel: string
}

export function PhaseCarousel({ photos, phaseLabel }: PhaseCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const onSelect = useCallback(() => {
    if (!api) {
      return
    }
    setCurrent(api.selectedScrollSnap())
  }, [api])

  const handleSetApi = useCallback((newApi: CarouselApi) => {
    setApi(newApi)
    if (newApi) {
      newApi.on('select', onSelect)
    }
  }, [onSelect])

  return (
    <div className="space-y-3">
      <Carousel
        setApi={handleSetApi}
        opts={{ align: 'start', loop: photos.length > 1 }}
        className="w-full"
      >
        <CarouselContent className="-ml-3">
          {photos.map(photo => (
            <CarouselItem
              key={photo.id}
              className={cn(
                'pl-3',
                photos.length === 1
                  ? 'basis-full'
                  : 'basis-[85%] sm:basis-[70%] md:basis-[55%] lg:basis-[45%]',
              )}
            >
              <div className="relative aspect-video overflow-hidden rounded-xl shadow-lg">
                <Image
                  src={photo.url}
                  alt={photo.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 85vw, (max-width: 768px) 70vw, (max-width: 1024px) 55vw, 45vw"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {photos.length > 1 && (
          <>
            <CarouselPrevious className="-left-3 md:-left-5 bg-background/80 backdrop-blur-sm" />
            <CarouselNext className="-right-3 md:-right-5 bg-background/80 backdrop-blur-sm" />
          </>
        )}
      </Carousel>

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => api?.scrollTo(index)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                index === current
                  ? 'w-6 bg-primary'
                  : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
              )}
              aria-label={`Go to ${phaseLabel} photo ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
