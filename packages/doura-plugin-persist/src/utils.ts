export function deserialize(serial: string) {
  return JSON.parse(serial)
}

export function serialize(data: any) {
  return JSON.stringify(data)
}
