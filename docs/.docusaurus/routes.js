import React from 'react'
import ComponentCreator from '@docusaurus/ComponentCreator'

export default [
  {
    path: '/doura/docs',
    component: ComponentCreator('/doura/docs', 'dce'),
    routes: [
      {
        path: '/doura/docs/',
        component: ComponentCreator('/doura/docs/', '961'),
        exact: true,
        sidebar: 'docs',
      },
      {
        path: '/doura/docs/api/',
        component: ComponentCreator('/doura/docs/api/', '8c3'),
        exact: true,
      },
      {
        path: '/doura/docs/guides/',
        component: ComponentCreator('/doura/docs/guides/', '5ce'),
        exact: true,
        sidebar: 'guides',
      },
      {
        path: '/doura/docs/playground',
        component: ComponentCreator('/doura/docs/playground', '3e5'),
        exact: true,
      },
      {
        path: '/doura/docs/reference/',
        component: ComponentCreator('/doura/docs/reference/', '1fe'),
        exact: true,
      },
      {
        path: '/doura/docs/tutorials',
        component: ComponentCreator('/doura/docs/tutorials', 'cdf'),
        exact: true,
      },
    ],
  },
  {
    path: '/doura/',
    component: ComponentCreator('/doura/', '175'),
    exact: true,
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
]
