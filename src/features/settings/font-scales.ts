/** User-editable font scaling. All values are multipliers applied to the base size. */
export interface FontScaleValues {
  /** Global scale for the whole interface. */
  ui: number
  /** Scale multiplier for body/reading text. */
  body: number
  /** Scale multiplier for code. */
  code: number
  /** Scale multiplier for headings. */
  heading: number
  /** Scale multiplier for small/meta text. */
  small: number
}

export const DEFAULT_FONT_SCALES: FontScaleValues = {
  ui: 1,
  body: 1,
  code: 1,
  heading: 1,
  small: 1,
}

/** Min/max bounds for each scale, mirrored in the settings sliders. */
export const FONT_SCALE_LIMITS: Record<keyof FontScaleValues, { min: number; max: number }> = {
  ui: { min: 0.85, max: 1.3 },
  body: { min: 0.75, max: 1.5 },
  code: { min: 0.75, max: 1.5 },
  heading: { min: 0.75, max: 1.5 },
  small: { min: 0.75, max: 1.5 },
}

export const FONT_SCALE_KEYS: readonly (keyof FontScaleValues)[] = [
  'ui',
  'body',
  'code',
  'heading',
  'small',
] as const
