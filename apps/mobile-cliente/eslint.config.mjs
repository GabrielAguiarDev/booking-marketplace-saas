import expoConfig from "eslint-config-expo/flat.js";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

import base from "../../eslint.config.base.mjs";

export default defineConfig([expoConfig, ...base, { ignores: ["dist/*", ".expo/*"] }, prettier]);
