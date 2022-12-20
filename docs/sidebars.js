/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

//@ts-check
// @ts-check
const fs = require('fs-extra')

const getTocFromId = (id) => {
  const src = fs.readFileSync(`./docs/${id}.md`, 'utf-8')
  const h2s = src.match(/^## [^\n]+/gm)
  const cacheAnchor = new Map()
  let headers = []
  if (h2s) {
    headers = h2s.map((h) => {
      const value = h
        .slice(2)
        .replace(/<sup class=.*/, '')
        .replace(/\\</g, '<')
        .replace(/`([^`]+)`/g, '$1')
        .trim()

      let anchor = value
        .toLowerCase()
        .replace(/[ ]/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '')
      if (cacheAnchor.has(anchor)) {
        cacheAnchor.set(anchor, cacheAnchor.get(anchor) + 1)
        anchor = anchor + '-' + cacheAnchor.get(anchor)
      } else {
        cacheAnchor.set(anchor, 0)
      }
      return { value, anchor }
    })
  }
  return headers
}

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'introduction',
    {
      type: 'category',
      label: 'Getting Stared',
      items: ['installation', 'playground'],
      collapsed: false,
      collapsible: false,
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'core-concepts/store',
        'core-concepts/state',
        'core-concepts/actions',
        'core-concepts/views',
        'core-concepts/plugins',
      ],
      collapsed: false,
      collapsible: false,
    },
    {
      type: 'category',
      label: 'React integration',
      items: [
        'react/component-state',
        'react/global-store',
        'react/multiple-stores',
      ],
      collapsed: false,
      collapsible: false,
    },
    {
      type: 'category',
      label: 'Guides',
      items: ['guides/compose-model', 'guides/optimize-views', 'guides/hmr'],
      collapsed: true,
      collapsible: true,
    },
  ],
  api: [
    // In order to generate the API directory, we must manually add the sidebar below.
    {
      type: 'category',
      label: 'Core',
      collapsed: false,
      collapsible: false,
      items: [
        {
          type: 'doc',
          id: 'api/core/doura',
          customProps: {
            headers: getTocFromId('api/core/doura'),
          },
        },
        {
          type: 'doc',
          id: 'api/core/react-doura',
          customProps: {
            headers: getTocFromId('api/core/react-doura'),
          },
        },
      ],
    },
    {
      type: 'category',
      label: 'Doura Plugin',
      collapsed: false,
      collapsible: false,
      items: [
        {
          type: 'doc',
          id: 'api/plugins/index',
          customProps: {
            headers: getTocFromId('api/plugins/index'),
          },
        },
      ],
    },
  ],
}

module.exports = sidebars
