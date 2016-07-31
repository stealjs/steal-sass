var sass = require('node-sass');

function dir(path){
	var parts = path.split("/");
	parts.pop();
	return parts.join("/");
}


export default function(loadObject) {
	var sassDir = dir(loadObject.address);

	return sass.renderSync({
		data: loadObject.source,
		includePaths: [sassDir]
	});
};