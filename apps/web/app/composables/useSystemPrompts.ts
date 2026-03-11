export function useSystemPrompts() {
  const {
    data: prompts,
    status,
    refresh,
    error,
  } = useAsyncData<Record<string, string>>(
    'system-prompts',
    () => $fetch<Record<string, string>>('/api/system-prompts'),
    {
      default: () => ({}),
    },
  )

  return {
    prompts,
    status,
    refresh,
    error,
  }
}
