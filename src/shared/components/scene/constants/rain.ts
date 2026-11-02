export const RAIN = {
  maxStreaks: 360,
  streakLength: 0.34,
  streakWidth: 0.012,
  fallSpeed: 7,
  color: '#9db8d6',
  opacity: 0.55,
  // A frame after a long idle would carry the whole gap as one delta and throw every streak across the box.
  maxFrameSeconds: 0.05,
} as const
