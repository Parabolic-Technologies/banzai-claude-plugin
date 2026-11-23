import js from '@eslint/js';

// The limits that `/banzai:setup` recommends to a project, as errors: a
// limit that only warns does not fail the check, and code grows past it.
// 500 lines is the size limit for a source or test file; the limits on a
// function are ESLint's default values.
export default [
  // Directories that Git ignores.
  { ignores: ['.probe/', '.claude/', '.banzai/', 'notes/'] },
  js.configs.recommended,
  {
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
    rules: {
      'max-lines': ['error', 500],
      complexity: ['error', 20],
      'max-lines-per-function': ['error', 50],
      // The hook passes over a failed read or write on purpose.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // It replaces control characters in the names it shows.
      'no-control-regex': 'off',
      // A test drops one property this way: const { seal, ...rest } = record.
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    // One test function often holds a whole suite.
    files: ['tests/**'],
    rules: { 'max-lines-per-function': 'off' },
  },
];
