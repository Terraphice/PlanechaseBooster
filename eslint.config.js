// eslint.config.js
// Minimal ESLint configuration for Planar Atlas.
// Catches common bugs: unused variables, undefined references, no-var, etc.
// Run with: npx eslint .   (or: npm run lint after installing eslint)

import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        history: "readonly",
        location: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        requestAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        btoa: "readonly",
        atob: "readonly",
        prompt: "readonly",
        alert: "readonly",
        CSS: "readonly",
        MutationObserver: "readonly",
        IntersectionObserver: "readonly",
        HTMLElement: "readonly",
        Node: "readonly",
        Image: "readonly",
        DOMPurify: "readonly",
        marked: "readonly",
        // Node.js globals (for scripts/)
        process: "readonly",
        console: "readonly",
      },
    },
    rules: {
      // Catch likely bugs
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-constant-condition": "warn",
      "no-debugger": "warn",

      // Prefer modern JS
      "no-var": "error",
      "prefer-const": ["warn", { destructuring: "all" }],

      // Keep code consistent
      "eqeqeq": ["warn", "always", { null: "ignore" }],
    },
  },
  {
    files: ["sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        Response: "readonly",
      },
    },
  },
  {
    // Ignore generated/vendor files and node_modules
    ignores: [
      "node_modules/**",
      "cards/**",
      "images/**",
      "transcripts/**",
      "MSE/**",
    ],
  },
];
