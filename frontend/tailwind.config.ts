import type { Config } from "tailwindcss";
export default { content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { brand: { DEFAULT: "#6045d8", dark: "#4c35bb" }, navy: "#182342" } } }, plugins: [] } satisfies Config;
