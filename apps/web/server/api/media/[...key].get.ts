/**
 * GET /api/media/[...key] — Serve media files from R2.
 * Auth-gated to prevent public access to user media.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const key = getRouterParam(event, 'key')
  if (!key) {
    throw createError({ statusCode: 400, message: 'Missing media key' })
  }

  const r2 = useR2(event)
  const object = await r2.get(key)

  if (!object) {
    throw createError({ statusCode: 404, message: 'Media not found' })
  }

  // Set appropriate headers
  const contentType = object.httpMetadata?.contentType || 'application/octet-stream'
  setResponseHeader(event, 'content-type', contentType)
  setResponseHeader(event, 'cache-control', 'private, max-age=31536000, immutable')

  if (object.httpMetadata?.contentDisposition) {
    setResponseHeader(event, 'content-disposition', object.httpMetadata.contentDisposition)
  }

  // Stream the R2 object body
  return object.body
})
