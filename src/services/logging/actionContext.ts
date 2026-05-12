import { AsyncLocalStorage } from "async_hooks"

export const actionLogContext = new AsyncLocalStorage<number>()
