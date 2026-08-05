import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { findPackageJSON } from 'node:module'
import { delimiter, dirname, isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface PiLauncherInvocation {
  command: string
  argsPrefix: string[]
}

interface PiPackageJson {
  bin?: { pi?: unknown }
}

/**
 * Reads the installed npm package name out of an npm-generated pi.cmd shim.
 * npm writes the real CLI path into the shim (`..."%dp0%\node_modules\@scope\name\dist\cli.js" %*`),
 * so the installed package can be discovered without configuring it.
 * Returns null when the shim does not reference a node_modules package path.
 */
export function packageNameFromShim(shimContent: string): string | null {
  const match = /node_modules[/\\](@[^/\\]+[/\\][^/\\\s"]+|[^/\\\s"]+)/.exec(shimContent)
  return match?.[1]?.replaceAll('\\', '/') ?? null
}

/**
 * Resolves Pi without executing npm's Windows command shim. On Windows npm installs
 * pi.cmd, but invoking its package CLI with Node keeps every RPC argument out of cmd.exe.
 *
 * The npm package to resolve is discovered from the shim itself (so any installed build,
 * official or fork, just works). It can be pinned with PI_LIVECRAFT_PI_PACKAGE
 * (e.g. @fan92rus/pi-coding-agent); an empty or whitespace value re-enables discovery.
 */
export function resolvePiLauncher(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  pathDelimiter = delimiter,
): PiLauncherInvocation {
  if (platform !== 'win32') return { command: 'pi', argsPrefix: [] }

  const configuredPackage = env.PI_LIVECRAFT_PI_PACKAGE?.trim() || null
  const path = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1]
  if (!path) throw new Error('Cannot find pi.cmd because PATH is empty')

  for (const directory of path.split(pathDelimiter)) {
    if (!directory) continue
    const piCmdPath = resolve(directory, 'pi.cmd')
    if (!existsSync(piCmdPath)) continue

    try {
      let piPackage = configuredPackage
      if (!piPackage) {
        // No override: the npm shim hardcodes the installed package path, so discover it.
        piPackage = packageNameFromShim(readFileSync(piCmdPath, 'utf8'))
      }
      if (!piPackage) continue
      const packageJsonPath = findPackageJSON(piPackage, pathToFileURL(piCmdPath))
      if (!packageJsonPath) continue
      const packageRoot = realpathSync(dirname(packageJsonPath))
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PiPackageJson
      const bin = packageJson.bin?.pi
      if (typeof bin !== 'string' || !bin) continue

      const cliPath = realpathSync(resolve(packageRoot, bin))
      if (!isPathInside(packageRoot, cliPath)) continue
      return { command: process.execPath, argsPrefix: [cliPath] }
    } catch {
      continue
    }
  }

  throw new Error(
    `Cannot find ${configuredPackage ?? 'the installed pi package'} from a pi.cmd entry on PATH`,
  )
}

function isPathInside(root: string, path: string): boolean {
  const pathFromRoot = relative(root, path)
  return Boolean(pathFromRoot) && pathFromRoot !== '..' && !pathFromRoot.startsWith('../')
    && !pathFromRoot.startsWith('..\\') && !isAbsolute(pathFromRoot)
}
