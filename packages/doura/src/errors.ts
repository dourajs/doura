import { warn } from './warning'

export const enum ErrorCodes {
  SCHEDULER,
}

const Errors: Record<number | string, string> = {
  [ErrorCodes.SCHEDULER]:
    'scheduler flush. This is likely a Doura internals bug. ' +
    'Please open an issue at https://github.com/dourajs/doura/issues/new',
}

export function error(err: unknown, type: ErrorCodes, ...args: any[]) {
  if (__DEV__) {
    const e = Errors[type] as any
    const info = !e
      ? 'unknown error nr: ' + error
      : typeof e === 'function'
      ? e.apply(null, args as any)
      : e
    warn(`Unhandled error${info ? ` during execution of ${info}` : ``}`)

    // crash in dev by default so it's more noticeable
    throw err
  } else {
    // recover in prod to reduce the impact on end-user
    console.error(err)
  }
}
