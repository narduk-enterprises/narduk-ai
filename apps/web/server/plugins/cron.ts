export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async (_event) => {
    // This hook is invoked when Cloudflare triggers the cron job defined in wrangler.json
    console.log('[cron] Executing scheduled event')

    // Call our internal cron endpoint securely
    const config = useRuntimeConfig()
    try {
      await $fetch('/api/cron/sync-jobs', {
        headers: {
          Authorization: `Bearer ${config.cronSecret}`,
        },
      })
      console.log('[cron] Successfully synced pending generation jobs')
    } catch (err) {
      console.error('[cron] Failed to execute sync-jobs cron route', err)
    }
  })
})
