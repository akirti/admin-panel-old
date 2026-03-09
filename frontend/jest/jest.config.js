module.exports = {
  rootDir: '..',
  testEnvironment: 'jsdom',
  testTimeout: 30000,
  setupFiles: ['./jest/jest-globals.js'],
  setupFilesAfterEnv: ['./jest/setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|eot|ttf|otf)$':
      '<rootDir>/jest/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/config/env.js',
    '!src/envConfig/**',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 82,
      branches: 82,
      functions: 82,
      lines: 82,
    },
  },
};
