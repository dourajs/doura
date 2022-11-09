import { defineModel } from 'doura'

export const test = defineModel({
  name: 'test',
  state: { value: '' },
  reducers: {
    setString: (_state, payload: string) => {
      return {
        value: payload,
      }
    },
  },
})
