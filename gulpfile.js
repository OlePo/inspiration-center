'use strict';

let gulp = require('gulp-param')(require("gulp"), process.argv)
let yaml = require('gulp-yaml')
let clean = require('gulp-clean')
let jsoncombine = require("gulp-jsoncombine")
let VideoParser = require('./lib/video-parser')
let through = require('through2')
let utils = require('./lib/utils')
let camelCase = require('camelcase')
let path = require('path')

gulp.task('clean', function() {
  return gulp.src(['dist'], {read: false})
    .pipe(clean());
});

gulp.task('compile', ['clean'], function(youtube, vimeo) {
	let videoParser = null
	if (youtube || vimeo) {
		videoParser = new VideoParser({
		    youtube: {
		        key: youtube
		    },
		    vimeo: {
		        access_token: vimeo
		    },
		    disableCache: true
		})
	}

	return gulp.src('./src/**/*.yml')
		// compile YAML to JSON
		.pipe(yaml({
			safe: true,
			space: 2
		}))
		// validate JSON schemas
		.pipe(through.obj((file, encoding, callback) => {
			utils.validateJSON(file.path, file.contents)
				.then(() => {
					callback(null, file)
				})
		}))
		// concat JSON files in to one
		.pipe(jsoncombine('config.json', (data, meta) => {
			let result = {};
			for (let key in data) {
				if (~key.indexOf('/')) {
					let collectionName = camelCase(path.dirname(key))
					let fileName = camelCase(path.basename(key, '.json'))
					let itemData = data[key]
					itemData.id = fileName
					let collection = result[collectionName] || (result[collectionName] = [])
					collection.push(itemData)
				} else {
					result[camelCase(key)] = data[key]
				}
			}
			return new Buffer(JSON.stringify(result));
		}))
		// get video meta
		// todo // throw errors
		.pipe(through.obj((file, encoding, callback) => {
			utils.prepareData(JSON.parse(file.contents.toString()), videoParser)
				.then((result) => {
					file.contents = new Buffer(JSON.stringify(result))
					callback(null, file)
				})
				.catch((err) => {
					console.log(err)
					throw new Error(err)
				})
		}))
		.pipe(gulp.dest('./dist'));
})

gulp.task('content', ['clean'], function() {
	return gulp.src(['./content/**/*'])
		.pipe(gulp.dest('./dist/content'))
})

gulp.task('build', ['compile', 'content'])

gulp.task('watch', function() {
	gulp.watch(['./src/**/*', 'gulpfile.js'], ['build'])
})

gulp.task('default', ['build']);