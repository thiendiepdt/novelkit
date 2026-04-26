import { useState, useEffect, useCallback } from 'react';

/**
 * A useState wrapper that persists the value to localStorage.
 * Automatically syncs reads and writes.
 *
 * @param key - localStorage key
 * @param defaultValue - fallback value when key doesn't exist
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void];
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === null) return defaultValue;

      // Parse based on the type of defaultValue
      if (typeof defaultValue === 'number') return parseInt(saved, 10) as T;
      if (typeof defaultValue === 'boolean') return (saved === 'true') as T;
      if (typeof defaultValue === 'string') return saved as T;
      
      // Fallback to JSON parse for objects/arrays
      try {
        return JSON.parse(saved) as T;
      } catch {
        return defaultValue;
      }
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      let stringValue = '';
      if (typeof value === 'string') stringValue = value;
      else if (typeof value === 'number' || typeof value === 'boolean') stringValue = String(value);
      else stringValue = JSON.stringify(value);
      
      localStorage.setItem(key, stringValue);
    } catch {
      // localStorage may be full or disabled
    }
  }, [key, value]);

  const setValueWrapped = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue(newValue);
    },
    [],
  );

  return [value, setValueWrapped];
}
