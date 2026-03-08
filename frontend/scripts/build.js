const { execSync } = require('child_process');

execSync('webpack --mode production', {
  stdio: 'inherit',
  cwd: __dirname + '/..',
});
