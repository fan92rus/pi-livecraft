import assert from 'node:assert/strict'
import test from 'node:test'
import type { RecentSession, SessionSummary } from '../shared/types.ts'
import {
  activeWorkspaceSessions,
  pickSessionOnOpen,
  recentOtherWorkspaceSessions,
  sidebarSessions,
} from '../src/features/workspace/sidebar-sessions.ts'

const persisted: RecentSession = {
  id: 'persisted-id',
  cwd: '/workspace',
  name: 'Premier message',
  sessionPath: '/sessions/new.jsonl',
  updatedAt: 456,
}

test('shows persisted sessions from the current workspace', () => {
  assert.deepEqual(sidebarSessions([persisted], '/workspace'), [persisted])
})

test('hides persisted sessions from another workspace', () => {
  assert.deepEqual(sidebarSessions([persisted], '/another-workspace'), [])
})

test('keeps a sent session visible when persistence temporarily omits it', () => {
  assert.deepEqual(sidebarSessions([], '/workspace', [persisted]), [persisted])
})

test('uses persisted order once the sent session is returned', () => {
  const other = {
    ...persisted,
    id: 'other-id',
    sessionPath: '/sessions/other.jsonl',
    updatedAt: 999,
  }
  const refreshed = { ...persisted, name: 'Generated title', updatedAt: 789 }

  assert.deepEqual(sidebarSessions([other, refreshed], '/workspace', [persisted]), [
    other,
    refreshed,
  ])
})

// -- activeWorkspaceSessions --------------------------------------------------------------------

const remoteSession: SessionSummary = {
  id: 'remote-1',
  cwd: '/remote',
  name: 'Remote session',
  sessionPath: '/sessions/remote.jsonl',
  status: 'running',
  pendingUi: [],
}

test('lists every live session from any workspace, busiest first', () => {
  const completed = {
    ...remoteSession,
    id: 'idle-1',
    sessionPath: '/sessions/idle.jsonl',
    status: 'idle' as const,
  }
  const starting = {
    ...remoteSession,
    id: 'starting-1',
    sessionPath: '/sessions/starting.jsonl',
    status: 'starting' as const,
  }
  const exited = {
    ...remoteSession,
    id: 'exited-1',
    sessionPath: '/sessions/exited.jsonl',
    status: 'exited' as const,
  }

  assert.deepEqual(
    activeWorkspaceSessions([completed, starting, exited, remoteSession]),
    [remoteSession, starting, completed],
  )
})

test('activeWorkspaceSessions drops exited sessions', () => {
  const exited = { ...remoteSession, id: 'exited', status: 'exited' as const }
  assert.deepEqual(activeWorkspaceSessions([exited]), [])
})

test('activeWorkspaceSessions de-duplicates sessions sharing a session path', () => {
  const idle = { ...remoteSession, id: 'idle', status: 'idle' as const }
  const running = { ...remoteSession, id: 'running', status: 'running' as const }
  // Same sessionPath as remoteSession (running), different id.
  assert.deepEqual(
    activeWorkspaceSessions([idle, running]),
    [running],
  )
})

test('activeWorkspaceSessions keeps distinct sessions without a session path', () => {
  const noPathA = { ...remoteSession, id: 'a', sessionPath: undefined }
  const noPathB = { ...remoteSession, id: 'b', sessionPath: undefined }
  assert.equal(activeWorkspaceSessions([noPathA, noPathB]).length, 2)
})

// -- recentOtherWorkspaceSessions ------------------------------------------------------------

const otherRecent: RecentSession = {
  id: 'other-1',
  cwd: '/remote',
  name: 'Other recent',
  sessionPath: '/sessions/other.jsonl',
  updatedAt: 500,
}

const inWorkspaceRecent: RecentSession = {
  ...otherRecent,
  id: 'current-1',
  cwd: '/workspace',
  sessionPath: '/sessions/current.jsonl',
}

const olderRecent: RecentSession = {
  ...otherRecent,
  id: 'older-1',
  sessionPath: '/sessions/older.jsonl',
  updatedAt: 100,
}

test('shows recent sessions from other workspaces, newest first', () => {
  assert.deepEqual(
    recentOtherWorkspaceSessions([olderRecent, otherRecent], [], '/workspace'),
    [otherRecent, olderRecent],
  )
})

test('hides recent sessions from the opened workspace', () => {
  assert.deepEqual(
    recentOtherWorkspaceSessions([inWorkspaceRecent], [], '/workspace'),
    [],
  )
})

test('hides recently active sessions backed by a live process (they live in the active section)', () => {
  const live = { ...remoteSession, id: 'other-1', sessionPath: '/sessions/other.jsonl' }
  assert.deepEqual(recentOtherWorkspaceSessions([otherRecent], [live], '/workspace'), [])
})

// -- pickSessionOnOpen ------------------------------------------------------

const runningSession: SessionSummary = {
  id: 'active-1',
  cwd: '/workspace',
  name: 'Running session',
  sessionPath: '/sessions/active.jsonl',
  status: 'running',
  pendingUi: [],
}

const idleCompletedSession: SessionSummary = {
  id: 'idle-1',
  cwd: '/workspace',
  name: 'Idle completed',
  sessionPath: '/sessions/idle.jsonl',
  status: 'idle',
  pendingUi: [],
}

const startingSession: SessionSummary = {
  id: 'starting-1',
  cwd: '/workspace',
  name: 'Starting session',
  sessionPath: '/sessions/starting.jsonl',
  status: 'starting',
  pendingUi: [],
}

const exitedSession: SessionSummary = {
  id: 'exited-1',
  cwd: '/workspace',
  name: 'Exited session',
  sessionPath: '/sessions/exited.jsonl',
  status: 'exited',
  pendingUi: [],
}

const visibleCompleted: RecentSession = {
  id: 'idle-1',
  cwd: '/workspace',
  name: 'Idle completed',
  sessionPath: '/sessions/idle.jsonl',
  updatedAt: 200,
}

const visibleRunning: RecentSession = {
  id: 'active-1',
  cwd: '/workspace',
  name: 'Running session',
  sessionPath: '/sessions/active.jsonl',
  updatedAt: 300,
}

const visibleStarting: RecentSession = {
  id: 'starting-1',
  cwd: '/workspace',
  name: 'Starting session',
  sessionPath: '/sessions/starting.jsonl',
  updatedAt: 100,
}

test('pickSessionOnOpen returns the most recent completed unviewed session first', () => {
  const visible = [visibleRunning, visibleCompleted]
  const active = [runningSession, idleCompletedSession]
  const completed = new Set(['/sessions/idle.jsonl'])

  assert.equal(pickSessionOnOpen(visible, active, completed), 'idle-1')
})

test('pickSessionOnOpen falls back to the most recent active session when no completed unviewed', () => {
  const visible = [visibleStarting, visibleRunning]
  const active = [startingSession, runningSession]
  const completed = new Set<string>()

  assert.equal(pickSessionOnOpen(visible, active, completed), 'starting-1')
})

test('pickSessionOnOpen skips idle sessions not flagged as completed', () => {
  const visible = [visibleCompleted]
  const active = [idleCompletedSession]
  const completed = new Set<string>()

  assert.equal(pickSessionOnOpen(visible, active, completed), null)
})

test('pickSessionOnOpen skips exited sessions', () => {
  const visibleExited: RecentSession = {
    ...visibleCompleted,
    sessionPath: '/sessions/exited.jsonl',
  }
  const visible = [visibleExited]
  const active = [exitedSession]
  const completed = new Set(['/sessions/exited.jsonl'])

  assert.equal(pickSessionOnOpen(visible, active, completed), null)
})

test('pickSessionOnOpen returns null when no candidate exists', () => {
  assert.equal(pickSessionOnOpen([], [], new Set()), null)
})

test('pickSessionOnOpen picks a starting session as active', () => {
  const visible = [visibleStarting]
  const active = [startingSession]

  assert.equal(pickSessionOnOpen(visible, active, new Set()), 'starting-1')
})
