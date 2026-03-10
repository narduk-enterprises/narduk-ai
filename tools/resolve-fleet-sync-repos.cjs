const fs = require('node:fs')
const path = require('node:path')

const manifestPath = path.join(__dirname, '..', 'config', 'fleet-sync-repos.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const availableRepos = Array.isArray(manifest.repos) ? manifest.repos : []
const requested = (process.env.REQUESTED_REPOS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const repos = requested.length > 0 ? [...new Set(requested)] : availableRepos
const unknownRepos = repos.filter((repo) => !availableRepos.includes(repo))

if (unknownRepos.length > 0) {
  console.error(`Unknown fleet sync repos requested: ${unknownRepos.join(', ')}`)
  process.exit(1)
}

process.stdout.write(`repos=${JSON.stringify(repos)}\n`)
process.stdout.write(`repo_count=${String(repos.length)}\n`)
