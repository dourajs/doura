import { defineModel } from 'doura'
import { id } from './base-models/id'

type item = {
  id: number
  content: string
}

export const listA = defineModel({
  name: 'listA',
  models: [id],
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
  actions: {
    addList(payload: Partial<item> & { content: string }) {
      this.arr.push({
        id: this.arr.length + 1,
        content: payload.content,
      })
    },
    removeById(payload: number) {
      this.arr = this.arr.filter((item) => item.id !== payload)
    },
    async addContentAsync(payload: string) {
      await this.id.setId(this.id.id + 1)
      const tempId = this.id.id
      this.addList({ content: `${payload}-id:${tempId}` })
    },
  },
})
