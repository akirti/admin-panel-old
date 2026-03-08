const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./coverage/coverage-summary.json', 'utf8'));
const results = [];
for (const [file, metrics] of Object.entries(data)) {
  if (file === 'total') continue;
  const shortFile = file.replace(/.*\/src\//, 'src/');
  const uncoveredBranches = metrics.branches.total - metrics.branches.covered;
  if (uncoveredBranches > 0) {
    results.push({
      file: shortFile,
      brPct: metrics.branches.pct,
      brUncovered: uncoveredBranches,
      brTotal: metrics.branches.total,
    });
  }
}
results.sort((a, b) => b.brUncovered - a.brUncovered);
console.log('Top files by uncovered branches:');
console.log('File | Br% | Uncov/Total');
results.slice(0, 30).forEach(r => {
  console.log(`${r.file} | ${r.brPct}% | ${r.brUncovered}/${r.brTotal}`);
});
console.log('\nTotal uncovered branches:', results.reduce((s, r) => s + r.brUncovered, 0));
