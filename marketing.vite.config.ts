import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS = "false";
  process.env.MINIFLARE_REGISTRY_PATH = ".wrangler/marketing-ui-test-registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: {
          secrets: { required: [] },
          vars: { ADMIN_SETUP_TOKEN: "marketing-ui-setup-token" },
        },
        persistState: false,
      }),
    ],
  };
});
