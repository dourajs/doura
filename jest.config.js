module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  setupFilesAfterEnv: ['./scripts/setupJestEnv.ts'],
  verbose: true,
  forceExit: false,
  bail: false,
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        allowJs: true,
        target: 'es6',
        lib: ['dom', 'esnext'],
        module: 'esnext',
        moduleResolution: 'nodenext',
        skipLibCheck: true,
        esModuleInterop: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
      },
    },
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  rootDir: __dirname,
  testMatch: ['<rootDir>/packages/**/__tests__/**/*.test.[jt]s?(x)'],
}
