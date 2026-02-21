import Image from 'next/image'

import { useState } from 'react'

import * as ImageSlider from 'react-compare-slider/components'
import { useReactCompareSlider } from 'react-compare-slider/hooks'
import { Slider } from '@/shared/components/ui/slider'

interface Props {
  beforeSrc: string
  afterSrc: string
}

export function CustomImageSlider({
  beforeSrc,
  afterSrc,
}: Props) {
  const sliderProps = useReactCompareSlider({
    portrait: false,
    defaultPosition: 50,
    // onPositionChange: (position) => {},
  })

  return (
    <div className="absolute inset-0 select-none z-5">
      <ImageSlider.Provider {...sliderProps}>
        <ImageSlider.Root className="h-full">
          <ImageSlider.Item item="itemOne">
            <ImageSlider.Image
              src={beforeSrc}
              alt="Before image"
              className="object-cover"
            />
          </ImageSlider.Item>
          <ImageSlider.Item item="itemTwo">
            <ImageSlider.Image
              src={afterSrc}
              alt="After image"
              className="object-cover"
            />
          </ImageSlider.Item>
          <ImageSlider.HandleRoot>
            <ImageSlider.Handle />
          </ImageSlider.HandleRoot>
        </ImageSlider.Root>
        <Image
          src={afterSrc}
          alt="After Full View"
          fill
          className="object-cover w-full h-full opacity-100 group-hover:opacity-0 group-active:opacity-0 transition duration-300 pointer-events-none z-20"
        />
        <div className="absolute inset-0 bg-black/60 opacity-80 group-hover:opacity-30 group-active:opacity-30 transition duration-300 pointer-events-none z-50" />
        <ImageSliderControls />
      </ImageSlider.Provider>
    </div>
  )
}

export function ImageSliderControls() {
  const { position, setPosition } = ImageSlider.useReactCompareSliderContext()
  const [sliderPosition, setSliderPosition] = useState(position.current ?? 50)

  return (
    <Slider
      value={[sliderPosition]}
      max={100}
      step={1}
      className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[75%] max-w-xs z-20"
      onValueChange={(val) => {
        setPosition(val[0])
        setSliderPosition(val[0])
      }}
    />
  )
}
