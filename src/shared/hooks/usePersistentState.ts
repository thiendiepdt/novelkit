import { useState, useEffect, useCallback } from 'react';
import { storeGet, storeSet } from '@/shared/utils/persistentStore';

/**
 * A useState wrapper whose value survives restarts: in the app's user data store on
 * desktop, in localStorage on the web (see `shared/utils/persistentStore`).
 *
 * Values are stored as strings, the way localStorage holds them: strings as is, numbers
 * and booleans with `String()`, anything else as JSON.
 *
 * @param key - storage key
 * @param defaultValue - fallback value when the key doesn't exist
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    const saved = storeGet(key);
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
  });

  useEffect(() => {
    let stringValue = '';
    if (typeof value === 'string') stringValue = value;
    else if (typeof value === 'number' || typeof value === 'boolean') stringValue = String(value);
    else stringValue = JSON.stringify(value);

    storeSet(key, stringValue);
  }, [key, value]);

  const setValueWrapped = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(newValue);
  }, []);

  return [value, setValueWrapped];
}
