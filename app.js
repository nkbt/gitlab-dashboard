var _ = require('underscore');
var request = require('request');
var querystring = require('querystring');
var async = require('async');
var naturalSort = require('javascript-natural-sort');
var url = require('url');
var fs = require('fs');
var http = require('http');


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
	this.token = options.token;
	this.url = options.url;
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


Gitlab.prototype.getData = function (callback) {
	var _this = this;

	return async.waterfall([
		async.apply(request.get, _this.gitlabUrl('/projects', {page: 1, per_page: 100})),
		processResponse,
		function (projects, next) {
			return async.map(sortProjects(projects), _this.getProjectTags.bind(_this), next);
		}
	], callback);
};



http.createServer(function (req, res) {
	var route = url.parse(req.url, true),
		gitlab;

	if (route.pathname === '/') {
		res.writeHead(200, {'Content-Type': 'text/html'});
		return fs.createReadStream('./index.html').pipe(res);
	}

	gitlab = new Gitlab(route.query);

	return gitlab.getData(function (error, data) {
		if (error) {
			data = {
				error: error.message,
				stack: error.stack
			};
		}
		var json = JSON.stringify(data);
		res.writeHead(200, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(data, null, '\t'));

	});

}).listen(3003);

