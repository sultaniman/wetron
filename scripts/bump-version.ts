import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('usage: pnpm exec tsx scripts/bump-version.ts <version>');
  process.exit(1);
}

// Discovered, not hardcoded: a hand-maintained list silently skipped @wetron/gguf,
// which would have published a core that depends on a version that never existed.
const packages = readdirSync('packages', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `packages/${entry.name}`)
  .filter((dir) => existsSync(`${dir}/package.json`))
  .sort();

for (const dir of packages) {
  const path = `${dir}/package.json`;
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.version = version;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ${pkg.name}  ->  ${version}`);
}
