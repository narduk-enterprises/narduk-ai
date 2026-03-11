// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import { sharedConfigs } from '@narduk-enterprises/eslint-config/config'

export default withNuxt(...sharedConfigs, {
  rules: {
    '@eslint-community/eslint-comments/require-description': 'off',
    'promise/always-return': 'off',
  },
})
