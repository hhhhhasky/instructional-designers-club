/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HomeInitialHero from './src/components/home/HomeInitialHero';
import { loadPublishedHomeContent } from './scripts/load-published-home-content';

import { miaodaDevPlugin } from "miaoda-sc-plugin";

// https://vite.dev/config/
export default defineConfig(async ({ command, mode }) => {
  const publishHome = command === 'build' && (
    process.env.CF_PAGES === '1' || process.env.HOME_CONTENT_BUILD === '1'
  );
  const homeContent = publishHome
    ? await loadPublishedHomeContent(loadEnv(mode, process.cwd(), 'VITE_SUPABASE_'))
    : null;

  return {
    define: { __PUBLISHED_HOME_CONTENT__: JSON.stringify(homeContent) },
    plugins: [react(), {
      name: 'home-initial-hero',
      transformIndexHtml(html) {
        if (!homeContent) return html;
        const hero = renderToStaticMarkup(createElement(HomeInitialHero, { hero: homeContent.landing.home_hero }));
        return html.replace('<!-- home-initial-hero -->', () => hero);
      },
    }, svgr({
        svgrOptions: {
          icon: true, exportType: 'named', namedExport: 'ReactComponent', }, }), miaodaDevPlugin()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (
              id.includes("/@supabase/") ||
              id.includes("/miaoda-auth-react/")
            ) {
              return "vendor-auth";
            }
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/react-router/") ||
              id.includes("/react-router-dom/") ||
              id.includes("/scheduler/")
            ) {
              return "vendor-react";
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      include: ['src/test/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    },
  };
});
