import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

import base from "../../eslint.config.base.mjs";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...base,
  prettier,
);
