module.exports = {
  testEnvironment: 'jsdom',
  testTimeout: 30000,
  setupFiles: ['./src/test/jest-globals.js'],
  setupFilesAfterEnv: ['./src/test/setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|eot|ttf|otf)$':
      '<rootDir>/src/test/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/test/**',
    '!src/main.jsx',
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
