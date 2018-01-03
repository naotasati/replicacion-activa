//REQUIRES DE NODE.JS
var zmq = require('zmq');		//Sockets tipo ZMQ
var underScore = require('underscore');	//Underscore
var Sequencer = require('./DSS.js');	//Utilizamos el modulo DSS
//VARIABLES
var pullSocket = zmq.socket('pull');	//Socket de pull
var pubsocket = zmq.socket('pub'); 	//Publisher
var rp = zmq.socket('rep');		//Socket de Reply
var msgRRJSON;				//JSON del cliente
var TORequest;				//JSON para envio de TO
var sTORequest;				//String del anterio JSON
var lastServedReq = 0;			//Ultima peticion atendida
var seq;				//Numero de secuencia
var seqaux;
var recibido = false;			//Si hemos recibido un mensaje

//=================================proxy0======================================

var responder = zmq.socket('req');
var auxfunctions = require('./auxfunctions.js');

var endpoint = '4445';
var id = '0';
var disponibilidad = 'OK';
var atencion = 'PROXY RECIBIDO RR0';
var num = 0;

console.log('ARH ( ' + id + ' ) connected to ' + endpoint + " Proxy0");
console.log('ARH ( ' + id + ' ) has sent READY msg: ' + disponibilidad);

responder.identity = id;
responder.connect('tcp://127.0.0.1:'+endpoint);

responder.on('message', function() {
	console.log("ARH ( " + id + " ) has received request: ( " + msgRRJSON + " ) from RR0");
	//auxfunctions.showArguments(args);
	setTimeout(function() {
		console.log("ARH ( " + id + " ) has send its reply");
		console.log(atencion);
		console.log("ARH ( " + id + " ) has sent " + (++num) + " replies");
		responder.send(atencion);
	}, 1000);
});
responder.send(disponibilidad);
//=================================proxy1=======================================
var requester = zmq.socket('req');
var ipBroker = '127.0.0.1';
var portBroker = '6666';
var identityARH = '0';
var serviceRequest = requester;

requester.identity = identityARH;
requester.connect('tcp://' + ipBroker + ':' + portBroker );

console.log("ARH0 ( " + identityARH + " ) connected to tcp://" + ipBroker + ":" + portBroker + " ...");

requester.on('message', function(msg) {
	console.log("ARH0 ( " + identityARH + " ) has received reply: " + msg.toString());
	requester.close();
	process.exit(0);
});

console.log("ARH0 ( " + identityARH + " ) has sent its msg: " + serviceRequest);

//=================================CODIGO======================================
rp.bind('tcp://127.0.0.1:9020', function(err){	//Bind para reply
	if(err)console.log(err)
});
//_____________________________________________________________________________
pubsocket.bind('tcp://127.0.0.1:9021', function(err){	//Bind para publicar
	if(err)console.log(err)
});
//_____________________________________________________________________________
pullSocket.bind('tcp://127.0.0.1:9022')		//Bind para pull

//===============================LISTENERS=====================================
rp.on('message',function(msgRR,err){
	if( err ) {
		throw err;
		console.log(err);
	}
	recibido = false;		//Control de mensaje recibido, admitir solo el primero
	msgRRJSON = JSON.parse(msgRR);	//Pasamos el String a JSON
	console.log('\n ARH0 - Ha llegado una peticion: '+msgRRJSON.req_id.cl_id);
	Sequencer.GetSeq(msgRR,function callback(seq){ 	//Obtenemos la secuencia del TO
		if(seq > lastServedReq + 1){
			for(var j=lastServedReq+1;j<seq;j++){
				//String recibido del JSON en la posicion j
				var reqj = Sequencer.GetReq(j);
				//Pasamos el String a JSON
				var reqjJSON = JSON.parse(reqj);
				TORequest = {  	//Objeto JSON hacia FO's
					seq: j,
					request: reqjJSON.request,
					ARH: 0
				}; 
				//Pasamos el JSON del TORequest a string
				sTORequest=JSON.stringify(TORequest);
				//Publicamos a todos los sub el objeto TORequest 
				pubsocket.send(''+sTORequest);
			}
		}
		TORequest = { 		//Objeto JSON hacia FO's
		seq: seq,
		request: msgRRJSON.request,
		ARH: 0
		};
		//Pasamos el JSON del TORequest a string
		sTORequest=JSON.stringify(TORequest);
		//Actualizamos el valor de lastServerRequest
		lastServedReq = Math.max(lastServedReq,seq);
		//Publicamos a todos los sub el objeto TORequest
		pubsocket.send(''+sTORequest);
		seqaux = seq;
	});
});
//_____________________________________________________________________________
//Listener para el mensaje de resultado desde FO
pullSocket.on('message', function(msgFO,err){
	if( err ) {
		throw err;
		console.log(err);
	}
	var msgFOJSON = JSON.parse(msgFO);	//Pasamos el String a JSON
	//Si lo que nos llega del FO es de la peticion actual
	if(seqaux == msgFOJSON.seq){
	//Si todavia no hemos recibido mensaje alguno de los FO's
		if (!recibido){ 
			recibido = true;
			var reply = {  //Objeto JSON hacia RR
				req_id: msgRRJSON.req_id,
				res: msgFOJSON.result
			};
			//Pasamos el JSON del reply a string
			sReply = JSON.stringify(reply);
			console.log('Resultado enviado al cliente '+msgRRJSON.req_id.cl_id);
			msgRRJSON=null;
			rp.send(sReply);    //Enviamos a RR conectado al socket rp
		}
	}
});

//_____________________________________________________________________________
//LISTENER para Ctrl + C -> salir
process.on('SIGINT', function() {	//Cerrar adecuadamente cada socket
	pubsocket.close();
	pullSocket.close();
	rp.close();
	rq.close();
	process.exit();
	
});
