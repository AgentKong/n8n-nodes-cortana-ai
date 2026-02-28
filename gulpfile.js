const { src, dest } = require('gulp');

// Copies SVG icons from nodes/** into dist/** mirroring the folder structure.
// n8n requires icons to live next to the compiled .js files in dist/.
function buildIcons() {
	return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
}

exports['build:icons'] = buildIcons;
