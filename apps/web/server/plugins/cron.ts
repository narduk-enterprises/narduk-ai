export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async (...args: unknown[]) => {
    // This hook is invoked when Cloudflare triggers the cron job defined in wrangler.json
    console.log('[cron] Executing scheduled event')

    const env = args[1] as Record<string, unknown> | undefined
    const context = args[2]

    // Call our internal cron endpoint securely
    const config = useRuntimeConfig()
    const cloudflareCtx = {
      cloudflare: {
        env,
        context,
      },
    }
    try {
      await nitroApp.localFetch('/api/cron/sync-jobs', {
        headers: {
          Authorization: `Bearer ${config.cronSecret}`,
        },
        context: cloudflareCtx,
      })
      console.log('[cron] Successfully synced pending generation jobs')
    } catch (err) {
      console.error('[cron] Failed to execute sync-jobs cron route', err)
    }

    // Refill lucky prompt cache
    try {
      await nitroApp.localFetch('/api/cron/refill-lucky', {
        headers: {
          Authorization: `Bearer ${config.cronSecret}`,
        },
        context: cloudflareCtx,
      })
      console.log('[cron] Successfully refilled lucky prompt cache')
    } catch (err) {
      console.error('[cron] Failed to refill lucky prompt cache', err)
    }
  })
})
