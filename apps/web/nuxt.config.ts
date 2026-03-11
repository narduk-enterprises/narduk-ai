import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend the published Narduk Nuxt Layer
  extends: ['@narduk-enterprises/narduk-nuxt-template-layer'],

  css: ['~/assets/css/main.css'],

  // nitro-cloudflare-dev proxies D1 bindings to the local dev server
  modules: ['nitro-cloudflare-dev'],

  nitro: {
    cloudflareDev: {
      configPath: resolve(__dirname, 'wrangler.json'),
    },
  },

  future: {
    compatibilityVersion: 4,
  },

  devServer: {
    port: Number(process.env.NUXT_PORT || 3000),
  },

  runtimeConfig: {
    // Server-only (admin API routes)
    googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON || '',
    posthogApiKey: process.env.POSTHOG_PERSONAL_API_KEY || '',
    gaPropertyId: process.env.GA_PROPERTY_ID || '',
    posthogProjectId: process.env.POSTHOG_PROJECT_ID || '',
    xaiApiKey: process.env.GROK_API_KEY || '',
    xaiManagementKey: process.env.XAI_MANAGEMENT_KEY || '',
    xaiTeamId: process.env.XAI_TEAM_ID || '',
    public: {
      appUrl: process.env.SITE_URL || 'https://narduk-ai.nard.uk',
      appName: process.env.APP_NAME || 'Narduk AI',
      // Analytics (client-side tracking)
      posthogPublicKey: process.env.POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      gaMeasurementId: process.env.GA_MEASUREMENT_ID || '',
      // IndexNow
      indexNowKey: process.env.INDEXNOW_KEY || '',
    },
  },

  site: {
    url: process.env.SITE_URL || 'https://narduk-ai.nard.uk',
    name: 'Narduk AI',
    description:
      'AI-powered image and video generation. Create stunning visuals with text prompts using Grok Imagine.',
    defaultLocale: 'en',
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'Narduk AI',
      url: process.env.SITE_URL || 'https://narduk-ai.nard.uk',
      logo: '/favicon.svg',
    },
  },

  image: {
    cloudflare: {
      baseURL: process.env.SITE_URL || 'https://narduk-ai.nard.uk',
    },
  },
})
