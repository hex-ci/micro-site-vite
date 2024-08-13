import orderOptions from './utils/stylelint-order-options/index.js';

export default {
  plugins: [
    'stylelint-order',
    '@stylistic/stylelint-plugin',
  ],
  extends: [
    'stylelint-config-recommended-scss',
    '@stylistic/stylelint-config',
  ],
  ignoreFiles: ['**/*.{js,cjs,mjs,ts,tsx,svg,md,xml,txt}', 'dist/**', '.*', 'node_modules/.*/**'],
  overrides: [
    {
      files: ['**/*.{vue,html}'],
      customSyntax: 'postcss-html',
    },
  ],
  rules: {
    'scss/at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['use', 'screen'],
      },
    ],
    'scss/operator-no-unspaced': null,

    'no-empty-source': null,
    'no-descending-specificity': null,
    'rule-empty-line-before': [
      'always-multi-line',
      {
        except: [
          'first-nested',
        ],
        ignore: [
          'after-comment',
        ],
      },
    ],
    'at-rule-empty-line-before': [
      'always',
      {
        except: [
          'blockless-after-same-name-blockless',
          'first-nested',
        ],
        ignore: [
          'after-comment',
          'inside-block',
        ],
      },
    ],
    'declaration-block-single-line-max-declarations': 0,
    'length-zero-no-unit': true,
    'font-family-no-missing-generic-family-keyword': null,
    'selector-pseudo-element-no-unknown': [
      true,
      {
        ignorePseudoElements: ['v-deep'],
      },
    ],
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['deep'],
      },
    ],
    'color-hex-length': 'short',

    'order/properties-order': orderOptions,

    '@stylistic/block-opening-brace-space-before': 'always',
    '@stylistic/selector-list-comma-newline-after': 'always',
    '@stylistic/declaration-colon-space-before': 'never',
    '@stylistic/declaration-colon-space-after': 'always-single-line',
    '@stylistic/no-eol-whitespace': true,
    '@stylistic/declaration-block-trailing-semicolon': 'always',
    '@stylistic/indentation': 2,
    '@stylistic/declaration-block-semicolon-space-before': 'never',
    '@stylistic/function-comma-space-after': 'always-single-line',
    '@stylistic/declaration-block-semicolon-newline-after': 'always-multi-line',
    '@stylistic/block-closing-brace-newline-before': 'always-multi-line',
    '@stylistic/color-hex-case': 'lower',
    '@stylistic/selector-combinator-space-after': 'always',
    '@stylistic/selector-combinator-space-before': 'always',
    '@stylistic/at-rule-name-space-after': 'always-single-line',
    '@stylistic/max-line-length': null,
  },
}
