import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ensureCompactCommand,
  fuzzyModelMatch,
  isCommandDraft,
  isCompactCommandDraft,
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
