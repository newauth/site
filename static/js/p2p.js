// Generate random room name if needed

var sseconnecturl = "/newauth/api/joinFlakeConf/";
var confpostmsgurl = "/newauth/api/sendmessagetoflakeconfuser/";

/*
* Browser get User Media
* */
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;

var confflake;
var confusername;
var localStream = null;
var confpostmsgconnection = null;
var confsseeventsource = null;
var localUser ;
/*
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);
  
// TODO: Replace with your own channel ID
//const drone = new ScaleDrone('2xmbUiTsqTzukyf7');
//establishFlakeConfSSEConnection(findconfusers, flake);
// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + roomHash;*/

const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;
  

function findconfusers() {
	var existingusersconnection = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
    existingusersconnection.open('POST', "/newauth/api/getflakeconfusers/" + confflake + "/" + confusername, false);
    existingusersconnection.withCredentials = true;
    existingusersconnection.setRequestHeader('Content-Type', 'application/json');     
    //alert("getting conf user count");
	
    existingusersconnection.onreadystatechange = function() {
    	if (existingusersconnection.readyState == 4 && existingusersconnection.status == 200) {
	           
        	var res = existingusersconnection.responseText;  
        	//alert(res);
        	if (res != null && res.length > 0) {
        		var otherstreamname = 'na';
        		var confusers =  JSON.parse(res);
        		var usercount = confusers.length;        		
        		const isOfferer = usercount === 2;
        		
        	    startWebRTC(isOfferer);
        	}
        }
    };
    
    existingusersconnection.send(null);
    
}
  
function onSuccess() {};
function onError(error) {
  console.error(error);
 // alert('error ' + JSON.stringify(error));
};

function loadconfstartbutton(autojoin) {
	var d = document.getElementById("flakeconfmodallaunchbutton");
	
	var anc = document.createElement('a');
	anc.setAttribute('data-toggle', 'modal');
	
	//alert('before checking autojoin');
	
	
	//alert('after checking autojoin');
	anc.setAttribute('href', '#flake-conf-start-modal');
	var i = document.createElement('img');
	
	i.src = '/static/icons/video-call-64.png';
	i.width = '40';
	i.height = '40';
	anc.appendChild(i);
	d.appendChild(anc);
	
	if (typeof autojoin !== 'undefined') {
		document.getElementById('auto-join-conf').value = autojoin;
		d.classList.add('fadeInOut');
		
		var para = document.createElement('p');
		para.setAttribute('id', 'JoinConfNotification');
		para.appendChild(document.createTextNode('Conference in progress. Click to join.'));
		
		d.appendChild(para);
	}
}

function joinflakeconference(flk) {
	
	var dummy = document.createElement("input");
    document.body.appendChild(dummy);
    dummy.setAttribute('value', newauthurl + '/f/' + flk);
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
    
	var confviddiv = document.getElementById("conferencecontainerRow");
	
	var modalbody = document.getElementById("confmodalbody");
	
	if (modalbody != null && confviddiv != null) {
		modalbody.innerHTML = '';
		modalbody.appendChild(confviddiv);
		confviddiv.style.display="block";
	}
	establishFlakeConfSSEConnection(findconfusers, flk);
}

function exitflakeconference() {
	
	// close local stream
	if (localStream != null) {
		localStream.getTracks().forEach(function(track) {
			console.log("stopping track " + track.id);
			  track.stop();
		});
		//stopStream('LOCAL');
		
		console.log("stopped local video");
	}
	
	// broadcast dropping to the conference
	var confdropconnection = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	confdropconnection.open('GET', "/newauth/api/dropfromFlakeConf/" + confflake + "/" + confusername, false);
	confdropconnection.withCredentials = true;
	//confdropconnection.setRequestHeader('Content-Type', 'application/json');  
	
	confdropconnection.send(null);
	
	// close SSE eventsource
	if (confsseeventsource != null) {
		confsseeventsource.close();
		confsseeventsource = null;
		//alert('SSE connection started in public page stopped.');
		console.log("conf SSE event source closed");
	}
	
	$('#flake-conf-start-modal').modal('hide');
}

function establishFlakeConfSSEConnection(callback, flake) {
	confflake = flake;
	//alert('inside establishFlakeConfSSEConnection' );	
	
	if (confusername != null) {
    	localUser = confusername ;    	
    } else {
		confusername = Math.floor(Math.random() * Math.floor(1000));
		console.log('passing a random username '+ confusername);
		localUser = confusername ; 
		if (document.getElementById("localstreamnamedisplay") != null)
			document.getElementById("localstreamnamedisplay").innerText = confusername;
	}	
	
	if (confpostmsgconnection == null) {
		confpostmsgconnection = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		confpostmsgconnection.open('POST', confpostmsgurl + confflake + "/" + confusername, false);
		confpostmsgconnection.withCredentials = true;
		confpostmsgconnection.setRequestHeader('Content-Type', 'application/json');     
	}	
	
	if(typeof(EventSource) !== "undefined") {
		if (confsseeventsource == null) {
			confsseeventsource = new EventSource(sseconnecturl + confflake + "/" + confusername);
			confsseeventsource.onerror = function() {
				  console.log("EventSource " + sseconnecturl + confflake + "/" + confusername + " failed to connect.");
				  document.getElementById("flake-conf-updates").innerText = "EventSource " + sseconnecturl + confflake + "/" + confusername + " failed to connect.";
				};
				
			//confsseeventsource.onopen = callback;					
			confsseeventsource.addEventListener('open',  callback);
			console.log('Connected to conf SSE event source');
			document.getElementById("flake-conf-updates").innerText = "Waiting for Peer..";
			//resolve(confsseeventsource);
		} else {
			console.log('Conf SSE event source is aleady connected');
			callback();
			//resolve(confsseeventsource);
		}
	} else {
		document.getElementById("flake-conf-updates").innerText = "This browser does not support EventSource API. Instant messsaging will not work.";
		//reject(confsseeventsource);
	}
	
}

  
// Send signaling data via Scaledrone
function sendMessage(message) {
 // drone.publish({
 //   room: roomName,
//    message
//  });
  
  confpostmsgconnection = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	confpostmsgconnection.open('POST', confpostmsgurl + confflake + "/" + confusername, false);
	confpostmsgconnection.withCredentials = true;
	confpostmsgconnection.setRequestHeader('Content-Type', 'application/json');     
  confpostmsgconnection.send(JSON.stringify(message));
  //alert('sent message ' + JSON.stringify(message));
}
  
function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);
  
  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
  // message to the other peer through the signaling server
  pc.onicecandidate = function(event) {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };
  
  // If user is offerer let the 'negotiationneeded' event create the offer
  if (isOfferer) {
	 
    pc.onnegotiationneeded = function()  {
    	// alert('on negotiation needed called' );
      pc.createOffer().then(localDescCreated).catch(onError);
    }
  }
  
  // When a remote stream arrives display it in the #remoteVideo element
  pc.ontrack = function(event) {
   // remoteVideo.srcObject = event.stream;
    
    console.log('gotRemotetrack', event.track);
   // document.getElementById("flake-conf-updates").innerText = "Got remote stream " ;
    var remoteVideo =  document.getElementById('remoteVideo');
    
    if (remoteVideo == null) {
    	var conferenceRow =  document.getElementById('conferenceRow');
    	
    	remoteVideo = document.createElement('video');
    	remoteVideo.setAttribute('id', 'remoteVideo');
    	remoteVideo.autoplay = true;
    	remoteVideo.playsinline = true;
    	//remoteVideo.muted = true;
    	
    	conferenceRow.appendChild(remoteVideo);
    }
   
    try {
    	if (remoteVideo.srcObject == null) {
    		remoteVideo.srcObject = new MediaStream();
            remoteVideo.srcObject.addTrack(event.track, remoteVideo.srcObject);

            console.log('remote stream attached to remotevideo.srcobject ID ' + event.track.id + ' muted ' + event.track.muted);
           // document.getElementById("flake-conf-updates").innerText = 'remote stream attached to remotevideo.src';
            
           // remoteVideo.style.position='absolute';
            remoteVideo.style.height='60%';
            remoteVideo.style.width='100%';
           // remoteVideo.style.bottom = '5px';
           // remoteVideo.style.right = '5px';
            remoteVideo.style.zIndex = 0;
            
            var localv = document.getElementById('localVideo');
            localv.style.position='absolute';
            localv.style.height= '100px';
            localv.style.width= '100px';
            localv.style.bottom = '5px';
            localv.style.right = '5px';
            
            localv.style.zIndex = remoteVideo.style.zIndex + 1;
            
            //alert('local zindex ' + localv.style.zIndex);
    	} else {
    		remoteVideo.srcObject.addTrack(event.track, remoteVideo.srcObject);
    		//alert('remotevideo.srcobject is already set, added track ', event.track);
           // document.getElementById("flake-conf-updates").innerText = 'remotevideo.srcobject is already set, added track';
    	}
    } catch (error) {
    	console.log('exception in remote stream attached to remotevideo.srcbj, setting remotevideo.src instead ', error);
        remoteVideo.src = window.URL.createObjectURL(event.stream);
        
        //document.getElementById("flake-conf-updates").innerText = 'exception in remote stream attached to remotevideo.src';
    }
  };
  
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(function(stream ) {
    // Display your local video in #localVideo element
	  var localVideo = document.getElementById('localVideo');
	  
	  localStream = stream;
    localVideo.srcObject = stream;
    // Add your stream to be sent to the conneting peer
   
    //pc.addStream(stream);
    stream.getTracks().forEach(function(track) {
        pc.addTrack(track, stream);
      });
   // alert('stream added to peerconn' );
    
    document.getElementById('callhangupbutton').style.display='block';
    
  }, onError);
  
  // Listen to signaling data from Scaledrone
  //room.on('data', (message, client) => {
  confsseeventsource.onmessage = (function (evt) {
    // Message was sent by us
	  
	 // console.log('event data received ' + evt );
	  if (evt.data.length == 0 ) return;
		
      var message = JSON.parse(evt.data);
   // if (client.id === drone.clientId) {
     // return;
   // }
  
     // console.log('event data received ' + JSON.stringify(message) );
      
      if (typeof message.message !== 'undefined' && typeof message.message.type !== 'undefined' && message.message.type === 'user_left') {
    	  //alert(message.type);
    	  if (document.getElementById('JoinConfNotification') != null ) {
    		  var divlb = document.getElementById('flakeconfmodallaunchbutton');
    		  if (divlb != null) {
    			  divlb.style.display = 'none';
    		  }
    	  }
      }
      
    if (message.sdp) {
    	console.log('sdp event data received ' + JSON.stringify(message) );
      // This is called after receiving an offer or answer from another peer
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), function () {
        // When receiving an offer lets answer it
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      // Add the new ICE candidate to our connections remote description
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    }
  });
}
  
function localDescCreated(desc) {
	//alert( "setting local desc  " + desc);
  pc.setLocalDescription(
    desc,
    function() { 
    	//alert( "sdp " + pc.localDescription);
    	sendMessage({'sdp': pc.localDescription});
    	},
    onError
  );
}


function displayflakechatmodal(event) {
	$('#display-flake-messages-modal').modal('show');
}