const { execSync } = require("child_process");
try {
  const out = execSync("npx tsc --noEmit", {
    cwd: "c:/kenny_work/251112_pigout/backend",
    encoding: "utf-8",
    maxBuffer: 1024 * 1024 * 10,
  });
  console.log(out);
} catch (e) {
  console.log(e.stdout);
  console.log(e.stderr);
}
