import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { packageNameFromShim, resolvePiLauncher } from '../server/pi-launcher.ts'

async function npmPiLayout(packageName = '@earendil-works/pi-coding-agent'): Promise<{ root: string; bin: string; cli: string }> {
  const root = await mkdtemp(join(tmpdir(), 'pi launcher ü '))
  const bin = join(root, 'node_modules', '.bin')
  const packageRoot = packageName.startsWith('@')
    ? join(root, 'node_modules', ...packageName.split('/'))
    : join(root, 'node_modules', packageName)
  const cli = join(packageRoot, 'dist', 'cli.mjs')
  await mkdir(join(packageRoot, 'dist'), { recursive: true })
  await mkdir(bin, { recursive: true })
  // npm writes the real CLI path into the shim; dp0 is the directory of pi.cmd.
  const shimPackage = packageName.split('/').join('\\')
  await writeFile(
    join(bin, 'pi.cmd'),
    `@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\${shimPackage}\\dist\\cli.mjs" %*\r\n`,
  )
  await writeFile(
    join(packageRoot, 'package.json'),
    JSON.stringify({ name: packageName, bin: { pi: 'dist/cli.mjs' } }),
  )
  return { root, bin, cli }
}

test('discovers the installed package name from the pi.cmd shim', () => {
  assert.equal(
    packageNameFromShim('"%_prog%"  "%dp0%\\node_modules\\@fan92rus\\pi-coding-agent\\dist\\cli.js" %*'),
    '@fan92rus/pi-coding-agent',
  )
  assert.equal(
    packageNameFromShim('"%_prog%"  "%dp0%\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js" %*'),
    '@earendil-works/pi-coding-agent',
  )
  assert.equal(packageNameFromShim('@echo hostile shim'), null)
})

test('resolves the package CLI behind pi.cmd without executing it', async (t) => {
  const { root, bin, cli } = await npmPiLayout()
  t.after(() => rm(root, { force: true, recursive: true }))
  await writeFile(cli, '')
  const invocation = resolvePiLauncher('win32', { PaTh: bin }, ';')
  assert.equal(invocation.command, process.execPath)
  assert.equal(invocation.argsPrefix[0], cli)
})

test('passes hostile RPC values to the resolved CLI exactly as argument-array data', async (t) => {
  const { root, bin, cli } = await npmPiLayout()
  const output = join(root, 'argv.json')
  t.after(() => rm(root, { force: true, recursive: true }))
  await writeFile(
    cli,
    `import { writeFile } from 'node:fs/promises'; await writeFile(${
      JSON.stringify(output)
    }, JSON.stringify(process.argv.slice(2)))`,
  )
  const invocation = resolvePiLauncher('win32', { PATH: bin }, ';')
  const hostile = [
    'with spaces',
    'émoji-東京',
    '"quote"',
    '%percent%',
    '!bang!',
    '&ampersand',
    '^caret',
    '(group)',
  ]
  const child = spawn(
    invocation.command,
    [...invocation.argsPrefix, '--system-prompt', ...hostile],
    { shell: false },
  )
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`CLI exited ${code}`)))
  })
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), ['--system-prompt', ...hostile])
})

test('resolves a fork package when PI_LIVECRAFT_PI_PACKAGE is set', async (t) => {
  const { root, bin, cli } = await npmPiLayout('@fan92rus/pi-coding-agent')
  t.after(() => rm(root, { force: true, recursive: true }))
  await writeFile(cli, '')
  const invocation = resolvePiLauncher(
    'win32',
    { PaTh: bin, PI_LIVECRAFT_PI_PACKAGE: '@fan92rus/pi-coding-agent' },
    ';',
  )
  assert.equal(invocation.command, process.execPath)
  assert.equal(invocation.argsPrefix[0], cli)
})

test('falls back to shim discovery when PI_LIVECRAFT_PI_PACKAGE is empty', async (t) => {
  const { root, bin, cli } = await npmPiLayout('@earendil-works/pi-coding-agent')
  t.after(() => rm(root, { force: true, recursive: true }))
  await writeFile(cli, '')
  const invocation = resolvePiLauncher(
    'win32',
    { PaTh: bin, PI_LIVECRAFT_PI_PACKAGE: '   ' },
    ';',
  )
  assert.equal(invocation.command, process.execPath)
  assert.equal(invocation.argsPrefix[0], cli)
})
