import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ensureCompactCommand,
  filterArgumentCompletions,
  fuzzyModelMatch,
  isCommandDraft,
  isCompactCommandDraft,
  parseCommandArguments,
} from '../src/features/composer/composer-utils.ts'

test('detects only slash commands exposed by Pi', () => {
  const commands = [{ name: 'agent' }, { name: 'session-name' }]
  assert.equal(isCommandDraft('/agent frontend', commands), true)
  assert.equal(isCommandDraft('  /SESSION-NAME demo', commands), true)
  assert.equal(isCommandDraft('/unknown', commands), false)
  assert.equal(isCommandDraft('agent', commands), false)
})

test('detects /compact with no arguments', () => {
  assert.equal(isCompactCommandDraft('/compact'), true)
  assert.equal(isCompactCommandDraft('  /compact  '), true)
})

test('rejects /compact with trailing arguments', () => {
  assert.equal(isCompactCommandDraft('/compact foo'), false)
  assert.equal(isCompactCommandDraft('/compact '), true) // selectSlashCommand appends a space
})

test('rejects unrelated input', () => {
  assert.equal(isCompactCommandDraft(''), false)
  assert.equal(isCompactCommandDraft('/agent'), false)
  assert.equal(isCompactCommandDraft('compact'), false)
})

test('prepends compact command when absent', () => {
  const result = ensureCompactCommand([{ name: 'agent' }])
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'compact')
  assert.equal(result[1].name, 'agent')
})

test('does not duplicate compact command when Pi already exposes it', () => {
  const result = ensureCompactCommand([{ name: 'compact' }, { name: 'agent' }])
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'compact')
  assert.equal(result[1].name, 'agent')
})

test('handles empty command list', () => {
  const result = ensureCompactCommand([])
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'compact')
})

test('parses a known command followed by a space into name and argument prefix', () => {
  const commands = [{ name: 'agile' }]
  assert.deepEqual(parseCommandArguments('/agile ', commands), { commandName: 'agile', argumentPrefix: '' })
  assert.deepEqual(parseCommandArguments('/agile run', commands), { commandName: 'agile', argumentPrefix: 'run' })
  assert.deepEqual(parseCommandArguments('/agile run extra', commands), { commandName: 'agile', argumentPrefix: 'run extra' })
})

test('returns null when the command has no space yet so the slash menu keeps ownership', () => {
  const commands = [{ name: 'agile' }]
  assert.equal(parseCommandArguments('/agile', commands), null)
  assert.equal(parseCommandArguments('/agi', commands), null)
})

test('returns null for an unknown command or non-command input', () => {
  const commands = [{ name: 'agile' }]
  assert.equal(parseCommandArguments('/unknown ', commands), null)
  assert.equal(parseCommandArguments('plain text', commands), null)
  assert.equal(parseCommandArguments('', commands), null)
})

test('returns the full list for an empty or whitespace argument prefix', () => {
  const items = [
    { value: 'on', label: 'on' },
    { value: 'off', label: 'off' },
    { value: 'run', label: 'run' },
  ]
  assert.equal(filterArgumentCompletions(items, '').length, 3)
  assert.equal(filterArgumentCompletions(items, '   ').length, 3)
})

test('filters cached completions by a case-insensitive prefix on value or label', () => {
  const items = [
    { value: 'on', label: 'on' },
    { value: 'off', label: 'off' },
    { value: 'run', label: 'run' },
    { value: 'setup', label: 'setup' },
  ]
  assert.deepEqual(filterArgumentCompletions(items, 'o'), [
    { value: 'on', label: 'on' },
    { value: 'off', label: 'off' },
  ])
  assert.deepEqual(filterArgumentCompletions(items, 'ru'), [{ value: 'run', label: 'run' }])
  assert.deepEqual(filterArgumentCompletions(items, 'setup'), [{ value: 'setup', label: 'setup' }])
  assert.deepEqual(filterArgumentCompletions(items, 'zzz'), [])
})

test('matches label even when it diverges from the value', () => {
  const items = [{ value: 'run', label: 'run <role> <model>' }]
  assert.equal(filterArgumentCompletions(items, 'run').length, 1)
})

// A model's canonical value is "provider/id" (hyphenated) while its label is
// "provider/name" (human-readable, spaced), e.g. opencode-go/deepseek-v4-flash
// shown as "opencode-go/DeepSeek V4 Flash (New)". Search must match both forms.
const VALUE = 'opencode-go/deepseek-v4-flash'
const LABEL = 'opencode-go/DeepSeek V4 Flash (New)'

test('matches the hyphenated canonical provider/id', () => {
  assert.equal(fuzzyModelMatch('deepseek-v4-flash', VALUE, LABEL), true)
  assert.equal(fuzzyModelMatch('opencode-go/deepseek-v4-flash', VALUE, LABEL), true)
  assert.equal(fuzzyModelMatch('deepseek-v4', VALUE, LABEL), true)
})

test('matches the spaced human-readable name', () => {
  assert.equal(fuzzyModelMatch('deepseek v4 flash', VALUE, LABEL), true)
  assert.equal(fuzzyModelMatch('opencode deepseek v4', VALUE, LABEL), true)
})

test('tolerates typos via Levenshtein distance', () => {
  assert.equal(fuzzyModelMatch('deeksee v4 flsh', VALUE, LABEL), true)
  assert.equal(fuzzyModelMatch('glmm-5.2', 'zai/glm-5.2', 'zai/GLM 5.2'), true)
})

test('does not match unrelated models', () => {
  assert.equal(fuzzyModelMatch('glm-5.2', VALUE, LABEL), false)
  assert.equal(fuzzyModelMatch('opencode-go/glm', VALUE, LABEL), false)
  assert.equal(fuzzyModelMatch('', VALUE, LABEL), true) // empty query shows everything
})
