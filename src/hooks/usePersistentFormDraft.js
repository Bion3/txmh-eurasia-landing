import { useEffect, useState } from "react";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function mergeDraft(initialValue, draftValue) {
  if (!draftValue || typeof draftValue !== "object") return initialValue;

  return Object.keys(initialValue).reduce(
    (next, key) => ({
      ...next,
      [key]: draftValue[key] ?? initialValue[key],
    }),
    initialValue
  );
}

function hasMeaningfulDraft(value, initialValue) {
  return Object.keys(initialValue).some((key) => {
    const current = String(value?.[key] ?? "").trim();
    const initial = String(initialValue?.[key] ?? "").trim();
    return current && current !== initial;
  });
}

function readDraft(storageKey, initialValue) {
  if (!canUseStorage()) {
    return {
      value: initialValue,
      restored: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {
        value: initialValue,
        restored: false,
      };
    }

    const parsed = JSON.parse(raw);
    const value = mergeDraft(initialValue, parsed);
    return {
      value,
      restored: hasMeaningfulDraft(value, initialValue),
    };
  } catch (error) {
    window.localStorage.removeItem(storageKey);
    return {
      value: initialValue,
      restored: false,
    };
  }
}

export function usePersistentFormDraft(storageKey, initialValue) {
  const [state, setState] = useState(() => readDraft(storageKey, initialValue));

  useEffect(() => {
    setState(readDraft(storageKey, initialValue));
  }, [storageKey]);

  useEffect(() => {
    if (!canUseStorage()) return;

    if (hasMeaningfulDraft(state.value, initialValue)) {
      window.localStorage.setItem(storageKey, JSON.stringify(state.value));
      return;
    }

    window.localStorage.removeItem(storageKey);
  }, [initialValue, state.value, storageKey]);

  const setValue = (nextValue) => {
    setState((prev) => ({
      value: typeof nextValue === "function" ? nextValue(prev.value) : nextValue,
      restored: false,
    }));
  };

  const clearDraft = (nextValue = initialValue) => {
    if (canUseStorage()) window.localStorage.removeItem(storageKey);
    setState({
      value: nextValue,
      restored: false,
    });
  };

  return [state.value, setValue, { clearDraft, draftRestored: state.restored }];
}
