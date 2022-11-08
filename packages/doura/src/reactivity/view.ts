import { warn } from '../warning'
import { ReactiveEffect, trackView, triggerView } from './effect'
import { toBase } from './common'
import { Dep } from './dep'

export interface View<T = any> {
  dep?: Dep
  mightChange: boolean
  readonly value: T
  readonly effect: ReactiveEffect<T>
}

export interface ViewOptions {
  disableCache?: boolean
}

export type ViewGetter<T> = (...args: any[]) => T

// export type onViewInvalidate = (fn: () => void) => () => void

export class ViewImpl<T> {
  public dep?: Dep = undefined

  public readonly effect: ReactiveEffect<T>

  public mightChange: boolean = false

  private _value!: T

  private _cacheable: boolean

  private _dirty = true

  constructor(getter: ViewGetter<T>, { disableCache = false }: ViewOptions) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true
        triggerView(this)
      }
    })
    this.effect.view = this
    this.effect.active = this._cacheable = !disableCache
  }

  get value() {
    // the view may get wrapped by other proxies e.g. readonly()
    const self = toBase(this)
    trackView(self)
    if (self._dirty || !self._cacheable) {
      self._dirty = false
      self._value = self.effect.run()!
    }
    return self._value
  }

  set value(_newValue: T) {
    if (process.env.NODE_ENV === 'development') {
      warn('Write operation failed: computed value is readonly')
    }
  }
}

export function view<T>(
  getter: ViewGetter<T>,
  options: ViewOptions = {}
): View<T> {
  const cRef = new ViewImpl<T>(getter, options)
  return cRef
}
