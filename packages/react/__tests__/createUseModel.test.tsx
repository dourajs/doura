/**
 * @jest-environment jsdom
 */

import React, { useMemo } from 'react'
import { render, act } from '@testing-library/react'
import {
  defineModel,
  doura,
  AnyModel,
  Selector,
  ModelData,
  nextTick,
} from 'doura'
import { createBatchManager } from '../src/batchManager'
import { IUseSharedModel, IUseStaticModel } from '../src/types'
import {
  createUseSharedModel,
  createUseStaticModel,
} from '../src/createUseModel'
import { countModel } from './models/index'

let douraStore: ReturnType<typeof doura>
let batchManager: ReturnType<typeof createBatchManager>
let useTestModel: IUseSharedModel
let useTestStaticModel: IUseStaticModel

beforeEach(() => {
  process.env.NODE_ENV === 'development'
  jest.useFakeTimers()
  douraStore = doura()
  batchManager = createBatchManager()
  useTestModel = <IModel extends AnyModel, S extends Selector<IModel>>(
    name: string,
    model: IModel,
    selector?: S,
    depends?: any[]
  ) => {
    return useMemo(
      () => createUseSharedModel(douraStore, batchManager),
      [douraStore, batchManager]
    )(name, model, selector, depends)
  }
  useTestStaticModel = <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel
  ) => {
    return useMemo(
      () => createUseStaticModel(douraStore, batchManager),
      [douraStore, batchManager]
    )(model)
  }
})

afterEach(() => {})

describe('createUseModel', () => {
  test('could access state and view', () => {
    const model = defineModel({
      state: { value: 1 },
      views: {
        test() {
          return this.value * 2
        },
      },
    })

    const App = () => {
      const [state, _actions] = useTestModel('model', model)

      return (
        <>
          <div id="v">{state.value}</div>
          <div id="t">{state.test}</div>
        </>
      )
    }
    const { container } = render(<App />)

    expect(container.querySelector('#v')?.innerHTML).toEqual('1')
    expect(container.querySelector('#t')?.innerHTML).toEqual('2')
  })

  describe('should rerender when state changed', () => {
    test('change state by doura reducer', async () => {
      const App = () => {
        const [state, actions] = useTestModel('count', countModel)

        return (
          <>
            <div id="value">{state.value}</div>
            <button id="button" type="button" onClick={() => actions.add()}>
              add
            </button>
          </>
        )
      }

      const { container } = render(<App />)
      expect(container.querySelector('#value')?.innerHTML).toEqual('1')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(container.querySelector('#value')?.innerHTML).toEqual('2')
    })

    test('change state by doura action', async () => {
      const App = () => {
        const [state, actions] = useTestModel('count', countModel)

        return (
          <>
            <div id="value">{state.value}</div>
            <button
              id="button"
              type="button"
              onClick={() => actions.asyncAdd(2)}
            >
              add
            </button>
          </>
        )
      }

      const { container } = render(<App />)
      expect(container.querySelector('#value')?.innerHTML).toEqual('1')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        jest.runAllTimers()
      })
      expect(container.querySelector('#value')?.innerHTML).toEqual('3')
    })

    test('should rerender when depends state changed', async () => {
      const newModel = defineModel({
        name: 'newModel',
        models: {
          countModel,
        },
        state: { value: 0 },
        actions: {
          add(payload: number = 1) {
            this.value += payload
          },
          async asyncAdd() {
            await this.$models.countModel.asyncAdd(1)
            this.add(this.$models.countModel.$state.value)
          },
        },
        views: {
          test() {
            return this.$models.countModel.value * 2
          },
        },
      })

      const App = () => {
        const [state, actions] = useTestModel(
          'newModel',
          newModel,
          function (stateAndViews) {
            return {
              v: stateAndViews.value,
              t: stateAndViews.test,
            }
          },
          []
        )

        return (
          <>
            <div id="v">{state.v}</div>
            <div id="t">{state.t}</div>
            <button
              id="button"
              type="button"
              onClick={() => actions.asyncAdd()}
            >
              add
            </button>
          </>
        )
      }

      const { container } = render(<App />)

      expect(container.querySelector('#v')?.innerHTML).toEqual('0')
      expect(container.querySelector('#t')?.innerHTML).toEqual('2')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      await act(async () => {
        jest.runAllTimers()
      })
      expect(container.querySelector('#v')?.innerHTML).toEqual('2')
      expect(container.querySelector('#t')?.innerHTML).toEqual('4')
    })
  })

  test('should only consume model once', async () => {
    const App = () => {
      const [state, setState] = React.useState(1)
      const [model, actions] = useTestModel(
        'count',
        defineModel({
          state: {
            count: state,
          },
          actions: {
            add() {
              this.count += 1
            },
          },
        })
      )

      return (
        <>
          <button id="state" onClick={() => setState((s) => s + 1)}>
            {state}
          </button>
          <button id="count" onClick={() => actions.add()}>
            {model.count}
          </button>
        </>
      )
    }
    const { container } = render(<App />)

    expect(container.querySelector('#count')!.textContent).toEqual('1')
    await act(async () => {
      container
        .querySelector('#state')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#state')!.textContent).toEqual('2')
    expect(container.querySelector('#count')!.textContent).toEqual('1')
  })

  test('should only consume model once with selector', async () => {
    const fn = jest.fn()
    const countSelector = (s: any) => {
      fn()
      return s.count
    }
    const App = () => {
      const [state, setState] = React.useState(1)
      const [count, actions] = useTestModel(
        'count',
        defineModel({
          state: {
            count: state,
          },
          actions: {
            add() {
              this.count += 1
            },
          },
        }),
        countSelector
      )

      return (
        <>
          <button id="state" onClick={() => setState((s) => s + 1)}>
            {state}
          </button>
          <button id="count" onClick={() => actions.add()}>
            {count}
          </button>
        </>
      )
    }
    const { container } = render(<App />)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#count')!.textContent).toEqual('1')
    await act(async () => {
      container
        .querySelector('#state')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#state')!.textContent).toEqual('2')
    expect(container.querySelector('#count')!.textContent).toEqual('1')
  })

  describe('selector', () => {
    const countModel = defineModel({
      state: {
        count: 1,
      },
      actions: {
        add() {
          this.count += 1
        },
      },
    })

    describe('no dependencies params', () => {
      test('global selector', async () => {
        const fn = jest.fn()
        const countSelector = (s: ModelData<typeof countModel>) => {
          fn()
          return s.count
        }
        const App = () => {
          const [state, setState] = React.useState(0)
          const [count, actions] = useTestModel(
            'count',
            countModel,
            countSelector
          )

          return (
            <>
              <button id="state" onClick={() => setState((s) => s + 1)}>
                {state}
              </button>
              <button id="count" onClick={() => actions.add()}>
                {count}
              </button>
            </>
          )
        }
        const { container } = render(<App />)

        expect(fn).toHaveBeenCalledTimes(1)
        expect(container.querySelector('#count')!.textContent).toEqual('1')
        await act(async () => {
          container
            .querySelector('#state')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          await nextTick()
        })
        expect(fn).toHaveBeenCalledTimes(1)
        await act(async () => {
          container
            .querySelector('#count')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          await nextTick()
        })
        expect(fn).toHaveBeenCalledTimes(2)
        expect(container.querySelector('#count')!.textContent).toEqual('2')
      })

      test('inline selector', async () => {
        const fn = jest.fn()
        const App = () => {
          const [state, setState] = React.useState(0)
          const [count, actions] = useTestModel('count', countModel, (s) => {
            fn()
            return s.count
          })

          return (
            <>
              <button id="state" onClick={() => setState((s) => s + 1)}>
                {state}
              </button>
              <button id="count" onClick={() => actions.add()}>
                {count}
              </button>
            </>
          )
        }
        const { container } = render(<App />)

        expect(fn).toHaveBeenCalledTimes(1)
        expect(container.querySelector('#count')!.textContent).toEqual('1')
        await act(async () => {
          container
            .querySelector('#state')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        expect(fn).toHaveBeenCalledTimes(2)
        expect(container.querySelector('#count')!.textContent).toEqual('1')
        await act(async () => {
          container
            .querySelector('#count')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        expect(fn).toHaveBeenCalledTimes(4)
        expect(container.querySelector('#count')!.textContent).toEqual('2')
      })
    })

    test('depends []', async () => {
      const fn = jest.fn()
      const App = () => {
        const [state, setState] = React.useState(0)
        const [count, actions] = useTestModel(
          'count',
          countModel,
          (s) => {
            fn()
            return s.count
          },
          []
        )

        return (
          <>
            <button id="state" onClick={() => setState((s) => s + 1)}>
              {state}
            </button>
            <button id="count" onClick={() => actions.add()}>
              {count}
            </button>
          </>
        )
      }
      const { container } = render(<App />)

      expect(fn).toHaveBeenCalledTimes(1)
      await act(async () => {
        container
          .querySelector('#state')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(fn).toHaveBeenCalledTimes(1)
      await act(async () => {
        container
          .querySelector('#count')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(fn).toHaveBeenCalledTimes(2)
      expect(container.querySelector('#count')!.textContent).toEqual('2')
    })

    it('should be called after deps changes', async () => {
      const fn = jest.fn()
      const SybApp = (props: { prop1: number; prop2: number }) => {
        const [state, _actions] = useTestModel(
          'count',
          countModel,
          function (stateAndViews) {
            fn()
            return stateAndViews.count + props.prop2
          },
          [props.prop2]
        )

        return <div id="value">{state}</div>
      }
      const App = () => {
        const [state1, setState1] = React.useState(0)
        const [state2, setState2] = React.useState(0)

        return (
          <>
            <button id="btn1" onClick={() => setState1((s) => s + 1)}>
              {state1}
            </button>
            <button id="btn2" onClick={() => setState2((s) => s + 1)}>
              {state2}
            </button>
            <SybApp prop1={state1} prop2={state2}></SybApp>
          </>
        )
      }
      const { container } = render(<App />)

      expect(fn).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#value')!.textContent).toEqual('1')
      await act(async () => {
        container
          .querySelector('#btn1')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(fn).toHaveBeenCalledTimes(1)
      await act(async () => {
        container
          .querySelector('#btn2')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(fn).toHaveBeenCalledTimes(2)
      expect(container.querySelector('#value')!.textContent).toEqual('2')
    })

    test('should clear prev selector cache', async () => {
      const selector1 = jest.fn()
      const selector2 = jest.fn()
      const countSelector1 = function () {
        selector1()
        return 1
      }
      const countSelector2 = function () {
        selector2()
        return 2
      }
      const App = () => {
        let [selectorSwitch, setSwitch] = React.useState(true)
        const [value, actions] = useTestModel(
          'count',
          countModel,
          selectorSwitch ? countSelector1 : countSelector2
        )

        return (
          <>
            <button id="switch" onClick={() => setSwitch((s) => !s)}>
              {selectorSwitch}
            </button>
            <button id="value" onClick={() => actions.add()}>
              {value}
            </button>
          </>
        )
      }

      const { container } = render(<App />)

      // countSelector1 run and cache countSelector1
      expect(selector1).toHaveBeenCalledTimes(1)
      expect(selector2).toHaveBeenCalledTimes(0)
      expect(container.querySelector('#value')?.textContent).toEqual('1')
      await act(async () => {
        container
          .querySelector('#count')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      // cache worked, use countSelector1 cache, not computed
      expect(selector1).toHaveBeenCalledTimes(1)
      expect(selector2).toHaveBeenCalledTimes(0)
      expect(container.querySelector('#value')?.innerHTML).toEqual('1')

      // drop countSelector1 cache,  countSelector2 run and cache countSelector2
      await act(async () => {
        container
          .querySelector('#switch')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(selector1).toHaveBeenCalledTimes(1)
      expect(selector2).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#value')?.textContent).toEqual('2')
      await act(async () => {
        container
          .querySelector('#count')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(selector1).toHaveBeenCalledTimes(1)
      expect(selector2).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#value')?.textContent).toEqual('2')

      // drop countSelector2 cache,  countSelector1 run and cache countSelector1
      await act(async () => {
        container
          .querySelector('#switch')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(selector1).toHaveBeenCalledTimes(2)
      expect(selector2).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#value')?.textContent).toEqual('1')
      await act(async () => {
        container
          .querySelector('#count')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(selector1).toHaveBeenCalledTimes(2)
      expect(selector2).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#value')?.textContent).toEqual('1')
    })

    test('should throw error if changed state in a selector', () => {
      const App = () => {
        const [_state] = useTestModel(
          'count',
          countModel,
          (stateAndViews: any) => {
            stateAndViews.value = 1
            return stateAndViews.value
          }
        )
        return null
      }
      expect(() => {
        render(<App />)
      }).toThrow()
    })
  })

  test('could trigger component render outside of component', async () => {
    let AppRenderCount = 0

    function App() {
      AppRenderCount += 1
      const [{ value }, _] = useTestModel('count', countModel)

      return (
        <>
          <div id="value">{`${value}`}</div>
        </>
      )
    }

    render(<App />)
    expect(AppRenderCount).toBe(1)

    await act(async () => {
      const countStore = douraStore.getModel('count', countModel)
      countStore.add()
      await nextTick()
    })

    expect(AppRenderCount).toBe(2)
  })

  test('should render with newest state even update state during render', async () => {
    let firstRender = true
    const App = () => {
      const [{ value }, actions] = useTestModel('count', countModel)

      if (firstRender) {
        firstRender = false
        actions.add(1)
      }

      return <div id="value">{value}</div>
    }

    const { container } = render(<App />)

    await act(async () => {
      await nextTick()
    })

    expect(container.querySelector('#value')!.textContent).toEqual('2')
  })
})

describe('createUseStaticModel', () => {
  test('could access state and view', () => {
    const model = defineModel({
      name: 'model',
      state: { value: 1 },
      views: {
        test() {
          return this.value * 2
        },
      },
    })

    const App = () => {
      const [state, _actions] = useTestStaticModel(model)

      return (
        <>
          <div id="v">{state.current.value}</div>
          <div id="t">{state.current.test}</div>
        </>
      )
    }
    const { container } = render(<App />)

    expect(container.querySelector('#v')?.innerHTML).toEqual('1')
    expect(container.querySelector('#t')?.innerHTML).toEqual('2')
  })

  test('state updated, but component should not rendered', async () => {
    let renderTime = 0
    let currentCount = 0

    const App = () => {
      renderTime += 1

      const [state, dispatch] = useTestStaticModel(countModel)

      currentCount = state.current.value

      return (
        <>
          <div id="state">{state.current.value}</div>
          <button id="add" type="button" onClick={() => dispatch.add()}>
            add
          </button>
          <button
            id="updateCount"
            type="button"
            onClick={() => {
              currentCount = state.current.value
            }}
          >
            updateCount
          </button>
        </>
      )
    }

    const { container } = render(<App />)

    expect(renderTime).toBe(1)
    expect(currentCount).toBe(1)

    await act(async () => {
      container
        .querySelector('#add')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })

    expect(renderTime).toBe(1)
    expect(currentCount).toBe(1)

    await act(async () => {
      container
        .querySelector('#updateCount')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(currentCount).toBe(2)
  })

  test('should render with newest state even update state during render', () => {
    let firstRender = true
    const App = () => {
      const [state, actions] = useTestStaticModel(countModel)

      if (firstRender) {
        firstRender = false
        actions.add(1)
      }

      return <div id="value">{state.current.value}</div>
    }

    const { container } = render(<App />)
    expect(container.querySelector('#value')!.textContent).toEqual('2')
  })
})
