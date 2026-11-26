import { ROOMS } from '@/features/trade-scenes/constants/home-geometry'

type Room = (typeof ROOMS)[keyof typeof ROOMS]

// The room whose span along the house holds `x`; inside the end walls' thickness, the end room.
export function roomAt(x: number): Room {
  return Object.values(ROOMS).find(room => x >= room.from && x <= room.to) ?? (x < 0 ? ROOMS.bedroom : ROOMS.kitchen)
}
