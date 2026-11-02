// Metres and turns a second. The fan in its own frame, facing +z: the shroud's radius and depth, the blade count, the fan
// thermostat's box [width, height, depth] and where it sits beside the shroud [x, y], its status light's radius, and how
// fast the blades turn while it runs. Working numbers, tuned by eye.
export const ATTIC_FAN_LOOK = {
  radius: 0.22,
  depth: 0.1,
  blades: 5,
  box: [0.12, 0.16, 0.05],
  boxAt: [0.42, -0.06],
  light: 0.018,
  turnsPerSecond: 2.5,
} as const
