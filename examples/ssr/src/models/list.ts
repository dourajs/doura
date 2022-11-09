import { defineModel } from 'doura'
import { id } from '../baseModels/id'

type item = {
  id: number
  content: string
}

export const list = defineModel(
  {
    name: 'list',
    state: {
      arr: [
        {
          id: 0,
          content: 'content 0',
        },
        {
          id: 1,
          content: 'content 1',
        },
      ],
    },
    reducers: {
      addList(state, payload: Partial<item> & { content: string }) {
        state.arr.push({
          id: state.arr.length + 1,
          content: payload.content,
        })
      },
      removeById(state, payload: number) {
        state.arr = state.arr.filter((item) => item.id !== payload)
      },
    },
    actions: {
      async addContentAsync(payload: string) {
        const id = this.$dep.id
        await id.incrementAsync(id.$state.id + 1)
        const tempId = id.$state.id
        this.addList({ content: `${payload}-id:${tempId}` })
      },
    },
  },
  [id]
)
