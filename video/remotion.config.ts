import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
// H.264 + AAC — the safe codec pair for Meta ad uploads.
Config.setCodec('h264')
