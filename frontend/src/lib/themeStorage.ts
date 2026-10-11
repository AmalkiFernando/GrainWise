export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

/** What the user picked. `system` defers to the OS setting, and is the default. */
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

/** What is actually on screen once `system` has been resolved. */
export type ResolvedTheme = 'light' | 'dark'

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'

export const THEME_STORAGE_KEY = 'grainwise.theme'

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

/** How long the cross-fade between palettes runs; kept in step with index.css. */
export const THEME_TRANSITION_MS = 320

const TRANSITION_CLASS = 'theme-transition'

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference)
}

/**
 * Read synchronously so the store can start in the theme that the pre-paint
 * script in index.html already put on screen. Reading this in an effect
 * instead would render one frame in the wrong palette before swapping.
 *
 * Values written by the earlier light/dark-only build still parse, so nobody
 * loses their choice on upgrade — they just don't get `system` until they
 * pick it.
 */
export function readStoredThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

export function writeStoredThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // localStorage unavailable — theme just won't persist across reloads
  }
}

/** Guarded because jsdom and older browsers don't implement matchMedia. */
export function getSystemTheme(): ResolvedTheme {
  try {
    return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference
}

let transitionTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Paint `theme`, optionally cross-fading every color on the page.
 *
 * The transition is opt-in per call and self-cancelling: index.css only
 * animates colors while `.theme-transition` is present, so hover states keep
 * their own snappier timings and nothing pays for a page-wide transition
 * during normal use. Hydration passes `animate: false` — there is nothing to
 * fade from on first paint.
 */
export function applyTheme(theme: ResolvedTheme, { animate = true } = {}): void {
  const root = document.documentElement

  if (animate && root.dataset.theme) {
    root.classList.add(TRANSITION_CLASS)
    clearTimeout(transitionTimer)
    transitionTimer = setTimeout(() => {
      root.classList.remove(TRANSITION_CLASS)
    }, THEME_TRANSITION_MS)
  }

  root.classList.toggle('dark', theme === 'dark')
  // Exposed for CSS/tests that want the active theme without probing classes.
  root.dataset.theme = theme
  // Switches native UI — scrollbars, date pickers, autofill, form controls.
  root.style.colorScheme = theme

  syncThemeColorMeta(theme)
}

/** Keeps the mobile browser chrome in step with the canvas color. */
function syncThemeColorMeta(theme: ResolvedTheme): void {
  const content = theme === 'dark' ? '#0f1512' : '#faf7f0'
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }

  meta.content = content
}

/**
 * Call `onChange` when the OS flips its light/dark setting, so a `system`
 * preference tracks it live rather than only on reload. Returns a cleanup
 * function; no-ops where matchMedia is unavailable.
 */
export function subscribeToSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  let query: MediaQueryList

  try {
    query = window.matchMedia(DARK_MEDIA_QUERY)
  } catch {
    return () => {}
  }

  const listener = (event: MediaQueryListEvent) => onChange(event.matches ? 'dark' : 'light')

  // addListener is the deprecated fallback for Safari < 14.
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }

  query.addListener?.(listener)
  return () => query.removeListener?.(listener)
}
