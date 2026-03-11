# Second-Opinion Audit: Prompt Generation System Refactor

> Review of the [audit](~/.gemini/antigravity/brain/dca92165-6bbc-42d7-ae4d-f41358225f68/audit_preset_modifier_system.md) and [implementation plan](~/.gemini/antigravity/brain/dca92165-6bbc-42d7-ae4d-f41358225f68/implementation_plan.md). Validates completeness, finds gaps, and answers the specified questions.

---

## PR #3 re-audit (refactor/prompt-generation-v3)

**Branch:** `refactor/prompt-generation-v3` ([PR #3](https://github.com/narduk-enterprises/narduk-ai/pull/3))

**Copilot’s 7 review findings — all addressed and verified:**

| # | File | Finding | Status |
|---|------|---------|--------|
| 1 | useGenerationForm.ts | `activePresetBlocks`: filter `find()` result with `el != null` (not just `el !== null`) so `undefined` is excluded | ✅ Fixed: `.filter((el): el is PromptElement => el != null)` |
| 2 | usePromptTags.ts | Non-mutating sort for `appliesTo` scope key (avoid mutating shared catalog) | ✅ Fixed: `[...(tag.appliesTo ?? [])].sort()` |
| 3 | quickModifiers.ts | Add `'framing'` to `CATEGORY_ORDER` | ✅ Fixed: `'framing'` included in order list |
| 4 | quickModifiers.ts | Validate `selectionMode` against `['single','multi']` | ✅ Fixed: `['single','multi'].includes(...) ? meta!.selectionMode : 'single'` |
| 5 | 0014_modifier_metadata.sql | Set `applies_to` for broad `attribute_key = 'framing'` | ✅ Fixed: `UPDATE ... SET applies_to = '["framing"]' WHERE attribute_key = 'framing' AND applies_to IS NULL` |
| 6 | useAdminQuickModifiers.ts | Use admin-specific type (not PromptTag) for raw API response | ✅ Fixed: `QuickModifierRow` interface, `useFetch<QuickModifierRow[]>` |
| 7 | presetSchemas.ts / useChatForm | `compilationPipelineDescription()` must match new tag-based compiler | ✅ Fixed: Text describes never-prune, appliesTo, attribute-key pairs; useChatForm injects same |

**Other checks:**

- **useFeelingLucky:** Critical fix (resolve by type+name) is already present on this branch.
- **useQuickModifiers:** Removed on this branch; no dead code.
- **Quality:** `pnpm run quality` passes after fixing Prettier in `app/composables/useAdminQuickModifiers.ts` and `server/utils/quickModifiers.ts` (run `pnpm exec prettier --write` on those two files if CI fails format check).

**Verdict:** PR #3 is in good shape. All Copilot comments and the earlier second-opinion critical fix are applied. Recommend merging after ensuring the format fix is committed if CI runs format check.

---

## 1. Issues Found

### 🔴 Critical

**1. useFeelingLucky: Preset name→ID resolution ignores type** — ✅ **Fixed on PR #3**

When consuming a cached lucky prompt, the code previously resolved `cached.presets` (Record<type, name>) to IDs using only `name`:

```ts
// useFeelingLucky.ts L62–66
for (const [_type, name] of Object.entries(cached.presets)) {
  const el = elements.value.find((e) => e.name === name)  // type discarded!
  if (el) ids.push(el.id)
}
```

If two presets share the same name (e.g. person "Alex" and scene "Alex"), the same element can be pushed twice or the wrong type chosen. Resolution must be by `(type, name)`.

**Fix:**

```ts
for (const [type, name] of Object.entries(cached.presets)) {
  const el = elements.value.find((e) => e.type === type && e.name === name)
  if (el) ids.push(el.id)
}
```

---

### 🟠 Major

**2. Plan’s “single-select per category” is under-specified; implementation is correct**

The plan said “Enforce single-select per category” but the real requirement is single-select per **(attributeKey, appliesTo)** scope (so scene:lighting and style:lighting are independent). The current `usePromptTags` implements this correctly (tagScope = `JSON.stringify(tag.appliesTo?.sort() ?? [])`). The implementation plan’s snippet showed only `attributeKey`; the codebase is ahead of the plan. No change needed; document this in the plan.

**3. useQuickModifiers.ts is dead code**

No remaining imports of `useQuickModifiers`; all flows use `usePromptTags`. The plan lists “useQuickModifiers.ts → usePromptTags.ts” as REWRITE but both files exist. Removing or deprecating `useQuickModifiers.ts` avoids confusion and prevents accidental use.

**4. Generation type omits lineage / promptElements**

`~/types/generation.ts` does not define `lineage` or `promptElements`; the API and DB store them and dispatch sends them. Today the UI only uses `presets` for badges, so behavior is correct. When you add features that read lineage (e.g. “regenerate with same presets”), extend the `Generation` type so TypeScript and consumers stay in sync.

---

### 🟡 Minor

**5. Dedup script: “keep longer snippet” can be wrong**

`dedup-modifiers.get.ts` keeps the row with the longer snippet. In rare cases the intended modifier might be the shorter one (e.g. “blonde” vs “blonde hair, natural highlights”). Consider making the “keep” rule configurable (e.g. prefer higher `usage_count`) or documenting that dedup is “richest snippet wins.”

**6. usePresetEditor.generatePreview passes name-based presets only**

`usePresetEditor` calls `generateImage(prompt, { presets: { [presetMode]: state.name } })`. That’s correct for the preset-editor context (single preset, name is enough). The plan’s note that “presets/[id].vue — no breaking change needed since dual-write keeps presets populated” is accurate. No code change; just confirming.

**7. schemaToPromptContext import in useChatForm**

`useChatForm` uses `schemaToPromptContext()` and `compilationPipelineDescription()` but the read of `presetSchemas.ts` didn’t show an import in that file. Confirmed they are used (L100–101). If they’re auto-imported by Nuxt, no issue.

---

## 2. Plan Gaps

- **usePresetEditor not in file manifest:** The plan says “usePresetEditor — Use activePresetIds for generation calls” in Phase 6 but usePresetEditor lives on presets/[id].vue and passes name-based `presets` for a single preset. It does not use `activePresetIds` (that’s the generate page). The plan should state explicitly that usePresetEditor stays name-based for its preview flow and does not need to adopt activePresetIds.

- **ensureLoaded before generate:** The plan says “Call before any consumer needs tag data: usePromptParser, generate.vue onMounted, useChatForm.” generate.vue does not show an explicit `onMounted` that calls `ensureTagsLoaded()`. If the first compile happens when the user clicks Generate, and tags haven’t loaded yet, `selectedTagsList` could be empty. Verify that the generate page (or useGenerationForm) calls `ensureTagsLoaded()` before the first compile (e.g. on mount or when opening the modifiers UI).

- **Migration 0014 run order:** 0014 adds columns and backfills. If 0011/0012 seeds run after 0014, new rows would have `attribute_key`/`applies_to`/`selection_mode` NULL unless seeds are updated or a later migration re-backfills. Confirm migration order (0011 → 0012 → 0014) and that 0014 runs after all seeds; or add a note that 0014 must run after any seed that inserts into quick_modifiers.

- **Dedup script: GET vs POST:** The plan says “Returns a dry-run report unless ?apply=true” but the codebase has GET = dry-run and POST = apply. So “apply” is done via POST, not query param. Plan should say “To apply deletions, POST to the same endpoint” (or whatever the actual apply endpoint is).

---

## 3. Design Challenges / Open Questions

**Prompt tags vs quick modifiers naming**

- The plan keeps the `quick_modifiers` table and adds columns; the client type is `PromptTag` / `PromptTagCategory`. That’s consistent. The abstraction “prompt tag” is appropriate for “thing that can be applied to preset attributes or appended as a modifier.” No need to rename the table for the refactor.

**“Never prune” and empty Key: lines**

- The plan says “empty Key: lines filtered upstream by attributesToContent().” In `presetSchemas.ts`, `attributesToContent()` does `.filter(([, v]) => v)`, so empty values are not emitted. Preset content coming from the editor therefore does not contain “Key: ” lines with no value. The compiler’s “never prune” means: do not remove a preset line that has a value just because no tag matched. So you do not get 17 empty lines in the compiled prompt unless someone pastes raw text that contains them. Design is correct.

**Multi-select and comma-joined snippets**

- The plan joins multi-select snippets with `, ` (e.g. “Clothing: casual wear, evening gown”). For image models, multiple comma-separated descriptors in one attribute are common and usually work. Restricting to single-select everywhere would be safer but less flexible. Recommendation: keep multi-select for the categories that already have it (accessories, props, key_elements, etc.) and monitor quality; if results degrade, narrow multi-select to a smaller list.

**useState() for catalog + ref() for selection**

- `useState('prompt-tag-catalog', () => [])` shares the catalog across all consumers and is SSR-safe. Selection in `ref([])` is ephemeral and per-component-tree; the generate page owns selection via useGenerationForm. Nuxt serializes useState by key; the key is a string and the value is an array of plain objects (no Set). So no serialization issue. Key collision: the keys `'prompt-tag-catalog'` and `'prompt-tag-loaded'` are unique; no other composable in the list uses them. So the singleton pattern is appropriate.

---

## 4. Answers to Specific Questions

**Does the prompt_tags migration SQL deduplicate correctly?**

- The plan does not introduce a `prompt_tags` table; it keeps `quick_modifiers` and adds columns in 0014. There is no dedup in the migration SQL. Dedup is a separate step (admin GET/POST dedup-modifiers). So the question is really about the dedup script. The script groups by `(attributeKey || category)::LOWER(label)` and keeps one row per group (longest snippet). With real seed data, attribute_key varies (e.g. body_type, hair_color), so same-label across different attribute_key are in different groups. Rows are only dropped when same attribute_key and same label appear twice (true duplicates). Edge case: if a category had two distinct modifiers with the same label (e.g. two “Natural” in different categories that normalize to different attribute_keys), they are not merged. So no incorrect drops from the script. The only caveat is “keep longest snippet” (see Minor #5).

**Is useState() the right singleton pattern?**

- Yes. Catalog in useState, selection in ref(); SSR-safe, no Set in state, keys are unique.

**Should preset lines ever be pruned?**

- No. Never prune preset lines that have a value. Empty “Key: ” lines are already excluded upstream by `attributesToContent()` when content is built from the editor. So “never prune” is correct and does not produce long runs of empty lines.

**Multi-select comma-join and image generation?**

- Comma-joined values for multi-select attributes are acceptable and common. Keep as-is; restrict multi-select by category if quality issues appear.

**What happens to existing generation records?**

- Old records have `presets` (JSON Record<string, string>) and possibly no `lineage`. New records get dual-write: `presets` + `lineage` + `promptElements`. Gallery and detail views (GenerationCard, GalleryViewer, gallery/[id]) read `generation.presets` and parse it for badges. So old and new records both render correctly. When you eventually add lineage-based features, handle missing lineage by falling back to presets.

**Other consumers of useQuickModifiers / quick_modifiers table?**

- **useQuickModifiers:** No remaining consumers; only definition in useQuickModifiers.ts. Replaced by usePromptTags everywhere that mattered.
- **quick_modifiers table:** Used by `/api/quick-modifiers`, `/api/quick-modifiers/usage`, `/api/admin/quick-modifiers` (and CRUD), and the dedup script. useChatForm, usePromptParser, useGenerationForm (via usePromptTags), and admin quick-modifiers page all go through these. No cron or other hidden consumers found. The plan’s “Update useAdminQuickModifiers — Add attributeKey, appliesTo, selectionMode to CRUD” is the right place to keep admin in sync.

**usePresetEditor and the audit**

- usePresetEditor was not in the original audit. It uses PRESET_ATTRIBUTES, attributesToContent, usePromptElements, useGenerate; it does not use quick modifiers or the compiler. It passes name-based `presets` for preview generation. No singleton/identity bugs; no change required for the refactor beyond the plan’s clarification that it stays name-based.

**Is compilationPipelineDescription() still accurate?**

- Yes. It already says: “Original preset lines are NEVER pruned — if no tag matches, the original value is kept” and “Tags are scoped by (presetType, attributeKey).” Matches the current usePromptCompiler behavior.

**Race between fetchTags and compiler?**

- Until the catalog loads, `tagCatalog` is [] so `selectedTagsList` is [] (selection is a subset of catalog). So if the user toggles tags before fetch completes, selectedTagIds updates but selectedTagsList stays empty until fetch resolves; then it includes the selected tags. No corrupt state. If the user clicks Generate before ensureLoaded(), the compiled prompt would simply have no tags. Mitigation: ensure ensureTagsLoaded() is called before the first compile (e.g. on generate page mount or when opening the tag UI). usePromptParser already awaits ensureLoaded() before parsing.

**useFeelingLucky and activePresetIds (cached path)?**

- Cached path sets activePresets (names) and then resolves names to IDs. The bug is resolution by name-only (Critical #1). With the fix (resolve by type+name), activePresetIds will be set correctly from the cached presets map.

---

## 5. Recommendations

1. **Fix useFeelingLucky resolution** (Critical #1): Use `(type, name)` when resolving cached presets to IDs.
2. **Remove or deprecate useQuickModifiers.ts** (Major #3): Prevent accidental reuse and align codebase with the plan.
3. **Document single-select scope** (Major #2): In the plan or a short ADR, state that single-select is per (attributeKey, appliesTo), not per attributeKey only.
4. **Ensure tag load before first compile**: In generate page or useGenerationForm, call `ensureTagsLoaded()` on mount (or when the user first opens the modifiers panel) so the first compile sees the catalog.
5. **Clarify plan for usePresetEditor**: Add one line that usePresetEditor keeps using name-based presets for its preview flow and does not use activePresetIds.
6. **Extend Generation type when needed**: When adding lineage-based UI, add `lineage?: string | null` and `promptElements?: string | null` to the Generation type.
7. **Migration order**: Confirm 0014 runs after all quick_modifiers seed migrations and document; or add a follow-up migration that backfills new rows if seeds are run after 0014.

---

## Summary

- The audit and plan are largely complete and the current implementation (usePromptTags, usePromptCompiler, useGenerationForm, useGenerationDispatch, dual-write, Feeling Lucky with singleton elements) matches the intent. The main fix needed is **useFeelingLucky preset resolution by (type, name)**. Other items are documentation, dead-code cleanup, and small safeguards (load gate, type, migration order). No fundamental design change is required; the prompt_tags abstraction and “never prune” behavior are sound.
