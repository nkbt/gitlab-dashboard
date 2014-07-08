gitlab-dashboard
================
GitLab Dashboard. Shows all your projects with tags

### Install:

	git clone git@github.com:nkbt/gitlab-dashboard.git
	cd gitlab-dashboard
	npm install

Dashboard requires `config.json` to be present:

	{
		"url": "http://gitlab",
		"token": "secret",
		"ssh": {
			"host": "",
			"port": 22,
			"username": "",
			"privateKey": "-----BEGIN RSA PRIVATE KEY-----\nLINE\nLINE\nETC\n-----END RSA PRIVATE KEY-----"
		}
	}

### Run:

	node app

Access in your browser:

	http://localhost:3003
