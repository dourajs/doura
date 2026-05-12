import { ModelDefinition, QueryFetch, defineModel } from 'doura'
import { expectType } from '../helper'

// object model
const countModel = defineModel({
  name: 'test',
  state: {
    count: 0,
  },
  actions: {
    inc() {
      this.count += 1
    },
  },
  views: {
    double() {
      return this.count * 2
    },
  },
})
expectType<'test'>(countModel.$options.name)
expectType<{ count: number }>(countModel.$options.state)

// @ts-expect-error — model name is required in object model options
defineModel({
  state: {},
})

// models
export const fooModel = defineModel({
  name: 'fooModel',
  state: {
    value: 0,
  },
  models: [countModel],
  actions: {
    accessDepend() {
      expectType<number>(this.test.count)
      // @ts-expect-error
      this.test.noExist
      expectType<number>(this.test.double)
      expectType<void>(this.test.inc())
    },
  },
})

// key conflicts are rejected for literal keys that can be checked statically.
// Runtime validation still covers dynamic keys and widened model arrays.
// @ts-expect-error - "double" in views conflicts with state
defineModel({
  name: 'conflictStateView',
  state: {
    double: 0,
  },
  views: {
    double() {
      return this.$state.double * 2
    },
  },
})

// @ts-expect-error - "reset" in actions conflicts with views
defineModel({
  name: 'conflictViewAction',
  state: {
    count: 0,
  },
  views: {
    reset() {
      return this.count
    },
  },
  actions: {
    reset() {
      this.count = 0
    },
  },
})

// @ts-expect-error - "fetchUser" in queries conflicts with state
defineModel({
  name: 'conflictStateQuery',
  state: {
    fetchUser: '',
  },
  queries: {
    fetchUser: (_ctx) => Promise.resolve({ id: '1' }),
  },
})

// @ts-expect-error - "refresh" in actions conflicts with queries
defineModel({
  name: 'actionQuerySameName',
  state: {
    count: 0,
  },
  actions: {
    refresh() {
      this.count += 1
    },
  },
  queries: {
    refresh: (_ctx) => Promise.resolve(1),
  },
})

const optionFieldQueryRef = defineModel({
  name: 'optionFieldQueryRef',
  state: {},
  queries: {
    state: (_ctx) => Promise.resolve(1),
    name: (_ctx) => Promise.resolve(1),
    actions: (_ctx) => Promise.resolve(1),
    views: (_ctx) => Promise.resolve(1),
    models: (_ctx) => Promise.resolve(1),
    queries: (_ctx) => Promise.resolve(1),
  },
})
expectType<QueryFetch<[], number>>(optionFieldQueryRef.state)
expectType<QueryFetch<[], number>>(optionFieldQueryRef.name)
expectType<QueryFetch<[], number>>(optionFieldQueryRef.actions)
expectType<QueryFetch<[], number>>(optionFieldQueryRef.views)
expectType<QueryFetch<[], number>>(optionFieldQueryRef.models)
expectType<QueryFetch<[], number>>(optionFieldQueryRef.queries)
expectType<'optionFieldQueryRef'>(optionFieldQueryRef.$options.name)
expectType<{}>(optionFieldQueryRef.$options.state)

const optionFieldActionRef = defineModel({
  name: 'optionFieldActionRef',
  state: {},
  actions: {
    state() {
      return 1
    },
    name() {
      return 1
    },
    queries() {
      return 1
    },
  },
})
expectType<() => number>(optionFieldActionRef.state)
expectType<() => number>(optionFieldActionRef.name)
expectType<() => number>(optionFieldActionRef.queries)

// @ts-expect-error - "$options" in queries conflicts with model definition fields
defineModel({
  name: 'reservedQueryRef',
  state: {},
  queries: {
    $options: (_ctx) => Promise.resolve(1),
  },
})

// @ts-expect-error - "$options" in actions conflicts with model definition fields
defineModel({
  name: 'reservedActionRef',
  state: {},
  actions: {
    $options() {
      return 1
    },
  },
})

const childConflictModel = defineModel({
  name: 'childConflict',
  state: {
    value: 0,
  },
})

// @ts-expect-error - "childConflict" in actions conflicts with models
defineModel({
  name: 'conflictActionModel',
  state: {
    count: 0,
  },
  models: [childConflictModel],
  actions: {
    childConflict() {
      this.count += 1
    },
  },
})

const dynamicChildren = [childConflictModel] as ModelDefinition[]

// Widened model arrays are intentionally left to runtime validation.
defineModel({
  name: 'widenedModelsSkipStaticConflict',
  state: {
    childConflict: 0,
  },
  models: dynamicChildren,
})
