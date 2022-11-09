/**
 * This file is supposed to export a request handler, which implements server-side rendering in a Node.js runtime
 * environment.
 *
 * In production, the request handler may be imported by an executable node script, which sets up an express server.
 * A sample script is provided in `react-scripts-with-ssr/scripts/serve.js`, which you may start with `npm run serve`
 * to test your production builds of the request handler. That script however is not part of the compilation. It is up
 * to you to implement, how the request handler is integrated in your server-side infrastructure.
 *
 * This file may also export a function called `devServerHandler`, which is supposed to return a request handler for
 * the development environment. That request handler is plugged into the local webpack dev server started by `npm start`.
 */
import React from 'react'
import { renderToPipeableStream } from 'react-dom/server'
// @ts-ignore
import express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import App from './App'
import { doura } from 'doura'
import { count } from './models/count'
import { test } from './models/test'

// provide a way to emulate fs access in development mode when builds are served from in-memory
let readFileSync: (filename: string) => Buffer = fs.readFileSync

const router = express.Router()

// define ssr path pattern, exclude file and hmr requests
const ssrRegex = /^\/(?!static|favicon\.ico|.*hot-update\.js).*/

// do server-side rendering
router.use(
  ssrRegex,
  async (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    const douraStore = doura()
    await douraStore.getModel(count).incrementAsync()
    await douraStore.getModel(test).setString(Math.random().toString())
    const template = readFileSync('build/index.html')
      .toString()
      .replace(/%BASE_HREF%/g, process.env.BASE_HREF || '')
      .replace(/%CLIENT_ENV%/g, JSON.stringify(douraStore.getState()))

    const [head, tail] = template.split('%ROOT%')
    let didError = false
    const stream = renderToPipeableStream(<App store={douraStore} />, {
      onShellReady() {
        // The content above all Suspense boundaries is ready.
        // If something errored before we started streaming, we set the error code appropriately.
        response.statusCode = didError ? 500 : 200
        response.setHeader('Content-type', 'text/html')
        response.write(head)
        stream.pipe(response)
      },
      onShellError(error) {
        // Something errored before we could complete the shell so we emit an alternative shell.
        response.statusCode = 500
        response.send(
          '<!doctype html><p>Loading...</p><script src="clientrender.js"></script>'
        )
      },
      onAllReady() {
        // If you don't want streaming, use this instead of onShellReady.
        // This will fire after the entire page content is ready.
        // You can use this for crawlers or static generation.
        // res.statusCode = didError ? 500 : 200;
        // res.setHeader('Content-type', 'text/html');
        // stream.pipe(res);
        response.write(tail)
        response.end()
      },
      onError(err) {
        didError = true
        console.error(err)
      },
    })
  }
)

// serve static files from build/ dir
router.use(
  express.static('build', {
    // do not send index.html for '/'
    index: false,
  })
)

/**
 * Export a request handler. This can be plugged into an express instance or deployed as a serverless function.
 * An express router itself implements the request handler interface (composite design pattern).
 */
export default router

/**
 * Supposed to return a request handler which can be plugged into a webpack dev server during development.
 * This function should return a somehow altered or decorated version of the 'export default' request handler,
 * which handles differences between development and production environment.
 * @param compiler webpack compiler which compiles the ssr entry point
 */
export const devServerHandler = (compiler: any) => {
  // redirect file access to use in-memory fs of the compiler
  readFileSync = (fileName) =>
    compiler.outputFileSystem.readFileSync(
      path.resolve(
        // handlers should expect files in build/ but the dev server writes them to dist/
        fileName.replace('build', 'dist')
      )
    )

  // ignore in-memory file requests, will be handled by the webpack dev middleware
  const devServerRouter = express.Router()
  devServerRouter.use(require('express-status-monitor')())
  devServerRouter.use(ssrRegex, router)
  return devServerRouter
}
