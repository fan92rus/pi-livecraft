import type { RecentSession, SessionSummary } from '../../../shared/types.ts'

/** Adds only sent sessions still missing from persistence, preserving the server order otherwise. */
export function sidebarSessions(
  recentSessions: RecentSession[],
  workspacePath: string,
  sentSessions: RecentSession[] = [],
): RecentSession[] {
  const recentIds = new Set(recentSessions.map((session) => session.id))
  const recentPaths = new Set(recentSessions.map((session) => session.sessionPath))
  const pending = sentSessions.filter((session) =>
    !recentIds.has(session.id) && !recentPaths.has(session.sessionPath)
  )
  return [...pending, ...recentSessions].filter(({ cwd }) => cwd === workspacePath)
}

/** Live, non-exited sessions from every workspace, busiest (working/waiting) first.
 *  Surfaced in the sidebar regardless of the workspace that is currently open. */
export function activeWorkspaceSessions(sessions: SessionSummary[]): SessionSummary[] {
  const statusPriority: Record<SessionSummary['status'], number> = {
    running: 0,
    starting: 1,
    idle: 2,
    exited: 3,
  }
  return sessions
    .filter((session) => session.status !== 'exited')
    .sort((left, right) => statusPriority[left.status] - statusPriority[right.status])
}

/** Recently active sessions from added workspaces other than the open one.
 *  Excludes sessions backed by a live Pi process (those live in the active section). */
export function recentOtherWorkspaceSessions(
  recentSessions: RecentSession[],
  activeSessions: SessionSummary[],
  workspacePath: string,
): RecentSession[] {
  const activePaths = new Set(
    activeSessions.map((session) => session.sessionPath).filter((path): path is string =>
      Boolean(path)
    ),
  )
  return recentSessions
    .filter((session) =>
      session.cwd !== workspacePath
      && !activePaths.has(session.sessionPath)
    )
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

/**
 * Picks the session to auto-select when opening a workspace.
 * Priority: most recent completed unviewed session → most recent active session → none.
 */
export function pickSessionOnOpen(
  visibleSessions: RecentSession[],
  activeSessions: SessionSummary[],
  completedSessionIds: ReadonlySet<string>,
): string | null {
  for (const visible of visibleSessions) {
    const active = activeSessions.find(
      (s) => s.sessionPath === visible.sessionPath && s.status !== 'exited',
    )
    if (active && active.status === 'idle' && completedSessionIds.has(visible.sessionPath)) {
      return active.id
    }
  }
  for (const visible of visibleSessions) {
    const active = activeSessions.find(
      (s) => s.sessionPath === visible.sessionPath && s.status !== 'exited',
    )
    if (active && (active.status === 'starting' || active.status === 'running')) {
      return active.id
    }
  }
  return null
}
