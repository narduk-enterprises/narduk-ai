/**
 * SYNC-TEMPLATE.TS — Standardize a Derived App Against the Template
 * ----------------------------------------------------------------
 * Copies critical infrastructure files from this template repository
 * to a derived app, switches CI to reusable workflows, and writes
 * a .template-version sentinel for drift tracking.
 *
 * Safe to re-run — all steps are idempotent.
 *
 * Usage:
 *   npx tsx tools/sync-template.ts <app-dir>
 *   npx tsx tools/sync-template.ts ~/new-code/your-app
 *   npx tsx tools/sync-template.ts ~/new-code/your-app --dry-run
 *   npx tsx tools/sync-template.ts ~/new-code/your-app --strict  # fail on remaining drift
 *
 * Options:
 *   --dry-run   Show what would change without writing anything
 *   --strict    Exit 1 if any drift remains after sync (for CI gating)
 */

import { execSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(__dirname, '..')

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')))
const dryRun = flags.has('--dry-run')
const strict = flags.has('--strict')
const allowDirtyTemplate = flags.has('--allow-dirty-template')

const appDir = args[0]?.replace(/^~/, process.env.HOME || '')
if (!appDir) {
  console.error(
    'Usage: npx tsx tools/sync-template.ts <app-directory> [--dry-run] [--strict] [--allow-dirty-template]',
  )
  console.error('  e.g: npx tsx tools/sync-template.ts ~/new-code/your-app')
  console.error(
    '  --allow-dirty-template  Skip template clean-working-tree check (used by fleet sync)',
  )
  process.exit(1)
}

if (!existsSync(appDir)) {
  console.error(`App directory not found: ${appDir}`)
  process.exit(1)
}

const appName = appDir.split('/').pop() || 'unknown'

// ─── File Categories ─────────────────────────────────────────

/** Files that must be identical to the template (copied verbatim). */
const COPY_VERBATIM = [
  // Tooling
  'tools/update-layer.ts',
  'tools/check-drift-ci.ts',
  'tools/check-sync-health.ts',
  'tools/generate-favicons.ts',
  'tools/check-setup.cjs',
  'tools/validate.ts',
  'tools/init.ts',
  'tools/tail.ts',
  'tools/db-migrate.sh',

  // CI/CD
  '.github/workflows/weekly-drift-check.yml',

  // Build orchestration
  'turbo.json',

  // Renovate
  'renovate.json',

  // Copilot/agent infra
  '.github/copilot-instructions.md',

  // ESLint (canonical config — app overrides go in eslint.overrides.mjs)
  'apps/web/eslint.config.mjs',

  // Formatting (Prettier + EditorConfig + VS Code)
  'prettier.config.mjs',
  '.editorconfig',
  '.vscode/settings.json',
  '.vscode/extensions.json',
]

/** Files to copy only if missing (not overwritten on subsequent syncs). */
const COPY_IF_MISSING: string[] = []

/** Directories where ALL files recursively must be synced (new files added, existing updated). */
const SYNC_DIRECTORIES_RECURSIVE = ['packages/eslint-config', '.agents/workflows']

/** Files that should be removed from derived apps. */
const REMOVE_STALE = [
  '.github/workflows/publish-layer.yml',
  '.github/workflows/deploy-showcase.yml',
  '.github/workflows/deploy.yml',
  '.github/workflows/version-bump.yml',
  'tools/check-setup.js',
  '.github/workflows/reusable-quality.yml',
  '.github/workflows/template-sync-bot.yml',
  '.env',
  '.env.local',
  '.env.example',
]

// ─── Helpers ─────────────────────────────────────────────────

function ensureDir(filePath: string) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function filesIdentical(a: string, b: string): boolean {
  try {
    return readFileSync(a).equals(readFileSync(b))
  } catch {
    return false
  }
}

function copyRecursiveSync(
  src: string,
  dest: string,
  ignores: RegExp[] = [/\/node_modules$/, /\/dist$/, /\/\.turbo$/],
): { copied: number; skipped: number } {
  const result = { copied: 0, skipped: 0 }
  if (ignores.some((regex) => regex.test(src))) return result

  const stat = statSync(src)
  if (stat.isDirectory()) {
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
    for (const child of readdirSync(src)) {
      const childRes = copyRecursiveSync(join(src, child), join(dest, child), ignores)
      result.copied += childRes.copied
      result.skipped += childRes.skipped
    }
  } else {
    if (existsSync(dest) && filesIdentical(src, dest)) {
      result.skipped++
    } else {
      const action = existsSync(dest) ? 'UPDATE' : 'ADD'
      console.log(`  ${action}: ${relative(TEMPLATE_DIR, src)}`)
      if (!dryRun) {
        ensureDir(dest)
        copyFileSync(src, dest)
      }
      result.copied++
    }
  }
  return result
}

// ─── Main ────────────────────────────────────────────────────

function main() {
  if (!dryRun && !allowDirtyTemplate) {
    try {
      const status = execSync('git status --porcelain', {
        encoding: 'utf-8',
        cwd: TEMPLATE_DIR,
      }).trim()
      if (status) {
        console.error('❌ Template repository has uncommitted changes.')
        console.error('   Please commit or stash your changes before syncing.')
        process.exit(1)
      }
    } catch {
      // ignore
    }
  }

  console.log()
  console.log(`Template Sync: ${appName}${dryRun ? ' [DRY RUN]' : ''}`)
  console.log(`═══════════════════════════════════════════════════════════════`)
  console.log(`  App:      ${appDir}`)
  console.log(`  Template: ${TEMPLATE_DIR}`)
  console.log()

  let copied = 0
  let skipped = 0
  let added = 0
  let removed = 0
  let packageJsonChanged = false
  let npmrcChanged = false

  // Phase 1: Copy verbatim files
  console.log('Phase 1: Syncing critical infrastructure files...')
  for (const file of COPY_VERBATIM) {
    const src = join(TEMPLATE_DIR, file)
    const dest = join(appDir, file)

    if (!existsSync(src)) continue

    if (existsSync(dest) && filesIdentical(src, dest)) {
      skipped++
      continue
    }

    const action = existsSync(dest) ? 'UPDATE' : 'ADD'
    console.log(`  ${action}: ${file}`)
    if (!dryRun) {
      ensureDir(dest)
      copyFileSync(src, dest)
    }
    copied++
  }
  // Also sync entire directories (e.g., ESLint plugins)
  for (const dir of SYNC_DIRECTORIES_RECURSIVE) {
    const srcDir = join(TEMPLATE_DIR, dir)
    const destDir = join(appDir, dir)
    if (!existsSync(srcDir)) continue
    const res = copyRecursiveSync(srcDir, destDir)
    copied += res.copied
    skipped += res.skipped
  }

  console.log(`  ${copied} files synced, ${skipped} already up to date.`)
  console.log()

  // Phase 2: Add missing workflow files
  console.log('Phase 2: Adding missing agent workflows...')
  for (const file of COPY_IF_MISSING) {
    const src = join(TEMPLATE_DIR, file)
    const dest = join(appDir, file)

    if (!existsSync(src) || existsSync(dest)) continue

    console.log(`  ADD: ${file}`)
    if (!dryRun) {
      ensureDir(dest)
      copyFileSync(src, dest)
    }
    added++
  }
  console.log(`  ${added} workflows added.`)
  console.log()

  // Phase 3: Replace CI with reusable-workflow version (monorepo layout only; app-directory defaults to apps/web)
  console.log('Phase 3: Switching CI to reusable workflows...')
  const ciPath = join(appDir, '.github/workflows/ci.yml')
  const slimCi = `name: CI

on:
  workflow_dispatch:

concurrency:
  group: ci-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

# CI is disabled (workflow_dispatch only) to conserve GitHub Actions minutes.
# Deploy is done locally via \`pnpm run deploy\` (wrangler deploy).
# See .agents/workflows/deploy.md for the local deploy workflow.

jobs:
  quality:
    uses: narduk-enterprises/narduk-ai/.github/workflows/reusable-quality.yml@main
    secrets:
      GH_PACKAGES_TOKEN: \${{ secrets.GH_PACKAGES_TOKEN }}
`

  if (existsSync(ciPath)) {
    const current = readFileSync(ciPath, 'utf-8')
    if (current.trimEnd() === slimCi.trimEnd()) {
      console.log('  ci.yml matches canonical version.')
    } else {
      console.log('  REPLACE: .github/workflows/ci.yml (standardizing)')
      if (!dryRun) {
        writeFileSync(ciPath, slimCi, 'utf-8')
      }
    }
  } else {
    console.log('  ADD: .github/workflows/ci.yml')
    if (!dryRun) {
      ensureDir(ciPath)
      writeFileSync(ciPath, slimCi, 'utf-8')
    }
  }
  console.log()

  // Phase 4: Write .template-version
  console.log('Phase 4: Writing .template-version...')
  let templateSha = ''
  try {
    templateSha = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: TEMPLATE_DIR,
    }).trim()
  } catch {
    /* ignore */
  }

  const versionContent = [
    `sha=${templateSha || 'unknown'}`,
    `template=narduk-ai`,
    `synced=${new Date().toISOString()}`,
    '',
  ].join('\n')

  const versionPath = join(appDir, '.template-version')
  console.log(
    `  ${existsSync(versionPath) ? 'UPDATE' : 'ADD'}: .template-version (${templateSha.slice(0, 12) || 'unknown'})`,
  )
  if (!dryRun) {
    writeFileSync(versionPath, versionContent, 'utf-8')
  }
  console.log()

  // Phase 4.5: Sync critical package.json scripts (these must match the template exactly)
  console.log('Phase 4.5: Syncing critical package.json scripts...')
  const CRITICAL_SCRIPTS: Record<string, string> = {
    postinstall:
      "node -e \"if(!require('fs').existsSync('.setup-complete'))console.log('\\n⚠️  Run pnpm run setup before doing anything else! See AGENTS.md.\\n')\"",
    'build:plugins': 'pnpm --filter @narduk/eslint-config build',
    prelint: 'pnpm run build:plugins',
  }

  const appPkgPath = join(appDir, 'package.json')
  try {
    const appPkg = JSON.parse(readFileSync(appPkgPath, 'utf-8'))
    let changed = false
    for (const [name, expected] of Object.entries(CRITICAL_SCRIPTS)) {
      if (appPkg.scripts?.[name] !== expected) {
        console.log(`  FIX: scripts.${name}`)
        appPkg.scripts = appPkg.scripts || {}
        appPkg.scripts[name] = expected
        changed = true
        packageJsonChanged = true
      }
    }
    if (changed && !dryRun) {
      writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2) + '\n', 'utf-8')
      console.log('  ✅ Updated package.json')
    } else if (!changed) {
      console.log('  All critical scripts match.')
    }
  } catch (e: any) {
    console.warn(`  ⚠️ Failed to sync scripts: ${e.message}`)
  }
  console.log()

  // Phase 4.6: Sync apps/web/package.json critical scripts
  console.log('Phase 4.6: Syncing apps/web/package.json scripts...')
  const webPkgPath = join(appDir, 'apps/web/package.json')
  if (existsSync(webPkgPath)) {
    try {
      const webPkg = JSON.parse(readFileSync(webPkgPath, 'utf-8'))
      let changed = false

      const WEB_CRITICAL_SCRIPTS: Record<string, string> = {
        lint: 'eslint . --max-warnings 0',
        quality: "echo 'Turbo dependsOn handles lint + typecheck + format:check'",
      }

      for (const [name, expected] of Object.entries(WEB_CRITICAL_SCRIPTS)) {
        if (webPkg.scripts?.[name] !== expected) {
          console.log(`  FIX: apps/web scripts.${name}`)
          webPkg.scripts = webPkg.scripts || {}
          webPkg.scripts[name] = expected
          changed = true
        }
      }

      // Sync db:migrate to use tracked db-migrate.sh runner (detect DB name from wrangler.json)
      const webWranglerPath = join(appDir, 'apps/web/wrangler.json')
      if (existsSync(webWranglerPath)) {
        try {
          const wrangler = JSON.parse(readFileSync(webWranglerPath, 'utf-8'))
          const dbName = wrangler.d1_databases?.[0]?.database_name
          if (dbName) {
            const expectedMigrate = `bash ../../tools/db-migrate.sh ${dbName} --local --dir drizzle`
            const expectedReset = `bash ../../tools/db-migrate.sh ${dbName} --local --dir drizzle --reset && pnpm run db:seed`
            const expectedReady = 'pnpm run db:migrate && pnpm run db:seed'

            if (webPkg.scripts?.['db:migrate'] !== expectedMigrate) {
              console.log(`  FIX: apps/web scripts.db:migrate (switching to tracked runner)`)
              webPkg.scripts = webPkg.scripts || {}
              webPkg.scripts['db:migrate'] = expectedMigrate
              changed = true
            }
            if (webPkg.scripts?.['db:reset'] !== expectedReset) {
              console.log(`  FIX: apps/web scripts.db:reset`)
              webPkg.scripts['db:reset'] = expectedReset
              changed = true
            }
            if (webPkg.scripts?.['db:ready'] !== expectedReady) {
              console.log(`  FIX: apps/web scripts.db:ready`)
              webPkg.scripts['db:ready'] = expectedReady
              changed = true
            }
          }
        } catch {
          /* skip wrangler parse */
        }
      }

      if (changed && !dryRun) {
        writeFileSync(webPkgPath, JSON.stringify(webPkg, null, 2) + '\n', 'utf-8')
        console.log('  ✅ Updated apps/web/package.json')
      } else if (!changed) {
        console.log('  All apps/web critical scripts match.')
      }
    } catch (e: any) {
      console.warn(`  ⚠️ Failed to sync apps/web scripts: ${e.message}`)
    }
  }
  console.log()

  // Phase 5: Remove stale files
  console.log('Phase 5: Cleaning stale files...')
  for (const file of REMOVE_STALE) {
    const target = join(appDir, file)
    if (!existsSync(target)) continue

    console.log(`  DELETE: ${file}`)
    if (!dryRun) {
      rmSync(target, { force: true })
    }
    removed++
  }
  if (removed === 0) console.log('  No stale files found.')
  console.log()

  // Phase 6: Patch .gitignore
  console.log('Phase 6: Patching .gitignore...')
  const gitignorePath = join(appDir, '.gitignore')
  if (existsSync(gitignorePath)) {
    let gi = readFileSync(gitignorePath, 'utf-8')
    let patched = false

    if (!gi.includes('.turbo')) {
      gi = gi.replace(/\.cache\n/, '.cache\n.turbo\n')
      patched = true
      console.log('  ADD: .turbo to .gitignore')
    }

    if (gi.includes('tools/eslint-plugin-vue-official-best-practices')) {
      gi = gi.replace(/.*tools\/eslint-plugin-vue-official-best-practices.*\n?/g, '')
      patched = true
      console.log('  REMOVE: stale eslint-plugin path from .gitignore')
    }

    if (patched && !dryRun) {
      writeFileSync(gitignorePath, gi, 'utf-8')
    }
    if (!patched) {
      console.log('  .gitignore is up to date.')
    }
  }
  console.log()

  // Phase 7: Ensure .npmrc has strict-peer-dependencies
  console.log('Phase 7: Checking .npmrc...')
  const npmrcPath = join(appDir, '.npmrc')
  if (existsSync(npmrcPath)) {
    let npmrc = readFileSync(npmrcPath, 'utf-8')
    let patched = false

    if (!npmrc.includes('strict-peer-dependencies')) {
      console.log('  ADD: strict-peer-dependencies=false')
      npmrc += '\nstrict-peer-dependencies=false\n'
      patched = true
      npmrcChanged = true
    } else if (npmrc.includes('strict-peer-dependencies=true')) {
      console.log('  UPDATE: strict-peer-dependencies=true → false')
      npmrc = npmrc.replace('strict-peer-dependencies=true', 'strict-peer-dependencies=false')
      patched = true
      npmrcChanged = true
    }

    if (npmrc.includes('@loganrenz:registry')) {
      console.log('  UPDATE: @loganrenz → @narduk-enterprises registry scope')
      npmrc = npmrc.replace(/@loganrenz:registry/g, '@narduk-enterprises:registry')
      patched = true
    }

    if (patched && !dryRun) {
      writeFileSync(npmrcPath, npmrc, 'utf-8')
    }

    if (!patched) {
      console.log('  .npmrc is up to date.')
    }
  } else {
    console.log('  ADD: .npmrc with registry + strict-peer-dependencies')
    if (!dryRun) {
      writeFileSync(
        npmrcPath,
        [
          '@narduk-enterprises:registry=https://npm.pkg.github.com',
          '',
          'strict-peer-dependencies=false',
          '',
        ].join('\n'),
        'utf-8',
      )
      npmrcChanged = true
    }
  }
  console.log()

  // Phase 8: Update root package.json scripts
  console.log('Phase 8: Checking root package.json scripts...')
  const rootPkgPath = join(appDir, 'package.json')
  if (existsSync(rootPkgPath)) {
    const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'))
    const scripts = pkg.scripts || {}
    let patchCount = 0

    const requiredScripts: Record<string, string> = {
      predev: 'node tools/check-setup.cjs',
      prebuild: 'node tools/check-setup.cjs',
      predeploy: 'node tools/check-setup.cjs',
      preship:
        'node tools/check-setup.cjs && pnpm install --frozen-lockfile && npx tsx tools/check-drift-ci.ts && npx tsx tools/check-sync-health.ts && pnpm run quality',
      ship: 'git add -A && git diff --cached --quiet || git commit -m "chore: ship $(date -u +%Y-%m-%dT%H:%M:%SZ)" && git fetch && (git merge-base --is-ancestor @{u} HEAD || (echo \'\\\\n❌ Remote has changes not in local branch. Run: git pull --rebase && pnpm ship\\\\n\' && false)) && git push && doppler run -- pnpm --filter web run deploy',
      'update-layer': 'npx tsx tools/update-layer.ts',
      'check:sync-health': 'npx tsx tools/check-sync-health.ts',
      'generate:favicons': 'npx tsx tools/generate-favicons.ts',
      tail: 'npx tsx tools/tail.ts',
      // Fleet apps only run quality on their own code, not layer/eslint packages
      quality: "turbo run quality --filter='./apps/*'",
      // Formatting — must match template exactly so all apps have consistent formatting tooling
      format:
        'prettier --write "**/*.{ts,mts,vue,js,mjs,json,yaml,yml,css,md}" --ignore-path .gitignore',
      'format:check':
        'prettier --check "**/*.{ts,mts,vue,js,mjs,json,yaml,yml,css,md}" --ignore-path .gitignore',
    }

    for (const [name, cmd] of Object.entries(requiredScripts)) {
      if (!scripts[name]) {
        console.log(`  ADD script: "${name}"`)
        scripts[name] = cmd
        patchCount++
      } else if (scripts[name] !== cmd) {
        console.log(`  UPDATE script: "${name}"`)
        scripts[name] = cmd
        patchCount++
      }
    }

    // Ensure packageManager is set (required by pnpm/action-setup in CI)
    const templatePkg = JSON.parse(readFileSync(join(TEMPLATE_DIR, 'package.json'), 'utf-8'))
    if (templatePkg.packageManager && pkg.packageManager !== templatePkg.packageManager) {
      console.log(`  SET packageManager: "${templatePkg.packageManager}"`)
      pkg.packageManager = templatePkg.packageManager
      patchCount++
      packageJsonChanged = true
    }

    const devDeps = pkg.devDependencies || {}
    const requiredDevDeps: Record<string, string> = {
      tsx: '^4.21.0',
      turbo: '^2.8.12',
      prettier: '^3.8.1',
    }

    for (const [name, version] of Object.entries(requiredDevDeps)) {
      if (!devDeps[name]) {
        console.log(`  ADD devDependency: "${name}@${version}"`)
        devDeps[name] = version
        patchCount++
        packageJsonChanged = true
      }
    }
    pkg.devDependencies = devDeps

    if (patchCount > 0) {
      pkg.scripts = scripts
      if (!dryRun) {
        writeFileSync(rootPkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
      }
      console.log(`  ${patchCount} items patched.`)
    } else {
      console.log('  All required scripts and dependencies present.')
    }
  }
  console.log()

  // Phase 8.5: Sync pnpm configuration (overrides and onlyBuiltDependencies)
  console.log('Phase 8.5: Syncing pnpm configuration...')
  if (existsSync(rootPkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'))
      const templatePkg = JSON.parse(readFileSync(join(TEMPLATE_DIR, 'package.json'), 'utf-8'))
      let changed = false

      if (JSON.stringify(pkg.pnpm?.overrides) !== JSON.stringify(templatePkg.pnpm?.overrides)) {
        console.log('  UPDATE: pnpm.overrides')
        pkg.pnpm = pkg.pnpm || {}
        pkg.pnpm.overrides = templatePkg.pnpm.overrides
        changed = true
        packageJsonChanged = true
      }

      if (
        JSON.stringify(pkg.pnpm?.onlyBuiltDependencies) !==
        JSON.stringify(templatePkg.pnpm?.onlyBuiltDependencies)
      ) {
        console.log('  UPDATE: pnpm.onlyBuiltDependencies')
        pkg.pnpm = pkg.pnpm || {}
        pkg.pnpm.onlyBuiltDependencies = templatePkg.pnpm.onlyBuiltDependencies
        changed = true
        packageJsonChanged = true
      }

      if (changed && !dryRun) {
        writeFileSync(rootPkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
        console.log('  ✅ Updated package.json pnpm config')
      } else if (!changed) {
        console.log('  pnpm configuration matches template.')
      }
    } catch {
      /* skip */
    }
  }
  console.log()

  // Phase 9: Ensure .setup-complete sentinel exists
  // sync-template only runs on already-initialized derived apps, so the bootstrap
  // guard (check-setup.js) should never block them. Create the sentinel if missing.
  console.log('Phase 9: Checking bootstrap sentinel...')
  const sentinelPath = join(appDir, '.setup-complete')
  if (existsSync(sentinelPath)) {
    console.log('  .setup-complete already exists.')
  } else {
    console.log('  ADD: .setup-complete (app is already initialized)')
    if (!dryRun) {
      writeFileSync(
        sentinelPath,
        `initialized=${new Date().toISOString()}\napp=${appName}\nsource=sync-template\n`,
        'utf-8',
      )
    }
  }
  console.log()

  // Phase 10: Update compatibility dates to today
  console.log('Phase 10: Updating compatibility dates...')
  const today = new Date().toISOString().slice(0, 10)
  let datesUpdated = 0

  // wrangler.json files
  const appsPath = join(appDir, 'apps')
  if (existsSync(appsPath)) {
    for (const entry of readdirSync(appsPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const wranglerPath = join(appsPath, entry.name, 'wrangler.json')
      if (!existsSync(wranglerPath)) continue
      try {
        const content = readFileSync(wranglerPath, 'utf-8')
        const updated = content.replace(
          /"compatibility_date":\s*"[^"]*"/,
          `"compatibility_date": "${today}"`,
        )
        if (content !== updated) {
          console.log(`  UPDATE: apps/${entry.name}/wrangler.json → ${today}`)
          if (!dryRun) writeFileSync(wranglerPath, updated, 'utf-8')
          datesUpdated++
        }
      } catch {
        /* skip */
      }
    }
  }

  // nuxt.config.ts compatibilityDate in layer
  const layerConfigPath = join(appDir, 'layers/narduk-nuxt-layer/nuxt.config.ts')
  if (existsSync(layerConfigPath)) {
    try {
      const content = readFileSync(layerConfigPath, 'utf-8')
      const updated = content.replace(
        /compatibilityDate:\s*'[^']*'/,
        `compatibilityDate: '${today}'`,
      )
      if (content !== updated) {
        console.log(`  UPDATE: layers/narduk-nuxt-layer/nuxt.config.ts → ${today}`)
        if (!dryRun) writeFileSync(layerConfigPath, updated, 'utf-8')
        datesUpdated++
      }
    } catch {
      /* skip */
    }
  }

  if (datesUpdated === 0) console.log('  All compatibility dates are current.')
  console.log()

  // Phase 11: Enforce Doppler hub-and-spoke references
  console.log('Phase 11: Checking Doppler hub references...')
  let dopplerAvailable = false
  try {
    execSync('doppler --version', { encoding: 'utf-8', stdio: 'pipe' })
    dopplerAvailable = true
  } catch {
    /* not installed */
  }

  if (!dopplerAvailable) {
    console.log('  ⏭ Doppler CLI not available; skipping.')
  } else {
    const appPkgPath = join(appDir, 'package.json')
    let projectName = appName
    if (existsSync(appPkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(appPkgPath, 'utf-8'))
        if (pkg.name) projectName = pkg.name
      } catch {
        /* use fallback */
      }
    }

    let projectExists = false
    try {
      execSync(`doppler projects get ${projectName}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      projectExists = true
    } catch {
      /* project doesn't exist */
    }

    if (!projectExists) {
      console.log(`  Doppler project "${projectName}" not found — creating...`)
      if (!dryRun) {
        try {
          execSync(
            `doppler projects create ${projectName} --description "${appName} auto-provisioned by sync-template"`,
            { encoding: 'utf-8', stdio: 'pipe' },
          )
          console.log(`  ✅ Created Doppler project: ${projectName}`)
          projectExists = true
        } catch (e: any) {
          console.warn(`  ⚠️ Failed to create Doppler project: ${e.message}`)
        }
      } else {
        console.log(`  Would create Doppler project: ${projectName}`)
      }
    }

    if (!projectExists) {
      console.log(`  ⏭ Cannot proceed without Doppler project; skipping hub ref check.`)
    } else {
      const hubRefs: Record<string, string> = {
        CLOUDFLARE_API_TOKEN: '${narduk-ai.prd.CLOUDFLARE_API_TOKEN}',
        CLOUDFLARE_ACCOUNT_ID: '${narduk-ai.prd.CLOUDFLARE_ACCOUNT_ID}',
        POSTHOG_PUBLIC_KEY: '${narduk-ai.prd.POSTHOG_PUBLIC_KEY}',
        POSTHOG_PROJECT_ID: '${narduk-ai.prd.POSTHOG_PROJECT_ID}',
        POSTHOG_HOST: '${narduk-ai.prd.POSTHOG_HOST}',
        POSTHOG_PERSONAL_API_KEY: '${narduk-ai.prd.POSTHOG_PERSONAL_API_KEY}',
        GA_ACCOUNT_ID: '${narduk-ai.prd.GA_ACCOUNT_ID}',
        GSC_SERVICE_ACCOUNT_JSON: '${narduk-ai.prd.GSC_SERVICE_ACCOUNT_JSON}',
        GSC_USER_EMAIL: '${narduk-ai.prd.GSC_USER_EMAIL}',
        APPLE_KEY_ID: '${narduk-ai.prd.APPLE_KEY_ID}',
        APPLE_SECRET_KEY: '${narduk-ai.prd.APPLE_SECRET_KEY}',
        APPLE_TEAM_ID: '${narduk-ai.prd.APPLE_TEAM_ID}',
        CSP_SCRIPT_SRC: '${narduk-ai.prd.CSP_SCRIPT_SRC}',
        CSP_CONNECT_SRC: '${narduk-ai.prd.CSP_CONNECT_SRC}',
      }

      let hubTokenValue = ''
      try {
        const hubJson = execSync(
          'doppler secrets get CLOUDFLARE_API_TOKEN --project narduk-ai --config prd --json',
          { encoding: 'utf-8', stdio: 'pipe' },
        )
        hubTokenValue = JSON.parse(hubJson).CLOUDFLARE_API_TOKEN?.computed || ''
      } catch {
        /* can't read hub */
      }

      if (!hubTokenValue) {
        console.log('  ⏭ Cannot read hub project; skipping Doppler validation.')
      } else {
        let spokeTokenValue = ''
        try {
          const spokeJson = execSync(
            `doppler secrets get CLOUDFLARE_API_TOKEN --project ${projectName} --config prd --json`,
            { encoding: 'utf-8', stdio: 'pipe' },
          )
          spokeTokenValue = JSON.parse(spokeJson).CLOUDFLARE_API_TOKEN?.computed || ''
        } catch {
          /* secret missing */
        }

        if (spokeTokenValue === hubTokenValue) {
          console.log('  Doppler hub references are correct.')
        } else {
          console.log('  STALE: Cloudflare credentials are direct values, not hub references.')
          if (!dryRun) {
            const pairs = Object.entries(hubRefs)
              .map(([k, v]) => `${k}='${v}'`)
              .join(' ')
            try {
              execSync(`doppler secrets set ${pairs} --project ${projectName} --config prd`, {
                encoding: 'utf-8',
                stdio: 'pipe',
              })
              console.log(
                `  ✅ Set ${Object.keys(hubRefs).length} hub references in ${projectName}/prd`,
              )
            } catch (e: any) {
              console.warn(`  ⚠️ Failed to set hub references: ${e.message}`)
            }
          } else {
            console.log(
              `  Would set ${Object.keys(hubRefs).length} hub references in ${projectName}/prd`,
            )
          }
        }
      }
    }
  }
  console.log()

  // Phase 12: Ensure doppler.yaml exists
  console.log('Phase 12: Checking doppler.yaml...')
  const dopplerYamlPath = join(appDir, 'doppler.yaml')
  const dopplerYamlContent = `setup:\n  project: ${appName}\n  config: prd\n`
  if (!existsSync(dopplerYamlPath)) {
    console.log(`  ADD: doppler.yaml (project=${appName}, config=prd)`)
    if (!dryRun) {
      writeFileSync(dopplerYamlPath, dopplerYamlContent, 'utf-8')
    }
  } else {
    const currentDopplerYaml = readFileSync(dopplerYamlPath, 'utf-8')
    const currentProject = currentDopplerYaml.match(/^\s*project:\s*(.+)\s*$/m)?.[1]?.trim() || null
    const currentConfig = currentDopplerYaml.match(/^\s*config:\s*(.+)\s*$/m)?.[1]?.trim() || null

    if (!currentProject || !currentConfig) {
      console.log(`  REPAIR: doppler.yaml (project=${appName}, config=prd)`)
      if (!dryRun) {
        writeFileSync(dopplerYamlPath, dopplerYamlContent, 'utf-8')
      }
    } else {
      console.log(
        `  doppler.yaml already exists (project=${currentProject}, config=${currentConfig}).`,
      )
    }
  }
  console.log()

  // Phase 13: Sync lockfile
  if ((packageJsonChanged || npmrcChanged) && !dryRun) {
    console.log('Phase 13: Syncing pnpm-lock.yaml...')
    try {
      execSync('pnpm install --no-frozen-lockfile', {
        cwd: appDir,
        stdio: 'inherit',
      })
      console.log('  ✅ Lockfile synchronized.')
    } catch (e: any) {
      console.warn(`  ⚠️ Failed to sync lockfile: ${e.message}`)
    }
  } else if (packageJsonChanged || npmrcChanged) {
    console.log('Phase 13: Would sync pnpm-lock.yaml (dry run).')
  }

  // Phase 14: Sync pre-commit hook (lockfile drift prevention)
  console.log('Phase 14: Syncing pre-commit hook...')
  const templateHook = join(TEMPLATE_DIR, '.githooks/pre-commit')
  const appHooksDir = join(appDir, '.githooks')
  const appHook = join(appHooksDir, 'pre-commit')
  if (existsSync(templateHook)) {
    const templateContent = readFileSync(templateHook, 'utf-8')
    const appContent = existsSync(appHook) ? readFileSync(appHook, 'utf-8') : ''
    if (templateContent !== appContent) {
      if (!dryRun) {
        mkdirSync(appHooksDir, { recursive: true })
        copyFileSync(templateHook, appHook)
        execSync(`chmod +x ${appHook}`, { stdio: 'pipe' })
        execSync(`git config core.hooksPath .githooks`, {
          cwd: appDir,
          stdio: 'pipe',
        })
        console.log('  ✅ Pre-commit hook synced and activated.')
      } else {
        console.log('  Would sync pre-commit hook (dry run).')
      }
    } else {
      console.log('  ✅ Pre-commit hook already up to date.')
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════════')
  if (dryRun) {
    console.log(' DRY RUN — no files were modified.')
    console.log(' Re-run without --dry-run to apply changes.')
  } else {
    console.log(` Sync complete.`)
    console.log()
    console.log(' Next steps:')
    console.log(`   cd ${appDir}`)
    console.log('   pnpm install')
    console.log('   pnpm run update-layer          # (Optional if you used a unified sync script)')
    console.log('   pnpm run quality                # verify nothing broke')
    console.log('   git add -A && git diff --cached # review changes')
    console.log('   git commit -m "chore: sync with template infra"')
  }
  console.log()

  if (strict) {
    // Run a quick drift check to see if anything remains
    const driftScript = join(appDir, 'tools/check-drift-ci.ts')
    if (existsSync(driftScript)) {
      try {
        execSync(`npx tsx ${driftScript} --strict`, {
          stdio: 'inherit',
          cwd: appDir,
        })
      } catch {
        process.exit(1)
      }
    }
  }
}

main()
