import type { ArgumentCompletion, JsonObject } from '../../../shared/types.ts'

/** Makes technical values readable in composer labels without changing RPC values. */
export function capitalizeLabel(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value
}

export { isObject } from '../../../shared/is-object.ts'

export function formatTokens(value: number): string {
  return value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
}

/** Returns true when the draft starts with a slash command exposed by Pi. */
export function isCommandDraft(text: string, commands: JsonObject[]): boolean {
  const name = /^\/([^\s]+)/.exec(text.trim())?.[1].toLowerCase()
  return name !== undefined
    && commands.some((command) => String(command.name).toLowerCase() === name)
}

/**
 * Splits a draft into a known command name and the argument text that follows it,
 * or null when the draft is not a command followed by a space.
 *
 * `/agile` → null (no space yet, command menu owns it)
 * `/agile ` → { commandName: 'agile', argumentPrefix: '' }
 * `/agile run extra` → { commandName: 'agile', argumentPrefix: 'run extra' }
 */
export function parseCommandArguments(
  text: string,
  commands: JsonObject[],
): { commandName: string; argumentPrefix: string } | null {
  const match = /^(\/[A-Za-z0-9][A-Za-z0-9_-]*)(\s.*)?$/s.exec(text)
  if (!match) return null
  const commandName = match[1].slice(1).toLowerCase()
  if (!commands.some((command) => String(command.name).toLowerCase() === commandName)) return null
  if (match[2] === undefined) return null // no space after the command name yet
  return { commandName, argumentPrefix: match[2].slice(1) }
}

/**
 * Filters cached argument completions by a case-insensitive prefix on the item
 * value or label. An empty or whitespace prefix returns the full list, so the
 * first request (which fetches everything) doubles as the unfiltered view.
 */
export function filterArgumentCompletions(
  items: ArgumentCompletion[],
  argumentPrefix: string,
): ArgumentCompletion[] {
  const prefix = argumentPrefix.trim().toLowerCase()
  if (!prefix) return items
  return items.filter(
    (item) => item.value.toLowerCase().startsWith(prefix)
      || item.label.toLowerCase().startsWith(prefix),
  )
}

/** Returns true when the trimmed draft is exactly the /compact slash command with no arguments. */
export function isCompactCommandDraft(text: string): boolean {
  return text.trim() === '/compact'
}

/** Prepends the local compact command when Pi does not already expose it in the snapshot. */
export function ensureCompactCommand(commands: JsonObject[]): JsonObject[] {
  return commands.some((cmd) => String(cmd.name).toLowerCase() === 'compact')
    ? commands
    : [{ name: 'compact' }, ...commands]
}

/** Tokenizes a string on the separators used in provider/model identifiers. */
function splitTokens(value: string): string[] {
  return value.toLowerCase().split(/[\s/_\-.:]+/).filter((token) => token.length > 0)
}

/** Classic Levenshtein edit distance between two strings. */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

/** How many typos a token should tolerate, scaled by its length. */
function typoThreshold(tokenLength: number): number {
  if (tokenLength <= 2) return 0
  if (tokenLength <= 5) return 1
  if (tokenLength <= 9) return 2
  return 3
}

/** True when one query token matches one candidate token, by substring or Levenshtein. */
function tokenMatches(queryToken: string, candidateToken: string): boolean {
  if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) return true
  return levenshteinDistance(queryToken, candidateToken) <= typoThreshold(queryToken.length)
}

/**
 * Fuzzy model matcher used by the model search box.
 *
 * Splits the query into tokens and requires every token to match at least one
 * token of either the canonical value ("provider/id", hyphenated) or the display
 * label ("provider/name", human-readable with spaces). Substring hits suffice;
 * otherwise a Levenshtein edit distance within a length-scaled threshold accepts
 * near-matches, so typos like "deeksee v4 flsh" still find deepseek-v4-flash.
 */
export function fuzzyModelMatch(query: string, value: string, label: string): boolean {
  const queryTokens = splitTokens(query)
  if (queryTokens.length === 0) return true
  const haystack = [...new Set([...splitTokens(value), ...splitTokens(label)])]
  return queryTokens.every((queryToken) =>
    haystack.some((token) => tokenMatches(queryToken, token))
  )
}

/** Restores the draft for one session from local storage. */
export function readComposerDraft(storageKey: string): string {
  try {
    const storage = (globalThis as typeof globalThis & {
      localStorage?: { getItem: (key: string) => string | null }
    })
      .localStorage
    return storage?.getItem(storageKey) ?? ''
  } catch {
    return ''
  }
}
