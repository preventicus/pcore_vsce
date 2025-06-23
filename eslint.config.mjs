import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
        },
        plugins: {
            "@typescript-eslint": tseslint.plugin,
        },
        rules: {
            "indent": ["error", 2, { "SwitchCase": 2 }],
            "linebreak-style": ["error", "unix"],
            "quotes": ["error", "double"],
            "semi": ["error", "never"],
            "no-console": "warn",
            "eqeqeq": "error",
            "space-before-function-paren": ["error", "never"],
            "object-curly-spacing": ["error", "always"],
            "@typescript-eslint/no-extraneous-class": "off",
            "comma-spacing": ["error", { "before": false, "after": true }],
            "arrow-parens": ["error", "as-needed"],
            "space-in-parens": ["error", "never"],
            "space-infix-ops": "error",
            "space-before-blocks": ["error", "always"],
            "array-bracket-spacing": ["error", "never"],
            "computed-property-spacing": ["error", "never"],
            "no-multi-spaces": "error",
            "no-trailing-spaces": "error",
            "no-whitespace-before-property": "error",
            "no-multiple-empty-lines": ["error", { "max": 1, "maxEOF": 1, "maxBOF": 0 }],
            "no-empty": ["error", { "allowEmptyCatch": false }],
            "padded-blocks": ["error", "never"],
            "@typescript-eslint/no-unused-vars": [ "error", {"argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_"}]
        },
    },
    {
        ignores: ["dist/", "node_modules/", "**/*.spec.js"],
    },
];
