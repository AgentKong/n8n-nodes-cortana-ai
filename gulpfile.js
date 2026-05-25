const { src, dest, parallel } = require('gulp');

// Copies SVG icons and codex JSON files from source folders into dist/ next to
// the compiled .js files. n8n requires both to live next to the compiled output.
function buildNodeIcons() {
	return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
}

function buildCredentialIcons() {
	return src('credentials/**/*.svg').pipe(dest('dist/credentials'));
}

function buildNodeCodex() {
	return src('nodes/**/*.node.json').pipe(dest('dist/nodes'));
}

exports['build:icons'] = parallel(buildNodeIcons, buildCredentialIcons, buildNodeCodex);
