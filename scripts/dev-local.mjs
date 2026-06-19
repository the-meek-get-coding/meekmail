import { spawn } from "node:child_process";

const children = [
  spawn("npm", ["run", "dev", "-w", "backend"], {
    stdio: "inherit",
    env: {
      ...process.env,
      YARLY_DEV_PASSWORD: process.env.YARLY_DEV_PASSWORD || "meek"
    }
  }),
  spawn("npm", ["run", "dev", "-w", "frontend", "--", "--host", "127.0.0.1"], {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_API_BASE_URL: "http://127.0.0.1:3000",
      VITE_DEV_ADMIN: "true"
    }
  })
];

function shutdown(signal) {
  for (const child of children) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown("SIGTERM");
      process.exit(code);
    }
  });
}
