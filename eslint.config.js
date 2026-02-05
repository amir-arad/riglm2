import globals from "globals";
import js from "@eslint/js";
import noComments from "eslint-plugin-no-comments";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

// WHY: noComments plugin is outdated, missing schema
noComments.rules.disallowComments.meta.schema = [
  {
    type: "object",
    properties: {
      allow: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    additionalProperties: false,
  },
];

export default [
  {
    ignores: ["dist/", "node_modules/", "**/*.js"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        Bun: "readonly",
        NodeJS: "readonly",
      },
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "no-comments": {
        ...noComments,
        rules: {
          ...noComments.rules,
          disallowComments: {
            ...noComments.rules.disallowComments,
          },
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "off",
      "no-fallthrough": "off",
      "no-comments/disallowComments": [
        "error",
        {
          allow: ["eslint", "jsdoc", "@ts-", "@type", "TODO", "WHY"],
        },
      ],
    },
  },
];
