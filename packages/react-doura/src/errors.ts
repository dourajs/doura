const MISSING_PROVIDER_MESSAGE =
  '[react-doura]: could not find react-doura context value; please ensure the component is wrapped in a <Provider>.'

export function assertDouraContext<T>(context: T | null): T {
  if (!context) {
    throw new Error(MISSING_PROVIDER_MESSAGE)
  }
  return context
}
