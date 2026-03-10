/**
 * Admin auth middleware — redirects non-admin users to home page.
 * Uses the nuxt-auth-utils session which includes user.isAdmin.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { loggedIn, user } = useAuth()

  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- user shape varies by build-time module resolution
  const adminUser = user.value as any
  if (!adminUser?.isAdmin) {
    return navigateTo('/')
  }
})
