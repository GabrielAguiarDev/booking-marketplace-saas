import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

import base from "../../eslint.config.base.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  ...base,
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
  prettier,
]);
