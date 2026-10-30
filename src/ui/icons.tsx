// Tiny inline SVG icon set (stroke icons, 24x24 viewBox).
import type { ReactNode } from 'react'

const S = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const IconWalk = () => (
  <S>
    <circle cx="13" cy="4" r="2" />
    <path d="M9 21l2-6 3 3v3M7 12l3-4 4 1 3 3M11 15l1-6" />
  </S>
)
export const IconHouse = () => (
  <S>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10M10 20v-6h4v6" />
  </S>
)
export const IconPlan = () => (
  <S>
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <path d="M3 12h8v9M11 3v5M15 12h6" />
  </S>
)
export const IconSofa = () => (
  <S>
    <path d="M4 11V8a2 2 0 012-2h12a2 2 0 012 2v3" />
    <path d="M2 13a2 2 0 014 0v2h12v-2a2 2 0 014 0v5H2zM5 18v2M19 18v2" />
  </S>
)
export const IconPlug = () => (
  <S>
    <path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 01-12 0zM12 17v5" />
  </S>
)
export const IconRuler = () => (
  <S>
    <path d="M3 17L17 3l4 4L7 21z" />
    <path d="M7 13l2 2M10 10l2 2M13 7l2 2" />
  </S>
)
export const IconLayers = () => (
  <S>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </S>
)
export const IconCeiling = () => (
  <S>
    <path d="M2 5h20M5 5v14M19 5v14M9 9h6" />
  </S>
)
export const IconGear = () => (
  <S>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </S>
)
export const IconSave = () => (
  <S>
    <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
  </S>
)
export const IconLoad = () => (
  <S>
    <path d="M12 15V3M7 8l5-5 5 5M4 19h16" />
  </S>
)
export const IconCamera = () => (
  <S>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </S>
)
export const IconHelp = () => (
  <S>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 4M12 17h.01" />
  </S>
)
export const IconClose = () => (
  <S>
    <path d="M6 6l12 12M18 6L6 18" />
  </S>
)
