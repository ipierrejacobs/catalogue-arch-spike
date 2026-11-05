import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart({
			start: {
				entry: "./start.ts",
			},
			client: {
				entry: "./client.tsx",
			},
		}),
		viteReact(),
	],
})

export default config
