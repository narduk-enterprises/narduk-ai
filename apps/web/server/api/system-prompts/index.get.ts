export default defineEventHandler(async (event) => {
  await requireAuth(event)
  // Retrieve the complete dictionary of name -> content
  return await getAllSystemPrompts(event)
})
