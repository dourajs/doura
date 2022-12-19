<div align="center">
<h1>doura</h1>
</div>

Doura is a decentralized state management solution based on the concept of model. It's very simple and intuitive.

- 🔑 100% TypeScript Support
- ⚛️ Reactive and Immutable
- 🔗 Models are organized in a decentralized way

<hr />

## Installation

Install with npm:

```
npm install doura
```

Install with yarn

```
yarn add doura
```

## Usage

### Define Model

```tsx
import { defineModel } from 'doura'
import { useModel } from 'react-doura'

const todoModel = defineModel({
  state: {
    todos: [
      {
        id: 0,
        text: 'read books',
        isFinished: true,
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
    // action can be asynchronous
    async getTodos() {
      this.todos = await fetchTodos('httpds://api.example.com/todos')
    }
  },
})
```

### Bind to React Components

```tsx
import { useModel } from 'react-doura'

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

## Credits

Doura is greatly inspired by following excellent projects:

- [Immer](https://github.com/immerjs/immer)
- [Vue.js](https://github.com/vuejs)
- [Pinia](https://github.com/vuejs/pinia)
