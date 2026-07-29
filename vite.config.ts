import { defineConfig } from 'vite';

// GitHub Pages serves project sites below /<repository>/ rather than /.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Molewave/' : '/',
});
