import React from 'react'
import clsx from 'clsx'
import Layout from '@theme/Layout'
import Link from '@docusaurus/Link'
import Translate, { translate } from '@docusaurus/Translate'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import styles from './styles.module.css'

function HeroBanner() {
  const context = useDocusaurusContext()
  const {
    siteConfig: { baseUrl },
    tagline,
  } = context

  return (
    <div className={clsx('container', styles.hero)}>
      <div className={clsx('text--center', styles.heroInner)}>
        <h1 className={styles.heroTitleWrapper}>
          <span className={styles.heroTitle}>Doura</span>
          <span className={styles.gitHubButtonWrapper}>
            <iframe
              className={styles.gitHubButton}
              src="https://ghbtns.com/github-btn.html?user=dourajs&amp;repo=doura&amp;type=star&amp;count=true&amp;size=large"
              width={160}
              height={30}
              title="GitHub Stars"
            />
          </span>
        </h1>
        <p className={styles.heroTagline}>{tagline}</p>
        <div className={clsx(styles.indexCtas)}>
          <Link className="button button--primary" to="/docs">
            <Translate>Get Started</Translate>
          </Link>
          <Link
            className="button button--outline"
            to={`${baseUrl}docs/playground`}
          >
            <Translate>Try a Demo</Translate>
          </Link>
        </div>
      </div>
    </div>
  )
}

function Features() {
  const features = [
    [
      {
        title: '💡 Intuitive',
        content: 'API designed to let you write well organized stores.',
      },
      {
        title: '⚛️ Reactive',
        content:
          'Bring the reactivity of Vue into React. State management can never be so simple and intuitive.',
      },
      {
        title: '🔑 Type Safe',
        content:
          'Types are inferred, which means stores provide you with autocompletion even in JavaScript!',
      },
    ],
    [
      {
        title: '⚙️ Devtools support',
        content:
          'Doura hooks into Redux devtools to give you an enhanced development experience.',
      },
      {
        title: '🔌 Extensible',
        content:
          'A flexiable plugin mechanism that makes it easy to extend Doura.',
      },
      {
        title: '🏗 Modular by design',
        content:
          'Build multiple stores and let your bundler code split them automatically.',
      },
    ],
  ]

  return (
    <div className={clsx('container', styles.features)}>
      {features.map((rows, index) => {
        return (
          <div className={clsx('row', index === 0 && 'margin-bottom--lg')}>
            {rows.map((feature) => {
              return (
                <div
                  className={clsx(
                    'col',
                    'col--4',
                    styles.feature,
                    feature.className
                  )}
                  key={feature.title}
                >
                  <h3>{feature.title}</h3>
                  <p className={styles.featureContent}>{feature.content}</p>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function Home() {
  const context = useDocusaurusContext()
  const { tagline } = context

  return (
    <Layout permalink={'/'} description={tagline}>
      <HeroBanner />
      <Features />
    </Layout>
  )
}

export default Home
