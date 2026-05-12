# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm workspace for Doura packages and documentation. Source lives in
`packages/*/src`, with primary packages in `packages/doura`,
`packages/react-doura`, `packages/doura-plugin-persist`, and
`packages/doura-plugin-log`. Unit tests live beside packages in
`packages/**/__tests__`; public API type tests live in `test-dts/` and package
type fixtures such as `packages/react-doura/test-dts/`. Examples are in
`examples/*`, docs source is split between `docs/` and the Docusaurus app in
`doc-sites/`, and build/release automation is in `scripts/`.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies; the repo enforces pnpm.
- `pnpm build`: build all publishable packages with Rollup.
- `pnpm build doura --types`: build a matching package and roll up `.d.ts`
  files; package names are fuzzy-matched by `scripts/build.js`.
- `pnpm test`: run Jest unit tests and TypeScript declaration tests.
- `pnpm test-unit packages/react-doura/__tests__/useModel.test.tsx`: run a
  focused Jest test file.
- `pnpm test-dts`: run API/type assertions from `test-dts/`.
- `pnpm doc` / `pnpm doc:build`: run or build the Docusaurus documentation.

## Coding Style & Naming Conventions

Use TypeScript for package source and React bindings. Prettier is configured for
2-space indentation, 80-column wrapping, single quotes, trailing commas where
valid in ES5, and no semicolons. ESLint extends recommended TypeScript rules and
allows leading-underscore unused arguments. Prefer existing file patterns:
camelCase functions and variables, PascalCase React components, and
`*.test.ts`/`*.test.tsx` test files.

## Testing Guidelines

Jest uses `ts-jest` with the `jsdom` environment and only discovers tests under
`packages/**/__tests__/**/*.test.[jt]s?(x)`. Add regression tests near the
package being changed. For public API or inference changes, add or update
`test-dts/*.test-d.ts` or `*.test-d.tsx` coverage and run `pnpm test-dts`.

## Commit & Pull Request Guidelines

Commits follow Conventional Commits enforced by commitlint. Valid types include
`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`, `style`,
`release`, and `revert`; scopes such as `doura`, `react-doura`, `query`, or
`examples` match the existing history. Examples: `fix(query): reduce render
work` or `refactor(doura): simplify query infrastructure`.

Pull requests should describe the behavioral change, list tests run, link any
related issue, and include screenshots only for docs or example UI changes. Keep
generated `dist/` changes out of ordinary feature PRs unless preparing a
release.

## Agent-Specific Instructions

Keep edits scoped to the relevant package, preserve workspace references such as
`workspace:*`, and prefer existing helpers in `scripts/` before adding new
tooling.
