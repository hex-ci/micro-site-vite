module.exports = {
  extends: [
    'stylelint-config-recommended-scss',
    'stylelint-config-rational-order'
  ],
  ignoreFiles: ['**/*.{js,cjs,ts,tsx,svg,md}', 'node_modules/.*/**', 'dist/**', 'LICENSE'],
  overrides: [
    {
      files: ['**/*.{vue,html}'],
      customSyntax: 'postcss-html'
    }
  ],
  rules: {
    'scss/at-rule-no-unknown': [
      true,
      {
        'ignoreAtRules': ['use']
      }
    ],
    'block-opening-brace-space-before': 'always',
    'no-empty-source': null,
    'no-descending-specificity': null,
    'rule-empty-line-before': [
      'always-multi-line',
      {
        'except': [
          'first-nested'
        ],
        'ignore': [
          'after-comment'
        ]
      }
    ],
    'at-rule-empty-line-before': [
      'always',
      {
        'except': [
          'blockless-after-same-name-blockless',
          'first-nested'
        ],
        'ignore': [
          'after-comment',
          'inside-block'
        ]
      }
    ],
    'selector-list-comma-newline-after': 'always',
    'declaration-colon-space-before': 'never',
    'declaration-colon-space-after': 'always-single-line',
    'no-eol-whitespace': true,
    'declaration-block-trailing-semicolon': 'always',
    'indentation': 2,
    'declaration-block-semicolon-space-before': 'never',
    'function-comma-space-after': 'always-single-line',
    'declaration-block-single-line-max-declarations': 0,
    'declaration-block-semicolon-newline-after': 'always-multi-line',
    'block-closing-brace-newline-before': 'always-multi-line',
    'color-hex-case': 'lower',
    'selector-combinator-space-after': 'always',
    'selector-combinator-space-before': 'always',
    'at-rule-name-space-after': 'always-single-line',
    'length-zero-no-unit': true,
    'font-family-no-missing-generic-family-keyword': null,
    'selector-pseudo-element-no-unknown': [
      true,
      {
        ignorePseudoElements: ['v-deep']
      }
    ],
    'color-hex-length': 'short'
  }
}
