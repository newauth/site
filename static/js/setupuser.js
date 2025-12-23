var currentfinalizeduserimagecount, totalimagecount, verificationcode, avatartimerinterval;

var loggedinusername;
var typingTimer;
var inmanage = false;
const doneTypingInterval = 1500; // Adjust this value to control the delay after typing stops (in milliseconds)


	
	function minimumentropy() {
		
		
		var permut = (factorial(6) );
		
		//alert(totalimagecount + ' total images ' + permut);
	
		var ent = getBaseLog(2, (Math.pow(16384 , 6) * permut));		//pow(4,7) = 16384	
			
		return parseFloat(Math.round(ent * 100) / 100).toFixed(2);
	}
	
	function currententropy() {
		
		if (currentfinalizeduserimagecount < 2)
			return "--";
		
		var permut;
		
		if (currentfinalizeduserimagecount > 6)
			permut = (factorial(totalimagecount)/factorial(totalimagecount-currentfinalizeduserimagecount) );
		else {
			permut = (factorial(currentfinalizeduserimagecount) );
		}
		
		//alert(totalimagecount + ' total images ' + permut);
	
		var ent = getBaseLog(2, (Math.pow(16384 , currentfinalizeduserimagecount) * permut));			
			
		return parseFloat(Math.round(ent * 100) / 100).toFixed(2);
	}
	
	
	function maximumentropy() {
		var permut = (factorial(totalimagecount)/factorial(totalimagecount-6) );
		//var permut = (factorial(16)/factorial(10) );
	
		var ent = getBaseLog(2, (Math.pow(16384 , 6) * permut));			
			
		return parseFloat(Math.round(ent * 100) / 100).toFixed(2);
	}
	
	
	function getBaseLog(base, val) {
		  return Math.log(val) / Math.log(base);
	}
	
	function factorial(n) {
		  if (n === 0) {
		    return 1;
		  }
		  
		  // This is it! Recursion!!
		  return n * factorial(n - 1);
		}
	
	function displayAuthScale( ) {
		
		var candiv = document.querySelector('#canvasdiv');
		
		//var canwidth = candiv.width;
		var canwidth = '600';
		var canheight = '200';
		
		var authcanvas = createHiDPICanvas(canwidth, canheight);
		
		//var authcanvas=document.querySelector('#auth-scale-canvas');
		
		candiv.appendChild(authcanvas);
		
		var ctx = authcanvas.getContext("2d");    	  
   	 	var font = "9px Arial";
   	 	var bigfont = "12px Arial";
		authcanvas.style.position = "relative";
		//authcanvas.width = window.screen.availWidth * 0.45;
		//authcanvas.height = '200';
		
		ctx.clearRect(0, 0, authcanvas.width, authcanvas.height);		
		
		var sidegap = 20;
		var bottomgap = 40;
		
		ctx.beginPath();
		ctx.moveTo(sidegap, (authcanvas.height - bottomgap)); //4,50
		ctx.lineTo((authcanvas.width - sidegap),(authcanvas.height - bottomgap)); // 396, 50
		ctx.lineTo((authcanvas.width - sidegap),bottomgap); // 396, 10
		ctx.fillStyle="#c2c2c2";
		ctx.fillStyle = "#c2c2c2";
		ctx.fill();
		
		ctx.beginPath();
		ctx.moveTo(sidegap, (authcanvas.height - bottomgap)); //4,50
		ctx.quadraticCurveTo((authcanvas.width - sidegap),(authcanvas.height - bottomgap), (authcanvas.width - sidegap),bottomgap); // 396, 50, 396, 10 
		
		ctx.fillStyle = "#ffffff";
		ctx.fillStyle="#ffffff";
		ctx.fill();
		
		ctx.font = font;
		ctx.fillStyle="#737373";
		
		var total = 16;
		
		for (var i=1; i<17; i++ ) {
			ctx.fillText(i, (sidegap + (i * (authcanvas.width - sidegap)/total)), (authcanvas.height - 2*bottomgap/3)); 
		}	
		
		// 16th Tic
		ctx.font = font;
		ctx.fillText("16", authcanvas.width - sidegap, (authcanvas.height - 2*bottomgap/3));
		ctx.fillText("6.3 M" , authcanvas.width - sidegap - 5, bottomgap); 
		
		ctx.fillStyle="#d00";
		
		if (currentfinalizeduserimagecount == 6)
			ctx.fillText("You are here" , (sidegap + (currentfinalizeduserimagecount * (authcanvas.width - sidegap)/total)), (authcanvas.height - bottomgap/7	)); 
		else
			ctx.fillText("You are here" , (sidegap + (currentfinalizeduserimagecount * (authcanvas.width - sidegap)/total)), (authcanvas.height - bottomgap/3	)); 
		
		ctx.font = font;
		ctx.fillText("Min" , (sidegap + (6 * (authcanvas.width - sidegap)/total)), (authcanvas.height - bottomgap/3)); 
		ctx.fillText("Max" , authcanvas.width - sidegap - 5, (authcanvas.height - bottomgap/3)); 
		
		
    	
		ctx.font = bigfont;
		//ctx.strokeStyle="#0a0a0a";
		ctx.fillStyle="#0a0a0a";
		ctx.fillText("Boxed images" , (sidegap + (7.2 * (authcanvas.width - sidegap)/total)), (authcanvas.height-5)); 
	}
	
	
	 
	function togglesearchbyalias() { // doing add only currently
		if (confirm('Are you sure you want to allow others to search you by your alias? ')) {
			var xhr = new XMLHttpRequest();
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		        	 document.getElementById("aliasvisiblecheck").checked = true; 
		 		    document.getElementById("fullnamevisiblecheck").checked = false; 
		 		    document.getElementById("giveoutspan").innerText = 'Alias';
		 		   setupUser(); // disabling alias instead of uploading the page again
		        } else {
		        	alert(xhr.responseText);
		        }
		    }
			xhr.open('POST', '/newauth/api/search/addalias', false);
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		    //alert('username: ' + document.getElementById("usernameinput").value);
		    
		    var reqpacket = JSON.stringify({
	     	   	username: document.getElementById("usernameinput").value,
	     	   	alias: document.getElementById("aliasinput").value,
	     	   firstname: document.getElementById("firstnameinput").value,
	     	   	lastname: document.getElementById("lastnameinput").value
	     		});
		    
		     xhr.send(reqpacket);   
		   
		    //document.getElementById("aliasvisiblecheck").setAttribute("disabled", "disabled");
		    return true;	
		} else {
			return false;
		}
	}
	
	function togglesearchbyflake() { // doing add only currently
		if (confirm('Are you sure you want to go dark? No one will be able to search you by your name or alias.')) {
			var xhr = new XMLHttpRequest();
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		        	document.getElementById("aliasvisiblecheck").checked = false; 
				    document.getElementById("fullnamevisiblecheck").checked = false; 
				    document.getElementById("giveoutspan").innerText = 'Flake';
		 		   setupUser(); // disabling alias instead of uploading the page again
		        } else {
		        	alert(xhr.responseText);
		        }
		    }
			xhr.open('POST', '/newauth/api/search/removenameandalias', false);
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		    //alert('username: ' + document.getElementById("usernameinput").value);
		    
		    var reqpacket = JSON.stringify({
	     	   	username: document.getElementById("usernameinput").value,
	     	   	alias: document.getElementById("aliasinput").value,
	     	   firstname: document.getElementById("firstnameinput").value,
	     	   	lastname: document.getElementById("lastnameinput").value
	     		});
		    
		    xhr.send(reqpacket);   
		   
		    //document.getElementById("aliasvisiblecheck").setAttribute("disabled", "disabled");
		    return true;	
		} else {
			return false;
		}
	}
	
	function togglesearchbyfullname() { // doing add only currently
		
		if (confirm('Are you sure you want to allow others to search you by your name?')) {
			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		        	document.getElementById("fullnamevisiblecheck").checked = true;
				    document.getElementById("giveoutspan").innerText = 'Full Name';
		 		   setupUser(); // disabling alias instead of uploading the page again
		        } else {
		        	alert(xhr.responseText);
		        }
		    }
			xhr.open('POST', '/newauth/api/search/addname', false);
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		    //alert('username: ' + document.getElementById("usernameinput").value);
		    
		    var reqpacket = JSON.stringify({
	     	   	username: document.getElementById("usernameinput").value,
	     	   alias: document.getElementById("aliasinput").value,
	     	   	firstname: document.getElementById("firstnameinput").value,
	     	   	lastname: document.getElementById("lastnameinput").value,
	     		});
		    
		    xhr.send(reqpacket);
		   
		    return true;	
		} else {
			return false;
		}
	}
	
	
	function togglesearchbyemailphone() { // doing add only currently
		//alert('function called');
		if (confirm('Are you sure you want to allow others to search you by your email and phone?')) {
			var xhr = new XMLHttpRequest();
			xhr.open('POST', '/newauth/api/search/addrecoveryoptions', false);
			
			var emaillist = [];
			
			var emelem  = document.getElementsByClassName('current-recovery-email');
			
			if (emelem) {
				for (var i=0; i<emelem.length; i++ ) {
					//alert('element' + em);
					emaillist.push (emelem[i].getElementsByTagName('p')[0].innerText.trim());
				}
			}
			
			var phonelist = [];
			
			var emelem1  = document.getElementsByClassName('current-recovery-phone');
			
			if (emelem1) {
				for (var i=0; i<emelem1.length; i++ ) {
					//alert("'" + emelem1[i].getElementsByTagName('p')[0].innerText.trim() + "'");
					
					var phoneobj = JSON.parse('{"number":"' + emelem1[i].getElementsByTagName('p')[0].innerText.trim() + '"}');
					phonelist.push (phoneobj);
				}
			}
			
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		    //alert('username: ' + document.getElementById("usernameinput").value);
		    
		    var reqpacket = JSON.stringify({
	     	   	username: document.getElementById("usernameinput").value,
	     	   	emails: emaillist,
	     	   	phones: phonelist,
	     		});
		     
		    document.getElementById("emailphonevisiblecheck").checked = true;
		    xhr.send(reqpacket);
		    setupUser();
		    return true;	
		} else {
			return false;
		}
	}
	
	function addemail() {
		var em = document.getElementById("emailinput").value;
		
		if (ValidateEmail(em)) {
			 
			 document.getElementById("verificationModeDetail").innerHTML = "email: " + em;
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		          // alert(xhr.responseText);
		        	var jsonres = xhr.responseText;
		        	var data = JSON.parse(jsonres);
		        	
		        	verificationcode = data.vercode;    			        	
		        	$('#verifyModal').modal('show');
		        }
		    }
			
			xhr.open('POST', '/newauth/api/addemail', true);
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		    var reqpacket = JSON.stringify({
	     	   	username: document.getElementById("usernameinput").value,
	     	   	emails:  document.getElementById("emailinput").value 
	     		});
		    
		    //alert(reqpacket);
		    xhr.send(reqpacket);
		    //setupUser();
		}
		
		return false;
	}
	
	function deleterecoveryemail(em) {
		alert('Not implemented ' + em);
	}
	

	

	
	function addphone() {
		var em = document.getElementById("phoneinput").value;
		
		if (ValidatePhone(em)) {
			document.getElementById("verificationModeDetail").innerHTML = "SMS: " + phone;
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		          // alert(xhr.responseText);
		        	var jsonres = xhr.responseText;
		        	var data = JSON.parse(jsonres);
		        	
		        	verificationcode = data.vercode;    			        	
		        	$('#verifyModal').modal('show');
		        }
		    }
			
			xhr.open('POST', '/newauth/api/addphone', true);
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		    var reqpacket = JSON.stringify({
	     	   	username: document.getElementById("usernameinput").value,
	     	   	phones: '{[{"number":"'+ document.getElementById("phoneinput").value +'"}]}'
	     		});
		    
		    //alert(reqpacket);
		    xhr.send(reqpacket);
		    //setupUser();
		}
		
		return false;
	}
	
	function verifyCode() {
		document.getElementById("verificationcodeinput").classList.remove("error");
		var cd = document.getElementById("verificationcodeinput").value;
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	          // alert(xhr.responseText);
	        	var jsonres = xhr.responseText;
	        	var data = JSON.parse(jsonres);
	        	
	        	var st = data.status.statuscode;  
	        	var em = data.email;
	        	var ph = data.phone;
	        	
	        	if (st === 'VERIFIED') {
	        		$('#verifyModal').modal('hide');
	        		setupUser();
	        	} else {
	        		document.getElementById("verifyerror").innerHTML = '<p class=error>' + data.status.detail + '</p>';
	        		//document.getElementById("verificationcodeinput").value = '';
	        	}
	        }
	    }
		
		xhr.open('POST', '/newauth/api/verifycode', true);
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    
	    var reqpacket = JSON.stringify({
	    	username: document.getElementById("usernameinput").value,
	    	email: document.getElementById("emailinput").value,
	    	phone: document.getElementById("phoneinput").value,
	    	verificationKeyCode: verificationcode, 
	    	verificationKeyInput: cd
	    	});
	    	    
	    //alert(reqpacket);
	    xhr.send(reqpacket);
	    //setupUser();
				
		return false;
	}
	
	function updateUsername() {
		var olduser = hashUserForAuthentication(document.getElementById("unu-currentusername").value);
		var newuser = hashUserForAuthentication(document.getElementById("unu-newusername").value);
		
		if (olduser !== loggedinusername) {
			console.log('loggedinusername' + loggedinusername + ' input user hash ' + olduser);
			document.getElementById('updateuserfeedback').innerText = "Please check the current username entered.";
			return false;
		}
		
		var doupdate = false;
		
		// First. validate the username
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/newauth/api/oktocreateusername', false);
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    
	    xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	           
	        	var res = xhr.responseText;        	
	        	if (res != null && res.length > 0) {
	        		if (res == 'DONOTCREATE') {
	        			document.getElementById('updateuserfeedback').innerText = "This username is already taken. Please choose a different username";
	        			return false;
	        		} else {
	        			
	        			if (confirm("You are about to change your username for Newauth. Your new user name is  '" + document.getElementById("unu-newusername").value +
	        					"'  Please make a note of this if you need to.")) {
		        			document.getElementById('updateuserfeedback').innerHTML = "";
		        			
	        				var xhr2 = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	        				
	        				xhr2.onreadystatechange = function() {
	        			        if (xhr2.readyState == 4 && xhr2.status == 200) {
	        			          // alert(xhr.responseText);
	        			        	var jsonres = xhr2.responseText;
	        			        	document.getElementById('updateuserfeedback').innerHTML = jsonres;    			        	
	        			        	
	        			        }
	        			    }
	        				
	        				xhr2.open('POST', '/newauth/api/updateusername', true);
	        			    xhr2.setRequestHeader('Content-Type', 'application/json');  
	        			    
	        			    var reqpacket = JSON.stringify({
	        			    	currentusername: olduser,
	        			    	newusername: newuser,
	        			    	processcode: document.getElementById('updateuserprocesscode').value
	        			    	});
	        			    	    
	        			    //alert(reqpacket);
	        			    xhr2.send(reqpacket);
	        			} else {
	        				document.getElementById('updateuserfeedback').innerText = "Your username has not been changed.";
	        			}
	        		}
	        	}
	        }
	    }		    
	   
	    // this is username check call
	    xhr.send(JSON.stringify({'username': newuser,
			//'usernameclear':username,
			'clientip': ''
				}));
		
	    
				
		return false;
	}
	
	
	function populateDeviceDisplayPanel() {
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	           //alert(xhr.responseText.length);
	        	var jsonres = xhr.responseText;
	        	
	        	if (jsonres.length > 0) {
	        		var data = JSON.parse(jsonres);
	        		
	        		if (data.length > 0) {
	        			document.getElementById("deviceinfodisplaypanel").innerHTML += '<p class="lead">You can restore your device settings to any of the previous settings.</p><p> Age is in number of days. Users is the number of Users which have successfully authenticated from this device.</p>	<hr>';
	        		} else {
	        			document.getElementById("deviceinfodisplaypanel").innerHTML += '<p class="lead">No devices found</p>';
	        		}
	        	
		        	for (var i=0; i< data.length; i++) {
		        		//alert(data[i].attachedusers);
		        		document.getElementById("deviceinfodisplaypanel").innerHTML += data[i].useragent ;
		        		if (navigator.userAgent.substring(0, 45) == data[i].useragent.substring(0, 45)) {
		        			//alert(data[i]);
		        			if (data[i].activeJWTId)
		        				document.getElementById("deviceinfodisplaypanel").innerHTML += '<p><mark>Current device : Age: ' + data[i].ageindays + ' Users: ' + data[i].attachedusers + '</mark></p>';
		        			else
		        				document.getElementById("deviceinfodisplaypanel").innerHTML += ' <button type="button" class="btn btn-sm btn-default" onclick="return swapJWT(\'' + data[i].jwtid + '\');">ID:' +  data[i].jwtid.substring(0, 8) + ' Age: ' + data[i].ageindays + ' Users: ' + data[i].attachedusers +'</button>'  ;
		        		}
		        		document.getElementById("deviceinfodisplaypanel").innerHTML += ' ' +  '<hr>';
		        	}
	        	}
	        }
	    }
		
		xhr.open('POST', '/newauth/api/devicedataforuser', true);
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    
	    var reqpacket = JSON.stringify({
	    	flake: loggedinuserflake
	    	});
	    	    
	    //alert(reqpacket);
	    xhr.send(reqpacket);
	    document.getElementById("deviceinfodisplaypanel").innerHTML = '';
	    //setupUser();
				
		return false;
		
	}
	
	function swapJWT (toid) {
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	           //alert(xhr.responseText);
	        	var resp = xhr.responseText;
	        	
	        	document.getElementById("deviceinfodisplaypanel").innerHTML += resp ;
	        
	        }
	    }
		
		xhr.open('POST', '/newauth/api/changedeviceid', true);
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    
	    var reqpacket = JSON.stringify({
	    	newid: toid,
	    	flake: loggedinuserflake	    	
	    	});
	    	    
	    //alert(reqpacket);
	    xhr.send(reqpacket);
	    //setupUser();
				
		return false;
	}
	
	function manageOrg(orgid) {
		if (orgid) {
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		        	if (xhr.responseText) {
			        	var resp = xhr.responseText;
			        	
			        	if (resp != null && resp.length > 0) {
				        	var orgobj = JSON.parse(resp);
				        	
				        	if (orgobj != null) {
					        	document.getElementById("orgid").value = orgobj.orgid;
					        	document.getElementById("orgtabname").value = orgobj.orgtabname;
					    		document.getElementById("orgname").value = orgobj.orgname;
				        	}
				        	$('#manageorgmodal').modal('show');
			        	}
		        	}
		        
		        }
		    }
			
			xhr.open('POST', '/newauth/api/getorganizationinfo', true);
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		    var ownerflake = '';
		    
		    if (document.getElementById("orgownerflake") != null)
		    	ownerflake = document.getElementById("orgownerflake").value;
		    
		    var reqpacket = JSON.stringify({
		    		orgid: orgid,
		    		ownerflake: ownerflake
		    	});
		    	    
		    //alert(reqpacket);
		    xhr.send(reqpacket);
			
		} else {
			document.getElementById("orgid").value = '';
        	document.getElementById("orgtabname").value = '';
    		document.getElementById("orgname").value = '';
			$('#manageorgmodal').modal('show');
		}
		
	}
	
	function removeOrg(orgid, ownerflake) {
		//alert('removing org ' + orgid + ' ' + ownerflake);
		if (orgid) {			
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		        	
		        	var resp = xhr.responseText;
		        	
		        	if (resp != null && resp.length > 0) {
			        	var orgobj = JSON.parse(resp);
			        	//alert ('response ' + resp);
			        	if (orgobj != null) {
				        	document.getElementById("orgid").value = orgobj.orgid;
				        	document.getElementById("orgtabname").value = orgobj.orgtabname;
				    		document.getElementById("orgname").value = orgobj.orgname;
				    		
				    		if (confirm('Are you sure you want to delete organization ' + document.getElementById("orgname").value)) {
				        		//alert ('will remove ' + document.getElementById("orgid").value);
				        		var xhr2 = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
				        		xhr2.onreadystatechange = function() {
				    		        if (xhr2.readyState == 4 && xhr2.status == 200) {
				    		        	
				    		        	var res = xhr2.responseText;
				    		        	removeorgfromsetuppage(orgid);
				    		        	removeorgfromheader(orgid);
				    		        }
				        		}
			    		        
				        		xhr2.open('POST', '/newauth/api/removeorg', true);
			    			    xhr2.setRequestHeader('Content-Type', 'application/json');
			    			    
			    			    //alert(orgid + ' ' + document.getElementById("orgtabname").value );
			    			    
			    			    var reqpac = JSON.stringify({
			    			    		orgid: orgid,
			    			    		orgtabname: document.getElementById("orgtabname").value,
			    			    		status: 'Inactive' ,
			    			    		ownerflake: ownerflake
			    			    		
			    			    	});
			    			    	    
			    			   // alert(' request to remove org ' + reqpac);
			    			    xhr2.send(reqpac);
			        		
				        	}
			        	}
		        	}
		        }
		    }
			
			xhr.open('POST', '/newauth/api/getorganizationinfo', true);
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		   // var ownerflake = '';
		    
		  //  if (document.getElementById("orgownerflake") != null)
		   // 	ownerflake = document.getElementById("orgownerflake").value;
		    
		    var reqpacket = JSON.stringify({
		    		orgid: orgid,
		    		ownerflake: ownerflake
		    	});
		    	    
		    //alert(reqpacket);
		    xhr.send(reqpacket);
			
		}
	}
	
	function updateorg() { // this adds or updates org
		// we need to store org private key in userdata .. check for vault key
		
		if (vaultkey == null || vaultkey.length == 0) {
			createvaultkeyoverlay();
			return false;
		}
		
		var orgid = document.getElementById("orgid").value;
		var orgtabname = document.getElementById("orgtabname").value;
		var orgname = document.getElementById("orgname").value;
		//alert('In updateorg -- orgid: '+ orgid);
		// generate pub and priv key pair
		
		if (orgid == null || orgid.length == 0) { // make sure org name and orgtabname are unique
			var currorgs = document.getElementsByClassName('user-org');
			for (var o=0; o< currorgs.length; o++) {
				//console.log('orgname ' + currorgs[o].getAttribute('data-orgname') + ' tab name ' + currorgs[o].innerText);
				if (currorgs[o].getAttribute('data-orgname') == orgname || currorgs[o].innerText == orgtabname) {
					document.getElementById('updateorg-err-message').innerText = 'Duplicate Org name or tabname not allowed';
					return false;
				}
				
			}		
		}
		
		var pair = sjcl.ecc.elGamal.generateKeys(384);
		var pub = pair.pub.get(), sec = pair.sec.get();

		// Serialized public key:
		pub = sjcl.codec.base64.fromBits(pub.x.concat(pub.y))
		
		// Serialized private key:
		sec = sjcl.codec.base64.fromBits(sec);
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	        	var resp = xhr.responseText;
	        	//alert(resp);
	        	var neworgid = resp.split(":=")[1];
	        	
	        	//alert(neworgid +  " " + resp.split(":=")[1]);
	        	if (orgid == null || orgid.length == 0) {// this is new org create
	        		addorgtoheader(neworgid, orgtabname);
	        		addorgtosetuppage(neworgid, orgtabname);
	        		
	        		addOrgPrivateKeytoUserData(resp, sec);
	        		
	        	}
	        	$('#manageorgmodal').modal('hide');
	        
	        }
	    }
		
		xhr.open('POST', '/newauth/api/updateorg', true);
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    
	    var ownerflake = '';
	    if (document.getElementById("orgownerflake") != null)
	    	ownerflake = document.getElementById("orgownerflake").value;
	    
	    var reqpacket = JSON.stringify({
	    		orgid: orgid,
	    		orgname: orgname,
	    		orgtabname: orgtabname,
	    		publicKey: pub,
	    		ownerflake: ownerflake,
	    		status: 'active'	    	
	    	});
	    	    
	    //alert(reqpacket);
	    xhr.send(reqpacket);
	    //setupUser();
				
		return false;
	}
	
	function addOrgPrivateKeytoUserData(org, orgkey) {
		if (orgkey != null  && orgkey.length > 0) {
		//alert('going to add org private key to user vault ' + org + ' ' + orgkey);
			getuserdatafromdb(0, function(keydata) {
							var arraytoreturn = [];
							//alert('in addOrgPrivateKeytoUserData .. current userdata for seq 0 '+ keydata);
							if (keydata != null && keydata.length > 0) {										
								
								if (typeof keydata === "string" && keydata.indexOf('"') < 0) {
									arraytoreturn.push(keydata);
								} else {
									//console.log('Parsing ' + keydata);
									var jsonobjindb = JSON.parse(keydata);
									//alert('json obj parsed');
									if (!Array.isArray(jsonobjindb)) {
										arraytoreturn.push(jsonobjindb);
									} else {											
										for (var i = 0; i < jsonobjindb.length; i++) {
											arraytoreturn.push( jsonobjindb[i]);
										}											
									}
								}
								
								var keyobj = {
													"org": org,
													"privkey": orgkey
											};
								
								if (pushUniqueToArray(arraytoreturn, keyobj)) {
								//arraytoreturn.push ({
								//				"org": org,
								//				"privkey": orgkey
								//});
								
									otherkeys.push (keyobj);
								} else {
									arraytoreturn = [];
								}
							}
							
							//alert('array with new orgkey  '+ JSON.stringify(arraytoreturn));
							
							if (arraytoreturn.length > 0) {
								var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
								
							    xhr.open('POST', '/secure/adduserdata', false);
							    xhr.withCredentials = true;
							    xhr.setRequestHeader('Content-Type', 'application/json');   
							    
							    var enckeydata = encryptdatawithstretchedkey(JSON.stringify(arraytoreturn), vaultkey,'',0);
							    
							    xhr.onreadystatechange = function() {
							        if (xhr.readyState == 4 && xhr.status == 200) {
							        	//console.log('Org key added to userdata. Removing Message sent by org owner');
							        	 clearsecureuserdatafromdb('ORGKEY'); // the data has been moved to users vault. delete it...
							        	 console.log("New orgkey successfully updated to userdata.");
							        }
							    }
							   					   
							    xhr.send(JSON.stringify({					     	   	
							     	   	data: enckeydata ,
							     	   	sequence: 0					     	   	
					     		}));
							} else {
								console.log("The Orgkey already existed in user data, not updating...");
							}
							
						    if (document.getElementById("vault-key-overlay") != null) {
						    	$('#vault-key-overlay').fadeOut('slow');
						    }
			});		
		}
	}
	
	
	function pushUniqueToArray(arr, obj) {
	    const index = arr.findIndex((e) => e.org === obj.org);

	    if (index === -1) {
	        arr.push(obj);
	        return true;
	    } else {
	    	console.warn('Tried to add duplicate entry to array ' + JSON.stringify(obj));
	    	return false;
	    }
	}

// Function to make the API call when typing is complete
function checkUniqueUsername(event) {
	// Replace the URL with your server API endpoint
	const apiEndpoint = "/newauth/api/oktocreateusername";
	var username = document.getElementById('cu-username-input').value;
	var displaydiv;
			
	if (username.length <6) {
		document.getElementById('flk-send-button').style.display = 'block';
		document.getElementById('flk-send-button').disabled = 'true';
		return false;
	} else {	
		displaydiv = displaybuttonbehavior(event, 'Wait ... checking username');
	}
		
	fetch(apiEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			'username': hashUserForAuthentication(username),
			//'usernameclear':username,
			'clientip': ''
		}),
	})
		.then(response => {
		      if (!response.ok) {
		        throw new Error("Network response was not ok");
		      }
		      return response.text();
		    })
		.then(data => {
			// Handle the response from the server API
			//console.log("Server API response:", data);
			if (data == 'OK') {
				removediv(displaydiv);
				document.getElementById('cu-username-input').value=  username;
				document.getElementById('cu-username-input').placeholder=  'Minimum 6 symbols';
				document.getElementById('cu-username-input').style.border = '';
				document.getElementById('flk-send-button').removeAttribute('disabled');
				displaybuttonbehavior(event, 'Click Create button now.');
			} else {
				document.getElementById('cu-username-input').style.border = '2px solid red';
				displaybuttonbehavior(event, 'Please choose a different username');
				document.getElementById('cu-username-input').value= '';
				document.getElementById('flk-send-button').disabled = 'true';
			}
		})
		.catch(error => {
			// Handle any errors that occurred during the API call
			console.error("Error:", error);
			document.getElementById('cu-username-input').style.border = '2px solid red';
			document.getElementById('cu-username-input').value=  '';
			document.getElementById('cu-username-input').placeholder=  'Please try later. Network error';
	
		});
}

	
	function mobileusercreate(refflake) {
	var flakeoverlay = document.getElementById("createuser-mobile-overlay"); // this id is setup as blocking overlay
	
	if (flakeoverlay == null) {
		//alert('in createUserFlakeOverlay .. creating new overlay');
		flakeoverlay = document.createElement("div");
		flakeoverlay.setAttribute("id", "createuser-mobile-overlay");
		document.body.appendChild(flakeoverlay);
		
		var cntnr = document.createElement("div");
		cntnr.classList.add('container');
		cntnr.style.marginTop = '5px';
		//cntnr.classList.add('v-center');
			
		var rowdiv = document.createElement("div");
		rowdiv.classList.add('row');
		
		
		var coldiv = document.createElement("div");
		coldiv.classList.add('col-md-8'); 
		coldiv.classList.add('col-md-offset-2');
		
		//coldiv.classList.add('center-block');
		
		var panl = document.createElement("div");
		panl.classList.add('panel'); 
		panl.classList.add('panel-default');
		panl.setAttribute("id", "createuser-overlay-content");
		 var p = document.createElement('h3');
		// p.classList.add('lead');
		 
		p.appendChild(document.createTextNode(""));
		 p.style.color = "#737373"; 
		 p.style.fontWeight = "900"; 
		
		// panl.appendChild(p);
		 
		 var headingrowc = document.createElement("div");
			headingrowc.classList.add('row');  
			headingrowc.classList.add('text-center');
			
			var headcol1 = document.createElement("div");
			headcol1.classList.add('col-xs-12');  
			//headcol1.classList.add('col-xs-offset-2');  
			
			var pdiv = document.createElement("p");
			pdiv.style.fontSize = "18px";
			pdiv.style.fontFamily = 'Arial Black';
			pdiv.appendChild(document.createTextNode("Create newauth Account"));
			
			headcol1.appendChild(pdiv);	
			headingrowc.appendChild(headcol1);	
		 
			panl.appendChild(headingrowc);
		 
		 var headrowc = document.createElement("div");
			headrowc.classList.add('row');  
			headrowc.classList.add('text-center');
			
			var headcol = document.createElement("div");
			headcol.classList.add('col-xs-4');  
			headcol.classList.add('col-xs-offset-4');  
			
			var candiv = document.createElement("img");
			candiv.src = '/static/icons/vlt-aniim-gif.gif';
			candiv.classList.add('center-block');
			candiv.width = '65';
			candiv.height = '65';
			candiv.style.borderRadius = '4px';
			candiv.setAttribute("id", "cu-flake-can");
			
			headcol.appendChild(candiv);	
			headrowc.appendChild(headcol);	
		 
			panl.appendChild(headrowc);
		
		 
		 let closeanchor = document.createElement('span');
		    closeanchor.innerHTML = '&times;';
		    closeanchor.style.float='right';
		    closeanchor.style.padding= '0px 8px';
		    closeanchor.style.fontSize= '3em';
		    closeanchor.style.top= '0px';
		    closeanchor.style.display = 'inline-block';
		    closeanchor.style.color = '#a2a2a2';
		    closeanchor.style.cursor = 'default';
		    closeanchor.addEventListener('mouseover', function(e) {
		    	e.target.style.color = '#d3d3d3';
		    });
		    closeanchor.addEventListener('mouseout', function(e) {
		    	e.target.style.color = '#a2a2a2';
		    });
		    
		    closeanchor.addEventListener('click', function() {
		    	$('#createuser-mobile-overlay').fadeOut(500);
		    	removediv(document.getElementById('createuser-mobile-overlay'));
		    	//alert('removed overlay');
		    	//loadWelcome();
		    	//fadeoutelement('app');
		    });
		    coldiv.appendChild(closeanchor);
		 
		 var pdh = document.createElement('p');
		 pdh.classList.add('lead');
		 pdh.setAttribute("id", "createuser-flake-text-header");
		 
		 pdh.appendChild(document.createTextNode("Choose your username"));
		 pdh.style.color = "#737373";
		 pdh.style.fontWeight = "700";
		 pdh.style.paddingTop = "5px"; 
		
		 panl.appendChild(pdh);
		 
		 var inputrowp = document.createElement("div");
			inputrowp.classList.add('row');
			
		var inputcolp = document.createElement("div");
		inputcolp.classList.add('col-sm-8');
		inputcolp.classList.add('col-sm-offset-2');
		 
		 var pd = document.createElement('p');
		 pd.classList.add('text-muted');
		 pd.setAttribute("id", "createuser-flake-text");
		 
		 pd.appendChild(document.createTextNode("Your username is for your eyes only. Newauth doesn't store it. Don't share."));
		 pd.style.color = "#878787"; 
		 pd.style.fontWeight = "600";
		 
		 var pd2 = document.createElement('p');
		 pd2.classList.add('text-muted');
		 pd2.setAttribute("id", "createuser-flake-text");
		 
		 pd2.appendChild(document.createTextNode("Avoid using your full name. Other than that, choose anything you can remember and type easily."));
		 pd2.style.color = "#878787"; 
		 pd2.style.paddingLeft = "8px"; 
		 pd2.style.paddingRight = "8px"; 
		 pd2.style.paddingTop = "2px"; 
		 pd2.style.fontWeight = "500";
		
		 inputcolp.appendChild(pd);
		 
		 inputcolp.appendChild(pd2);
		
		 inputrowp.appendChild(inputcolp);		 
		
		 panl.appendChild(inputrowp);			
			
		 var inputdiv = document.createElement("div");
			inputdiv.classList.add('panel-body');
			inputdiv.classList.add('panel-word-wrap');
			//inputdiv.style.backgroundColor = "#c2c2c2"; 
			
			var inputrow  = document.createElement("div");
				inputrow.classList.add('row');
				
			var inputcol = document.createElement("div");
			inputcol.classList.add('col-xs-8');
			//inputcol.classList.add('col-sm-offset-2');
			inputcol.setAttribute('id', 'create-user-input-holder');
			
			inputrow.appendChild(inputcol);
			
			inputdiv.appendChild(inputrow);
			var cuflkinput = document.createElement("input");
			cuflkinput.setAttribute("type", "password");
			cuflkinput.setAttribute("id", "cu-username-input");
			cuflkinput.style.fontSize = '18px';
			cuflkinput.setAttribute("placeholder", "At least 6 characters");
			cuflkinput.setAttribute("autofocus", "true");
			
			cuflkinput.setAttribute("data-toggle","password");
			cuflkinput.setAttribute("data-message","Show/hide username");
			cuflkinput.classList.add('form-control');
			cuflkinput.classList.add('input-md');
			//cuflkinput.addEventListener('input', prepareSendButton, false);
			
			function resetTypingTimer(event) {
			  clearTimeout(typingTimer);
			}
			
			// Function to start the timer when typing stops
			function startTypingTimer(event) {
			  typingTimer = setTimeout(function() {
				  checkUniqueUsername(event);
				  }
				  , doneTypingInterval);
			}

			cuflkinput.addEventListener('input', function(event){ 
				
				resetTypingTimer(event);
  				startTypingTimer(event);
				
			}, false);
			cuflkinput.style.color = '#646464';
			
			var sendbutton = document.createElement("input");
			sendbutton.setAttribute("id", "flk-send-button");
			sendbutton.classList.add('btn');
			sendbutton.classList.add('btn-primary');
			sendbutton.classList.add('btn-md');
			//sendbutton.classList.add('pull-right');
			sendbutton.conversationID = '';
			sendbutton.changestarttime = '';
			sendbutton.type = "button";
			sendbutton.disabled = "true";
			sendbutton.value = "Create";
			//sendbutton.style.marginTop = '10px';
			sendbutton.style.display = 'block';
			sendbutton.addEventListener('click', function(){
					createaccountfrommobile(refflake);
				}, false);			
			
			var inputcol2 = document.createElement("div");
			inputcol2.classList.add('col-xs-4');
			inputrow.appendChild(inputcol2);
			
			inputcol.appendChild(cuflkinput);
			inputcol2.appendChild(sendbutton);
			
			inputdiv.appendChild(inputrow);
		 
		 panl.appendChild(inputdiv);
		 
		 coldiv.appendChild(panl);
		 
		rowdiv.appendChild(coldiv);
		cntnr.appendChild(rowdiv);
		flakeoverlay.appendChild(cntnr);
		
	
		  $('#cu-username-input').focus();
	
	}
	
	
	settimeoutid = setTimeout(function(){ 
				//flakeoverlay.style.display = "block";
				$('#createuser-mobile-overlay').fadeIn('slow');
			}, 500);

}

function createaccountfrommobile(refflake) {
	if (confirm('Please confirm the username  "' + document.getElementById("cu-username-input").value
					+ '"  . Your Newauth username should be kept private and only known to you. Newauth does not store it in a readable '
					+ 'format. If you need to make a note of your username, do so now before continuing. Click OK to confirm and create your account.')) {
		
		//$(this).prop("disabled",true); // disable the button so it can not be submitted again
		document.getElementById('flk-send-button').disabled = 'true';
		
		createusershell(document.getElementById("cu-username-input").value,refflake);
		
		document.getElementById('createuser-mobile-overlay').style.opacity = '0.6';
		
	} else {
		return false;
	}
	
	return false;
}

function createusershell(username, flake) {
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	          // alert(xhr.responseText);
	        	var jsonres = xhr.responseText;
	        	if (jsonres.length > 10) {
					addCollageCSS();
					createCollage(jsonres);
					
					$('#createuser-mobile-overlay').fadeOut(500);
		    	removediv(document.getElementById('createuser-mobile-overlay'));
				}
	        }
	    }
		
		xhr.open('POST', '/newauth/api/addusername', true);
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    var hashedusername = hashUserForAuthentication(username);
	    
	    var reqpacket = JSON.stringify({
	    	username: hashedusername,
	    	refflake: flake,
	    	type: 0
	    	});
	    	    
	    //alert(reqpacket);
	    xhr.send(reqpacket);
	    //setupUser();
				
		return false;
}

function addCollageCSS() {

  // Create style element
  const style = document.createElement('style');

  // Add CSS rules
  style.innerHTML = `
    .collage-container {
		  background-color: #545454;
		   z-index: 9998;
      		position: fixed;
      		top: 0;
      		left: 0;
      		width: 100%;
      		height:100%;
		}
    
    .collage {
      display: flex;
      align-items: flex-start; 
      justify-content: center;
      flex-wrap: wrap;
      top: 50%; 
      position:fixed;
      max-height: 60%;
	  width: 90%;  
	  margin-left: auto;
  	margin-right: auto;
      transform: translateY( -50%);
      object-fit: cover;
      overflow: hidden;
    }
    
    .collage img {
      width: 30%;
      opacity: 0.1;
  		height: auto;
  		max-height: 20%;
  		
    }
    
    
  `;

  // Append style to head
  document.head.appendChild(style);

}

function createCollage(imagesjson) {
	
	var imobjs = JSON.parse(imagesjson);
	
	var images = [];
	
	for (var i=0; i<imobjs.length; i++) {
		images.push('/image/' + imobjs[i].imageid);
	}
	
		const lockiconholder = document.createElement('div');
		lockiconholder.style.position = 'fixed';
		lockiconholder.style.top = '20px';
		lockiconholder.style.zIndex = '9999';
		lockiconholder.style.left = '50%';
		lockiconholder.style.transform= 'translate(-50%, 0)';
		
  		const lockicon = document.createElement('img');
  		lockicon.width = '28';
  		lockicon.height = '28';
  		lockicon.src = '/static/icons/lock-64.png';
  		lockiconholder.appendChild(lockicon);
  		document.body.appendChild(lockiconholder);
  		
  		
	const collagecont = document.createElement('div');
  collagecont.classList.add('collage-container');

  // Create collage container
  const collage = document.createElement('div');
  collage.classList.add('collage');

  // Loop through images
  var imgct = 0;
  images.forEach(imageUrl => {

    // Create image element    
    const img = document.createElement('img');
    img.src = imageUrl;

    // Append to collage 
    if (imgct < 15) collage.appendChild(img);
	imgct++;
  });

	collagecont.appendChild(collage);
  // Add collage to page
  document.body.appendChild(collagecont);
  
  const noticecont = document.createElement('div');
  noticecont.id = 'acct-cr-notice';
  noticecont.style.position = 'fixed';
  noticecont.style.top = '50%';
  noticecont.style.left = '50%';	
  noticecont.style.width = "80%";
  noticecont.style.display = 'none';
  noticecont.style.backgroundColor = "#454545";
  noticecont.style.opacity = "0.9";
  noticecont.style.zIndex = '9999';
  noticecont.style.textAlign = 'center';
  noticecont.style.fontSize = '18px';
  noticecont.style.transform= 'translate(-50%, -50%)';
  noticecont.style.color = '#838383';
  noticecont.innerHTML = '<h4 style="font-size: 18; font-family:Arial black; color: #f5f5f5;">Account setup pending!</h4>' +
		'<br> ' + 
		'<p style="font-size: 14; padding-left:5px; padding-right: 5px; color: #d6d6d6;">To complete setup, you must visit our website from a Desktop or Laptop computer. Their larger screens allow us to precisely track actions during setup for improved security.</p> ' +
		'<p style="font-size: 12; padding-left:5px; padding-right: 5px;color: #bababa;">From a <strong>Desktop or Laptop</strong>, go to: </p>' + 
		'<p style="font-size: 13;padding-left:5px; padding-right: 5px;font-family:Arial black; color: #bababa;"><strong>https://newauth.io</strong></p>' + 
		'<p style="font-size: 12; padding-left:5px; padding-right: 5px;color: #bababa;">Enter your username and follow the instructions provided. </p>';
  
  
  
  setTimeout(function(){
	  $('#acct-cr-notice').fadeIn('slow');
	  }, 2000);
  document.body.appendChild(noticecont);
  
  const footer = document.createElement('div');
  footer.style.position = 'fixed';
  footer.style.bottom = '15px';
  footer.style.right = '15px';	
  footer.style.zIndex = '9999';
  footer.style.fontSize = '18px';
  footer.style.color = '#a3a3a3';
  footer.appendChild(document.createTextNode('n e w a u t h'));
  document.body.appendChild(footer);
  // flicker
  
  const flimages = document.querySelectorAll('.collage img');
  
  flimages.forEach(img => {
	  img.style.transition = 'opacity 2s'; 
	});

	let animated = [];

setInterval(() => {

  flimages.forEach(img => {

    // If already animated, skip this image
    if(animated.includes(img)) return; 

    animated.push(img);

    img.style.transition = 'opacity 1.2s';

    img.style.opacity = Math.random() > 0.8 ? 1 : 0.3;

    // Remove from animated list after transition ends
    setTimeout(() => {
      animated = animated.filter(i => i !== img);
    }, 800);

  });

}, 500);

}

	
	  function createvaultkeyoverlay(fnaftersuccess) {
			
			var flakeoverlay = document.getElementById("vault-key-overlay"); // this id is setup as blocking overlay
			
			if (flakeoverlay == null) {
				//alert('in createUserFlakeOverlay .. creating new overlay');
				flakeoverlay = document.createElement("div");
				flakeoverlay.setAttribute("id", "vault-key-overlay");
				document.body.appendChild(flakeoverlay);
				
				var cntnr = document.createElement("div");
				cntnr.classList.add('container');
				cntnr.classList.add('v-center');
					
				var rowdiv = document.createElement("div");
				rowdiv.classList.add('row');			
				
				var coldiv = document.createElement("div");
				coldiv.classList.add('col-md-8'); 
				coldiv.classList.add('col-md-offset-2');
				
				//coldiv.classList.add('center-block');
				
				var panl = document.createElement("div");
				panl.classList.add('panel'); 
				panl.classList.add('panel-default');
				
				 var p = document.createElement('h3');
				// p.classList.add('lead');
				 
				p.appendChild(document.createTextNode(""));
				 p.style.color = "#737373"; 
				 p.style.fontWeight = "900"; 
				
				 panl.appendChild(p);
				 
				 let closeanchor = document.createElement('span');
				    closeanchor.innerHTML = '&times;';
				    closeanchor.style.float='right';
				    closeanchor.style.padding= '2px 7px';
				    closeanchor.style.fontSize= '1.6em';
				    closeanchor.style.top= '0px';
				    closeanchor.style.display = 'inline-block';
				    closeanchor.style.color = '#a2a2a2';
				    closeanchor.style.cursor = 'default';
				    closeanchor.addEventListener('mouseover', function(e) {
				    	e.target.style.color = '#d3d3d3';
				    });
				    closeanchor.addEventListener('mouseout', function(e) {
				    	e.target.style.color = '#a2a2a2';
				    });
				    
				    closeanchor.addEventListener('click', function() {
				    	$('#vault-key-overlay').fadeOut(500);
				    	
				    });
				    coldiv.appendChild(closeanchor);
				 
				 var pdh = document.createElement('p');
				 pdh.classList.add('lead');
				 pdh.setAttribute("id", "createuser-flake-text-header");
				 
				 pdh.appendChild(document.createTextNode("This operation requires data from your vault in order to proceed."));
				 pdh.style.color = "#737373";
				 pdh.style.fontWeight = "700";
				
				 panl.appendChild(pdh);
				 
				 var inputrowp = document.createElement("div");
					inputrowp.classList.add('row');
					
				var inputcolp = document.createElement("div");
				inputcolp.classList.add('col-sm-8');
				inputcolp.classList.add('col-sm-offset-2');
				 
				 var pd = document.createElement('p');
				 pd.classList.add('text-muted');
				 pd.setAttribute("id", "createuser-flake-text");
				 
				 pd.appendChild(document.createTextNode("Please enter your Vault Key below. Your username is your vault key if you have not changed it."));
				 pd.style.color = "#878787"; 
				 pd.style.fontWeight = "600";
				
				 inputcolp.appendChild(pd);
				 inputrowp.appendChild(inputcolp);		 
				
				 panl.appendChild(inputrowp);		 	
					
					
				 var inputdiv = document.createElement("div");
					inputdiv.classList.add('panel-body');
					inputdiv.classList.add('panel-word-wrap');
					//inputdiv.style.backgroundColor = "#c2c2c2"; 
					
					var inputrow  = document.createElement("div");
						inputrow.classList.add('row');
						
					var inputcol = document.createElement("div");
					inputcol.classList.add('col-sm-8');
					inputcol.classList.add('col-sm-offset-2');
					
					inputrow.appendChild(inputcol);
					
					inputdiv.appendChild(inputrow);
					var cuflkinput = document.createElement("input");
					cuflkinput.setAttribute("type", "password");
					cuflkinput.setAttribute("id", "vault-key-input");
					cuflkinput.setAttribute("autofocus", "true");
					cuflkinput.classList.add('form-control');
					cuflkinput.classList.add('input-md');
					//cuflkinput.addEventListener('input', prepareSendButton, false);
					cuflkinput.addEventListener('input', function(){ 					
						var flk = document.getElementById('vault-key-input').value;
						if ( flk.length >= 6) {
							$('#cde-send-button').fadeIn('slow');
						} else {
							document.getElementById('cde-send-button').style.display = 'none';
						}
					}, false);
					cuflkinput.style.color = '#646464';
					
					cuflkinput.addEventListener('keyup', function() {
						if ( event.keyCode !== 13) return;
						
						vaultkey = document.getElementById('vault-key-input').value;
						//alert(vaultkey);
						
						getuserdatafromdb(0, function(keydata) {																		
												
												if (keydata != 'ERROR') {
													//alert('full userdata for seq 0 '+ keydata);
													
													if (typeof keydata === "string" && keydata.indexOf('"') < 0) {
														userkey = keydata;
													} else {	
														var jsonobjindb = JSON.parse(keydata);
														userkey = jsonobjindb[0];
														
														for (var i=1; i<jsonobjindb.length; i++ ) {
															otherkeys.push(jsonobjindb[i]);
														}	
													}
													
													if (fnaftersuccess) {
														fnaftersuccess();
													}
													//alert('userkey found '+ userkey);
													$('#vault-key-overlay').fadeOut('slow');
												} else {
													document.getElementById('vault-key-input').style.borderColor = 'red';
													document.getElementById('vault-key-input').value
												}
											});
					}, false);		
					
					var sendbutton = document.createElement("input");
					sendbutton.setAttribute("id", "cde-send-button");
					sendbutton.classList.add('btn');
					sendbutton.classList.add('btn-primary');
					sendbutton.classList.add('btn-md');
					//sendbutton.classList.add('pull-right');
					sendbutton.conversationID = '';
					sendbutton.changestarttime = '';
					sendbutton.type = "button";
					sendbutton.value = "Submit";
					sendbutton.style.display = 'none';
					sendbutton.addEventListener('click', function() {
												vaultkey = document.getElementById('vault-key-input').value;
												//alert(vaultkey);
												
												getuserdatafromdb(0, function(keydata) {																		
																		
																		if (keydata != 'ERROR') {
																			//alert('full userdata for seq 0 '+ keydata);
																			
																			if (typeof keydata === "string" && keydata.indexOf('"') < 0) {
																				userkey = keydata;
																			} else {	
																				var jsonobjindb = JSON.parse(keydata);
																				userkey = jsonobjindb[0];
																				
																				for (var i=1; i<jsonobjindb.length; i++ ) {
																					otherkeys.push(jsonobjindb[i]);
																				}	
																			}
																			
																			if (fnaftersuccess) {
																				fnaftersuccess();
																			}
																			//alert('userkey found '+ userkey);
																			$('#vault-key-overlay').fadeOut('slow');
																		} else {
																			document.getElementById('vault-key-input').style.borderColor = 'red';
																			document.getElementById('vault-key-input').value
																		}
																	});
											}, false);				
									
					var inputcol2 = document.createElement("div");
					inputcol2.classList.add('col-sm-2');
					inputrow.appendChild(inputcol2);
					
					inputcol.appendChild(cuflkinput);
					inputcol2.appendChild(sendbutton);
					
					inputdiv.appendChild(inputrow);
				 
				 panl.appendChild(inputdiv);
				 
				 coldiv.appendChild(panl);
				 
				rowdiv.appendChild(coldiv);
				cntnr.appendChild(rowdiv);
				
				
				flakeoverlay.appendChild(cntnr);				

				  $('#vault-key-input').focus();
			
			}
			
			settimeoutid = setTimeout(function(){ 
						//flakeoverlay.style.display = "block";
						$('#vault-key-overlay').fadeIn('slow');
					}, 500);
			
		}
	  
	  
	
	function addorgtoheader(orgid, orgname) {
		var ulelem = document.getElementById("hdr-right-list");
		
		var lielem = document.createElement("li");
		lielem.setAttribute('id', "user-org-header-" + orgid);
			
		var aelem = document.createElement("a");
		
		//aelem.href = "javascript:loadSearchDetailModal('" + avatarname + "', '" + flake + "');";
		aelem.onclick = function() {
									return loadOrgPage(loggedinuserflake, orgid );
						};
		aelem.classList.add('na-header-anchor');
		var textelem = document.createTextNode(orgname); 
		
		aelem.appendChild(textelem);
		
		lielem.appendChild(aelem);
		
		ulelem.insertBefore(lielem, ulelem.childNodes[0]);
	}
	
	function addorgtosetuppage(orgid, orgname) {
		//alert('adding org id ' + orgid + ' name ' + orgname + '  to the page');
		var container = document.getElementById("user-org-list");
		
		var rowelem = document.createElement("div");
		rowelem.classList.add('row');
		rowelem.setAttribute("id", "user-org-" + orgid);
							
		var colelem = document.createElement("div");
		colelem.classList.add('col-md-4');
		var pelem  = document.createElement("p");
		pelem.classList.add('text-right');
		
		var aelem = document.createElement("a");
		
		//aelem.href = "javascript:loadSearchDetailModal('" + avatarname + "', '" + flake + "');";
		aelem.onclick="javascript:return manageOrg('" + orgid + "', '" + loggedinuserflake + "');";
		
		var textelem = document.createTextNode(orgname); 
		
		aelem.appendChild(textelem);
		pelem.appendChild(aelem);
		colelem.appendChild(pelem);
		
		rowelem.appendChild(colelem);
		
		var colelem2 = document.createElement("div");
		colelem2.classList.add('col-md-4');
		
		var btn = document.createElement("BUTTON");  
		btn.classList.add('btn');
		btn.classList.add('btn-xs');
		btn.classList.add('btn-default');
		btn.onclick= function(ev){    
			addmembertoOrgModal(orgid, loggedinuserflake);
	       
	      };
					
		btn.innerHTML = "Add member";                  
		colelem2.appendChild(btn);  
		
		rowelem.appendChild(colelem2);
		
		var colelem3 = document.createElement("div");
		colelem3.classList.add('col-md-4');
		
		var btn2 = document.createElement("BUTTON");  
		btn2.classList.add('btn');
		btn2.classList.add('btn-xs');
		btn2.classList.add('btn-default');
		btn2.onclick=function(ev){    
			removeOrg(orgid, loggedinuserflake);		       
	      };
		
		btn2.innerHTML = "Remove";                  
		colelem3.appendChild(btn2);  
		
		rowelem.appendChild(colelem3)
		container.appendChild(rowelem);
							
	}
	
	function removeorgfromsetuppage(orgid, ownerflake) {
		//console.log('removing orgid ' + orgid);
		var elemtoremove = document.getElementById("user-org-" + orgid);
		elemtoremove.parentNode.removeChild(elemtoremove);
	}
	
	function removeorgfromheader(orgid) {
		var elemtoremove = document.getElementById("user-org-header-" + orgid);
		elemtoremove.parentNode.removeChild(elemtoremove);
	}
	
	function addmembertoOrgModal(orgid, ownerflake) {
		//alert('input passed to addmembertoOrgModal ' + orgid + ' ' + ownerflake );
		if (vaultkey == null || vaultkey.length == 0) {
			createvaultkeyoverlay();
			//return false;
		}
		
		if (orgid) {			
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		        	
		        	var resp = xhr.responseText;
		        	
		        	if (resp != null && resp.length > 0) {
			        	var orgobj = JSON.parse(resp);
			        	//alert ('response ' + resp);
			        	if (orgobj != null) {
				        	document.getElementById("orgid").value = orgobj.orgid;
				        	document.getElementById("orgtabname").value = orgobj.orgtabname;
				    		document.getElementById("orgname").value = orgobj.orgname;
				    		document.getElementById("orgownerflake").value = ownerflake;
				    		
				    		document.getElementById('org-fullname-title').innerHTML = orgobj.orgname;
				    		
				    		$('#manageorgmembermodal').modal('show');
				    		
			        	}
		        	}
		        }
		    }
			
			xhr.open('POST', '/newauth/api/getorganizationinfo', true);
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		   // var ownerflake = '';
		    
		    //if (document.getElementById("orgownerflake") != null)
		    //	ownerflake = document.getElementById("orgownerflake").value;
		    
		    var reqpacket = JSON.stringify({
		    		orgid: orgid,
		    		ownerflake: ownerflake
		    	});
		    	    
		   // alert(reqpacket);
		    xhr.send(reqpacket);
			
		}
	}
	
	function exitmemberfromOrg(orgid, ownerflake) {
		
		if (typeof orgid === 'undefined' || orgid ==null || orgid.length == 0 )
			orgid = document.getElementById("orgid").value;		
		
		//var ownerflake = orgownerflake;
	    
	    if ((typeof ownerflake === 'undefined' || ownerflake ==null || ownerflake.length == 0 ) && document.getElementById("orgownerflake") != null)
	    	ownerflake = document.getElementById("orgownerflake").value;
	    
	   // alert('ownerflake ' + ownerflake + ' memberflake ' + loggedinuserflake);
	    
		if (orgid) {			
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 ) {
		        	
		        	if (xhr.status == 200) {
			        	var resp = xhr.responseText;
			        	//alert('response from addmembertoorg '+ xhr.status + ' ' + resp);
			        	if (resp != null && resp.length > 0) {
			        		//document.getElementById("memberadderror").innerText = resp;
			        		removeorgfromheader(orgid);
			        		$('#manageorgmembermodal').modal('hide');
			        		loadHome();
			        	}
		        	} 
		        }
		    }
			
			var isowner = false;
			
			xhr.open('POST', '/newauth/api/exitmemberfromorg', true);
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		      var reqpacket = JSON.stringify({
		    		orgid: orgid,
		    		memberflake: loggedinuserflake,
		    		ownerflake: ownerflake,
		    		isOwner: isowner
		    	});
		    	    
		 //   alert(reqpacket);
		    xhr.send(reqpacket);
			
		}
	}
	
	function addmembertoOrg(orgid, ownerflake) {
		
		if (typeof orgid === 'undefined' || orgid ==null || orgid.length == 0 )
			orgid = document.getElementById("orgid").value;
		
		var memflake = document.getElementById("orgmemberflake").value;
		
		//var ownerflake = orgownerflake;
	    
	    if ((typeof ownerflake === 'undefined' || ownerflake ==null || ownerflake.length == 0 ) && document.getElementById("orgownerflake") != null)
	    	ownerflake = document.getElementById("orgownerflake").value;
	    
	  	//alert('In addmembertoOrg org memflake ' + orgid + ' ' + memflake);
		if (memflake == null || memflake.length < 15 ) {
			document.getElementById("orgmemberflake").style.border.color = "#a20000";
			document.getElementById("memberadderror").value = "Please enter new member's flake";
			return false;
		}
		if (orgid) {			
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 ) {
		        	
		        	if (xhr.status == 200) {
			        	var resp = xhr.responseText;
			        	//alert('response from addmembertoorg '+ xhr.status + ' ' + resp);
			        	if (resp != null && resp.length > 0) {
			        		//document.getElementById("memberadderror").innerText = resp;
			        		
			        		if (resp.indexOf('publickey') >= 0) {
			        			var pubkeyofnewmember = JSON.parse(resp).publickey;
			        			//alert(' publickey ' + pubkeyofnewmember);
			        			if (pubkeyofnewmember != null && pubkeyofnewmember.length > 0) {
			        				
			        				sendOrgKeyToNewMember(orgid, ownerflake, memflake, pubkeyofnewmember);
			        			}
			        			$('#manageorgmembermodal').modal('hide');	    	
			        		}
				        	
			        	}
		        	} else {
			        	//alert('in bad status response '+ xhr.readyState + ' ' + xhr.status );
			        	var resp = xhr.responseText;
			        	if (resp.length > 0) {
			        		document.getElementById("orgmemberflake").style.borderColor = "#a20000";
			        		document.getElementById("memberadderror").innerHTML = resp;
			        	}
			        }
		        }
		    }
			
			var isowner = document.getElementById("ismemberowner").checked;
			
			xhr.open('POST', '/newauth/api/addmembertoorg', true);
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		      var reqpacket = JSON.stringify({
		    		orgid: orgid,
		    		memberflake: memflake,
		    		ownerflake: ownerflake,
		    		isOwner: isowner
		    	});
		    	    
		   // alert(reqpacket);
		    xhr.send(reqpacket);
			
		}
	}
	
function sendOrgKeyToNewMember(orgid, ownerflake, memflake, pubkeyofnewmember) {
	//alert('In sendOrgKeyToNewMember otherkeys ' + JSON.stringify(otherkeys));
	//console.log('orgid ' + orgid + ' ownerflake '+ ownerflake );
	for (var i=0; i<otherkeys.length; i++) {
		//console.log(JSON.stringify(otherkeys[i]));
		
		if (otherkeys[i].org && otherkeys[i].org.split(":=")[1] == orgid && otherkeys[i].org.split(":=")[0] == ownerflake) {
			
			var pub = new sjcl.ecc.elGamal.publicKey(
				    sjcl.ecc.curves.c384,
				    sjcl.codec.base64.toBits(pubkeyofnewmember)
				);
			
			var encryptedmessage =  sjcl.encrypt(pub, JSON.stringify(otherkeys[i]));
			//console.log('Original message ' + JSON.stringify(otherkeys[i]) + ' public key ' + pubkeyofnewmember + ' after enc ' + encryptedmessage);			
			
			var sec = new sjcl.ecc.elGamal.secretKey(
				    sjcl.ecc.curves.c384,
				    sjcl.ecc.curves.c384.field.fromBits(sjcl.codec.base64.toBits(userkey))
				);
			
			//console.log( 'message decrypted with key '+ userkey + ' ' + sjcl.decrypt(sec, encryptedmessage));
						
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		        	//message sent successfully
		        	console.log('Org keys sent to the new member');
		        } 
		    }
			
			var isowner = document.getElementById("ismemberowner").checked;
			
			xhr.open('POST', '/newauth/api/sendsecuremessagetoflake', true);
		    xhr.setRequestHeader('Content-Type', 'application/json');  		    
		    
		    var reqpacket = JSON.stringify({
		    		
		    		flake: memflake,
		    		data: encryptedmessage,
		    		tag: 'ORGKEY',
		    		publickey: pubkeyofnewmember
		    		
		    	});
		    	    
		    alert(reqpacket);
		    xhr.send(reqpacket);
			
		}
	}
}
	
function showvianaref(mode) {
	
	if (mode == 'one') {
		document.getElementById('mode-one-reference').style.display='block';
		document.getElementById('mode-two-reference').style.display='none';
	}
	
	if (mode == 'two') {
		document.getElementById('mode-one-reference').style.display='none';
		document.getElementById('mode-two-reference').style.display='block';
	}
}


function setupDomainForAuth(domainname) {
	 $("#domainsetupModal").modal('show');
	 document.getElementById('managedomainforauth').value = domainname;
}

function updateJsonSchema(fields) {
    var jsonSchema = {};
    for (var i = 0; i < fields.length; i++) {
      jsonSchema[fields[i].name] = {type: fields[i].type, hashed: fields[i].hashed};
    }
    document.getElementById("json-schema").value = JSON.stringify(jsonSchema, null, 2);
    
    document.getElementById('jsoncontentstructure').value = document.getElementById("json-schema").value;
  }

function createTopic(topicname) {
	
	//alert('jsoncontent' + document.getElementById('jsoncontentcheck').checked);
	if (topicname) {
		//alert('in if topicname ' + topicname);
		if (document.getElementById('jsoncontentcheck').checked == true ) {
			var fields = [];
			
			var schemaElement = document.getElementById("add-json-field-btn");
				if (typeof schemaElement.onclick === "function") {
				    // An event handler already exists for the "change" event
				    console.log("Event handler already set.");
				} else {
				   document.getElementById("add-json-field-btn").addEventListener("click", function() {
				    var fieldType = document.getElementById("json-field-type").value;
				    var fieldName = document.getElementById("json-field-name").value;
				    var fieldhashed = document.getElementById("json-field-hashed").checked;
				    
				    if (fieldName) {
				      fields.push({name: fieldName, type: fieldType, hashed: fieldhashed});
				      updateJsonSchema(fields);
				      document.getElementById("json-field-name").value = "";
				      document.getElementById("json-field-type").value = "";
				    }
				  });
				  
				  document.getElementById("json-schema").addEventListener("change", function() {
				    document.getElementById('jsoncontentstructure').value = document.getElementById("json-schema").value;
				  });    
			
				}
			//alert ('json content.. ' + document.getElementById('jsoncontentstructure').value);
			if (document.getElementById('jsoncontentstructure').value.length == 0) {
				//alert ('json content.. needs to be set');
				if (document.getElementById("json-schema").value.length > 0) {
				    document.getElementById('jsoncontentstructure').value = document.getElementById("json-schema").value;
				  }
				$('#setjsonschemamodal').modal('show');
				
				document.getElementById('topicupdatebtn').disabled = true;
				return false;
			}
		}
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 ) {
				if (xhr.status == 200) {
		        	if (xhr.responseText) {
			        	var resp = xhr.responseText;
			        	
			        	if (resp != null && resp.length > 0) {
			        		document.getElementById('topic-create-status').innerHTML=resp;
			        		
			        		document.getElementById("createtopicname").value='';
				    		document.getElementById("createtopicname").value='';
				    		document.getElementById("topic_invite_message").value='';
				    		document.getElementById("inviteaddress").value='';
				    		document.getElementById('idmembersbydevice').checked=false;
				    		document.getElementById("daystojoin").value='';
				    		document.getElementById('transferoncreatecheck').checked=false;
				    		document.getElementById('jsoncontentcheck').checked=false;
				    		document.getElementById("json-schema").value='';
				    		document.getElementById('jsoncontentstructure').value='';
				    		document.getElementById('hashedcontentcheck').checked=false;
				    		document.getElementById("topicmaxdepthinput").value='';
				    		document.getElementById('topiccrtime').value='';
				    		
				    		document.getElementById('topicupdatebtn').disabled = false;
			        		
			        		setTimeout(function() {
			        			
			        			$('#managetopicmodal').modal('hide');
			        		}, 2000);
			        	}
			        	
		        	}
				} else {
					document.getElementById('createtopicname').value = '';
	        		document.getElementById('createtopicname').placeholder = "Please choose a different topic name";
	        		document.getElementById('createtopicname').focus();
			        		
					document.getElementById('topic-create-status').style.color = 'darkred';
					document.getElementById('topic-create-status').innerHTML=xhr.responseText;
					document.getElementById('topicupdatebtn').disabled = false;
				}
	        
	        }
	    }
		
		xhr.open('POST', '/newauth/api/createtopic', true);
		xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	      
	    var reqpacket = JSON.stringify({
	    		topic: document.getElementById("createtopicname").value,
	    		commentoption: document.getElementById("commentsettingsselect").value,
    			postoption: document.getElementById("postsettingsselect").value,
    			storeoption: document.getElementById("storagesettingsselect").value,
	    		display: document.getElementById("createtopicname").value,
	    		invitemessage: document.getElementById("topic_invite_message").value,
	    		inviteaddress: document.getElementById("inviteaddress").value,
	    		idbydevice: document.getElementById('idmembersbydevice').checked,
	    		daystojoin: document.getElementById("daystojoin").value,
	    		transferownership: document.getElementById('transferoncreatecheck').checked,
	    		jsoncontent: document.getElementById('jsoncontentcheck').checked,
	    		jsonschema: document.getElementById("json-schema").value,
	    		hashedcontent: document.getElementById('hashedcontentcheck').checked,
	    		topicmaxdepth: document.getElementById("topicmaxdepthinput").value,
	    		crTime: document.getElementById('topiccrtime').value
	    	});
	    	    
	    //alert(reqpacket);
	    xhr.send(reqpacket);
	    document.getElementById('topicupdatebtn').disabled = true;
		//document.getElementById('create-topic-button').disabled = true;
	} else {
		//document.getElementById("topic_invite_message").value = '';
		//alert('in else topicname ' + topicname);
    	document.getElementById("inviteaddress").value = '';
		document.getElementById("createtopicname").value = '';
		
		document.getElementById('createtopicname').addEventListener('change', function(){
			//alert('onchange of topic fired');
			var newtopic = document.getElementById('createtopicname').value;
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			
			xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		        	if (xhr.responseText) {
			        	var resp = xhr.responseText;
			        	if (resp == 'EXISTS') {
			        		document.getElementById('createtopicname').value = '';
			        		document.getElementById('createtopicname').placeholder = "Please choose a different topic name";
			        		document.getElementById('createtopicname').focus();
			        		
							document.getElementById('topic-create-status').style.fontColor = 'darkred';
			        		document.getElementById('topic-create-status').innerHTML="The topic name '" + newtopic + "' is already taken.";
			        	}
			        	
		        	}
		        
		        }
		    }
			
			xhr.open('GET', '/newauth/api/doestopicexist/' + newtopic, true);
		    xhr.setRequestHeader('Content-Type', 'application/json');          
		  	    
		    //alert(reqpacket);
		    xhr.send(null);
			
		});
		
		document.getElementById('inviteaddress').addEventListener('input',function(){
			if (document.getElementById('inviteaddress').value.indexOf('@') > 0) {
				document.getElementById('transferoncreatecheck').checked = true;
			}
		});
		
		document.getElementById('createtopicname').removeAttribute('readonly');
	}
	
}

function loadusertopics() {
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	if (xhr.responseText) {
	        	
	        	var objs = JSON.parse(xhr.responseText);
	        	var dv = document.getElementById('user-topic-list');
	        	dv.innerHTML = '';
	        	for (var o=0; o< objs.length; o++) {	        	
		        	
	        		var r = document.createElement('div');
		        	r.classList.add('row');
		        	r.setAttribute('id', 'topic-row-' + objs[o].topic);
		        	
		        	var c1 = document.createElement('div');
		        	c1.classList.add('col-xs-4');
		        	c1.appendChild(document.createTextNode(objs[o].topic + ' [' + objs[o].hits + ']'));
		        	var c2 = document.createElement('div');
		        	c2.classList.add('col-xs-4');
		        	
		        	var manb = document.createElement('button');
		        	manb.classList.add('btn');					
		        	manb.classList.add('btn-xs');
		        	manb.classList.add('btn-default');
		        	manb.appendChild(document.createTextNode("Manage"));
		        	manb.addEventListener('click', function(ob){
						return function() {
							manageTopic(ob);
						};
						
					}(objs[o]));
		        	
					c2.appendChild(manb);
		        	
		        	var c3 = document.createElement('div');
		        	c3.classList.add('col-xs-4');
		        		
					var remb = document.createElement('button');
					remb.classList.add('btn');					
					remb.classList.add('btn-xs');
					remb.classList.add('btn-default');
					remb.appendChild(document.createTextNode("Remove"));
					remb.addEventListener('click', function(ob){
						return function() {
							removeTopic(ob);
						};
						
					}(objs[o]));
		        	
					c3.appendChild(remb);
					
					r.appendChild(c1);
		        	r.appendChild(c2);
		        	r.appendChild(c3);
		        	
		        	dv.appendChild(r);
		        	
	        	}
        	}
        
        }
    }
	
	xhr.open('GET', '/newauth/api/gettopicsbyuser', true);
    xhr.setRequestHeader('Content-Type', 'application/json');          
  	    
    //alert(reqpacket);
    xhr.send(null);
}

function manageTopic(ob) {
	//alert('implement manageTopic');
	
	var xhr = new XMLHttpRequest();
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert('Topic data ' + xhr.responseText);
			inmanage =  true;
        	var topicobj = JSON.parse(xhr.responseText);
        	var settingsobj = parseJsonWithFallback(topicobj.settings);
        	
        	if (settingsobj != null) {
	        	document.getElementById('createtopicname').value = topicobj.topic;
				document.getElementById('createtopicname').setAttribute('readonly', 'readonly');
				
	        	
	        	if (settingsobj.idbydevice)
	        		document.getElementById('idmembersbydevice').checked = true;
	        		
	        	document.getElementById('daystojoin').value = topicobj.daystojoin;
	        	document.getElementById('inviteaddress').value = topicobj.inviteaddress;
	        	
	        	if (settingsobj.transferownership)
	        		document.getElementById('transferoncreatecheck').checked = true;
	        		
	        	document.getElementById('topic_invite_message').value = settingsobj.invitemessage;
	        	
	        	document.getElementById("commentsettingsselect").value = settingsobj.comments;
	        	document.getElementById("storagesettingsselect").value = settingsobj.storage;
	        	
	        	//alert('posts db value ' + settingsobj.posts);
    			document.getElementById("postsettingsselect").value = settingsobj.posts;
	        	
	        	if (settingsobj.jsoncontent)
	        		document.getElementById('jsoncontentcheck').checked = true;
	        	
	        	if (settingsobj.hashedcontent)	
	        		document.getElementById('hashedcontentcheck').checked = true;
	        		
	        	if (typeof settingsobj.maxdepth != 'undefined')
	        		document.getElementById('topicmaxdepthinput').value = settingsobj.maxdepth;
	        	
	        	document.getElementById('topicupdatebtn').value = 'Update';
	        	document.getElementById('topiccrtime').value = topicobj.crTime;
	        	document.getElementById('json-schema').value = settingsobj.jsonschema;
        	}
        	
        } else {
        	
        }
    }
	xhr.open('GET', '/newauth/api/gettopicbyname/' + ob.topic, false);
   // xhr.setRequestHeader('Content-Type', 'application/json');  
    
     xhr.send(null); 
	$('#managetopicmodal').modal('show');
}

function activatetopicdeadline(cb) {
	if (cb.checked == true) {
		document.getElementById('topic-join-deadline').style.display = 'block';
		document.getElementById('daystojoin').value = "1";
	} else
		document.getElementById('daystojoin').value = "0";
		document.getElementById('topic-join-deadline').style.display = 'none';
	
	return false;
}

function launchmanagetopicdialog(){
	$('#managetopicmodal').modal('show');
}

function updatetopic() {
	//alert('update/create topicname ... inmanage ' + document.getElementById("createtopicname").value + ' ' + inmanage);
	
	if (document.getElementById("createtopicname").value.length > 3) {
		
		let topic = document.getElementById("createtopicname").value;
		
		if (document.getElementById('topic-row-' + topic.toLowerCase()) != null && !inmanage ) {
			document.getElementById('topic-create-status').style.color = 'darkred';
			document.getElementById('topic-create-status').innerHTML="You have created this topic already. Please use the manage button to change its settings";
			return false;
		}
		createTopic(document.getElementById("createtopicname").value);
	} else {
		document.getElementById('topic-create-status').innerHTML="Topic name must be longer than 3 characters";
	}
}

function removeTopic(obj) {
	var xhr = new XMLHttpRequest();
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	document.getElementById('topic-row-' + obj.topic).style.display = 'none';
        } else {
        	
        }
    }
	xhr.open('POST', '/newauth/api/removetopic', false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    //alert('username: ' + document.getElementById("usernameinput").value);
    
    var reqpacket = JSON.stringify({
 	   	topic: obj.topic
 		});
    
     xhr.send(reqpacket); 
}