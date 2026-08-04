import assert from 'node:assert/strict'
import { access, chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { spawn } from 'node:child_process'
import { connect, type Socket } from 'node:net'
import test from 'node:test'
import { isObject } from '../shared/is-object.ts'

/**
 * Focused manager tests for the `close` and `delete` session actions. Kept in a
 * separate file from manager.integration.test.ts so the two suites can land
 * independently. The fake Pi is minimal: it only needs `get_state` (returning
 * the `--session` path) and must exit on stdin EOF to satisfy the manager's
 * terminate protocol.
 */
test('close terminates the Pi process while preserving its session file', {
  timeout: 10_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-mgr-close-'))
  const port = 45_000 + (process.pid % 10_000)
  await writeFakePi(directory)
  const sessionPath = join(directory, 'keep.jsonl')
  await writeFile(sessionPath, '')
  const manager = spawn(process.execPath, ['server/manager.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${fakePiBin(directory)}${delimiter}${process.env.PATH}`,
      PI_LIVECRAFT_MANAGER_PORT: String(port),
      PI_CODING_AGENT_SESSION_DIR: directory,
    },
    stdio: 'ignore',
  })
  const client = await connectManager(port)
  try {
    const opened = await client.request('open', {
      cwd: process.cwd(),
      name: 'Active',
      sessionPath,
    })
    const id = sessionId(opened)
    const closed = await client.request('close', { sessionId: id })
    assert.deepEqual(closed.data, { closed: true })
    assert.equal(await pathExists(sessionPath), true)
    assert.equal(sessionStatus(await client.request('list', {}), id), undefined)
  } finally {
    client.close()
    await stopProcess(manager)
    await rm(directory, { force: true, recursive: true })
  }
})

test('delete removes the session file after closing its process', {
  timeout: 10_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-mgr-del-'))
  const port = 45_000 + (process.pid % 10_000)
  await writeFakePi(directory)
  const sessionPath = join(directory, 'remove.jsonl')
  await writeFile(sessionPath, '')
  const manager = spawn(process.execPath, ['server/manager.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${fakePiBin(directory)}${delimiter}${process.env.PATH}`,
      PI_LIVECRAFT_MANAGER_PORT: String(port),
      PI_CODING_AGENT_SESSION_DIR: directory,
    },
    stdio: 'ignore',
  })
  const client = await connectManager(port)
  try {
    const opened = await client.request('open', {
      cwd: process.cwd(),
      name: 'Active',
      sessionPath,
    })
    const id = sessionId(opened)
    const deleted = await client.request('delete', { sessionId: id, sessionPath })
    assert.deepEqual(deleted.data, { deleted: true })
    assert.equal(await pathExists(sessionPath), false)
    assert.equal(sessionStatus(await client.request('list', {}), id), undefined)
  } finally {
    client.close()
    await stopProcess(manager)
    await rm(directory, { force: true, recursive: true })
  }
})

test('delete refuses to remove a session with active work', {
  timeout: 10_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-mgr-busy-'))
  const port = 45_000 + (process.pid % 10_000)
  await writeFakePi(directory)
  const sessionPath = join(directory, 'busy.jsonl')
  await writeFile(sessionPath, '')
  const manager = spawn(process.execPath, ['server/manager.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${fakePiBin(directory)}${delimiter}${process.env.PATH}`,
      PI_LIVECRAFT_MANAGER_PORT: String(port),
      PI_CODING_AGENT_SESSION_DIR: directory,
    },
    stdio: 'ignore',
  })
  const client = await connectManager(port)
  try {
    const opened = await client.request('open', {
      cwd: process.cwd(),
      name: 'Active',
      sessionPath,
    })
    const id = sessionId(opened)
    await client.request('command', {
      sessionId: id,
      command: { type: 'prompt', message: 'Test' },
    })
    const deleted = await client.request('delete', { sessionId: id, sessionPath })
    assert.equal(deleted.ok, false)
    assert.match(deleted.error ?? '', /active work/)
    assert.equal(await pathExists(sessionPath), true)
  } finally {
    client.close()
    await stopProcess(manager)
    await rm(directory, { force: true, recursive: true })
  }
})

/** Writes a tiny fake `pi` binary that returns its `--session` path from get_state. */
async function writeFakePi(directory: string): Promise<void> {
  const source = `#!/usr/bin/env node
import readline from 'node:readline'
const sessionPath = process.argv[process.argv.indexOf('--session') + 1]
let streaming = false
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const command = JSON.parse(line)
  if (command.type === 'prompt') streaming = command.message !== '/handled'
  const data = command.type === 'get_state'
    ? { sessionFile: sessionPath, isStreaming: streaming, isCompacting: false, pendingMessageCount: 0 }
    : {}
  console.log(JSON.stringify({ type: 'response', id: command.id, success: true, data }))
})
`
  if (process.platform === 'win32') {
    const packageRoot = join(directory, 'node_modules', '@earendil-works', 'pi-coding-agent')
    const bin = fakePiBin(directory)
    await mkdir(join(packageRoot, 'dist'), { recursive: true })
    await mkdir(bin, { recursive: true })
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({ bin: { pi: 'dist/cli.mjs' } }),
    )
    await writeFile(join(packageRoot, 'dist', 'cli.mjs'), source)
    await writeFile(join(bin, 'pi.cmd'), '@echo off')
    return
  }
  const path = join(directory, 'pi')
  await writeFile(path, source)
  await chmod(path, 0o755)
}

function fakePiBin(directory: string): string {
  return process.platform === 'win32' ? join(directory, 'node_modules', '.bin') : directory
}

interface ManagerResponse {
  kind: 'response'
  id: string
  ok: boolean
  data?: unknown
  error?: string
}

async function connectManager(
  port: number,
): Promise<
  {
    request: (action: string, fields: Record<string, unknown>) => Promise<ManagerResponse>
    close: () => void
  }
> {
  const socket = await connectWithRetry(port)
  let buffer = ''
  let requestId = 0
  const pending = new Map<string, (response: ManagerResponse) => void>()
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line) continue
      const response: unknown = JSON.parse(line)
      if (!isObject(response) || response.kind !== 'response' || typeof response.id !== 'string')
        continue
      const id = response.id
      const resolve = pending.get(id)
      if (resolve) {
        pending.delete(id)
        resolve(response as unknown as ManagerResponse)
      }
    }
  })
  return {
    request(action, fields) {
      const id = String(++requestId)
      return new Promise((resolve) => {
        pending.set(id, resolve)
        socket.write(`${JSON.stringify({ id, action, ...fields })}\n`)
      })
    },
    close: () => socket.end(),
  }
}

async function connectWithRetry(port: number): Promise<Socket> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await new Promise<Socket>((resolve, reject) => {
        const socket = connect({ host: '127.0.0.1', port })
        socket.once('connect', () => resolve(socket))
        socket.once('error', reject)
      })
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  throw new Error('Pi manager did not start')
}

function sessionId(response: ManagerResponse): string {
  if (!isObject(response.data) || typeof response.data.id !== 'string')
    throw new Error('Invalid session response')
  return response.data.id
}

function sessionStatus(response: ManagerResponse, id: string): unknown {
  if (!Array.isArray(response.data)) throw new Error('Invalid sessions response')
  const session = response.data.find((value) => isObject(value) && value.id === id)
  return isObject(session) ? session.status : undefined
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function stopProcess(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null || !child.pid) return
  if (process.platform === 'win32') {
    const taskkill = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    })
    await new Promise((resolve) => taskkill.once('exit', resolve))
    return
  }
  child.kill('SIGTERM')
  await new Promise((resolve) => child.once('exit', resolve))
}
