import React from 'react'
import clsx from 'clsx'
import Layout from '@theme/Layout'
import Link from '@docusaurus/Link'
import Translate, { translate } from '@docusaurus/Translate'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import Highlight, { defaultProps } from 'prism-react-renderer'
import theme from 'prism-react-renderer/themes/vsDark'
import { exampleCode as routeExampleCode } from '../data/feature-examples/route'
import { exampleCode as loaderExampleCode } from '../data/feature-examples/loader'
import styles from './styles.module.css'

function HeroBanner() {
  const context = useDocusaurusContext()
  const {
    siteConfig: { baseUrl },
  } = context

  return (
    <div className={styles.hero} data-theme="dark">
      <div className={styles.heroInner}>
        <h1 className={styles.heroProjectTagline}>
          {/* <img
            alt={translate({ message: "Docusaurus with Keytar" })}
            className={styles.heroLogo}
            src={useBaseUrl("/img/docusaurus.svg")}
            width="200"
            height="200"
          /> */}
          <span
            className={styles.heroTitleTextHtml}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: translate({
                id: 'homepage.hero.title',
                message:
                  'Build <b>optimized</b> websites <b>quickly</b>, focus on your <b>content</b>',
              }),
            }}
          />
        </h1>
        <div className={styles.indexCtas}>
          <Link className="button button--primary" to="/docs">
            <Translate>Get Started</Translate>
          </Link>
          <Link
            className="button button--info"
            to={`${baseUrl}docs/playground`}
          >
            <Translate>Try a Demo</Translate>
          </Link>
          <span className={styles.indexCtasGitHubButtonWrapper}>
            <iframe
              className={styles.indexCtasGitHubButton}
              src="https://ghbtns.com/github-btn.html?user=shuvijs&amp;repo=shuvi&amp;type=star&amp;count=true&amp;size=large"
              width={160}
              height={30}
              title="GitHub Stars"
            />
          </span>
        </div>
      </div>
    </div>
  )
}

function Features() {
  const features = [
    {
      title: 'Focus on experience',
      content:
        'Focusing on developers, emphasizing development experience and focusing on development efficiency.',
      icon: 'icon-shuvi-chengbenhesuan',
    },
    {
      title: 'Out of the box',
      content:
        'With just one dependency, you can have a modern, deeply optimized front-end application.',
      icon: 'icon-shuvi-anquanguanli',
    },
    {
      title: 'Rich extensibility',
      content:
        'Provides rich interfaces, which can meet various functions and needs through plug-ins.',
      icon: 'icon-shuvi-qiyedinge',
    },

    {
      title: 'Feature rich',
      content:
        'The API interface and server-side middleware are sufficient to support complex scenarios.',
      icon: 'icon-shuvi-shangwuguanli',
    },
    {
      title: 'SSR/CSR',
      content: 'Progressive support for CSR and SSR',
      icon: 'icon-shuvi-shebeiguanli',
    },
    {
      title: 'Compile on demand',
      content:
        'Compilation speed is greatly improved, improving development efficiency.',
      icon: 'icon-shuvi-weibaoguanli',
    },
    {
      title: 'Plugin system',
      content: 'Powerful plug-in system to meet in-depth customization needs.',
      icon: 'icon-shuvi-wendangziliao',
    },
    {
      title: 'Built-in state management',
      content: 'Simple to use, suitable for team collaboration.',
      icon: 'icon-shuvi-xietongbangong',
    },
  ]

  return (
    <div className={clsx(styles.featuresWrapper)}>
      <div className={clsx(styles.features)}>
        {features.map((feature) => {
          return (
            <div className={styles.feature} key={feature.title}>
              <p className={styles.featureImg}>
                <svg className="icon icon-big">
                  <use xlinkHref={`#${feature.icon}`} />
                </svg>
              </p>
              <h3>{feature.title}</h3>
              <p className={styles.featureContent}>{feature.content}</p>
            </div>
          )
        })}
      </div>
      <div className={clsx(styles.featureShowCases, 'container')}>
        <div className={styles.featureShowCasesTilte}>
          <h2>Full Stack Web development framework.</h2>
        </div>
        <div className={styles.featureShowcase}>
          <div className={styles.featureShowcaseContent}>
            <h3>Conventional routing system</h3>
            <p>
              Files are routes, supporting nested layouts, dynamic paths, API
              and Middleware definitions.
            </p>
            <Link
              to="/docs/guides/routes"
              className={styles.featureShowcaseLink}
            >
              Read More
            </Link>
          </div>
          <FeatureShowcaseCode code={routeExampleCode} />
        </div>
        <div className={styles.featureShowcase}>
          <FeatureShowcaseCode code={loaderExampleCode} />
          <div className={styles.heroContent}>
            <h3>Isomorphism</h3>
            <p>Data automatic dehydration water injection.</p>
            <Link to="/docs/guides/Data%20Fetching" className={styles.heroLink}>
              Read More
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureShowcaseCode({ code }) {
  return (
    <Highlight {...defaultProps} theme={theme} code={code} language="jsx">
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={clsx(className, styles.featureShowcaseCode)}
          style={style}
        >
          {tokens.map((line, i) => (
            <div {...getLineProps({ line, key: i })} key={i.toString()}>
              {line.map((token, key) => (
                <span {...getTokenProps({ token, key })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  )
}

function Home() {
  return (
    <Layout
      permalink={'/'}
      description={'Set up a modern web app by running one command.'}
    >
      <HeroBanner />
      <Features />
    </Layout>
  )
}

export default Home
