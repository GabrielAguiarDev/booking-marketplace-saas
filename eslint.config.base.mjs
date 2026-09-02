/**
 * Regras compartilhadas pelos cinco apps e pelo pacote.
 *
 * Este arquivo NÃO registra o plugin `@typescript-eslint` de propósito:
 * `eslint-config-next` e `eslint-config-expo` já o registram, e o flat config
 * do ESLint 9 rejeita a segunda definição com
 * `Cannot redefine plugin "@typescript-eslint"`.
 *
 * Quem não tem config de framework (packages/supabase) registra o plugin por
 * conta própria antes de concatenar estas regras.
 */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.expo/**",
      "**/.turbo/**",
      "**/database.types.ts",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
