import js from "@eslint/js";
import prettier from "eslint-config-prettier";
// O pacote tem hooks (`useAsync`, `createSessionContext`) e não herda config de
// framework como os apps herdam do Expo. Sem registrar o plugin aqui, a
// diretiva `eslint-disable` de `exhaustive-deps` em `async.ts` vira erro de
// "regra não encontrada".
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

import base from "../../eslint.config.base.mjs";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat["recommended-latest"],
  ...base,
  prettier,
);
