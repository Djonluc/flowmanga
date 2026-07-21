import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src-tauri/target', 'src-tauri/gen']),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [jsxA11y.flatConfigs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
