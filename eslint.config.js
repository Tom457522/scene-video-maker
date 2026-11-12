import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/** 部品(src/parts/)では、フレームから決まらない動きや独自の色を禁止する */
const partRules = {
  'no-restricted-imports': [
    'error',
    {
      paths: [
        { name: 'remotion', message: '部品では remotion を直接使わず、src/kit の関数(progress / back / draw など)を使ってください。' },
        { name: '@remotion/player', message: '部品ではプレイヤーを使いません。' },
      ],
    },
  ],
  'no-restricted-globals': [
    'error',
    { name: 'setTimeout', message: 'タイマーは使えません。frame から見た目を決めてください。' },
    { name: 'setInterval', message: 'タイマーは使えません。frame から見た目を決めてください。' },
    { name: 'requestAnimationFrame', message: 'frame から見た目を決めてください。' },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: '乱数は同じフレームで同じ絵にならないので使えません。' },
    { object: 'Date', property: 'now', message: '時刻は使えません。frame から決めてください。' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'Property[key.name=/^(transition|animation|animationName)$/]',
      message: 'CSS の transition / animation は使えません。frame から見た目を決めてください。',
    },
    {
      selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
      message: '色は src/kit/theme.ts の colors / accent / alpha を使ってください。',
    },
    {
      selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
      message: '色は src/kit/theme.ts の colors / accent / alpha を使ってください。',
    },
    {
      selector: 'Literal[value=/(^|[^\\w])(rgba?|hsla?)\\(/]',
      message: '色は src/kit/theme.ts の colors / accent / alpha を使ってください。',
    },
    {
      selector: "NewExpression[callee.name='Date']",
      message: '時刻は使えません。frame から決めてください。',
    },
  ],
  'react-hooks/rules-of-hooks': 'off',
};

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'out', 'stills'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  { files: ['**/*.mjs'], languageOptions: { globals: globals.node } },
  { files: ['src/parts/**/*.{ts,tsx}'], rules: partRules },
);
