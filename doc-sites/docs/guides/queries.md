---
id: queries
title: Queries
---

Queries provide built-in async data fetching with caching, directly in your model definition. They handle cache identity, staleness, cancellation, and garbage collection out of the box.

## Defining Queries

Add a `queries` field to your model. Each query entry is a function. Configure per-query options, such as `staleTime`, in the optional second argument to `defineModel()`.

```ts
import { defineModel } from 'doura'

const userModel = defineModel(
  {
    name: 'user',
    state: {
      currentUser: null as User | null,
    },
    queries: {
      fetchAll: async function (ctx) {
        const res = await fetch('/api/users', { signal: ctx.signal })
        return (await res.json()) as User[]
      },

      fetchById: async function (ctx, id: string) {
        const res = await fetch(`/api/users/${id}`, { signal: ctx.signal })
        const user = await res.json()
        // Actions on `this` are available — update state as a side effect
        this.currentUser = user
        return user
      },
    },
  },
  ({ model }) => {
    model.setQueryOptions('fetchById', { staleTime: 30_000 })
  }
)
```

## Cache Identity

Each query entry maintains a cache keyed by its arguments. No custom key function is needed — the args tuple determines cache identity automatically.

```ts
// These are different cache entries:
instance.fetchById.fetch('user-1')
instance.fetchById.fetch('user-2')

// Same args = same cache entry (deduped):
instance.fetchById.fetch('user-1') // returns cached or dedupes inflight
```

## QueryCtx and Cancellation

Every query function receives a `QueryCtx` as its first argument, which provides an `AbortSignal`. The signal fires when `cancel()` is called on the query handle.

```ts
queries: {
  search: async function (ctx, term: string) {
    const res = await fetch(`/api/search?q=${term}`, {
      signal: ctx.signal,  // automatically cancelled if a new search starts
    })
    return res.json()
  },
}
```

## Using Queries in Actions

Inside actions, query handles are available as `this.queryName`:

```ts
actions: {
  async loadUser(id: string) {
    const user = await this.fetchById.fetch(id)
    this.currentUser = user
  },
  refreshAll() {
    this.fetchAll.invalidate()  // mark stale, next observer will refetch
  },
  cancelPending() {
    this.fetchById.cancel()     // cancel all inflight fetchById requests
  },
}
```

## QueryHandle Methods

Each query handle provides these methods:

| Method                   | Description                          |
| ------------------------ | ------------------------------------ |
| `fetch(...args)`         | Fetch and return data                |
| `prefetch(...args)`      | Fetch to warm cache (returns `void`) |
| `getData(...args)`       | Read cached data without fetching    |
| `getState(...args)`      | Read raw cache entry                 |
| `isFetching(...args)`    | Check if currently fetching          |
| `isStale(...args)`       | Check if data is stale               |
| `cancel(...args?)`       | Cancel inflight request(s)           |
| `invalidate(...args?)`   | Mark entry/entries stale             |
| `reset(...args?)`        | Clear entry/entries entirely         |
| `setData(...args, data)` | Write data into the cache manually   |

Methods that accept optional args operate on a specific cache slot when args are provided, or on all slots when called with no arguments.

## Configuration

### Per-entry staleTime

Set `staleTime` with `model.setQueryOptions()` to control how long data is considered fresh for a specific query.

```ts
const userModel = defineModel(
  {
    name: 'user',
    state: {},
    queries: {
      fetchUser: async function (ctx, id: string) {
        /* ... */
      },
    },
  },
  ({ model }) => {
    model.setQueryOptions('fetchUser', { staleTime: 60_000 })
  }
)
```

### Global configuration

Set default query behavior for the entire store:

```ts
import { doura } from 'doura'

const store = doura({
  query: {
    staleTime: 10_000, // default: 0 (always stale)
    gcTime: 300_000, // default: 5 minutes (garbage collect unused entries)
  },
})
```

Priority: hook override > per-entry `staleTime` > global `staleTime`.

## Bulk Operations

Model instances provide bulk operations that affect all queries:

```ts
const instance = store.getModel(userModel)

instance.$invalidateQueries() // mark all entries stale
instance.$cancelQueries() // cancel all inflight requests
instance.$resetQueries() // clear all cache entries
```

## React Integration

### useQuery

Subscribe to a query's cache and auto-fetch when data is stale:

```tsx
import { useModel, useQuery } from 'react-doura'

function UserProfile({ userId }: { userId: string }) {
  const user = useModel(userModel)

  const { data, isLoading, error, refetch } = useQuery(
    user.fetchById,
    [userId],
    { staleTime: 60_000, enabled: !!userId }
  )

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error!</div>
  return (
    <div>
      {data.name} <button onClick={refetch}>Refresh</button>
    </div>
  )
}
```

### useInfiniteQuery

For paginated data that accumulates pages:

```tsx
import { useModel, useInfiniteQuery } from 'react-doura'

function PostList() {
  const posts = useModel(postsModel)

  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery(posts.fetchPage, {
      initialArgs: [1] as [number],
      getNextArgs: (lastPage, allPages) =>
        lastPage.hasMore ? ([allPages.length + 1] as [number]) : undefined,
    })

  return (
    <div>
      {data?.pages.flatMap((page) =>
        page.items.map((item) => <div key={item.id}>{item.title}</div>)
      )}
      {hasNextPage && (
        <button onClick={fetchNextPage} disabled={isFetchingNextPage}>
          Load more
        </button>
      )}
    </div>
  )
}
```

### useAction

Track action lifecycle (loading, success, error) in your component:

```tsx
import { useModel, useAction } from 'react-doura'

function SaveButton() {
  const form = useModel(formModel)
  const { run, isPending } = useAction(form.save)

  return (
    <button onClick={() => run()} disabled={isPending}>
      {isPending ? 'Saving...' : 'Save'}
    </button>
  )
}
```

See the [API reference](/docs/api/core/react-doura#usequery) for full type details.
