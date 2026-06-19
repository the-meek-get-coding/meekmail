import { build } from "esbuild";

const handlers = ["forwarder", "yarly-gate", "yarly-processor", "api"];

await Promise.all(
  handlers.map((handler) =>
    build({
      entryPoints: [`src/handlers/${handler}.ts`],
      outfile: `dist/handlers/${handler}.js`,
      bundle: true,
      platform: "node",
      target: "node22",
      format: "cjs",
      sourcemap: true,
      logLevel: "info"
    })
  )
);
