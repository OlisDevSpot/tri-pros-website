import { weatherSunDirection } from '@/features/trade-scenes/lib/weather-sun-direction'

const [SUN_X, , SUN_Z] = weatherSunDirection('summer')

// Whether a face looking out along this horizontal direction takes the summer afternoon sun the sky draws, so the thermal
// camera warms the same walls the light does.
export function facesSummerSun(outwardX: number, outwardZ: number): boolean {
  return outwardX * SUN_X + outwardZ * SUN_Z > 0
}
