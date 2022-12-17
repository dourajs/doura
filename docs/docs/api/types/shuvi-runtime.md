---
id: shuvi-runtime
title: "@shuvi/runtime"
---

## Loader

```ts
type Loader<T extends {} = {}> = (
  loaderContenxt: RouteLoaderContext
) => Promise<T | Response | void | undefined> | T | Response | void | undefined;
```

- type [RouteLoaderContext](#routeloadercontext)

## RouteLoaderContext

loaderContenxt is an object containing several useful properties and methods.

### `ctx.pathname`

Current url path

### Type

`string`

### Example

If current url is `/xx/yy?hello=world&test=123`,  
`pathname` will be `/xx/yy`

### `ctx.query`

The query object of current url.

### Type

```ts
interface Query {
  [x: string]: any;
}
```

### Example

If current url is `/xx/yy?hello=world&test=123`,  
`query` will be

```js
{
  hello: 'world',
  test: '123'
}
```

### `ctx.params`

The params of current url.

If matched routes contains dynamic route, the params of dynamic route will be parsed as this `params` object.

### Type

```ts
interface Params {
  [x: string]: any;
}
```

### Example

If the route is set as `/:foo/:bar` and the current url is `/xx/yy?hello=world&test=123` `params` will be

```js
{
  foo: 'xx',
  bar: 'yy'
}
```

### `ctx.redirect`

make a redirect to another path.

### Type

```ts
function redirect(toPath: string, status?: number = 302): Response;
```

### Example

```tsx
import { Loader } from "@shuvi/runtime";
export const loader: Loader = async ({ redirect }) => {
  return redirect("/target", 301);
};
```

### `ctx.error`

Make a redirect to error page.

### Type

```ts
(body?: string, statusCode?: number = 500) => Response;
```

### Example

```tsx
import { Loader } from "@shuvi/runtime";
export const loader: Loader = async ({ redirect }) => {
  return error("not found", 404);
};
```

### `ctx.appContext`

Application context object, which is accessiable during the entire lifecycle of application

- type [AppContext](#appcontext)

### `ctx.req`

Current request information. Only available on server side.

- type [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)

## AppContext

```ts
interface AppContext {
  store: any;
  pageData: any;
  [x: string]: any;
}
```
