import { defineModel } from 'doura'
import { id } from './base-models/id'

type item = {
  id: number
  content: string
}

export const listB = defineModel(
  {
    name: 'listB',
    state: {
      arr: [
        {
          id: 0,
          item: 'content 0',
        },
        {
          id: 1,
          item: 'content 1',
        },
      ],
    },
    reducers: {
      addList(state, payload: Partial<item> & { item: string }) {
        state.arr.push({
          id: state.arr.length + 1,
          item: payload.item,
        })
      },
      removeById(state, payload: number) {
        state.arr = state.arr.filter((item) => item.id !== payload)
      },
    },
    actions: {
      async addContentAsync(payload: string) {
        const tempId = this.$state.arr.length
        this.addList({ item: `${payload}-id:${tempId}` })
      },
      choose(id: number) {
        this.$dep.id.setId(id)
      },
    },
    views: {
      current() {
        const current = this.arr.filter((item) => item.id === this.$dep.id.id)
        return current.length ? current[0].item : ''
      },
    },
  },
  [id]
)
