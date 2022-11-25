export function invariant(condition: any, message?: string): asserts condition {
  if (condition) {
    return
  }
  // Condition not passed

  // When not in production we allow the message to pass through
  // *This block will be removed in production builds*
  throw new Error(`[Doura React]: ${message || ''}`)
}
