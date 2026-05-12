import React from 'react'
import Layout from '@theme-original/DocItem/Layout'
import type { WrapperProps } from '@docusaurus/types'

type Props = WrapperProps<typeof Layout>

export default function LayoutWrapper(props: Props): React.ReactElement {
  return (
    <>
      <div className="agent-directive">
        For AI agents: a documentation index is available at{' '}
        <a href="/doura/llms.txt">/llms.txt</a>
      </div>
      <Layout {...props} />
    </>
  )
}
