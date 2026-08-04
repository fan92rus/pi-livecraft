import * as Select from '@radix-ui/react-select'
import { useEffect, useMemo, useState, type RefObject } from 'react'

/** Generic Radix-based select dropdown shared by all composer toolbar controls. */
export function ComposerSelect(
  {
    ariaLabel,
    disabled,
    onOpenChange,
    onValueChange,
    open,
    onOptionPointerMove,
    onOptionsPointerLeave,
    options,
    placeholder,
    searchable,
    searchPlaceholder,
    searchEmptyLabel,
    tone,
    triggerRef,
    loading,
    value,
  }: {
    ariaLabel: string
    disabled?: boolean
    onValueChange: (value: string) => void
    options: { description?: string; kind?: 'action'; label: string; value: string }[]
    placeholder?: string
    searchable?: boolean
    searchPlaceholder?: string
    searchEmptyLabel?: string
    tone: 'agent' | 'behavior' | 'command' | 'improve' | 'model' | 'prompt' | 'thinking'
    value: string
    loading?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onOptionPointerMove?: (value: string) => void
    onOptionsPointerLeave?: () => void
    triggerRef?: RefObject<HTMLButtonElement | null>
  },
) {
  const [query, setQuery] = useState('')

  // Reset the search box every time the dropdown reopens.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  // Filter the options against the query. The label carries the searchable text
  // (for models it is "provider/model"), so typing either the full provider/model
  // form or just the model name matches. Descriptions are also matched.
  const visibleOptions = useMemo(
    () =>
      searchable
        ? options.filter(
          (option) =>
            `${option.label} ${option.description ?? ''}`.toLowerCase().includes(
              query.trim().toLowerCase(),
            ),
        )
        : options,
    [searchable, options, query],
  )

  return (
    <Select.Root
      disabled={disabled}
      onOpenChange={onOpenChange}
      open={open}
      onValueChange={onValueChange}
      value={value}
    >
      <Select.Trigger aria-label={ariaLabel} className={`composer-select ${tone}`} ref={triggerRef}>
        {loading
          ? <span aria-hidden='true' className='composer-select-spinner' />
          : <ComposerSelectIcon tone={tone} />}
        <Select.Value placeholder={placeholder} />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={`composer-select-content ${tone}`}
          position='popper'
          sideOffset={7}
        >
          {searchable && (
            <div className='composer-select-search'>
              <input
                aria-label='Search options'
                autoFocus
                className='composer-select-search-input'
                onChange={(event) => setQuery(event.target.value)}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder={searchPlaceholder ?? 'Search…'}
                type='text'
                value={query}
              />
            </div>
          )}
          <Select.Viewport onPointerLeave={onOptionsPointerLeave}>
            {visibleOptions.length === 0
              ? <div className='composer-select-empty'>{searchEmptyLabel ?? 'No matches'}</div>
              : visibleOptions.map((option) => (
                <Select.Item
                  className={`composer-select-option${option.kind === 'action' ? ' action' : ''}`}
                  key={option.value}
                  onPointerMove={() => onOptionPointerMove?.(option.value)}
                  value={option.value}
                >
                  <Select.ItemText>
                    <span className='composer-select-option-copy'>
                      <span>{option.label}</span>
                      {option.description && <small>{option.description}</small>}
                    </span>
                  </Select.ItemText>
                  <Select.ItemIndicator aria-hidden='true'>✓</Select.ItemIndicator>
                </Select.Item>
              ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

/** Uses consistent SVG pictograms independent of a font or emoji set. */
function ComposerSelectIcon(
  { tone }: {
    tone: 'agent' | 'behavior' | 'command' | 'improve' | 'model' | 'prompt' | 'thinking'
  },
) {
  if (tone === 'model')
    return (
      <svg aria-hidden='true' className='composer-select-icon' viewBox='0 0 16 16'>
        <path
          d='m2.5 5 5.5-2.5L13.5 5 8 7.5 2.5 5Zm0 3L8 10.5 13.5 8M2.5 11 8 13.5l5.5-2.5'
          fill='none'
          stroke='currentColor'
          strokeLinejoin='round'
          strokeWidth='1.4'
        />
      </svg>
    )
  if (tone === 'prompt')
    return (
      <svg aria-hidden='true' className='composer-select-icon' viewBox='0 0 16 16'>
        <path
          d='M3 2.5h10v11H3zM5.2 5.5h5.6M5.2 8h5.6M5.2 10.5h3.2'
          fill='none'
          stroke='currentColor'
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='1.4'
        />
      </svg>
    )
  if (tone === 'thinking')
    return (
      <svg aria-hidden='true' className='composer-select-icon' viewBox='0 0 16 16'>
        <path
          d='m8 2 1.4 4.6L14 8l-4.6 1.4L8 14 6.6 9.4 2 8l4.6-1.4L8 2Z'
          fill='none'
          stroke='currentColor'
          strokeLinejoin='round'
          strokeWidth='1.4'
        />
      </svg>
    )
  return <span className='composer-select-icon' aria-hidden='true' />
}
