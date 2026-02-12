import { useState, useEffect, useCallback } from 'react'

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debouncedValue
}

export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delayMs: number
): T {
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null)

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId)
      const id = setTimeout(() => callback(...args), delayMs)
      setTimeoutId(id)
    },
    [callback, delayMs, timeoutId]
  ) as T

  return debounced
}
