import { ATTIC_FAN_ON_ABOVE } from '@/features/trade-scenes/constants/home-heat-figures'

// A fan thermostat switches on strictly above its setpoint, so an attic reading exactly at it still idles.
export function atticFanRuns(fanMaterial: string | null, atticReading: number): boolean {
  return fanMaterial === 'thermostat-fan' && atticReading > ATTIC_FAN_ON_ABOVE
}
