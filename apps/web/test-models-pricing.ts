import { grokListModels } from './server/utils/grok'

async function main() {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    console.error('No API key')
    process.exit(1)
  }
  const models = await grokListModels(apiKey)
  console.log(JSON.stringify(models.slice(0, 5), null, 2))
}
main()
