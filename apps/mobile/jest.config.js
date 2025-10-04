const path = require('path');

const sharedRoot = path.resolve(__dirname, '../../packages/shared');
const uuidModulePath = path.dirname(
  require.resolve('uuid/package.json', { paths: [sharedRoot] }),
);

module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(((jest-)?react-native|@react-navigation)(?:[-/].*)?|@react-native(?:[-/].*)?)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  watchman: false,
  moduleFileExtensions: [
    'native.ts',
    'native.tsx',
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node',
  ],
  moduleNameMapper: {
    '^@yui/shared/platform/clientInfo$': '<rootDir>/../../packages/shared/src/platform/clientInfo.native.ts',
    '^@yui/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@yui/shared/(?!platform/clientInfo$)(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^uuid$': path.join(uuidModulePath, 'dist/cjs/index.js'),
  },
};
