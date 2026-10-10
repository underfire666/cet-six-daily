import { cp, lstat, readdir, realpath, unlink } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = join(projectRoot, ".next", "standalone");

try {
  await lstat(join(artifact, "server.js"));
  const canonicalArtifact = await realpath(artifact);
  if (!canonicalArtifact.startsWith(`${await realpath(projectRoot)}${sep}`)) {
    throw new Error("Standalone directory must stay inside the project.");
  }
  // Next may trace local environment files. They must never be shipped as artifacts.
  for (const name of await readdir(artifact)) {
    if (name === ".env" || name.startsWith(".env.")) {
      const target = join(canonicalArtifact, name);
      const stat = await lstat(target);
      if (!stat.isFile() && !stat.isSymbolicLink()) {
        throw new Error("Unexpected environment directory in standalone output.");
      }
      await unlink(target);
    }
  }
  await cp(join(projectRoot, "public"), join(artifact, "public"), { recursive: true });
  await cp(join(projectRoot, ".next", "static"), join(artifact, ".next", "static"), { recursive: true });
  console.log("Standalone assets prepared; local environment files excluded.");
} catch {
  console.error("Standalone preparation failed. Build first and check the project output directory.");
  process.exitCode = 1;
}
