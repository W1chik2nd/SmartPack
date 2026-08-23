import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// 手机拍照需要两个条件,所以本地开发默认开 HTTPS + 局域网监听:
// 1. 手机访问不到电脑的 localhost,必须用局域网 IP(host: true 即监听 0.0.0.0)
// 2. 浏览器只在安全上下文(HTTPS 或 localhost)才允许调用相机
// 自签证书手机首次访问会提示“不安全”,点“继续访问”即可。
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    port: 5177,
    proxy: {
      "/api": "http://localhost:4177",
    },
  },
});
