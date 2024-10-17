const express = require('express');
const http = require('http');
const shell = require('shelljs');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const config = require('./config.js');
const exec = require('./exec.js');
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(function (req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-Authorization, Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');
	res.setHeader('Access-Control-Allow-Credentials', true);
	next();
});
app.get('/', function (req, res) {
	res.status(404).send('Not Found'); //write a response to the client
	res.end(); //end the response
});
app.get('/git-webhook', function (req, res) {
	console.log(req);
	// var yourscript = exec('sh pm2-deploy.sh', (error, stdout, stderr) => {
	// 	console.log(stdout);
	// 	console.log(stderr);
	// 	if (error !== null) {
	// 		console.log(`exec error: ${error}`);
	// 	}
	// });

	res.status(404).send('Not Found'); //write a response to the client
	res.end(); //end the response
});
app.post('/git-webhook', function (req, res) {
	const body = req.body;
	if (config.allowedLogins.indexOf(body.repository.owner.login) < 0) {
		res.status(400);
		return res.json({ success: false, message: 'owner of repository not allowed' });
	}
    res.status(200);
    res.json({ success: true, message: 'Acknowledged' });

    console.log('webhook received:',body.repository.clone_url)
	const folderName = body.repository.name;
    pullAndDeploy(config.repoHomePath,folderName,body.repository.clone_url);

});
app.use(function (error, req, res, next) {
	// Any request to this server will get here, and will send an HTTP
	// response with the error message 'woops'
	console.error(`Error! ${error}`);
	res.status(500);
	res.json({ success: false, message: error.message });
});
(() => {
	if (!shell.which('git')) {
		shell.echo('Sorry, this script requires git');
		shell.exit(1);
		return;
	}
	const httpServer = http.createServer(app);
	httpServer.listen(config.httpPort, () => {
		console.info(`Node.js app is listening at http://localhost:${config.httpPort}`);
	});
})();

const pullAndDeploy = (homePath,folderName,cloneUrl)=>{
	const repoFullPath = path.join(homePath, folderName);
    console.log('repoFullPath',repoFullPath);
	if (fs.existsSync(repoFullPath)) {
		shell.cd(repoFullPath);
		if (shell.exec('git pull && git fetch').code !== 0) {
			shell.echo('Error: Git pull and fetch failed:',repoFullPath);
			// shell.exit(1);
            return;
		}
        console.log('pull fetch completed!')
	}
    else{
		shell.cd(homePath);
        if (shell.exec(`git clone ${cloneUrl}`).code !== 0) {
            shell.echo('Error: git clone failed:',cloneUrl);
            // shell.exit(1);z
            return;
        }
		shell.cd(repoFullPath);
    }
    console.log('cd folder then run npm i',repoFullPath)
    shell.cd(repoFullPath);
    shell.rm('-rf','node_modules package-lock.json');
    if (shell.exec('npm i').code !== 0) {
        shell.echo('Error: npm install failed:',repoFullPath);
        // shell.exit(1);
        return;
    }
    console.log('npm i done! deploying....');
    const cmd = shell.exec('pm2-meteor deploy');
    if (cmd.code !== 0) {
        console.log(cmd,cmd.code);
        shell.echo('Error: pm2-meteor deploy failed:',repoFullPath);
        // shell.exit(1);
        return;
    }
    console.log('deploy success:',cloneUrl);
}