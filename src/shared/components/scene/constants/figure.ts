export const FIGURE = {
  crossfadeSeconds: 0.4,
  // Same reason as the rain: a frame after an idle gap must not jump the pose.
  maxFrameSeconds: 0.05,
  // Packs key their clips at 24 or 30 fps; cutting on a 30 fps grid lands on a key either way within a frame.
  subclipFps: 30,
  // Below this pace the motion reads as stopped, so the pose it holds is kept as the rest pose.
  woundBelow: 0.02,
} as const
