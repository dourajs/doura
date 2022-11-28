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

const countModel = defineModel({
  state: {
    count: 0,
  },
  actions: {
    inc() {
      this.count += 1
    },
  },
})
```

### Bind to React Components

```tsx
import { useModel } from 'react-doura'

function Counter() {
  const counter = useModel(countModel)

  return (
    <div>
      <h1>Count: {counter.count}</h1>
      <button onClick={counter.inc}>inc</button>
    </div>
  )
}
```

## Credits

Doura is greatly inspired by following excellent projects:

- [Immer](https://github.com/immerjs/immer)
- [Vuejs](https://github.com/vuejs)
- [Pinia](https://github.com/vuejs/pinia)
