import { useState, useCallback, useEffect, createContext, useContext, useRef } from 'react'
import type { ReactNode } from 'react'

const THEME_KEY = 'ofenes_theme'

type ThemeMode = 'dark' | 'light'

interface ThemeState {
    mode: ThemeMode
    accentColor: string
    accentName: string
    presetName: string | null // null = custom (dark/light + accent picker)
}

interface ThemeContextValue extends ThemeState {
    setMode: (mode: ThemeMode) => void
    toggleMode: () => void
    setAccentColor: (hex: string, name?: string) => void
    setPreset: (name: string | null) => void
    presets: typeof ACCENT_PRESETS
    themePresets: typeof THEME_PRESETS
}

// Accent color presets
export const ACCENT_PRESETS = [
    { name: 'Cyan', hex: '#06b6d4', light: '#22d3ee', dark: '#0891b2', secondary: '#818cf8' },
    { name: 'Blue', hex: '#3b82f6', light: '#60a5fa', dark: '#2563eb', secondary: '#a78bfa' },
    { name: 'Violet', hex: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed', secondary: '#f472b6' },
    { name: 'Rose', hex: '#f43f5e', light: '#fb7185', dark: '#e11d48', secondary: '#f97316' },
    { name: 'Orange', hex: '#f97316', light: '#fb923c', dark: '#ea580c', secondary: '#facc15' },
    { name: 'Green', hex: '#10b981', light: '#34d399', dark: '#059669', secondary: '#06b6d4' },
    { name: 'Amber', hex: '#f59e0b', light: '#fbbf24', dark: '#d97706', secondary: '#f97316' },
    { name: 'Pink', hex: '#ec4899', light: '#f472b6', dark: '#db2777', secondary: '#a78bfa' },
] as const

// Full theme presets — override both base colors and accent
export interface ThemePreset {
    name: string
    preview: [string, string, string, string] // 4 colors shown in picker
    variables: Record<string, string>
}

export const THEME_PRESETS: ThemePreset[] = [
    {
        name: 'Frost',
        preview: ['#F4F4F2', '#E8E8E8', '#BBBFCA', '#495464'],
        variables: {
            '--bg-base': '#F4F4F2',
            '--bg-surface': '#FFFFFF',
            '--bg-overlay': 'rgba(232, 232, 232, 0.6)',
            '--bg-input': '#FFFFFF',
            '--bg-card': 'rgba(255, 255, 255, 0.8)',
            '--border': '#E8E8E8',
            '--border-subtle': 'rgba(187, 191, 202, 0.3)',
            '--text-primary': '#495464',
            '--text-secondary': '#6B7280',
            '--text-tertiary': '#BBBFCA',
            '--text-muted': '#D1D5DB',
            '--text-on-accent': '#FFFFFF',
            '--shadow-base': 'rgba(73, 84, 100, 0.08)',
            '--backdrop': 'rgba(73, 84, 100, 0.3)',
            '--tile-bg': '#E8E8E8',
            '--tile-fallback': '#F4F4F2',
            '--tile-avatar': '#BBBFCA',
            '--control-bg': '#E8E8E8',
            '--control-bg-hover': '#BBBFCA',
            '--control-active': '#BBBFCA',
            '--menu-bg': '#FFFFFF',
            '--menu-hover': '#F4F4F2',
            '--menu-border': '#E8E8E8',
            '--msg-own-bg': 'rgba(73, 84, 100, 0.1)',
            '--msg-own-text': '#495464',
            '--msg-own-border': 'rgba(73, 84, 100, 0.2)',
            '--msg-other-bg': '#E8E8E8',
            '--msg-other-text': '#495464',
            '--msg-other-border': 'rgba(187, 191, 202, 0.4)',
            '--accent': '#495464',
            '--accent-light': '#6B7280',
            '--accent-dark': '#34374C',
            '--accent-bg': 'rgba(73, 84, 100, 0.1)',
            '--accent-border': 'rgba(73, 84, 100, 0.25)',
            '--accent-ring': 'rgba(73, 84, 100, 0.4)',
            '--accent-shadow': 'rgba(73, 84, 100, 0.2)',
            '--accent-secondary': '#BBBFCA',
        },
    },
    {
        name: 'Sunset',
        preview: ['#FAF3E1', '#F5E7C6', '#FF6D1F', '#222222'],
        variables: {
            '--bg-base': '#FAF3E1',
            '--bg-surface': '#FFFFFF',
            '--bg-overlay': 'rgba(245, 231, 198, 0.6)',
            '--bg-input': '#FFFFFF',
            '--bg-card': 'rgba(255, 255, 255, 0.8)',
            '--border': '#F5E7C6',
            '--border-subtle': 'rgba(245, 231, 198, 0.5)',
            '--text-primary': '#222222',
            '--text-secondary': '#5C5C5C',
            '--text-tertiary': '#A89070',
            '--text-muted': '#D4C4A8',
            '--text-on-accent': '#FFFFFF',
            '--shadow-base': 'rgba(34, 34, 34, 0.06)',
            '--backdrop': 'rgba(34, 34, 34, 0.3)',
            '--tile-bg': '#F5E7C6',
            '--tile-fallback': '#FAF3E1',
            '--tile-avatar': '#E8D5B0',
            '--control-bg': '#F5E7C6',
            '--control-bg-hover': '#E8D5B0',
            '--control-active': '#E8D5B0',
            '--menu-bg': '#FFFFFF',
            '--menu-hover': '#FAF3E1',
            '--menu-border': '#F5E7C6',
            '--msg-own-bg': 'rgba(255, 109, 31, 0.1)',
            '--msg-own-text': '#222222',
            '--msg-own-border': 'rgba(255, 109, 31, 0.25)',
            '--msg-other-bg': '#F5E7C6',
            '--msg-other-text': '#222222',
            '--msg-other-border': 'rgba(245, 231, 198, 0.6)',
            '--accent': '#FF6D1F',
            '--accent-light': '#FF8A4C',
            '--accent-dark': '#E05A10',
            '--accent-bg': 'rgba(255, 109, 31, 0.1)',
            '--accent-border': 'rgba(255, 109, 31, 0.3)',
            '--accent-ring': 'rgba(255, 109, 31, 0.5)',
            '--accent-shadow': 'rgba(255, 109, 31, 0.25)',
            '--accent-secondary': '#FACC15',
        },
    },
    {
        name: 'Crimson',
        preview: ['#34374C', '#2C2E3E', '#EE2B47', '#F6F6F6'],
        variables: {
            '--bg-base': '#2C2E3E',
            '--bg-surface': '#34374C',
            '--bg-overlay': 'rgba(52, 55, 76, 0.5)',
            '--bg-input': 'rgba(44, 46, 62, 0.5)',
            '--bg-card': 'rgba(52, 55, 76, 0.5)',
            '--border': '#44475C',
            '--border-subtle': 'rgba(68, 71, 92, 0.5)',
            '--text-primary': '#F6F6F6',
            '--text-secondary': '#A8AABE',
            '--text-tertiary': '#6E7190',
            '--text-muted': '#4A4D64',
            '--text-on-accent': '#FFFFFF',
            '--shadow-base': 'rgba(0, 0, 0, 0.3)',
            '--backdrop': 'rgba(0, 0, 0, 0.5)',
            '--tile-bg': '#2C2E3E',
            '--tile-fallback': '#34374C',
            '--tile-avatar': '#44475C',
            '--control-bg': '#44475C',
            '--control-bg-hover': '#565970',
            '--control-active': '#565970',
            '--menu-bg': '#34374C',
            '--menu-hover': '#44475C',
            '--menu-border': '#565970',
            '--msg-own-bg': 'rgba(238, 43, 71, 0.15)',
            '--msg-own-text': '#FEE2E2',
            '--msg-own-border': 'rgba(238, 43, 71, 0.4)',
            '--msg-other-bg': 'rgba(52, 55, 76, 0.6)',
            '--msg-other-text': '#F6F6F6',
            '--msg-other-border': 'rgba(68, 71, 92, 0.4)',
            '--accent': '#EE2B47',
            '--accent-light': '#F45B6E',
            '--accent-dark': '#CC1F3A',
            '--accent-bg': 'rgba(238, 43, 71, 0.1)',
            '--accent-border': 'rgba(238, 43, 71, 0.3)',
            '--accent-ring': 'rgba(238, 43, 71, 0.5)',
            '--accent-shadow': 'rgba(238, 43, 71, 0.25)',
            '--accent-secondary': '#F6F6F6',
        },
    },
]

const DEFAULT_THEME: ThemeState = {
    mode: 'dark',
    accentColor: ACCENT_PRESETS[0].hex,
    accentName: ACCENT_PRESETS[0].name,
    presetName: null,
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : null
}

function lightenHex(hex: string, amount: number): string {
    const rgb = hexToRgb(hex)
    if (!rgb) return hex
    const r = Math.min(255, rgb.r + amount)
    const g = Math.min(255, rgb.g + amount)
    const b = Math.min(255, rgb.b + amount)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function darkenHex(hex: string, amount: number): string {
    const rgb = hexToRgb(hex)
    if (!rgb) return hex
    const r = Math.max(0, rgb.r - amount)
    const g = Math.max(0, rgb.g - amount)
    const b = Math.max(0, rgb.b - amount)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function hexToRgba(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex)
    if (!rgb) return hex
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/** Apply accent CSS variables to the document root */
function applyAccentToDOM(hex: string, secondaryHex?: string) {
    const el = document.documentElement
    const preset = ACCENT_PRESETS.find((p) => p.hex === hex)

    const light = preset?.light ?? lightenHex(hex, 30)
    const dark = preset?.dark ?? darkenHex(hex, 30)
    const secondary = secondaryHex ?? preset?.secondary ?? lightenHex(hex, 60)

    el.style.setProperty('--accent', hex)
    el.style.setProperty('--accent-light', light)
    el.style.setProperty('--accent-dark', dark)
    el.style.setProperty('--accent-bg', hexToRgba(hex, 0.1))
    el.style.setProperty('--accent-border', hexToRgba(hex, 0.3))
    el.style.setProperty('--accent-ring', hexToRgba(hex, 0.5))
    el.style.setProperty('--accent-shadow', hexToRgba(hex, 0.25))
    el.style.setProperty('--accent-secondary', secondary)

    // Update own-message colors for dark mode to use accent tint
    if (document.documentElement.getAttribute('data-theme') !== 'light') {
        el.style.setProperty('--msg-own-bg', hexToRgba(hex, 0.15))
        el.style.setProperty('--msg-own-border', hexToRgba(dark, 0.4))
    }
}

function applyModeToDOM(mode: ThemeMode) {
    document.documentElement.setAttribute('data-theme', mode)
}

/** Apply a full theme preset — sets all CSS variables directly */
function applyPresetToDOM(preset: ThemePreset) {
    const el = document.documentElement
    // Remove data-theme so preset variables aren't overridden by :root/[data-theme] rules
    el.removeAttribute('data-theme')
    for (const [key, value] of Object.entries(preset.variables)) {
        el.style.setProperty(key, value)
    }
}

/** Clear all inline CSS variables (used when switching away from a preset) */
function clearPresetFromDOM() {
    const el = document.documentElement
    const allVars = [
        '--bg-base', '--bg-surface', '--bg-overlay', '--bg-input', '--bg-card',
        '--border', '--border-subtle',
        '--text-primary', '--text-secondary', '--text-tertiary', '--text-muted', '--text-on-accent',
        '--shadow-base', '--backdrop',
        '--tile-bg', '--tile-fallback', '--tile-avatar',
        '--control-bg', '--control-bg-hover', '--control-active',
        '--menu-bg', '--menu-hover', '--menu-border',
        '--msg-own-bg', '--msg-own-text', '--msg-own-border',
        '--msg-other-bg', '--msg-other-text', '--msg-other-border',
        '--accent', '--accent-light', '--accent-dark',
        '--accent-bg', '--accent-border', '--accent-ring', '--accent-shadow', '--accent-secondary',
    ]
    for (const v of allVars) {
        el.style.removeProperty(v)
    }
}

function loadTheme(): ThemeState {
    try {
        const stored = localStorage.getItem(THEME_KEY)
        if (stored) return JSON.parse(stored) as ThemeState
    } catch { /* ignore */ }
    return DEFAULT_THEME
}

function saveTheme(state: ThemeState) {
    localStorage.setItem(THEME_KEY, JSON.stringify(state))
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ThemeState>(() => {
        const initial = loadTheme()
        // Apply immediately to prevent flash
        if (initial.presetName) {
            const preset = THEME_PRESETS.find((p) => p.name === initial.presetName)
            if (preset) {
                applyPresetToDOM(preset)
                return initial
            }
        }
        applyModeToDOM(initial.mode)
        applyAccentToDOM(initial.accentColor)
        return initial
    })

    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Sync to DB (debounced)
    const syncToDB = useCallback((newState: ThemeState) => {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
        syncTimerRef.current = setTimeout(() => {
            const token = localStorage.getItem('ofenes_token')
            if (!token) return
            fetch('/api/me/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ theme: newState }),
            }).catch(() => { /* silent fail */ })
        }, 1000)
    }, [])

    const setMode = useCallback((mode: ThemeMode) => {
        setState((prev) => {
            if (prev.presetName) clearPresetFromDOM()
            const next = { ...prev, mode, presetName: null }
            applyModeToDOM(mode)
            applyAccentToDOM(next.accentColor)
            saveTheme(next)
            syncToDB(next)
            return next
        })
    }, [syncToDB])

    const toggleMode = useCallback(() => {
        setState((prev) => {
            if (prev.presetName) clearPresetFromDOM()
            const mode = prev.mode === 'dark' ? 'light' : 'dark'
            const next = { ...prev, mode, presetName: null }
            applyModeToDOM(mode)
            applyAccentToDOM(next.accentColor)
            saveTheme(next)
            syncToDB(next)
            return next
        })
    }, [syncToDB])

    const setAccentColor = useCallback((hex: string, name?: string) => {
        setState((prev) => {
            const accentPreset = ACCENT_PRESETS.find((p) => p.hex === hex)
            // Switching accent clears any active theme preset
            if (prev.presetName) {
                clearPresetFromDOM()
                applyModeToDOM(prev.mode)
            }
            const next = {
                ...prev,
                accentColor: hex,
                accentName: name ?? accentPreset?.name ?? 'Custom',
                presetName: null,
            }
            applyAccentToDOM(hex)
            saveTheme(next)
            syncToDB(next)
            return next
        })
    }, [syncToDB])

    const setPreset = useCallback((name: string | null) => {
        setState((prev) => {
            if (!name) {
                // Switch back to custom mode
                clearPresetFromDOM()
                const next = { ...prev, presetName: null }
                applyModeToDOM(next.mode)
                applyAccentToDOM(next.accentColor)
                saveTheme(next)
                syncToDB(next)
                return next
            }
            const preset = THEME_PRESETS.find((p) => p.name === name)
            if (!preset) return prev
            applyPresetToDOM(preset)
            const next = {
                ...prev,
                presetName: name,
                accentColor: preset.variables['--accent'],
                accentName: name,
            }
            saveTheme(next)
            syncToDB(next)
            return next
        })
    }, [syncToDB])

    // Load theme from DB on mount if authenticated
    useEffect(() => {
        const token = localStorage.getItem('ofenes_token')
        if (!token) return

        fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.ok ? res.json() : null)
            .then((user) => {
                const dbTheme = user?.preferences?.theme
                if (dbTheme?.mode && dbTheme?.accentColor) {
                    const restored = { ...DEFAULT_THEME, ...dbTheme }
                    setState(restored)
                    if (restored.presetName) {
                        const preset = THEME_PRESETS.find((p) => p.name === restored.presetName)
                        if (preset) {
                            applyPresetToDOM(preset)
                            saveTheme(restored)
                            return
                        }
                    }
                    applyModeToDOM(restored.mode)
                    applyAccentToDOM(restored.accentColor)
                    saveTheme(restored)
                }
            })
            .catch(() => { /* ignore */ })
    }, [])

    return (
        <ThemeContext.Provider
            value={{
                ...state,
                setMode,
                toggleMode,
                setAccentColor,
                setPreset,
                presets: ACCENT_PRESETS,
                themePresets: THEME_PRESETS,
            }}
        >
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext)
    if (!ctx) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return ctx
}
