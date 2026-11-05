import type { WeatherSky } from '@/features/trade-scenes/types'
import type { Weather } from '@/shared/modules/construction/core/types'

// Each weather is a time of day as much as a sky: normal is a low golden afternoon, summer the hard high afternoon sun,
// winter a cold blue evening with the rooms lit warm, rain a flat overcast that wets the yard. Working numbers, tuned by
// eye under AgX; the ground's colour is a light tint over the lawn, so white leaves the grass as it is.
export const WEATHER_SKIES = {
  normal: {
    sky: { top: '#8fb6d6', horizon: '#f3c999' },
    sun: { day: 288, hour: 16.5, minElevation: 0, color: '#ffae5a', intensity: 5.2 },
    fill: { sky: '#a9c4de', ground: '#b8875a', intensity: 0.45 },
    bounce: { color: '#f7c991', intensity: 0.7 },
    environment: { color: '#f6f4ec', intensity: 0.3, image: true },
    fog: { near: 32, far: 140 },
    ground: { color: '#ffffff', roughness: 0.95 },
    windowGlow: 0,
    roomLight: 0,
  },
  summer: {
    sky: { top: '#5f9fd8', horizon: '#f7d49c' },
    sun: { day: 196, hour: 15, minElevation: 0, color: '#ffd08a', intensity: 7.2 },
    fill: { sky: '#d8e2e6', ground: '#e8b878', intensity: 0.8 },
    bounce: { color: '#ffb466', intensity: 2.6 },
    environment: { color: '#fff4e2', intensity: 0.38, image: true },
    fog: { near: 34, far: 135 },
    ground: { color: '#fbf2dc', roughness: 0.95 },
    windowGlow: 0,
    roomLight: 0,
  },
  winter: {
    sky: { top: '#16223f', horizon: '#56688f' },
    sun: { day: 15, hour: 17, minElevation: 28, color: '#a9bce0', intensity: 0.6 },
    fill: { sky: '#3d5379', ground: '#2a2d3a', intensity: 0.45 },
    bounce: { color: '#8396bd', intensity: 0.15 },
    environment: { color: '#6f86b3', intensity: 0.25, image: false },
    fog: { near: 30, far: 115 },
    ground: { color: '#c9d0d6', roughness: 0.95 },
    windowGlow: 1.4,
    roomLight: 5,
  },
  rain: {
    sky: { top: '#7f8a93', horizon: '#b8bec2' },
    sun: { day: 288, hour: 13, minElevation: 0, color: '#e3e7ea', intensity: 1.1 },
    fill: { sky: '#c3cad0', ground: '#5d6358', intensity: 1.1 },
    bounce: { color: '#c9cdc8', intensity: 0.4 },
    environment: { color: '#d5dade', intensity: 0.45, image: false },
    fog: { near: 24, far: 100 },
    ground: { color: '#8a9282', roughness: 0.55 },
    windowGlow: 0.25,
    roomLight: 1.5,
  },
} as const satisfies Record<Weather, WeatherSky>

export const SKY_RIG = { domeRadius: 118, shadowMapSize: 2048, sunDistance: 60 } as const

// Served from this site: an in-home connection must never wait on, or fail at, another host.
export const SKY_IMAGE = '/scenes/sky/citrus-orchard-road-puresky-512.hdr'

// Must equal the sky image's PMREM cube size, or every lit material compiles a second program when the image replaces the Lightformer light.
export const LIGHTFORMER_RESOLUTION = 128

// Below and in front of the house, aimed up at it: the yard's bounce, which lights the attic's undersides through the open slope.
export const BOUNCE_POSITION = [-3, -6, 14] as const
