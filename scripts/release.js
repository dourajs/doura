// modified from https://github.com/vuejs/core/blob/8dcb6c7bbdd2905469e2bb11dfff27b58cc784b2/scripts/release.js

const args = require('minimist')(process.argv.slice(2))
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const semver = require('semver')
const currentVersion = require('../package.json').version
const { prompt } = require('enquirer')
const execa = require('execa')

const help = `
Usage: pnpm release [version] [options]

Options:
   help, --help, -h             Get Help
   <d+>.<d+>.<d+>[-<pre>.<d+>]  Specify the target version for the update. e.g. 0.0.1, 1.0.10-beta.11...
   --tag <value>                Publish to npm store with tag version. e.g. --tag beta, --tag alpha...
   --pre <value>                Pre release. e.g. alpha, beta...
   --dry                        Dry run (skip build / skip test / dryrun commit / dryrun publish)
   --skipTests                  Skip the tests
   --skipBuild                  Skip the build

Steps:
   Step 1                       Choose version (include patch / minor / major / custom and pre version)
   Step 2                       Update version include itself and dependency packages
   Step 3                       Generate / Update CHANGELOG.MD
   Step 4                       Clean all packages
   Step 5                       Install all packages and update pnpm-lockfile
   Step 6                       Build all packages
   Step 7                       Run test (unit test & e2e test)
   Step 8                       Commit changes
   Step 9                       Publish packages
   Step 10                      Push to github with tag
`

const pre =
  args.pre ||
  (semver.prerelease(currentVersion) && semver.prerelease(currentVersion)[0])
const isDryRun = args.dry
const skipTests = args.skipTests
const skipBuild = args.skipBuild

const ingoredPackages = []
const skippedPackages = []
const pkgDirs = ['../packages', '../packages/plugins']
let packages = []

for (const pkgDir of pkgDirs) {
  packages = packages.concat(
    fs
      .readdirSync(path.resolve(__dirname, pkgDir))
      .filter(
        (p) =>
          !ingoredPackages.includes(p) &&
          !p.endsWith('.ts') &&
          !p.startsWith('.')
      )
      .map((p) => path.join(__dirname, pkgDir, p))
  )
}
packages = packages.filter((p) => fs.existsSync(path.join(p, 'package.json')))

const isNeedHelp = args.help || args.h || args._[0] === 'help'
const versionIncrements = [
  'patch',
  'minor',
  'major',
  ...(pre ? ['prepatch', 'preminor', 'premajor', 'prerelease'] : []),
]

const inc = (i) => semver.inc(currentVersion, i, pre)
const bin = (name) => path.resolve(__dirname, '../node_modules/.bin/' + name)
const run = (bin, args, opts = {}) =>
  execa(bin, args, { stdio: 'inherit', ...opts })
const dryRun = (bin, args, opts = {}) =>
  console.log(chalk.blue(`[dryrun] ${bin} ${args.join(' ')}`), opts)
const runIfNotDry = isDryRun ? dryRun : run
const getPkgId = (pkg) => path.basename(pkg)
const step = (msg) => console.log(chalk.cyan(msg))

async function main() {
  let targetVersion = args._[0]

  if (isNeedHelp) {
    console.log(help)
    return
  }

  if (!targetVersion) {
    // no explicit version, offer suggestions
    const { release } = await prompt({
      type: 'select',
      name: 'release',
      message: 'Select release type',
      choices: versionIncrements
        .map((i) => `${i} (${inc(i)})`)
        .concat(['custom']),
    })

    if (release === 'custom') {
      targetVersion = (
        await prompt({
          type: 'input',
          name: 'version',
          message: 'Input custom version',
          initial: currentVersion,
        })
      ).version
    } else {
      targetVersion = release.match(/\((.*)\)/)[1]
    }
  }

  if (!semver.valid(targetVersion)) {
    throw new Error(`invalid target version: ${targetVersion}`)
  }

  const { yes } = await prompt({
    type: 'confirm',
    name: 'yes',
    message: `Releasing v${targetVersion}. Confirm?`,
  })

  if (!yes) {
    return
  }

  // update all package versions and inter-dependencies
  step('\nUpdating cross dependencies...')
  updateVersions(targetVersion)

  // generate changelog
  // step('\nGenerating changelog...');
  // await run(`pnpm`, ['changelog']);

  // clean all package
  step('\nClean all package...')
  await run(`pnpm`, ['clean'])

  // install all packages and update pnpm-lock.yaml
  step('\nUpdating lockfile...')
  await run(`pnpm`, ['install'])

  // build all packages with types
  step('\nBuilding all packages...')
  if (!skipBuild && !isDryRun) {
    await run('pnpm', ['build'])
  } else {
    console.log(`(skipped)`)
  }

  // run tests before release
  step('\nRunning tests...')
  if (!skipTests && !isDryRun) {
    await run(bin('jest'), ['--clearCache'])
    await run('pnpm', ['test', '--bail'])
  } else {
    console.log(`(skipped)`)
  }

  const { stdout } = await run('git', ['diff'], { stdio: 'pipe' })

  if (stdout) {
    step('\nCommitting changes...')
    await runIfNotDry('git', ['add', '-A'])
    await runIfNotDry('git', ['commit', '-m', `release: v${targetVersion}`])
  } else {
    console.log('No changes to commit.')
  }

  // publish packages
  step('\nPublishing packages...')
  for (const pkg of packages) {
    await publishPackage(pkg, targetVersion)
  }

  // push to GitHub
  step('\nPushing to GitHub...')
  await runIfNotDry('git', ['tag', `v${targetVersion}`])
  await runIfNotDry('git', ['push', 'origin', `refs/tags/v${targetVersion}`])
  await runIfNotDry('git', ['push'])

  if (isDryRun) {
    console.log(`\nDry run finished - run git diff to see package changes.`)
  }

  if (skippedPackages.length) {
    console.log(
      chalk.yellow(
        `The following packages are skipped and NOT published:\n- ${skippedPackages.join(
          '\n- '
        )}`
      )
    )
  }
  console.log()
}

function updateVersions(version) {
  // 1. update root package.json
  updatePackage(path.resolve(__dirname, '..'), version)
  // 2. update all packages
  packages.forEach((p) => updatePackage(p, version))
}

function updatePackage(pkgRoot, version) {
  if (!fs.existsSync(path.join(pkgRoot, 'package.json'))) {
    return
  }
  pkgPath = path.resolve(pkgRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.version = version
  updateDeps(pkg, 'dependencies', version)
  updateDeps(pkg, 'peerDependencies', version)
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

function updateDeps(pkg, depType, version) {
  const deps = pkg[depType]
  if (!deps) return
  Object.keys(deps).forEach((dep) => {
    if (dep === 'doura' || dep.startsWith('doura-')) {
      console.log(
        chalk.yellow(`${pkg.name} -> ${depType} -> ${dep}@${version}`)
      )
      deps[dep] = version
    }
  })
}

async function publishPackage(pkgRoot, version) {
  const pkgId = getPkgId(pkgRoot)

  if (skippedPackages.includes(pkgId)) {
    return
  }

  const pkgPath = path.resolve(pkgRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  if (pkg.private) {
    return
  }

  const pkgName = pkg.name
  let releaseTag = null
  if (args.tag) {
    releaseTag = args.tag
  } else if (version.includes('alpha')) {
    releaseTag = 'alpha'
  } else if (version.includes('beta')) {
    releaseTag = 'beta'
  } else if (version.includes('rc')) {
    releaseTag = 'rc'
  }

  step(`Publishing ${pkgName}...`)
  try {
    // note: use of yarn is intentional here as we rely on its publishing
    // behavior.
    await runIfNotDry(
      'yarn',
      [
        'publish',
        '--new-version',
        version,
        ...(releaseTag ? ['--tag', releaseTag] : []),
        '--access',
        'public',
      ],
      {
        cwd: pkgRoot,
        stdio: 'pipe',
      }
    )
    console.log(chalk.green(`Successfully published ${pkgName}@${version}`))
  } catch (e) {
    if (e.stderr && e.stderr.match(/previously published/)) {
      console.log(chalk.red(`Skipping already published: ${pkgName}`))
    } else {
      throw e
    }
  }
}

main().catch((err) => {
  updateVersions(currentVersion)
  console.error(err)
})
