// Polyfills for older WebViews (ES2022+)
if (typeof Object.hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    value: function hasOwn(obj: object, prop: PropertyKey): boolean {
      if (obj === null || obj === undefined) {
        throw new TypeError('Cannot convert undefined or null to object')
      }
      return Object.prototype.hasOwnProperty.call(obj, prop)
    },
    writable: true,
    configurable: true,
  })
}

if (typeof Array.prototype.at !== 'function') {
  Object.defineProperty(Array.prototype, 'at', {
    value: function at<T>(this: T[], index: number): T | undefined {
      const k = Math.trunc(index) || 0
      const len = this.length >>> 0
      const relativeIndex = k >= 0 ? k : len + k
      if (relativeIndex < 0 || relativeIndex >= len) {
        return undefined
      }
      return this[relativeIndex]
    },
    writable: true,
    configurable: true,
  })
}

if (typeof Array.prototype.toReversed !== 'function') {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value: function toReversed<T>(this: T[]): T[] {
      return Array.from(this).reverse()
    },
    writable: true,
    configurable: true,
  })
}

if (typeof window !== 'undefined') {
  if (!('crypto' in window) || !window.crypto) {
    try {
      Object.defineProperty(window, 'crypto', {
        value: {},
        writable: true,
        configurable: true,
      })
    } catch {
      // ignore
    }
  }
  if (typeof window.crypto.randomUUID !== 'function') {
    const mockRandomUUID = () =>
      '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (+c ^ ((Math.random() * 16) >> (+c / 4))).toString(16)
      )
    try {
      window.crypto.randomUUID = mockRandomUUID as () => `${string}-${string}-${string}-${string}-${string}`
    } catch {
      Object.defineProperty(window.crypto, 'randomUUID', {
        value: mockRandomUUID,
        writable: true,
        configurable: true,
      })
    }
  }
}

// Global error handlers
if (typeof window !== 'undefined') {
  const saveLastError = (error: unknown, fallbackMessage?: string) => {
    try {
      let message = fallbackMessage || ''
      let stack = ''
      if (error instanceof Error) {
        message = error.message || message
        stack = error.stack || ''
      } else if (typeof error === 'string') {
        message = error
      } else if (error && typeof error === 'object') {
        const obj = error as Record<string, unknown>
        message = String(obj.message || obj.reason || fallbackMessage || '')
        stack = String(obj.stack || '')
      }
      const record = {
        time: new Date().toISOString(),
        message: String(message).slice(0, 2000),
        stack: String(stack).slice(0, 2000),
      }
      localStorage.setItem('fakeseek:lastError', JSON.stringify(record))
    } catch {
      // ignore
    }
  }

  window.addEventListener('error', (event) => {
    saveLastError(event.error, event.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    saveLastError(event.reason, String(event.reason))
  })
}

import { createRoot } from 'react-dom/client'
import { App } from './app/App.js'
import { ErrorBoundary } from './app/ErrorBoundary.js'
import { setupTheme } from './app/theme.js'
import { ensureKatex } from './services/markdown/katex.js'
import './app/theme.css'
import './app/global.css'

ensureKatex()
setupTheme()

createRoot(document.getElementById('root') as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

// React 已挂载：解除 index.html 里的白屏看门狗
if (typeof window.__fakeseekBootOk === 'function') {
  window.__fakeseekBootOk()
}
