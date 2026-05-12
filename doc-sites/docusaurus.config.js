// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github')
const darkCodeTheme = require('prism-react-renderer/themes/dracula')

const baseURL = '/doura'
const allDocHomesPaths = ['/docs/']

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Doura',
  tagline:
    "The simple, intuitive and reactive state manager you've been waiting for.",
  projectName: 'doura', // Usually your repo name.
  organizationName: 'dourajs', // Usually your GitHub org/user name.
  url: 'https://dourajs.github.io/',
  baseUrl: baseURL,
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  // scripts: [`${baseURL}iconfont.js`],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-CN'],
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl: 'https://github.com/dourajs/doura/tree/main/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        gtag: {
          trackingID: 'G-Z7JW9V41VF',
          anonymizeIP: true,
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // image: 'img/logo-og.png',
      // sidebarCollapsible: false,
      navbar: {
        title: 'Doura',
        // logo: {
        //   alt: 'Doura',
        //   src: 'img/logo.svg',
        // },
        items: [
          {
            type: 'doc',
            docId: 'introduction',
            position: 'right',
            label: 'Docs',
          },
          {
            label: 'API',
            position: 'right',
            to: 'docs/api',
          },
          {
            href: 'https://github.com/dourajs/doura',
            position: 'right',
            className: 'header-github-link',
            'aria-label': 'GitHub repository',
          },
        ],
      },
      footer: {
        copyright: `Copyright © ${new Date().getFullYear()} Dourajs`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),

  plugins: [
    function rawMarkdownPlugin() {
      return {
        name: 'raw-markdown',
        async postBuild({ outDir }) {
          const fs = require('fs/promises')
          const path = require('path')
          const docsDir = path.join(__dirname, 'docs')

          async function copyMd(dir, rel) {
            const entries = await fs.readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
              const srcPath = path.join(dir, entry.name)
              const relPath = path.join(rel, entry.name)
              if (entry.isDirectory()) {
                await copyMd(srcPath, relPath)
              } else if (
                entry.name.endsWith('.md') ||
                entry.name.endsWith('.mdx')
              ) {
                const destPath = path.join(outDir, 'docs', relPath)
                await fs.mkdir(path.dirname(destPath), { recursive: true })
                await fs.copyFile(srcPath, destPath)
              }
            }
          }

          await copyMd(docsDir, '')
        },
      }
    },
    [
      'client-redirects',
      /** @type {import('@docusaurus/plugin-client-redirects').Options} */
      ({
        fromExtensions: ['html'],
        createRedirects(routePath) {
          // Redirect to /docs from /docs/introduction, as introduction has been
          // made the home doc
          if (allDocHomesPaths.includes(routePath)) {
            return [`${routePath}/introduction`]
          }
          return []
        },
        redirects: [],
      }),
    ],
  ],
}

module.exports = config
