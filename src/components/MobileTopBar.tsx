/**
 * Phone-only navigation bar shown below the 480px breakpoint.
 *
 * On phones the app-shell re-flows into a single column, so the desktop
 * workspace sidebar and the right-sidebar tools strip would consume most of
 * the screen with no room for the conversation. This bar trades the fixed
 * columns for two overlay surfaces driven by app-shell attributes:
 *
 * - `data-mobile-nav`  -> slides the workspace sidebar in as a left drawer.
 * - `data-mobile-tools`-> slides the workspace tools in as a bottom sheet.
 *
 * The bar itself is hidden (display:none) at widths where those overlays are
 * inactive, so desktop and tablet layouts are completely unaffected.
 */
export function MobileTopBar({
  mobileNavOpen,
  mobileToolsOpen,
  onToggleNav,
  onToggleTools,
  onCreate,
  creating,
}: {
  mobileNavOpen: boolean
  mobileToolsOpen: boolean
  onToggleNav: () => void
  onToggleTools: () => void
  onCreate: () => void
  creating: boolean
}) {
  return (
    <header className='mobile-top-bar' data-testid='mobile-top-bar'>
      <button
        aria-expanded={mobileNavOpen}
        aria-label='Sessions and workspace'
        className='mobile-top-bar-action'
        onClick={onToggleNav}
        type='button'
      >
        <MenuIcon />
      </button>
      <div className='mobile-top-bar-title' aria-hidden='true'>
        <span className='mobile-top-bar-brand'>π</span>
        <strong>Pi Livecraft</strong>
      </div>
      <div className='mobile-top-bar-actions'>
        <button
          aria-expanded={mobileToolsOpen}
          aria-label='Workspace tools'
          className='mobile-top-bar-action'
          onClick={onToggleTools}
          type='button'
        >
          <ToolsIcon />
        </button>
        <button
          aria-label={creating ? 'Starting…' : 'New session'}
          className='mobile-top-bar-new'
          disabled={creating}
          onClick={onCreate}
          type='button'
        >
          {creating ? '…' : '＋'}
        </button>
      </div>
    </header>
  )
}

function MenuIcon() {
  return (
    <svg
      aria-hidden='true'
      fill='none'
      height='20'
      stroke='currentColor'
      strokeLinecap='round'
      strokeWidth='2'
      viewBox='0 0 24 24'
      width='20'
    >
      <path d='M4 7h16M4 12h16M4 17h16' />
    </svg>
  )
}

function ToolsIcon() {
  return (
    <svg
      aria-hidden='true'
      fill='none'
      height='20'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.75'
      viewBox='0 0 24 24'
      width='20'
    >
      <path d='M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l2.8 2.8 5.7-5.7a4.5 4.5 0 0 0 6-6l-2.3 2.3-2.5-.5-.5-2.5 2.5-2.1Z' />
    </svg>
  )
}
