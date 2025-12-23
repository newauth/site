var avatartoinvite, flaketoinvite;

var publicpagelinkclicked =  false;


var userGraph, sigma_ins;

var declinesenderid, declinesenderflake;
var tracktypingtimeoutid ;
var notypingtime = 10000; // send a no typing event if nothing typed for 10 sec

var nodeidflakemap = {}; // stores user nodeid to flake mapping
var nodeidnamemap = {}; // stores user nodeid to username mapping
var nodeidconvmap = {}; // stores convnodeid to convid mapping
var convmsgtimemap = {}; /// used to make sure that the same message is not displayed twice in a conv.
var convparticipants = {};

var inviteout=0, invitein=0, conversations=0;
var entityMap = {
		  '&': '&amp;',
		  '<': '&lt;',
		  '>': '&gt;',
		  '"': '&quot;',
		  "'": '&#39;',
		  '/': '&#x2F;',
		  '`': '&#x60;',
		  '=': '&#x3D;'
		};

function escapeHtml (string) {
  return String(string).replace(/[&<>"'`=\/]/g, function (s) {
    return entityMap[s];
  });
}


function inviteOthers() {
	
	$('#inviteOthersModal').modal('show');
	
	return false;
}

function searchnewauth() {
	//alert('searching');
	var containerdiv = document.getElementById("searchresults");
	
	if (containerdiv != null) {
		//alert('cleaing existing results');
		cleardiv(containerdiv); // clearing old results
	}
	
	var xhr = new XMLHttpRequest();
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	
        	
        	var jsonres = xhr.responseText;
        	var data = {};
        	
        	if (jsonres != null && jsonres.length > 0)
        		data = JSON.parse(jsonres);
        	
        	if (data.length > 0) {
	        	for (var j=0; j< data.length; j++) {
	        		//alert(data[j].publicKey);
	        		
	        		displaysearchresult(data[j]);
	            	
	        	}
        	} else {
        		displayerror('No results matching search criteria.');
        	}
        	/*verificationcode = data.vercode;    			        	
        	$('#verifyModal').modal('show');*/
        }
    }
	xhr.open('POST', '/newauth/api/search', false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    var text = document.getElementById('search-text').value;
	//alert(text);
	
    var reqpacket = JSON.stringify({
 	   	username: text
 		});
     
    xhr.send(reqpacket);
	
	return false;
}



function displaysearchresult(data) {
	
	var containerdiv = document.getElementById("searchresults");
	//containerid.innerHTML = ''; // clearing old results
	
	var name = 'NAME HIDDEN';
	var alias = 'NO ALIAS';
	var avatarname = 'AVATAR UNKNOWN';
	var flake = 'UNKNOWN FLAKE';
	
	//alert(JSON.stringify(data));
	if (data.firstname != null)
		name = data.firstname;
	
	if (data.middleinitial != null)
		name += ' ' + data.middleinitial;
	
	if (data.lastname != null)
		name += ' ' + data.lastname;
	
	if (data.alias != null)
		alias = data.alias;
	
	if (data.currentavatar != null)
		avatarname = data.currentavatar;
	
	if (data.flake != null)
		flake = data.flake;
	
	var rowlem  = document.createElement("div");
	//rowlem.classList.add('row');	
	rowlem.classList.add('panel-thin');	
	rowlem.classList.add('panel-body');	
	rowlem.classList.add('panel-word-wrap');	
	
	var collem  = document.createElement("div");
	collem.classList.add('col-xs-12');
	collem.classList.add('text-center');
	
	//<a href="#" data-toggle="modal" data-target="#boxDescriptionModal">Boxed images</a>
	
	var wrapperdiv  = document.createElement("div");
	wrapperdiv.classList.add('row');
	
	var nameelem = document.createElement("div");
	nameelem.classList.add('col-xs-3');
	
	var aliaselem = document.createElement("div");
	aliaselem.classList.add('col-xs-3');
	
	var avatarelem = document.createElement("div");
	avatarelem.classList.add('col-xs-3');
	
	var linkelem = document.createElement("div");
	linkelem.classList.add('col-xs-3');
	
	nameelem.appendChild(getpanelfortext(name, 'name'));
	aliaselem.appendChild(getpanelfortext(alias, 'alias'));
	//avatarelem.appendChild(getpanelfortext(avatarname, 'avatar'));	
	
	
	wrapperdiv.appendChild(nameelem);
	wrapperdiv.appendChild(aliaselem);
	wrapperdiv.appendChild(avatarelem);
	wrapperdiv.appendChild(linkelem);
	
	var aelem = document.createElement("a");
	//aelem.href = "#";
	//aelem.setAttribute('data-toggle', 'modal');
	//aelem.setAttribute('data-target', '#searchResultDetailModal');
	
	
	aelem.href = "javascript:loadSearchDetailModal('" + avatarname + "', '" + flake + "');";
	//aelem.setAttribute('data-href', dataurl);
	
	//aelem.innerHTML = data.firstname + ' ' + data.middleinitial + ' ' + data.lastname ;
	
	var pelem  = document.createElement("p");
	pelem.classList.add('lead');	
	
	
	var textelem = document.createTextNode(name); 
	
	pelem.appendChild(textelem); 
	
	
	//collem.appendChild(pelem);
	aelem.appendChild(pelem);
	
	linkelem.appendChild(aelem);
	collem.appendChild(wrapperdiv);
	rowlem.appendChild(collem);
	
	containerdiv.appendChild(rowlem);
	

	
}

function getpanelfortext(txt, type) {
	var rowlem  = document.createElement("div");
	//rowlem.classList.add('row');	
	rowlem.classList.add('panel-thin');	
	//rowlem.classList.add('panel-default');	
	
	var bdy  = document.createElement("div");
	bdy.classList.add('panel-body-thin');
	
	rowlem.appendChild(bdy); 
	
	var rowtxtcenter  = document.createElement("div");
	rowtxtcenter.classList.add('row');	
	
	
	var col12  = document.createElement("div");
	col12.classList.add('col-xs-12');	
	col12.classList.add('center-block');	
	col12.setAttribute("align", "center");

	rowtxtcenter.appendChild(col12); 
	
	var pelem  = document.createElement("p");
	pelem.classList.add('lead');
	pelem.classList.add('text-center');
	
	var textelem = document.createTextNode(txt); 
	
	if (type) {	
		
		if (type == 'name')
			bdy.classList.add('panel-semi-dark');
		
		if (type == 'alias') 
			bdy.classList.add('panel-alias-display');
			
		if (type == 'avatar') {
				pelem.classList.remove('lead');	
				pelem.classList.add('text-muted');
		}
	
	}
	
	pelem.appendChild(textelem); 
	
	col12.appendChild(pelem);
	
	bdy.appendChild(rowtxtcenter);
	
	
	return rowlem;
}


function displayerror(txt) {
var containerdiv = document.getElementById("searchresults");
	
	var rowlem  = document.createElement("div");
	//rowlem.classList.add('row');	
	rowlem.classList.add('panel');	
	rowlem.classList.add('panel-body');	
	rowlem.classList.add('panel-word-wrap');	
	
	var collem  = document.createElement("div");
	collem.classList.add('col-xs-12');
	
	var pelem  = document.createElement("p");
	pelem.classList.add('lead');
	var textelem = document.createTextNode(txt); 
	
	pelem.appendChild(textelem); 
	
	collem.appendChild(pelem);
	rowlem.appendChild(collem);
	
	containerdiv.appendChild(rowlem);
	

}


function loadSearchDetailModal(avatar, inflake) {
	var url = '/newauth/api/searchbyflake';
	var dataobj;
		
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var jsonres = xhr.responseText;
        	//alert(jsonres);
        	
        	if (jsonres.length > 0) {
	        	dataobj = JSON.parse(jsonres);
	        	
	        	if (dataobj.firstname != null) {
	        		var fullname = dataobj.firstname;
	        		
	        		if (dataobj.middleinitial != null) fullname += ' ' + dataobj.middleinitial;
	        		
	        		if (dataobj.lastname != null) fullname += ' ' + dataobj.lastname;
	        			
	        		document.getElementById('searchedentityname').innerHTML = fullname;
	        	}
	        	
	        	if (dataobj.alias != null) {
	        		document.getElementById('searchedentityalias').innerHTML = '<em>' + dataobj.alias + '</em>';
	        	}
	        	
	        	if (dataobj.homepagesectiondata != null)
	        		document.getElementById('searched-entity-description').innerHTML = dataobj.homepagesectiondata;
	        	
	        	//avatartoinvite = avatar;
	        	flaketoinvite = inflake;
        	}
        	
        }
    }
	
    xhr.open('POST', url, false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
	xhr.send(JSON.stringify({
		 currentavatar: avatar,
		 flake: inflake
		}));
	     
	
	 $("#searchResultDetailModal").modal('show');
}

function invitebyemailorphone() {
	var address = document.getElementById('inviteemailinput').value;
	
	
	if (address.length == 0) {
		document.getElementById("emailinputerror").innerHTML = 'No email address or phone number provided';
		return false;
	}
	
	if (!ValidateEmail(address)) {
		if (ValidatePhone(address)) {
			document.getElementById("emailinputerror").innerHTML = "";  
			$('#inviteOthersModal').modal('hide');
			sendInvite('', address );
			
		} else {
			document.getElementById("emailinputerror").innerHTML = 'Does not appear to be a phone number or an email address';
		}
	} else {
		$('#inviteOthersModal').modal('hide');
		sendInvite( address , '');
		
		
	}
	
	return false;
}



function sendInvite(email, phone) {
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var jsonres = xhr.responseText;        	
        	//alert(jsonres);
        	userGraph = JSON.parse(atob(jsonres));
        	clearexistinggraph();
        	convertanddrawgraphdata();	

        }
    }
	
    xhr.open('POST', '/newauth/api/invite/externalbyphoneemail' , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
    var invmessage = escapeHtml(document.getElementById('invitemessage').value);
    var receiverobj;
    
    if (email.length > 0) {
    	receiverobj = {	emails: email   };
    }
    
    if (phone.length > 0) {
    	receiverobj =  {	phones: '{"number":"'+ phone +'"}'   };
    }
   
    //alert(currentavatar);
    var reqpacket = JSON.stringify({
								 	   	sender : {  flake : loggedinuserflake},
								 	   receiver: receiverobj,
								 	   message: invmessage
								 		});
	xhr.send(reqpacket);
	 
}



function sendInternalInvite() {
	
	//if (avatartoinvite == null || avatartoinvite.length ==0)
	//	return false;
	
	if (flaketoinvite == null || flaketoinvite.length ==0)
		return false;
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var jsonres = xhr.responseText;        	
        	//alert(jsonres);
        	userGraph = JSON.parse(atob(jsonres));
        	clearexistinggraph();
        	convertanddrawgraphdata();	

        }
    }
	
    xhr.open('POST', '/newauth/api/invite/internaluser' , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
    //alert('loggedinuserflake ' + loggedinuserflake);
    var reqpacket = JSON.stringify({
								 	   	sender : { flake : loggedinuserflake },
								 	   receiver: { currentavatar : avatartoinvite,
								 		            flake: flaketoinvite}
								 		});
	xhr.send(reqpacket);
	 
}


function convertanddrawgraphdata() {
	
	nodeidflakemap = {}; // stores user nodeid to flake mapping
	nodeidnamemap = {}; // stores user nodeid to username mapping
	nodeidconvmap = {}; // stores convnodeid to convid mapping
	convmsgtimemap = {}; /// used to make sure that the same message is not displayed twice in a conv.
	convparticipants = {};
	
	var g = {
		      nodes: [],
		      edges: []
		    };
	var usernodeid, nodeid, xarg, yarg, sizearg, nodename;	
	
	inviteout = 0;
	invitein = 0;
	conversations = 0;
	var edgeCount = 0;
	

	 if (debugappui) console.log(JSON.stringify(userGraph));
	
	for (var i=0; i<userGraph.length; i++) {
		
		if (userGraph[i]['@type'] === undefined ) { // this is a vertex
			
			if (userGraph[i]['label'] == 'user' ) {
				nodeid = userGraph[i]['id']['@value'];
				if (nodeidnamemap[nodeid] === undefined) { // this user has not been processed yet
					
					var propsobj, avatarname, username;
					
					var vertexcolorval = '#eee';
					
					propsobj = userGraph[i];
					
					avatarname = getavatarname(propsobj);	
					username = getusername(propsobj);
					
					if (avatarname != null || username != null)
						vertexcolorval = '#090'; // In network user - green
					
					if (i == 0) {
						xarg = 0;
						yarg = 0;
						sizearg = 8;
						nodename = 'You';
						
						usernodeid = nodeid;
					} else {
						xarg = Math.random();
						yarg = Math.random();
						sizearg = 2;
						nodename = getnamelabel(propsobj);
					}
					
					nodeidflakemap[nodeid] = userGraph[i].flake[0];
					
					nodeidnamemap[nodeid] = nodename;
					
					
					 g.nodes.push({
						    id: nodeid,
						    label:  nodename,
						    x: xarg,
						    y: yarg,
						    size: sizearg,
						    color: vertexcolorval
						  });
					 
					 if (debugappui) console.log("node added: " + nodeid + " " + nodename);
					// alert('node ' + i + ' pushed');
				}
			} else {
				if (debugappui) console.log('nodeidnamemap contained ' + nodeid + ' did not add');
			}
			
			if (userGraph[i]['label'] == 'conversation' ) {
				nodeid = userGraph[i]['id']['@value'];
				if (nodeidconvmap[nodeid] === undefined) { // this conv has not been processed yet -- will not be added to UI directly
					var convid =  userGraph[i]['convid']['0']['@value'];
					nodeidconvmap[nodeid] = convid;
				}
			}
			
		} else if (userGraph[i]['@type'].indexOf("Edge") != -1) {
			var sourcenodeid = null;
			if (debugappui) console.log("processing edge: " + JSON.stringify(userGraph[i]));
			
			if (userGraph[i]['@value']['label'] == 'invited') {
				
				sourcenodeid = userGraph[i]['@value']['inV']['@value'];
				
				if (userGraph[i]['@value']['inV']['@value'] == usernodeid) {
					invitein ++;
					
					var msg = userGraph[i]['@value']['properties']['message']['@value']['value'];
					var senderid = userGraph[i]['@value']['outV']['@value'];
					
					var senderflake = find_vertex_flake_in_JSON_graph(senderid);
					
					//alert(JSON.stringify(userGraph[i]));
					populateInvitationOnPanel(senderid, senderflake, msg);
					
					
				}
				
				if (userGraph[i]['@value']['outV']['@value'] == usernodeid)
					inviteout ++;
				
			}
			
			if (userGraph[i]['@value']['label'] == 'joined') {
				
				var otherpartynodeid, convnodeid;
				
				if ( userGraph[i]['@value']['outV']['@value'] == usernodeid) {
					conversations ++;
					//otherpartynodeid = userGraph[i]['@value']['inV']['@value'];
				}
				
				convnodeid = userGraph[i]['@value']['inV']['@value'];
				otherpartynodeid = userGraph[i]['@value']['outV']['@value'];
											
				if (debugappui) console.log("processing edge: " + JSON.stringify(userGraph[i]));
				if (otherpartynodeid != usernodeid) { // this is another participant in the conv, other than you
					sourcenodeid = usernodeid; // this conv needs to be displayed between you and the other node
					
					var convID = find_conv_id_in_JSON_graph(convnodeid);
					
					var chatname = find_chat_name_in_JSON_graph(otherpartynodeid);
					
					if (convparticipants == null) { /// first conversation being processed
						convparticipants = {};
						convparticipants[convID] = [];
						convparticipants[convID].push(chatname);
						
						populateConversationOnPanel(convID, chatname);
					} else {
						if (convparticipants[convID] === undefined) { // this is a new conversation not yet processed
							convparticipants[convID] = [];
							convparticipants[convID].push(chatname);
							
							populateConversationOnPanel(convID, chatname);
						} else { // a new participant in the conversation.... will not populate conv on the panel again
							convparticipants[convID].push(chatname);
						}
					}
				
					//alert('about to call populateConversationOnPanel');
				
					
				}
				
			}
			
			if (sourcenodeid != null) {
				
				if (debugappui) console.log("adding edge " + edgeCount + " : " + userGraph[i]['@value']['id']['@value']['relationId'] + " between " + sourcenodeid + " - " + userGraph[i]['@value']['outV']['@value']);
				 g.edges.push({
					    id: userGraph[i]['@value']['id']['@value']['relationId'],
					    source: sourcenodeid,
					    target: userGraph[i]['@value']['outV']['@value'],
					    size: Math.random(),
					    color: '#ccc',
					    type: 'curve',
					    count : edgeCount
					  });
				 
				 edgeCount++;
			}
			 
		}
		
	}
	//alert("nodes: " + g.nodes );
	//alert('sent invites: ' + inviteout + ' received invites ' + invitein + ' conversations: ' + conversations);
	
	sigma_ins = new sigma({ 
        graph: g,
        renderer: {
            container: document.getElementById('publicpageusergraph'),
            type: 'canvas'
          },
        settings: {
            defaultNodeColor: '#ec5148'
        }
	});
	
	var summary = '';
	if (inviteout > 0)
		summary += 'Sent invites: ' + inviteout;
	
	if (invitein > 0) { // There are pending invitations
		
		displayInvitations();
		
		if (summary.length > 0)
			summary += '<br>';		
		
		summary += '<button type="button" class="btn btn-sm btn-default" onclick="return displayInvitations();">Invitations:' +  invitein + '</button>' ;
	}
	
	if (conversations > 0) {
		
		displayConversations();
		if (summary.length > 0)
			summary += '<br>';
		
		summary += '<button type="button" class="btn btn-sm btn-default" onclick="return displayConversations();">Conversations:' +  conversations + '</button>' ;
		
	}
	
	document.getElementById('graphsummary').innerHTML = '<p>' + summary + '</p>';
	
	return g;
}


function find_vertex_flake_in_JSON_graph( id){

	return nodeidflakemap[id]
	
}


function find_chat_name_in_JSON_graph(otherpartynodeid) {
	return nodeidnamemap[otherpartynodeid];
}

function find_conv_id_in_JSON_graph(convnodeid) {
	return nodeidconvmap[convnodeid];
}


function displayInvitations() {
	document.getElementById("invitations-panel").style.display='inline';
}


function displayConversations() {
	document.getElementById("conversations-panel").style.display='inline';
}



function populateInvitationOnPanel(senderid, senderflake, msg) {
	var rowlem  = document.createElement("div");
	rowlem.classList.add('panel');	
	rowlem.classList.add('panel-thin');	
	rowlem.setAttribute("id", "invite-" + senderid);
	
	var collem  = document.createElement("div");
	
	collem.classList.add('panel-body');
	collem.style.backgroundColor = "#7283a7"; 
	
	var p = document.createElement('p');
	p.style.color = '#fff';
	p.appendChild(document.createTextNode(msg));
	
	collem.appendChild(p);
	
	rowlem.appendChild(collem);
	
	// buttons panel
	
	var buttonspanel = document.createElement("div");
	buttonspanel.classList.add('panel');	
	buttonspanel.classList.add('panel-thin');	
	
	var accButton = document.createElement("input");
	accButton.classList.add('btn');
	accButton.classList.add('btn-primary');
	accButton.classList.add('btn-xs');
	//accButton.classList.add('pull-right');
	accButton.type = "button";
	accButton.value = "Accept";
	accButton.addEventListener('click', acceptInvitation, false);
	accButton.senderID = senderid;
	accButton.senderFlake = senderflake;
	
	var decButton = document.createElement("input");
	decButton.classList.add('btn');
	decButton.classList.add('btn-primary');
	decButton.classList.add('btn-xs');
	decButton.classList.add('pull-right');
	decButton.type = "button";
	decButton.value = "Decline";
	
	decButton.setAttribute("data-toggle", "modal"); 
	decButton.setAttribute("data-target", "#declineInviteModal"); 
	decButton.setAttribute("data-sendernodeid", senderid);
	decButton.setAttribute("data-senderflake", senderflake);
	
	buttonspanel.appendChild(decButton);
	buttonspanel.appendChild(accButton);
	accButton.style.marginRight = "3px";
	
	rowlem.appendChild(buttonspanel);
	
	document.getElementById("invitations-panel-body").appendChild(rowlem);
}


function populateConversationOnPanel (convid, chatname) {
	//alert('now populating conversations ' + convid + ' with ' + chatname);
	
	var existingconv = document.getElementById("conversation-" + convid);
	
	if (existingconv == null) {
		var rowlem  = document.createElement("div");
		rowlem.classList.add('panel');	
		rowlem.classList.add('panel-default');	
		rowlem.setAttribute("id", "conversation-" + convid);
		
		var heading  = document.createElement("div");
		
		heading.classList.add('panel-heading');
		
		var h5 = document.createElement('h5');
		h5.classList.add('panel-title');
		h5.appendChild(document.createTextNode(chatname +' '));
		h5.setAttribute("id", "conv-header-" + convid);
		
		var imgelem = document.createElement('img');
		imgelem.classList.add('user-icon');				
		
		if (convparticipants[convid].length == 1) {
			imgelem.src = '/static/icons/one-user-grey-16.png';
		}	
		
		if (convparticipants[convid].length > 1) {
			imgelem.src = '/static/icons/multiple-users-grey-16.png';
		}
		
		//imgelem.style.width = '4px';
		//imgelem.style.height = '4px';
		h5.appendChild(imgelem);
		
		heading.appendChild(h5);
		
		rowlem.appendChild(heading);
		
		var pbody = document.createElement("div");
		pbody.classList.add('panel-body');
		pbody.classList.add('panel-word-wrap');
		pbody.classList.add('pre-scrollable');
		pbody.setAttribute("id", "conv-data-" + convid);
		pbody.style.backgroundColor = "#cacaca"; 
		
		rowlem.appendChild(pbody);
		document.getElementById("conversations-panel-body").appendChild(rowlem);
		
		/*var msg = "HELLO There my message...";
		var type = 0;  // 0 - own, 1 - other, 1000 - system
		addconversationmessagetopanel(convid, msg, type);
		
		msg = "HELLO There other's message...";
		type = 1;  // 0 - own, 1 - other, 1000 - system
		addconversationmessagetopanel(convid, msg, type);
		
		msg = "SYSTEM MESSAGE";
		var type = 1000;  // 0 - own, 1 - other, 1000 - system
		addconversationmessagetopanel(convid, msg, type);*/
		
		joinconversation(convid);
		
		loadconversation(convid);
		
		var inputdiv = document.createElement("div");
		inputdiv.classList.add('panel-body');
		inputdiv.classList.add('panel-word-wrap');
		inputdiv.style.backgroundColor = "#c2c2c2"; 
		inputdiv.setAttribute("id", "conv-message-" + convid);
		
		var inputrow  = document.createElement("div");
			inputrow.classList.add('row');
			
		var inputcol = document.createElement("div");
		inputcol.classList.add('col-sm-9');
		
		inputrow.appendChild(inputcol);
		
		inputdiv.appendChild(inputrow);
		var msginput = document.createElement("input");
		msginput.setAttribute("type", "text");
		msginput.setAttribute("id", "conv-message-input-" + convid);
		msginput.classList.add('form-control');
		msginput.classList.add('input-md');
		msginput.addEventListener('input', prepareSendButton, false);
		msginput.addEventListener('change', trackTyping, false);
		msginput.conversationID = convid;
		msginput.style.color = '#454545';
		msginput.size = "50";
		
		var sendbutton = document.createElement("input");
		sendbutton.setAttribute("id", "conv-send-button-" + convid);
		sendbutton.classList.add('btn');
		sendbutton.classList.add('btn-primary');
		sendbutton.classList.add('btn-sm');
		sendbutton.classList.add('pull-right');
		sendbutton.conversationID = '';
		sendbutton.changestarttime = '';
		sendbutton.type = "button";
		sendbutton.value = "Send";
		sendbutton.addEventListener('click', sendConversationMessage, false);
		
		
		var inputcol2 = document.createElement("div");
		inputcol2.classList.add('col-sm-3');
		inputrow.appendChild(inputcol2);
		
		inputcol.appendChild(msginput);
		inputcol2.appendChild(sendbutton);
		
		inputdiv.appendChild(inputrow);
		rowlem.appendChild(inputdiv);
		
		
		pbody.scrollTop = pbody.scrollHeight;  // scroll to the bottom
	}
	//document.getElementById("conversations-panel-body").appendChild(rowlem);
}

function trackTyping (evt) {
	window.clearTimeout(tracktypingtimeoutid);
	
	startTrackTypingTimer(evt.target.conversationID);
}





function prepareSendButton (evt) {
	
	var now  = new Date();
	
	var sendbutton = document.getElementById("conv-send-button-" + evt.target.conversationID);
	
	sendbutton.conversationID = evt.target.conversationID;
	sendbutton.changestarttime = now.toUTCString();
	
	//alert('input for conversation "' + sendbutton.conversationID + ' "started changing at ' + sendbutton.changestarttime);
	// remove any further event handling for the input box
	
	sendTypingEventForConversation(evt.target.conversationID);
	evt.target.removeEventListener('input', prepareSendButton, false);
	
	startTrackTypingTimer(evt.target.conversationID);
	
}

function startTrackTypingTimer(convid) {
	if (debugappui) console.log('in startTrackTypingTimer convid: ' + convid);
	tracktypingtimeoutid = window.setTimeout(sendNoTypingEventForConversation, notypingtime, convid);
}

function sendTypingEventForConversation(convid) {
	//if (debugappui) console.log('in sendTypingEventForConversation convid: ' + convid);
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {    
        	// actually nothing happens on this client
        	// this event is delivered as an empty conversation message to other participants
        	// Will be handled in join conversation
        }
    }
	
    xhr.open('POST', '/newauth/api/addtypingeventtoconversation' , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
    
    //alert(currentavatar);
    var reqpacket = JSON.stringify({
					 	  sender : { flake : loggedinuserflake },
					 	 typing: 'true',
					 	 conversationID: convid
 					});
    
  //  alert('sending message to add to conversation: ' + reqpacket);
	xhr.send(reqpacket);
}

function sendNoTypingEventForConversation(convid) {
	
	if (debugappui) console.log('in sendNoTypingEventForConversation convid: ' + convid);
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {    
	        	// actually nothing happens on this client
	        	// this event is delivered as an empty conversation message to other participants
	        	// Will be handled in join conversation
	        }
	    }
		
	    xhr.open('POST', '/newauth/api/addtypingeventtoconversation' , false);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');     
	    
	    //alert(currentavatar);
	    var reqpacket = JSON.stringify({
						 	  sender : { flake : loggedinuserflake },
						 	 typing: 'false',
						 	 conversationID: convid
	 					});
	    
	  //  alert('sending message to add to conversation: ' + reqpacket);
		xhr.send(reqpacket);
		
		//clear timeout
		window.clearTimeout(tracktypingtimeoutid);
		
		// restart tracking input events on message box
		var msgInput = document.getElementById("conv-message-input-" + convid);
		msgInput.addEventListener('input', prepareSendButton, false);
	}

function sendConversationMessage(evt) {
	var convid = evt.target.conversationID;
	 var msg = document.getElementById("conv-message-input-" + convid).value;
	 var crtime  = document.getElementById("conv-send-button-" + convid).changestarttime;
	   
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {  
        	
        	var cpanel = document.getElementById("conv-data-" + convid);
        	addconversationmessagetopanel(cpanel, 
        								document.getElementById("conv-message-input-" + convid).value, 
        								0,
        								crtime,
        								fullname);
        	document.getElementById("conv-message-input-" + convid).value = '';
        	
        }
    }
	
    xhr.open('POST', '/newauth/api/addmessagetoconversation' , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
    
   
    //alert(currentavatar);
    var reqpacket = JSON.stringify({
					 	  // 	sender : { flake : loggedinuserflake },
					 	   message : msg,
					 	  messagecreatetime: crtime ,
					 	 conversationID: convid,
					 	 permanent: 'false'
 					});
    
  //  alert('sending message to add to conversation: ' + reqpacket);
	xhr.send(reqpacket);
}



function acceptInvitation(evt) {
	var acceptflake =  evt.target.senderFlake;
	var acceptid =  evt.target.senderID;
	
	clearexistinggraph();
	
	//alert ('DECLINE: dontinviteagain: ' + donotinviteagain + ' sendernodeid: ' + declinesenderid + ' flake' + declinesenderflake);
	
	if (acceptflake == null || acceptflake.length ==0)
		return false;

	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var jsonres = xhr.responseText;        	
        	//alert(jsonres);
        	userGraph = JSON.parse(atob(jsonres));
        	
        	convertanddrawgraphdata();	

        	var invitetoremove = document.getElementById("invite-" + acceptid);
        	removediv(invitetoremove);
        	
        	//alert('about to call populateConversationOnPanel');
        	populateConversationOnPanel();
        }
    }
	
    xhr.open('POST', '/newauth/api/acceptinvite' , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
    //alert(currentavatar);
    var reqpacket = JSON.stringify({
					 	   	sender : { flake : acceptflake },
					 	   receiver: { flake: loggedinuserflake}
 					});
	xhr.send(reqpacket);
}

function declineInvitation(senderid) {
	clearexistinggraph();
	var donotinviteagain = document.getElementById("dontinviteagaincheck").checked;
	
	//alert ('DECLINE: dontinviteagain: ' + donotinviteagain + ' sendernodeid: ' + declinesenderid + ' flake' + declinesenderflake);
	
	if (declinesenderflake == null || declinesenderflake.length ==0)
		return false;

	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var jsonres = xhr.responseText;        	
        	//alert(jsonres);
        	userGraph = JSON.parse(atob(jsonres));
        	
        	convertanddrawgraphdata();	

        	var invitetoremove = document.getElementById("invite-" + declinesenderid);
        	removediv(invitetoremove);
        }
    }
	
    xhr.open('POST', '/newauth/api/declineinvite' , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
    //alert(currentavatar);
    var reqpacket = JSON.stringify({
					 	   	sender : { flake : declinesenderflake },
					 	   receiver: { flake: loggedinuserflake},
					 	  blocknewinvites: donotinviteagain
 					});
	xhr.send(reqpacket);
	 
}

function dismissInvitations() {
	document.getElementById("invitations-panel").style.display='none';
	return false;
}

function dismissConversations() {
	document.getElementById("conversations-panel").style.display='none';
	return false;
}


function getnamelabel(props) {
	
	if ('fullName' in props) {
		return props['fullName']['0'];
	}
	
	if ('phone' in props) {
		return props['phone']['0'];
	}
	
	if ('email' in props) {
		return props['email']['0'];
	}
}

function getavatarname(props) {
	
	if ('avatar' in props) {
		return props['avatar'][0];
	}
	
	return null;
}

function getusername(props) {
	
	if ('userName' in props) {
		return props['userName'][0];
	}
	
	return null;
}



function clearexistinggraph() {
	//alert('clearing existing graph');
    //this gets rid of all the ndoes and edges
	sigma_ins.graph.clear();
	
	
    //this gets rid of any methods you've attached to s.
	//sigma_ins.graph.kill();
	
	sigma_ins.refresh();
};