export type Signal<T> = {
  value: T
  peek(): T
}

type Tracker = { deps: Set<Store<unknown>>; run: () => void; active: boolean }
type Store<T> = Signal<T> & { listeners: Set<Tracker>; write(value: T): void }

let active: Tracker | undefined
let revision = 0
const renderListeners = new Set<() => void>()

const changed = () => {
  revision++
  for (const listener of renderListeners) listener()
}

export const subscribeSignals = (listener: () => void) => {
  renderListeners.add(listener)
  return () => { renderListeners.delete(listener) }
}
export const signalVersion = () => revision

export const signal = <T>(initial: T): Signal<T> => {
  let value = initial
  const listeners = new Set<Tracker>()
  const store: Store<T> = {
    get value() {
      if (active) {
        store.listeners.add(active)
        active.deps.add(store as Store<unknown>)
      }
      return value
    },
    set value(next: T) { store.write(next) },
    peek: () => value,
    listeners,
    write(next) {
      if (Object.is(value, next)) return
      value = next
      for (const tracker of [...listeners]) if (tracker.active) tracker.run()
      changed()
    },
  }
  return store
}

export const effect = (fn: () => void) => {
  const tracker: Tracker = {
    deps: new Set(),
    active: true,
    run() {
      for (const dep of tracker.deps) dep.listeners.delete(tracker)
      tracker.deps.clear()
      const previous = active
      active = tracker
      try { fn() } finally { active = previous }
    },
  }
  tracker.run()
  return () => {
    tracker.active = false
    for (const dep of tracker.deps) dep.listeners.delete(tracker)
    tracker.deps.clear()
  }
}

export const computed = <T>(fn: () => T): Signal<T> => {
  const result = signal<T>(undefined as T)
  effect(() => { result.value = fn() })
  return result
}
