// How many drawn frames a woken scan keeps running past the last change it found. A render's passive effects (a figure
// swapping in its thermal material) land a frame or two after the render that woke the scan, and must still be caught.
export const SCENE_SCAN_SETTLE_FRAMES = 3
