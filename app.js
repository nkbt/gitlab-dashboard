var _ = require('underscore');
var request = require('request');
var querystring = require('querystring');
var async = require('async');
var naturalSort = require('javascript-natural-sort');
var url = require('url');
var fs = require('fs');
var http = require('http');
var Connection = require('ssh2');

var config = require('./config.json');

function sortProjects(projects) {
	return projects.sort(function (projectA, projectB) {
		return naturalSort(projectA.path_with_namespace, projectB.path_with_namespace);
	});
}


function sortTags(tags) {
	return tags.sort(function (tagA, tagB) {
		return naturalSort(tagA.name, tagB.name);
	});
}


function processResponse(response, body, callback) {
	var data;
	try {
		data = JSON.parse(body);
	} catch (err) {
		return callback(err);
	}
	return callback(null, data);
}


function Gitlab(options) {
	this.url = options.url;
	this.token = options.token;
}


Gitlab.prototype.gitlabUrl = function (path, params) {
	params = params || {};
	params.private_token = this.token;
	return [this.url, '/api/v3', path, '?' + querystring.stringify(params)].join('');
};


Gitlab.prototype.getProjectTags = function (project, callback) {
	var _this = this;

	return async.waterfall([
		async.apply(request.get, _this.gitlabUrl(['/projects', project.id, 'repository/tags'].join('/'))),
		processResponse,
		function (tags, next) {
			project.tags = sortTags(tags);
			return next(null, project);
		}
	], callback);
};

function call(command, callback) {
	var conn = new Connection();
	return conn
		.on('ready', function () {
			conn.exec(command, function (err, stream) {
				var data = [],
					errorMessage;

				if (err) {
					return callback(err);
				}

				stream
					.on('exit', function () {
						if (errorMessage) {
							return callback(new Error(errorMessage))
						}
						return callback(null, data.join('\n'));
					})
					.on('close', function () {
						conn.end();
					})
					.on('data', function (response) {
						data.push(response.toString().trim());
					})
					.stderr.on('data', function (response) {
						errorMessage = response.toString().trim();
					});
			});
		})
		.connect(config.ssh);
}


function setVersions(env) {
	return function (projects, callback) {
		var commands = _.map(projects, function (project) {
			return ['releaseGetVersion', project.path_with_namespace, env].join(' ');
		});
		return call(commands.join(';'), function(error, data) {
			var versions = data.split('\n');
			return callback(null, _.map(projects, function(project, index) {
				project[env] = versions[index] ? versions[index] : '';
				return project;
			}));
		})
	};
}


Gitlab.prototype.getData = function (callback) {
	var _this = this;

	return async.waterfall([
		async.apply(request.get, _this.gitlabUrl('/projects', {page: 1, per_page: 100})),
		processResponse,
		function (projects, next) {
			return async.map(sortProjects(projects), _this.getProjectTags.bind(_this), next);
		},
		setVersions('dev'),
		setVersions('live')
	], callback);
};


function jsonResponse(res) {
	return function (error, data) {
		if (error) {
			data = {
				error: error.message,
				stack: error.stack
			};
		}
		res.writeHead(200, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(data, null, '\t'));
	};
}


http.createServer(function (req, res) {
	var route = url.parse(req.url, true),
		gitlab;

	if (route.pathname === '/') {
		res.writeHead(200, {'Content-Type': 'text/html'});
		return fs.createReadStream('./index.html').pipe(res);
	}

	gitlab = new Gitlab(config);

	if (route.pathname.substr(0, 5) === '/data') {
		return gitlab.getData(jsonResponse(res));
	}

	return jsonResponse(res)(new Error('404'));
}).listen(3003);

