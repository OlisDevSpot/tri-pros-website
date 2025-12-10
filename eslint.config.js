import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  react: true,
  ignores: ['src/payload-types.ts', 'src/app/(payload)/admin/importMap.js'],
  rules: {
    'react-refresh/only-export-components': 'off',
    'ts/no-empty-object-type': 'off',
  },
})
