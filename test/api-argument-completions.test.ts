import assert from 'node:assert/strict'
import test from 'node:test'
import { getArgumentCompletions } from '../src/api.ts'

function mockFetch(body: unknown, status = 200): void {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as Response
}

test('unwraps data.items from the RPC response', async () => {
  mockFetch({
    id: 'request-1',
    type: 'response',
    command: 'get_argument_completions',
    success: true,
    data: {
      items: [
        { value: 'on', label: 'on', description: 'Enable agile mode' },
        { value: 'off', label: 'off' },
      ],
    },
  })

  const items = await getArgumentCompletions('session-1', 'agile', '')
  assert.deepEqual(items, [
    { value: 'on', label: 'on', description: 'Enable agile mode' },
    { value: 'off', label: 'off' },
  ])
})

test('filters out items that are not valid ArgumentCompletion objects', async () => {
  mockFetch({
    success: true,
    data: {
      items: [
        { value: 'run', label: 'run' },
        { value: 'setup' }, // missing label
        'on', // not an object
        { label: 'off' }, // missing value
        null,
      ],
    },
  })

  const items = await getArgumentCompletions('session-1', 'agile', 'r')
  assert.deepEqual(items, [{ value: 'run', label: 'run' }])
})

test('returns an empty array when the response has no data.items', async () => {
  mockFetch({ success: true, data: {} })
  assert.deepEqual(await getArgumentCompletions('session-1', 'agile', ''), [])

  mockFetch({ success: true })
  assert.deepEqual(await getArgumentCompletions('session-1', 'agile', ''), [])
})

test('returns an empty array when items is not an array', async () => {
  mockFetch({ success: true, data: { items: 'not-an-array' } })
  assert.deepEqual(await getArgumentCompletions('session-1', 'agile', ''), [])
})

test('rejects when the backend returns an error', async () => {
  mockFetch({ error: 'Unknown command: get_argument_completions' }, 500)
  await assert.rejects(
    getArgumentCompletions('session-1', 'agile', ''),
    /Unknown command: get_argument_completions/,
  )
})

test('posts the command name and argument prefix to the session commands endpoint', async () => {
  let requestedPath = ''
  let requestBody = ''
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    requestedPath = String(input)
    requestBody = String(init?.body)
    return new Response(JSON.stringify({ success: true, data: { items: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as Response
  }

  await getArgumentCompletions('session-1', 'agile', 'r')
  assert.equal(requestedPath, '/api/sessions/session-1/commands')
  assert.deepEqual(JSON.parse(requestBody), {
    type: 'get_argument_completions',
    commandName: 'agile',
    argumentPrefix: 'r',
  })
})
