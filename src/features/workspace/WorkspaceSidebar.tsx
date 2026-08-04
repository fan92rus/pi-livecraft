import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Tooltip } from '../../components/Tooltip.tsx'
import type { RecentSession, SessionSummary } from '../../../shared/types.ts'
import { sessionIndicator } from './session-indicator.ts'
import { SessionStatusIndicator } from './SessionStatusIndicator.tsx'
import {
  activeWorkspaceSessions,
  recentOtherWorkspaceSessions,
  sidebarSessions,
} from './sidebar-sessions.ts'
import { maxWorkspaceSidebarWidth, minWorkspaceSidebarWidth } from './workspace-sidebar.ts'

interface WorkspaceSidebarProps {
  compactingSessionIds: ReadonlySet<string>
  completedSessionIds: ReadonlySet<string>
  isRefreshing: boolean
  recentSessions: RecentSession[]
  sentSessions: RecentSession[]
  sessions: SessionSummary[]
  selectedId: string
  width: number
  workspacePath: string
  onChooseWorkspace: () => void
  onCreate: () => Promise<void>
  onCloseSession: (sessionId: string) => void | Promise<void>
  onDeleteSession: (sessionId: string | undefined, sessionPath: string) => void | Promise<void>
  onOpenSession: (session: RecentSession) => Promise<void>
  onSelectOtherWorkspaceSession: (session: SessionSummary) => void
  onSelectSession: (sessionId: string) => void
  onOpenSettings: () => void
  onResize: (width: number) => void
  onError: (cause: unknown) => void
}

/** Displays the current workspace and opens or selects its recent Pi sessions. */
export function WorkspaceSidebar({
  compactingSessionIds,
  completedSessionIds,
  isRefreshing,
  recentSessions,
  sentSessions,
  sessions,
  selectedId,
  width,
  workspacePath,
  onChooseWorkspace,
  onCreate,
  onCloseSession,
  onDeleteSession,
  onOpenSession,
  onSelectOtherWorkspaceSession,
  onSelectSession,
  onOpenSettings,
  onResize,
  onError,
}: WorkspaceSidebarProps) {
  const [openingSessionPath, setOpeningSessionPath] = useState('')
  const [contextMenu, setContextMenu] = useState<
    {
      x: number
      y: number
      sessionPath: string
      sessionId: string | undefined
    } | null
  >(null)
  const selectedSessionRef = useRef<HTMLButtonElement>(null)
  const activeSessions = useMemo(
    () => activeWorkspaceSessions(sessions),
    [sessions],
  )
  const activePaths = useMemo(() => new Set(activeSessions.map((s) => s.sessionPath)), [
    activeSessions,
  ])
  const visibleSessions = useMemo(() => {
    const recent = sidebarSessions(recentSessions, workspacePath, sentSessions)
    // Live sessions appear in the active section; keep the recent list to completed history.
    return recent.filter((session) => !activePaths.has(session.sessionPath))
  }, [activePaths, recentSessions, sentSessions, workspacePath])
  const otherRecentSessions = useMemo(
    () => recentOtherWorkspaceSessions(recentSessions, activeSessions, workspacePath),
    [activeSessions, recentSessions, workspacePath],
  )

  useEffect(() => {
    selectedSessionRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selectedId, visibleSessions])

  useEffect(() => {
    if (!contextMenu) return
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null
      if (target && target instanceof Element && target.closest('.session-context-menu')) {
        event.preventDefault()
        return
      }
      setContextMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('contextmenu', (event) => {
      const target = event.target as Node | null
      if (target && target instanceof Element && target.closest('.session-context-menu')) {
        event.preventDefault()
      }
    })
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextMenu])

  function startResize(event: ReactPointerEvent<HTMLDivElement>): void {
    const handle = event.currentTarget
    const initialX = event.clientX
    const initialWidth = width
    handle.setPointerCapture(event.pointerId)

    const resize = (moveEvent: PointerEvent): void =>
      onResize(initialWidth + moveEvent.clientX - initialX)
    const stop = (): void => {
      handle.removeEventListener('pointermove', resize)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
      handle.removeEventListener('lostpointercapture', stop)
    }

    handle.addEventListener('pointermove', resize)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
    handle.addEventListener('lostpointercapture', stop)
  }

  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const adjustment = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0
    if (adjustment) {
      event.preventDefault()
      onResize(width + adjustment)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      onResize(minWorkspaceSidebarWidth)
    }
    if (event.key === 'End') {
      event.preventDefault()
      onResize(maxWorkspaceSidebarWidth)
    }
  }

  return (
    <aside className='sidebar'>
      <div
        aria-label='Resize session sidebar'
        aria-orientation='vertical'
        aria-valuemax={maxWorkspaceSidebarWidth}
        aria-valuemin={minWorkspaceSidebarWidth}
        aria-valuenow={width}
        className='sidebar-resize-handle'
        onKeyDown={resizeWithKeyboard}
        onPointerDown={startResize}
        role='separator'
        tabIndex={0}
      />
      <div className='brand'>
        <span className='brand-mark'>π</span>
        <div>
          <strong>Pi Livecraft</strong>
          <small>Local workspace</small>
        </div>
        <Tooltip label='Settings'>
          <button
            aria-label='Open settings'
            className='settings-button'
            onClick={onOpenSettings}
            type='button'
          >
            <SettingsIcon />
          </button>
        </Tooltip>
      </div>
      <div className='workspace-group'>
        <Tooltip label={workspacePath}>
          <button
            aria-label={`Choose workspace: ${workspacePath}`}
            className='workspace-path'
            onClick={onChooseWorkspace}
            type='button'
          >
            <WorkspaceIcon />
            <div className='workspace-path-copy'>
              <span>Current directory</span>
              <strong>{workspacePath}</strong>
            </div>
            <ChevronIcon />
          </button>
        </Tooltip>
      </div>
      <NewSessionButton onCreate={onCreate} onError={onError} />
      {activeSessions.length > 0 && (
        <section className='active-sessions'>
          <h2>Active</h2>
          <nav aria-label='Live Pi sessions' className='other-session-list'>
            {activeSessions.map((session) => {
              const inCurrentWorkspace = session.cwd === workspacePath
              const indicator = sessionIndicator(
                session,
                selectedId,
                compactingSessionIds,
                completedSessionIds,
              )
              return (
                <Tooltip key={session.id} label={`${session.name}\n${session.cwd}`}>
                  <button
                    aria-label={inCurrentWorkspace
                      ? session.name
                      : `${session.name} in workspace ${session.cwd}`}
                    className={`session-item${session.id === selectedId ? ' selected' : ''}${
                      indicator ? ` ${indicator}` : ''
                    }`}
                    onClick={() => {
                      if (inCurrentWorkspace) onSelectSession(session.id)
                      else onSelectOtherWorkspaceSession(session)
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        sessionPath: session.sessionPath ?? session.id,
                        sessionId: session.id,
                      })
                    }}
                    type='button'
                  >
                    {indicator && <SessionStatusIndicator status={indicator} />}
                    <span>
                      <strong>{session.name}</strong>
                      {!inCurrentWorkspace && <small>{session.cwd}</small>}
                    </span>
                  </button>
                </Tooltip>
              )
            })}
          </nav>
        </section>
      )}
      <nav className='session-list' aria-label='Recent Pi sessions'>
        {isRefreshing && visibleSessions.length === 0 && (
          <p className='session-list-loading' role='status'>Loading sessions…</p>
        )}
        {visibleSessions.map((recentSession) => {
          const activeSession = sessions.find((session) =>
            session.sessionPath === recentSession.sessionPath && session.status !== 'exited'
          )
          const indicator = sessionIndicator(
            activeSession,
            selectedId,
            compactingSessionIds,
            completedSessionIds,
          )
          const sessionLabel = openingSessionPath === recentSession.sessionPath
            ? 'Opening…'
            : recentSession.name
          return (
            <Tooltip
              key={recentSession.sessionPath}
              label={`${recentSession.name}\n${
                new Date(recentSession.updatedAt).toLocaleString('en-US')
              }`}
            >
              <button
                className={`session-item${activeSession?.id === selectedId ? ' selected' : ''}${
                  indicator ? ` ${indicator}` : ''
                }`}
                disabled={openingSessionPath === recentSession.sessionPath}
                onClick={() => {
                  if (activeSession) {
                    onSelectSession(activeSession.id)
                    return
                  }
                  setOpeningSessionPath(recentSession.sessionPath)
                  void onOpenSession(recentSession).catch(onError).finally(() =>
                    setOpeningSessionPath('')
                  )
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    sessionPath: recentSession.sessionPath,
                    sessionId: activeSession?.id,
                  })
                }}
                ref={activeSession?.id === selectedId ? selectedSessionRef : undefined}
                type='button'
              >
                {indicator && <SessionStatusIndicator status={indicator} />}
                <span>
                  <strong>{sessionLabel}</strong>
                </span>
              </button>
            </Tooltip>
          )
        })}
        {visibleSessions.length === 0 && !isRefreshing && (
          <p className='empty-sidebar'>
            {activeSessions.some((session) => session.cwd === workspacePath)
              ? 'No completed sessions in this directory.'
              : 'No Pi sessions in this directory.'}
          </p>
        )}
      </nav>
      {otherRecentSessions.length > 0 && (
        <section className='other-workspace-sessions'>
          <h2>Recently active</h2>
          <nav
            aria-label='Recently active sessions in other workspaces'
            className='other-session-list'
          >
            {otherRecentSessions.map((recent) => (
              <Tooltip
                key={recent.sessionPath}
                label={`${recent.name}\n${new Date(recent.updatedAt).toLocaleString('en-US')}`}
              >
                <button
                  aria-label={`${recent.name} in workspace ${recent.cwd}`}
                  className='session-item'
                  onClick={() => {
                    setOpeningSessionPath(recent.sessionPath)
                    void onOpenSession(recent).catch(onError).finally(() =>
                      setOpeningSessionPath('')
                    )
                  }}
                  type='button'
                >
                  <span>
                    <strong>{recent.name}</strong>
                    <small>{recent.cwd}</small>
                  </span>
                </button>
              </Tooltip>
            ))}
          </nav>
        </section>
      )}
      {contextMenu && (
        <SessionContextMenu
          sessionId={contextMenu.sessionId}
          x={contextMenu.x}
          y={contextMenu.y}
          onCloseSession={() => {
            if (contextMenu.sessionId) {
              Promise.resolve(onCloseSession(contextMenu.sessionId)).catch(onError)
            }
            setContextMenu(null)
          }}
          onDeleteSession={() => {
            Promise
              .resolve(
                onDeleteSession(contextMenu.sessionId, contextMenu.sessionPath),
              )
              .catch(onError)
            setContextMenu(null)
          }}
        />
      )}
    </aside>
  )
}

/** Prevents duplicate session creation and reports errors to the container. */
function NewSessionButton(
  { onCreate, onError }: { onCreate: () => Promise<void>; onError: (cause: unknown) => void },
) {
  const [busy, setBusy] = useState(false)

  async function create(): Promise<void> {
    setBusy(true)
    try {
      await onCreate()
    } catch (cause) {
      onError(cause)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      className='new-session'
      disabled={busy}
      onClick={() => void create()}
      type='button'
    >
      {busy ? 'Starting…' : '＋ New session'}
    </button>
  )
}

/** Context menu shown on right-click over a session item. */
function SessionContextMenu({
  sessionId,
  x,
  y,
  onCloseSession,
  onDeleteSession,
}: {
  sessionId: string | undefined
  x: number
  y: number
  onCloseSession: () => void
  onDeleteSession: () => void
}) {
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 900,
  }
  return (
    <div className='session-context-menu' role='menu' style={style}>
      {sessionId && (
        <button
          className='session-context-item'
          onClick={onCloseSession}
          role='menuitem'
          tabIndex={0}
          type='button'
        >
          <span aria-hidden='true'>⏻</span>Close session
        </button>
      )}
      <button
        className='session-context-item danger'
        onClick={() => {
          if (
            window.confirm(
              'Delete this session? This permanently removes its history and cannot be undone.',
            )
          ) onDeleteSession()
        }}
        role='menuitem'
        tabIndex={0}
        type='button'
      >
        <span aria-hidden='true'>🗑</span>Delete session
      </button>
    </div>
  )
}

function WorkspaceIcon() {
  return (
    <svg
      aria-hidden='true'
      fill='none'
      height='16'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      viewBox='0 0 24 24'
      width='16'
    >
      <path d='M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8A1.5 1.5 0 0 1 20.5 8.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-11Z' />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden='true'
      fill='none'
      height='14'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.75'
      viewBox='0 0 24 24'
      width='14'
    >
      <path d='m9 6 6 6-6 6' />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden='true'
      fill='none'
      height='16'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      viewBox='0 0 24 24'
      width='16'
    >
      <path d='M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z' />
      <path d='m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.9 1.9 0 0 0-3.2 1.3v.2a2 2 0 1 1-4 0v-.2a1.9 1.9 0 0 0-3.2-1.3l.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.9 1.9 0 0 0 2.2 12a1.9 1.9 0 0 0 1.2-3.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.9 1.9 0 0 0 3.2-1.3v-.2a2 2 0 1 1 4 0v.2a1.9 1.9 0 0 0 3.2 1.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.9 1.9 0 0 0 20.8 12a1.9 1.9 0 0 0-1.4 3Z' />
    </svg>
  )
}
