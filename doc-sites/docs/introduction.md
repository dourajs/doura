---
id: introduction
title: What is Doura?
slug: /
pagination_next: null
hide_table_of_contents: true
custom_edit_url: null
---

Doura is a TypeScript-first state management library built around models.
Models keep state, actions, views, composed child models, and async queries in a
single definition. A `doura()` store creates model instances, and React apps use
`DouraRoot` plus hooks from `react-doura`.

Current packages are published as `0.2.0-beta.1`. `react-doura` has peer
dependencies on `doura@0.2.0-beta.1` and `react >=18`.

## Example

```tsx
import { defineModel, doura } from 'doura'
import { DouraRoot, useModel } from 'react-doura'

const todoModel = defineModel({
  name: 'todos',
  state: {
    todos: [
      { id: 0, text: 'read books', isFinished: true },
      { id: 1, text: 'play games', isFinished: false },
    ],
    filter: 'all' as 'all' | 'unfinished',
  },
  views: {
    unfinishedTodos() {
      return this.todos.filter((todo) => !todo.isFinished)
    },
    filteredTodos() {
      return this.filter === 'unfinished' ? this.unfinishedTodos : this.todos
    },
  },
  actions: {
    setFilter(filter: 'all' | 'unfinished') {
      this.filter = filter
    },
    toggle(id: number) {
      const todo = this.todos.find((item) => item.id === id)
      if (todo) todo.isFinished = !todo.isFinished
    },
  },
})

const store = doura()
const todos = store.getModel(todoModel)
todos.setFilter('unfinished')

function TodoList() {
  const { filteredTodos, setFilter, toggle } = useModel(todoModel)

  return (
    <section>
      <label>
        <input
          type="checkbox"
          onChange={(event) =>
            setFilter(event.currentTarget.checked ? 'unfinished' : 'all')
          }
        />
        Only show unfinished
      </label>

      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id}>
            <label>
              <input
                type="checkbox"
                checked={todo.isFinished}
                onChange={() => toggle(todo.id)}
              />
              {todo.text}
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function App() {
  return (
    <DouraRoot>
      <TodoList />
    </DouraRoot>
  )
}
```

## API Shape

- `defineModel({ name, state, actions?, views?, models?, queries? }, setup?)`
  returns a `ModelDefinition`; the raw options are available at
  `definition.$options`.
- `doura({ initialState?, plugins?, query? })` creates a store.
- `store.getModel(modelDefinition)` returns a named model instance cached by
  `definition.$options.name` in that store.
- React hooks accept the model definition directly:
  `useModel(model, selector?, depends?)`. The returned `ModelAPI` includes
  state, views, actions, direct query fetch functions, and `$queries`.
