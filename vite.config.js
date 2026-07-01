import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function parseAllowedHosts(value) {
  return (value || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const allowedHosts = [
    ...parseAllowedHosts(env.APP_ALLOWED_HOSTS),
    ...parseAllowedHosts(env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS),
  ];

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      allowedHosts,
    },
    preview: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      allowedHosts,
    },
  };
})
