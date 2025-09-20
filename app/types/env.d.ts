/// <reference types="vite/client" />

declare module '~/*' {
  const value: any
  export default value
}

declare module '~/composables/useEventBus' {
  export type EventHandler = (detail?: any) => void
  export function on(event: string, handler: EventHandler): void
  export function off(event: string, handler: EventHandler): void
  export function emit(event: string, detail?: any): void
  export function useEventBus(): {
    on: typeof on
    off: typeof off
    emit: typeof emit
  }
  const _default: typeof useEventBus
  export default _default
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
