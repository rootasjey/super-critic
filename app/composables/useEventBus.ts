export type EventHandler = (detail?: any) => void

const bus = new EventTarget()

function attach(event: string, handler: EventHandler) {
  const listener = (e: Event) => handler((e as CustomEvent).detail)
  ;(handler as any).__listener = listener
  bus.addEventListener(event, listener as EventListener)
}

function detach(event: string, handler: EventHandler) {
  const listener = (handler as any).__listener || handler
  bus.removeEventListener(event, listener as EventListener)
}

function dispatch(event: string, detail?: any) {
  bus.dispatchEvent(new CustomEvent(event, { detail }))
}

export const useEventBus = () => {
  return {
    on: attach,
    off: detach,
    emit: dispatch,
  }
}

// Backwards compatibility: named exports
export const on = (event: string, handler: EventHandler) => useEventBus().on(event, handler)
export const off = (event: string, handler: EventHandler) => useEventBus().off(event, handler)
export const emit = (event: string, detail?: any) => useEventBus().emit(event, detail)

export default useEventBus
