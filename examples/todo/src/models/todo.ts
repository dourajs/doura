///<reference types="webpack-env" />

import { defineModel, acceptHMRUpdate } from 'doura'

interface Todo {
  id: number
  content: string
  isFinished: boolean
}

export const todoModel = defineModel({
  state: {
    todos: [] as Todo[],
    filter: 'all',
    nextId: 213,
  },
  views: {
    unfinishedTodos() {
      return this.todos.filter((todo) => !todo.isFinished)
    },
    filteredTodos() {
      if (this.filter === 'unfinished') {
        return this.unfinishedTodos
      }
      return this.todos
    },
  },
  actions: {
    // any amount of arguments, return a promise or not
    setFilter(filter: 'all' | 'unfinished') {
      // you can directly mutate the state
      this.filter = filter
    },
    toggleTodo(id: number) {
      const todo = this.todos.find((i) => i.id === id)
      if (todo) {
        todo.isFinished = !todo.isFinished
      }
    },
    addTodo(content: string) {
      this.todos.push({
        id: this.nextId++,
        content,
        isFinished: false,
      })
    },
    clear() {
      this.todos.length = 0
    },
  },
})

// for model hmr
if (module.hot) {
  module.hot.accept()
  module.hot.dispose(acceptHMRUpdate(todoModel))
}
