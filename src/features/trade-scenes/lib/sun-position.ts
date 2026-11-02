import { SCENE_ATTRIBUTES } from '@/features/trade-scenes/constants/scene-attributes'

const RAD = Math.PI / 180

// The sun's azimuth (clockwise from north) and elevation, in degrees, from the NOAA low-precision formula. The clock hour is
// local time; the day range is Pacific daylight time (UTC-7) from mid-March to early November, standard (UTC-8) otherwise.
export function sunPosition(dayOfYear: number, clockHour: number): { azimuth: number, elevation: number } {
  const { latitude, longitude } = SCENE_ATTRIBUTES
  const utcOffset = dayOfYear >= 70 && dayOfYear <= 307 ? -7 : -8
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (clockHour - 12) / 24)
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma))
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma)
  const solarMinutes = clockHour * 60 + equationOfTime + 4 * longitude - 60 * utcOffset
  const hourAngle = (solarMinutes / 4 - 180) * RAD
  const lat = latitude * RAD

  const sinElevation = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)
  const fromSouth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat))
  return {
    azimuth: (((fromSouth / RAD + 180) % 360) + 360) % 360,
    elevation: Math.asin(sinElevation) / RAD,
  }
}
