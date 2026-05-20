// Ambient module declarations for non-TS side-effect imports.
//
// Why this file exists: tsconfig.json sets an explicit `types: ["react",
// "google.maps"]` array, which disables auto-loading of CSS module type
// declarations that Next.js otherwise ships. Without this shim, side-effect
// imports like `import './globals.css'` fail TypeScript (TS2882) even though
// Next.js handles them correctly at build time.

declare module '*.css'
declare module '*.scss'
