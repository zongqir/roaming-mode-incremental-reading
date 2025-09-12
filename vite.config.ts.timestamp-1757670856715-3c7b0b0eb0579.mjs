// vite.config.ts
import { resolve } from "path";
import { defineConfig } from "file:///C:/Users/User/IdeaProjects/roaming-mode-incremental-reading/node_modules/.pnpm/vite@5.4.11_@types+node@22.10.0_stylus@0.61.0/node_modules/vite/dist/node/index.js";
import minimist from "file:///C:/Users/User/IdeaProjects/roaming-mode-incremental-reading/node_modules/.pnpm/minimist@1.2.8/node_modules/minimist/index.js";
import { viteStaticCopy } from "file:///C:/Users/User/IdeaProjects/roaming-mode-incremental-reading/node_modules/.pnpm/vite-plugin-static-copy@0.16.0_vite@5.4.11_@types+node@22.10.0_stylus@0.61.0_/node_modules/vite-plugin-static-copy/dist/index.js";
import livereload from "file:///C:/Users/User/IdeaProjects/roaming-mode-incremental-reading/node_modules/.pnpm/rollup-plugin-livereload@2.0.5/node_modules/rollup-plugin-livereload/dist/index.cjs.js";
import { svelte } from "file:///C:/Users/User/IdeaProjects/roaming-mode-incremental-reading/node_modules/.pnpm/@sveltejs+vite-plugin-svelte@2.5.3_svelte@4.2.19_vite@5.4.11_@types+node@22.10.0_stylus@0.61.0_/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
import fg from "file:///C:/Users/User/IdeaProjects/roaming-mode-incremental-reading/node_modules/.pnpm/fast-glob@3.3.2/node_modules/fast-glob/out/index.js";
var __vite_injected_original_dirname = "C:\\Users\\User\\IdeaProjects\\roaming-mode-incremental-reading";
var args = minimist(process.argv.slice(2));
var isWatch = args.watch || args.w || false;
var distDir = "./dist";
console.log("isWatch=>", isWatch);
console.log("distDir=>", distDir);
var vite_config_default = defineConfig({
  plugins: [
    svelte(),
    viteStaticCopy({
      targets: [
        {
          src: "./README*.md",
          dest: "./"
        },
        {
          src: "./LICENSE",
          dest: "./"
        },
        {
          src: "./icon.png",
          dest: "./"
        },
        {
          src: "./preview.png",
          dest: "./"
        },
        {
          src: "./plugin.json",
          dest: "./"
        },
        {
          src: "./src/i18n/**",
          dest: "./i18n/"
        }
      ]
    })
  ],
  // https://github.com/vitejs/vite/issues/1930
  // https://vitejs.dev/guide/env-and-mode.html#env-files
  // https://github.com/vitejs/vite/discussions/3058#discussioncomment-2115319
  // 在这里自定义变量
  define: {
    "process.env.NODE_ENV": isWatch ? `"development"` : `"production"`,
    "process.env.DEV_MODE": `"${isWatch}"`
  },
  build: {
    // 输出路径
    outDir: distDir,
    emptyOutDir: false,
    // 构建后是否生成 source map 文件
    sourcemap: false,
    // 设置为 false 可以禁用最小化混淆
    // 或是用来指定是应用哪种混淆器
    // boolean | 'terser' | 'esbuild'
    // 不压缩，用于调试
    minify: !isWatch,
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__vite_injected_original_dirname, "src/index.ts"),
      // the proper extensions will be added
      fileName: "index",
      formats: ["cjs"]
    },
    rollupOptions: {
      plugins: [
        ...isWatch ? [
          livereload(distDir),
          {
            //监听静态资源文件
            name: "watch-external",
            async buildStart() {
              const files = await fg(["src/i18n/*.json", "./README*.md", "./plugin.json"]);
              for (const file of files) {
                this.addWatchFile(file);
              }
            }
          }
        ] : []
      ],
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ["siyuan"],
      output: {
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") {
            return "index.css";
          }
          return assetInfo.name;
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVc2VyXFxcXElkZWFQcm9qZWN0c1xcXFxyb2FtaW5nLW1vZGUtaW5jcmVtZW50YWwtcmVhZGluZ1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcVXNlclxcXFxJZGVhUHJvamVjdHNcXFxccm9hbWluZy1tb2RlLWluY3JlbWVudGFsLXJlYWRpbmdcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL1VzZXIvSWRlYVByb2plY3RzL3JvYW1pbmctbW9kZS1pbmNyZW1lbnRhbC1yZWFkaW5nL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gXCJwYXRoXCJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCJcbmltcG9ydCBtaW5pbWlzdCBmcm9tIFwibWluaW1pc3RcIlxuaW1wb3J0IHsgdml0ZVN0YXRpY0NvcHkgfSBmcm9tIFwidml0ZS1wbHVnaW4tc3RhdGljLWNvcHlcIlxuaW1wb3J0IGxpdmVyZWxvYWQgZnJvbSBcInJvbGx1cC1wbHVnaW4tbGl2ZXJlbG9hZFwiXG5pbXBvcnQgeyBzdmVsdGUgfSBmcm9tIFwiQHN2ZWx0ZWpzL3ZpdGUtcGx1Z2luLXN2ZWx0ZVwiXG5pbXBvcnQgZmcgZnJvbSBcImZhc3QtZ2xvYlwiXG5cbmNvbnN0IGFyZ3MgPSBtaW5pbWlzdChwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpXG5jb25zdCBpc1dhdGNoID0gYXJncy53YXRjaCB8fCBhcmdzLncgfHwgZmFsc2VcbmNvbnN0IGRpc3REaXIgPSBcIi4vZGlzdFwiXG5cbmNvbnNvbGUubG9nKFwiaXNXYXRjaD0+XCIsIGlzV2F0Y2gpXG5jb25zb2xlLmxvZyhcImRpc3REaXI9PlwiLCBkaXN0RGlyKVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgc3ZlbHRlKCksXG5cbiAgICB2aXRlU3RhdGljQ29weSh7XG4gICAgICB0YXJnZXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6IFwiLi9SRUFETUUqLm1kXCIsXG4gICAgICAgICAgZGVzdDogXCIuL1wiLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiBcIi4vTElDRU5TRVwiLFxuICAgICAgICAgIGRlc3Q6IFwiLi9cIixcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHNyYzogXCIuL2ljb24ucG5nXCIsXG4gICAgICAgICAgZGVzdDogXCIuL1wiLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiBcIi4vcHJldmlldy5wbmdcIixcbiAgICAgICAgICBkZXN0OiBcIi4vXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6IFwiLi9wbHVnaW4uanNvblwiLFxuICAgICAgICAgIGRlc3Q6IFwiLi9cIixcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHNyYzogXCIuL3NyYy9pMThuLyoqXCIsXG4gICAgICAgICAgZGVzdDogXCIuL2kxOG4vXCIsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pLFxuICBdLFxuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS92aXRlanMvdml0ZS9pc3N1ZXMvMTkzMFxuICAvLyBodHRwczovL3ZpdGVqcy5kZXYvZ3VpZGUvZW52LWFuZC1tb2RlLmh0bWwjZW52LWZpbGVzXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS92aXRlanMvdml0ZS9kaXNjdXNzaW9ucy8zMDU4I2Rpc2N1c3Npb25jb21tZW50LTIxMTUzMTlcbiAgLy8gXHU1NzI4XHU4RkQ5XHU5MUNDXHU4MUVBXHU1QjlBXHU0RTQ5XHU1M0Q4XHU5MUNGXG4gIGRlZmluZToge1xuICAgIFwicHJvY2Vzcy5lbnYuTk9ERV9FTlZcIjogaXNXYXRjaCA/IGBcImRldmVsb3BtZW50XCJgIDogYFwicHJvZHVjdGlvblwiYCxcbiAgICBcInByb2Nlc3MuZW52LkRFVl9NT0RFXCI6IGBcIiR7aXNXYXRjaH1cImAsXG4gIH0sXG5cbiAgYnVpbGQ6IHtcbiAgICAvLyBcdThGOTNcdTUxRkFcdThERUZcdTVGODRcbiAgICBvdXREaXI6IGRpc3REaXIsXG4gICAgZW1wdHlPdXREaXI6IGZhbHNlLFxuXG4gICAgLy8gXHU2Nzg0XHU1RUZBXHU1NDBFXHU2NjJGXHU1NDI2XHU3NTFGXHU2MjEwIHNvdXJjZSBtYXAgXHU2NTg3XHU0RUY2XG4gICAgc291cmNlbWFwOiBmYWxzZSxcblxuICAgIC8vIFx1OEJCRVx1N0Y2RVx1NEUzQSBmYWxzZSBcdTUzRUZcdTRFRTVcdTc5ODFcdTc1MjhcdTY3MDBcdTVDMEZcdTUzMTZcdTZERjdcdTZEQzZcbiAgICAvLyBcdTYyMTZcdTY2MkZcdTc1MjhcdTY3NjVcdTYzMDdcdTVCOUFcdTY2MkZcdTVFOTRcdTc1MjhcdTU0RUFcdTc5Q0RcdTZERjdcdTZEQzZcdTU2NjhcbiAgICAvLyBib29sZWFuIHwgJ3RlcnNlcicgfCAnZXNidWlsZCdcbiAgICAvLyBcdTRFMERcdTUzOEJcdTdGMjlcdUZGMENcdTc1MjhcdTRFOEVcdThDMDNcdThCRDVcbiAgICBtaW5pZnk6ICFpc1dhdGNoLFxuXG4gICAgbGliOiB7XG4gICAgICAvLyBDb3VsZCBhbHNvIGJlIGEgZGljdGlvbmFyeSBvciBhcnJheSBvZiBtdWx0aXBsZSBlbnRyeSBwb2ludHNcbiAgICAgIGVudHJ5OiByZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvaW5kZXgudHNcIiksXG4gICAgICAvLyB0aGUgcHJvcGVyIGV4dGVuc2lvbnMgd2lsbCBiZSBhZGRlZFxuICAgICAgZmlsZU5hbWU6IFwiaW5kZXhcIixcbiAgICAgIGZvcm1hdHM6IFtcImNqc1wiXSxcbiAgICB9LFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgLi4uKGlzV2F0Y2hcbiAgICAgICAgICA/IFtcbiAgICAgICAgICAgICAgbGl2ZXJlbG9hZChkaXN0RGlyKSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vXHU3NkQxXHU1NDJDXHU5NzU5XHU2MDAxXHU4RDQ0XHU2RTkwXHU2NTg3XHU0RUY2XG4gICAgICAgICAgICAgICAgbmFtZTogXCJ3YXRjaC1leHRlcm5hbFwiLFxuICAgICAgICAgICAgICAgIGFzeW5jIGJ1aWxkU3RhcnQoKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGF3YWl0IGZnKFtcInNyYy9pMThuLyouanNvblwiLCBcIi4vUkVBRE1FKi5tZFwiLCBcIi4vcGx1Z2luLmpzb25cIl0pXG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRXYXRjaEZpbGUoZmlsZSlcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXVxuICAgICAgICAgIDogW10pLFxuICAgICAgXSxcblxuICAgICAgLy8gbWFrZSBzdXJlIHRvIGV4dGVybmFsaXplIGRlcHMgdGhhdCBzaG91bGRuJ3QgYmUgYnVuZGxlZFxuICAgICAgLy8gaW50byB5b3VyIGxpYnJhcnlcbiAgICAgIGV4dGVybmFsOiBbXCJzaXl1YW5cIl0sXG5cbiAgICAgIG91dHB1dDoge1xuICAgICAgICBlbnRyeUZpbGVOYW1lczogXCJbbmFtZV0uanNcIixcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6IChhc3NldEluZm8pID0+IHtcbiAgICAgICAgICBpZiAoYXNzZXRJbmZvLm5hbWUgPT09IFwic3R5bGUuY3NzXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBcImluZGV4LmNzc1wiXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBhc3NldEluZm8ubmFtZVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNlcsU0FBUyxlQUFlO0FBQ3JZLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sY0FBYztBQUNyQixTQUFTLHNCQUFzQjtBQUMvQixPQUFPLGdCQUFnQjtBQUN2QixTQUFTLGNBQWM7QUFDdkIsT0FBTyxRQUFRO0FBTmYsSUFBTSxtQ0FBbUM7QUFRekMsSUFBTSxPQUFPLFNBQVMsUUFBUSxLQUFLLE1BQU0sQ0FBQyxDQUFDO0FBQzNDLElBQU0sVUFBVSxLQUFLLFNBQVMsS0FBSyxLQUFLO0FBQ3hDLElBQU0sVUFBVTtBQUVoQixRQUFRLElBQUksYUFBYSxPQUFPO0FBQ2hDLFFBQVEsSUFBSSxhQUFhLE9BQU87QUFFaEMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLElBRVAsZUFBZTtBQUFBLE1BQ2IsU0FBUztBQUFBLFFBQ1A7QUFBQSxVQUNFLEtBQUs7QUFBQSxVQUNMLE1BQU07QUFBQSxRQUNSO0FBQUEsUUFDQTtBQUFBLFVBQ0UsS0FBSztBQUFBLFVBQ0wsTUFBTTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsVUFDRSxLQUFLO0FBQUEsVUFDTCxNQUFNO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxVQUNFLEtBQUs7QUFBQSxVQUNMLE1BQU07QUFBQSxRQUNSO0FBQUEsUUFDQTtBQUFBLFVBQ0UsS0FBSztBQUFBLFVBQ0wsTUFBTTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsVUFDRSxLQUFLO0FBQUEsVUFDTCxNQUFNO0FBQUEsUUFDUjtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLFFBQVE7QUFBQSxJQUNOLHdCQUF3QixVQUFVLGtCQUFrQjtBQUFBLElBQ3BELHdCQUF3QixJQUFJLE9BQU87QUFBQSxFQUNyQztBQUFBLEVBRUEsT0FBTztBQUFBO0FBQUEsSUFFTCxRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUE7QUFBQSxJQUdiLFdBQVc7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBTVgsUUFBUSxDQUFDO0FBQUEsSUFFVCxLQUFLO0FBQUE7QUFBQSxNQUVILE9BQU8sUUFBUSxrQ0FBVyxjQUFjO0FBQUE7QUFBQSxNQUV4QyxVQUFVO0FBQUEsTUFDVixTQUFTLENBQUMsS0FBSztBQUFBLElBQ2pCO0FBQUEsSUFDQSxlQUFlO0FBQUEsTUFDYixTQUFTO0FBQUEsUUFDUCxHQUFJLFVBQ0E7QUFBQSxVQUNFLFdBQVcsT0FBTztBQUFBLFVBQ2xCO0FBQUE7QUFBQSxZQUVFLE1BQU07QUFBQSxZQUNOLE1BQU0sYUFBYTtBQUNqQixvQkFBTSxRQUFRLE1BQU0sR0FBRyxDQUFDLG1CQUFtQixnQkFBZ0IsZUFBZSxDQUFDO0FBQzNFLHlCQUFXLFFBQVEsT0FBTztBQUN4QixxQkFBSyxhQUFhLElBQUk7QUFBQSxjQUN4QjtBQUFBLFlBQ0Y7QUFBQSxVQUNGO0FBQUEsUUFDRixJQUNBLENBQUM7QUFBQSxNQUNQO0FBQUE7QUFBQTtBQUFBLE1BSUEsVUFBVSxDQUFDLFFBQVE7QUFBQSxNQUVuQixRQUFRO0FBQUEsUUFDTixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0IsQ0FBQyxjQUFjO0FBQzdCLGNBQUksVUFBVSxTQUFTLGFBQWE7QUFDbEMsbUJBQU87QUFBQSxVQUNUO0FBQ0EsaUJBQU8sVUFBVTtBQUFBLFFBQ25CO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
