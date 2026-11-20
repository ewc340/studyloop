import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Core module boundary: everything outside src/core goes through its public interface.
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: ["src/core/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(@/core|(\\./|\\.\\./)+(src/)?core)/.+",
              message: "Import from the core's public interface (@/core) instead of its internals.",
            },
          ],
        },
      ],
    },
  },
  // Core stays framework-free and never depends on the UI or its adapters.
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: "^(next|react|react-dom)(/.*)?$", message: "src/core must not depend on Next.js or React." },
            { regex: "^@/(app|server)(/.*)?$", message: "src/core must not depend on UI code or adapters." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
