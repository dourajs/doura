'use strict'

const autocannon = require('autocannon')

autocannon({
  url: 'http://localhost:3000',
  connections: 1000, //default
  pipelining: 1, // default
  duration: 1000 // default
}, console.log)