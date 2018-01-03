var zmq = require('zmq');
var frontend = zmq.socket('router');
var backend = zmq.socket('router');
var auxfunctions = require('./auxfunctions.js');
var WORKING = true;
var workers = {};

// ARGUMENTS
if( process.argv.length != 6 ) {
	console.log("Parametros incorrectos");
	process.exit(1);
}
var portClient0 = process.argv[2];//port ARH0
var portWorker0 = process.argv[3];//port F0
var portClient1 = process.argv[4];//port ARH1
var portWorker1 = process.argv[5];//port F1


// ARGUMENTS

console.log('broker: frontend-routerARH0 listening on tcp://*:' + portClient0 + ' ...');
console.log('broker: backend-routerFO0 listening on tcp://*:' + portWorker0 + ' ...');
console.log('broker: frontend-routerARH1 listening on tcp://*:' + portClient1 + ' ...');
console.log('broker: backend-routerFO1 listening on tcp://*:' + portWorker1 + ' ...');

frontend.bindSync('tcp://*:' + portClient0);
frontend.bindSync('tcp://*:' + portClient1);
backend.bindSync('tcp://*:' + portWorker0);
backend.bindSync('tcp://*:' + portWorker1);



function getWorker() {
	var minWorks = calculeWorksmin();
	for (var key in workers) {
		if( workers[key][1] == minWorks )
			return key;
		}
	return null;
}

function calculeWorksmin() {
	var min = 999999999;
	for (var key in workers) {
		if( workers[key][1] < min )
			min = workers[key][1];
	}
	return min
}

function clearArgs(args) {
	var newArgs = args.reverse();
	newArgs.pop();
	newArgs.pop();
	return newArgs.reverse();
}


frontend.on('message', function() {
	var args = Array.apply(null, arguments);
	var worker = getWorker();
	console.log("\nFrontend");
	console.log("Received request: " + args[2] + " from client ( " + args[0] + " ).");
	//auxfunctions.showArguments(args);
	
	if( worker == null ) {
		console.log("We have not workers")
		frontend.send([args[0], "" , 'We have not workers']);
		return
	}
	
	console.log("Sending client: ( " + args[2] + " ) req to worker( " + worker + " ) through bakend.");
	//auxfunctions.showArguments(args);
	
	workers[worker][0] = WORKING;
	workers[worker][1] += 1;
	backend.send([worker, "" ,args]);
});

backend.on('message', function() {
	var args = Array.apply(null, arguments);
	console.log("\nBackend");
	if(workers[args[0]] == undefined) {
		workers[args[0]] = [!WORKING, 0];
		console.log("Received request: ( " + args[2] + " ) from worker ( " + args[0] + " ).");
		//auxfunctions.showArguments(args);
		
	}
	else {
		workers[args[0]][0] = !WORKING;
		console.log("Received request: ( " + args[2]+ " ) from worker ( " + args[0] + " ).");
		//auxfunctions.showArguments(args);
		
	}
	if(args[2] != "READY") {
		console.log("Sending worker: ( " + args[0] + " ) rep to client ( " + args[2] + " ) through frontend.");
		args = clearArgs(args);
		//auxfunctions.showArguments(args);
		frontend.send([args[0] , "" , args[2]]);
	}
	//console.log(workers);
});

//LISTENER para Ctrl + C -> salir
process.on('SIGINT', function() {	//Cerrar adecuadamente cada socket
	process.exit();
	
});
