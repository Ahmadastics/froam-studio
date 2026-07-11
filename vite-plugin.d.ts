import type { Plugin } from 'vite'

export type FroamStudioPluginOptions = {
  /** Where froam files live, relative to the Vite project root. Default: 'src/froam'. */
  dir?: string
}

export default function froamStudio(options?: FroamStudioPluginOptions): Plugin
