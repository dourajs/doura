---
id: introduction
title: What is Doura?
slug: /
pagination_next: null
hide_table_of_contents: true
custom_edit_url: null
---

Doura brings the reactivity to React. It's provided an intuitive and simple way to manage state. It has a powerful type system which all types can be inferred. Doura also splits the `model` from `store`, which means you can write your `models` and share it arcoss projects easily. Doura can be used as a global store(redux), shared stores(React Context) or local store(useReducer).

:::info

Doura is greatly inspired by [Immer](https://github.com/immerjs/immer), [Vue.js](https://github.com/vuejs) and [Pinia](https://github.com/vuejs/pinia). Thanks for their excellent work.

:::

## React Example

```tsx
import { defineModel } from 'doura'
import { useModel } from 'react-doura'

const todoModel = defineModel({
  name: 'todo',
  state: {
    todos: [
      {
        id: 0,
        text: 'read books',
        isFinished: true,
      },
      {
        id: 1,
        text: 'play games',
        isFinished: false,
      },
    ],
    /** @type {'all' | 'unfinished'} */
    filter: 'all',
  },
  views: {
    unfinishedTodos() {
      // autocompletion! ✨
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
    setFilter(filter) {
      // you can directly mutate the state
      this.filter = filter
    },
  },
})

export function TodoApp() {
  // type of `filteredTodos` and `setFilter` are inferred automatically
  const { filteredTodos, setFilter } = useModel(todoModel)

  return (
    <div>
      <div>
        <input
          type="checkbox"
          id="filter"
          onClick={(event) =>
            setFilter(event.target.checked ? 'unfinished' : 'all')
          }
        />
        <label htmlFor="filter">Only show unfinished</label>
      </div>
      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id}>
            <input type="checkbox" checked={todo.isFinished} />
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
```
