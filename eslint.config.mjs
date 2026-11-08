import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

const config = [
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
  ...new FlatCompat({ baseDirectory: import.meta.dirname }).extends("next/core-web-vitals", "next/typescript"),
];

export default config;
