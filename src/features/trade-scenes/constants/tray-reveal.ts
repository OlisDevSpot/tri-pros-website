import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'

// A tray, a part's options or a folded dock group opening is a quick reveal under the finger, not a move of the scene, so
// it runs shorter than the scene's timing. Each closes at once, so whatever turns with it (a chevron) turns back at once.
export const TRAY_REVEAL_TRANSITION = { ...SCENE_MOTION.transition, duration: 0.2 } as const
