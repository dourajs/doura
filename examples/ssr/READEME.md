
## Start

  1. `yarn run start` to start server
     1. `http://localhost:3000/` for ssr page
     1. `http://localhost:3000/status` for monitor express server

  1. `node scripts/autocannon.js` to make a few thousand requests

## SSR memory

  1. init(140m)=>renderPage(240m)+Max(300m)=>GC(260-280m)