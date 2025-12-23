var  orgdatainsystem;
var orgownerflake, orgpublickey, orgID;
var orgkey = '';


function submitencorgdata(orgid, type, newdata) {
	/*if (vaultkey.length == 0) {
		alert('Please enter your key first. This key will be used to encrypt your data. Most users use their username as the key. You can use a different key if you want');
		document.getElementById(type+'-data').value = '';
		$('#' + type + 'Modal').modal('hide');
		return false;
	}*/
	// first check if values filled in -- only for new data
	//alert(orgid);
	if (newdata) {
		if (type === 'org-secure') {
			if (document.getElementById('org-secure-sitepwd').value.length == 0) return false;
			if (document.getElementById('org-secure-siteuser').value.length == 0) return false;
			if (document.getElementById('org-secure-siteUrl').value.length == 0) return false;
		}
		
		if (type === 'fin') {
			if (document.getElementById('fin-institution').value.length == 0) return false;
		}
		
		createOrgData(type);
	}
	//alert('after createdata');
	//if (type === 'org-secure')
	//	document.getElementById(type+'-seq').value = '1';
	
	if (type === 'fin')
		document.getElementById(type+'-seq').value = '2';
	
	if (type === 'oth')
		document.getElementById(type+'-seq').value = '3';
	
	
	var cleardata =  document.getElementById(type+'-data').value ;
	
	var encrypteddata =	getEncMessageUsingPublickey(cleardata, orgpublickey); //encryptwithstretchedkey(type, vaultkey);
	//alert(cleardata + ' --> enc data: ' +  encrypteddata);	
	
	var stdate = "";
	var endate = "";
	
	if (document.getElementById('datetimepickerst') != null) {
	  var stdate = document.getElementById('datetimepickerst').getElementsByTagName("INPUT")[0].value;
	  var endate = document.getElementById('datetimepickeren').getElementsByTagName("INPUT")[0].value;
	}
	
	console.log('about to add org data start date being set ' + stdate);
  	  
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
    xhr.open('POST', '/secure/addorgdata', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
         xhr.send(JSON.stringify({
     	   	group: type,
     	   	salt: document.getElementById(type+'-slt').value,
     	   	iterations: document.getElementById(type+'-itns').value,
     	   	section: 'org-credentials',
     	   	seq: 0,
     	   	startdate: stdate,
     	   	enddate: endate,
     	   	data: encrypteddata ,
     	   	ownerflake: orgownerflake,
     	   	orgid: orgid ,
     	   	publicKey: '',
     	   	privateKey: '',
     	   	createdate: document.getElementById(type+'-crdate').value,
     	   	lastupdatedate: document.getElementById(type+'-upddate').value,
     	   dononotify: true
     		}));
         
     if (type === 'oth') { // add content also as a separate item        	 
    	 
    	 document.getElementById(type+'-data').value = JSON.stringify(filecontentobject) ;
    	 
    	 cleardata = document.getElementById(type+'-data').value ;
    	// alert('adding content seq ' + document.getElementById(type+'-data').value);
 		encrypteddata =	encryptwithstretchedkey(type, vaultkey);
			     		
 		xhr.open('POST', '/secure/addorgdata', false);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');   
	    
 		xhr.send(JSON.stringify({
     	   	group: type,
     	   	salt: document.getElementById(type+'-slt').value,
     	   	iterations: document.getElementById(type+'-itns').value,
     	   	data: encrypteddata ,
     	   	sequence: filecontentobject.fileseq,
     	   	createdate: document.getElementById(type+'-crdate').value,
     	   	lastupdatedate: document.getElementById(type+'-upddate').value
     		}));
     }
   // showDataAddDiv(type + 'Div');
         
         $('#' + type + 'Modal').modal('hide');
         $('#orgcredscollapse').collapse('show');
         
         //showOrgPage(orgownerflake,orgid);
    return false;		 
}


function createOrgData(type) {
	var userdata = '';	
	
	if (type === 'org-secure' ) {
		
		userdata =  '"key": "publickey of the user", "credential": ' +
					'{"siteUrl":"' + document.getElementById('org-secure-siteUrl').value + '", ' +
					'"sitedesc":"' + document.getElementById('org-secure-sitedesc').value + '", ' +
					'"siteuser":"' + document.getElementById('org-secure-siteuser').value + '", ' +
					'"sitepwd":"' + document.getElementById('org-secure-sitepwd').value + '"}, ';
		
		addCredentialToOrgPage();
	}
	
	if (type === 'fin') {
		
		userdata = '"institution":"' + document.getElementById('fin-institution').value + '", ' +
					'"accType":"' + document.getElementById('fin-accType').value + '", ' +
						'"acctNum":"' + document.getElementById('fin-acctNum').value + '", ';
		
		addFinDataToSecurePage();
	}
	
	
	if (type === 'oth') {  // read the file
		
		
		var files = document.getElementById('secure-file').files;
		
		for (var i = 0; i < files.length; i++) {
			
		 var file = files[i];

		  // Check the file type.
		  /*if (!file.type.match('image.*')) {
		    continue;
		  }*/
		  
		  //check the file size -- currently limiting to 1 MB
		  if (file.size/1024/1024 > 1) {
			  alert('Files greater than 1 MB not supported right now.');
			  continue;
		  }

		   
		  var fileobject = {"secure-file": file.name,
				  			"filetype": file.type,
				  			"filesize": file.size,
				  			"fileseq": lastfileseq + 1
				  			};
		  
		 // alert('secure-file-content: ' + document.getElementById("secure-file-content").value);
		  var b64content = '"' + document.getElementById("secure-file-content").value + '"';
		  filecontentobject = {"secure-file": file.name,
		  						"filetype": file.type,
		  						"filesize": file.size,
		  						"fileseq": lastfileseq + 1,
		  						"content": document.getElementById("secure-file-content").value
		  						};
		  
			userdata += JSON.stringify(fileobject) ;
		   
		   //document.getElementById('oth-content-data').value=filecontentobject;
		   
		 // alert('File seq after instantiation: ' + filecontentobject.fileseq);
		   
		   if (i < files.length -1)
			   userdata +=  ', ';
		   
		   addFileDataToSecurePage(file.name, file.type, file.size, lastfileseq + 1);
		} //for
		
		
		
	}			
	
	//alert("orgdatainsystem '" + orgdatainsystem.trim() + "'");
	if (orgdatainsystem.trim().length > 0 ) {
		
		var orgdatainsystemobj = JSON.parse(orgdatainsystem.trim());
		
		//alert('orgdatainsystemobj.length ' + orgdatainsystemobj.length + ' type ' + type);
		if (orgdatainsystemobj.length > 0) {
			if (type === 'org-secure' ) {
				
				var existingsites = '';
				//var obj = JSON.parse(orgdatainsystemobj[0].data); 
				
				for (var x=0; x< orgdatainsystemobj.length; x++) {
					//alert('Existing cred ' + x + ' ' + JSON.stringify(orgdatainsystemobj[x]));
					if (orgdatainsystemobj[x].section === 'org-credentials' && parseInt(orgdatainsystemobj[x].seq) == 0) {
					
						var sec = new sjcl.ecc.elGamal.secretKey(
							    sjcl.ecc.curves.c384,
							    sjcl.ecc.curves.c384.field.fromBits(sjcl.codec.base64.toBits(orgkey))
							);
						
						var obj = JSON.parse(sjcl.decrypt(sec, orgdatainsystemobj[x].data));
						
						//var obj = JSON.parse( orgdatainsystemobj[x].data); 
						
						//alert(JSON.stringify(obj));
						for (var i=0; i< obj.length; i++) {
							
							existingsites += JSON.stringify(obj[i]);
							
							if (i < obj.length )
								existingsites +=  ", ";
						}
					}
				}
				
				// do not add if it is time fenced data
				//alert('document.getElementById(inform-receiver) ' + document.getElementById('inform-receiver'));
				if ( document.getElementById('inform-receiver') == null)	{		
					console.log('in 1 existingsites ' + existingsites);
					document.getElementById('org-secure-data').value = '[' + existingsites + '{' + userdata.substring(0, userdata.length-2) + '}]';
				} else {
					var radios = document.getElementsByName("infoshareoption");
					for(var i = 0, max = radios.length; i < max; i++) {
						if (radios[i].checked) {
					      if (radios[i].value == 'T') {
					    	  console.log('in 2 existingsites ' + existingsites);
					    	  document.getElementById(type+'-seq').value = "0";
					    	  document.getElementById('org-secure-data').value = '{' + userdata.substring(0, userdata.length-2) + '}';
					       }
					      
					      if (radios[i].value == 'R') {
					    	  console.log('in 3 existingsites ' + existingsites);
					    	  document.getElementById('org-secure-data').value = '[' + existingsites + '{' + userdata.substring(0, userdata.length-2) + '}]';
					       }
					       
						}
					}
				}
			} 
			
			if (type === 'fin') {
				
				var existingfin = '';
				
				for (var x=0; x< orgdatainsystemobj.length; x++) {
					if (orgdatainsystemobj[x].sequence === 2) {
						
						var obj = JSON.parse(decryptwithstretchedkey('fin', vaultkey, orgdatainsystemobj[x].data)); 
						
						for (var i=0; i< obj.length; i++) {
							
							existingfin += JSON.stringify(obj[i]);
							
							if (i < obj.length )
								existingfin +=  ", ";
						}
							
					}
				}
				
				document.getElementById('fin-data').value = '[' + existingfin + '{' + userdata.substring(0, userdata.length-2) + '}]';			
			}
			
			if (type === 'oth') {
				//alert(userdata);
				
				//var existingoth = userdata;
				var existingoth = userdata;
				
				for (var x=0; x< orgdatainsystemobj.length; x++) {
					if (orgdatainsystemobj[x].sequence === 3) {				
					
						var obj = JSON.parse(decryptwithstretchedkey('oth', vaultkey, orgdatainsystemobj[x].data)); 
						
						for (var i=0; i< obj.length; i++) {
							
							existingoth += ", " + JSON.stringify(obj[i]);							
							lastfileseq = obj[i].fileseq;
						}					
					}
				}
				
				document.getElementById('oth-data').value = '[' + existingoth + ']';			
				
			}
		} else {
			if (type === 'oth') 
				document.getElementById(type+'-data').value = '[' + userdata + ']';
			else
				document.getElementById(type+'-data').value = '[{' + userdata.substring(0, userdata.length-2) + '}]';
		}
	} else {
		if (type === 'oth') 
			document.getElementById(type+'-data').value = '[' + userdata + ']';
		else
			document.getElementById(type+'-data').value = '[{' + userdata.substring(0, userdata.length-2) + '}]';
	}
	//alert ('org-secure-data value: ' + document.getElementById(type+'-data').value);
}

function addCredentialNotificationToOrgPage() {
var sitenotification, sitetitle, startdate, enddate;		
	
	sitenotification = document.getElementById('org-secure-notification').value;
	startdate = document.getElementById('org-secure-startdate').value;
	enddate = document.getElementById('org-secure-endate').value;
	sitetitle = "Coming in";
	
	
	//alert(timedetail);
	//alert(siteurl + ' ' + siteusername+ ' ' +  sitepass+ ' ' +  sitetitle);
	
	if (sitenotification != null && sitenotification.length > 0) {
			var outerdiv = document.createElement("div");
			var currdate = Date.now();
	
			var timedetail = '';
			
			if (currdate < parseInt(startdate)) {
				timedetail = gettimedifference(parseInt(startdate), true);
			} else {
				if (enddate != null && enddate.length > 0) {
					if (currdate < parseInt(enddate)) {
						sitetitle = "Visible for";
						timedetail = gettimedifference(parseInt(enddate), true);
					}
				} else {
					//alert('here');
					sitetitle = "Shared Credential";
					outerdiv.style.backgroundColor = '#ededed';
				}
			}


		//alert('adding ' + siteurl + ' ' + siteusername);	
		//alert(sitedomain);
		
		outerdiv.classList.add('col-md-2');
		outerdiv.classList.add('col-xs-4');
		outerdiv.classList.add('website-cred-display');
		outerdiv.style.height='100px';
		
		var divelem = document.createElement("div");
		divelem.classList.add('center-block');
		divelem.classList.add('text-center');
		//divelem.classList.add('card');
		//divelem.style.width='64px';
		divelem.style.height='80px';
		
		var imgelem = document.createElement("img");
		imgelem.setAttribute("src", "https://www.google.com/s2/favicons?domain=https://newauth.io");
		imgelem.setAttribute("height", "24");
		imgelem.setAttribute("width", "24");
		//imgelem.setAttribute("alt", siteurl);
		imgelem.classList.add('center-block');	
		
		var cardcaption = document.createElement("div");
		//cardcaption.classList.add('center-block');
		cardcaption.style.textAlign= 'center';
		
		var p = document.createElement("p")  ;
		p.classList.add('font-weight-bold');
		//  p.style.wordWrap = "break-word"; 
		p.style.maxWidth = "100px";
		p.style.margin= 'auto';
		
		var textelem = document.createTextNode(timedetail); 
		
		p.appendChild(textelem);  
				
		
		cardcaption.appendChild(p);	
		
		var cardtitle = document.createElement("p")  ;
		//cardtitle.classList.add('lead');
		cardtitle.style.maxWidth = "100px";
		cardtitle.style.margin= 'auto';
		
		if (sitetitle != null && sitetitle.trim().length > 0) {
			//alert(sitetitle[0]);
			var sitetitlecased = sitetitle.charAt(0).toUpperCase() + sitetitle.substring(1, sitetitle.length );
			var ttextelem = document.createTextNode(sitetitlecased); 
			
			var strongtag = document.createElement('strong');
			
			strongtag.appendChild(ttextelem);  
			cardtitle.appendChild(strongtag);  
	
			
			divelem.appendChild(cardtitle);	
			divelem.appendChild(document.createElement('br'));	
				
		}
		
		divelem.appendChild(imgelem);	
		divelem.appendChild(cardcaption);	
		
		outerdiv.addEventListener("mouseover", function(evt){
		//	evt.target.style.background='#e2e2e2';
		outerdiv.style.border = "1px solid #828282";
			
		}, false);
		
		outerdiv.addEventListener("mouseout", function(evt){
		//	evt.target.style.background='transparent';
		outerdiv.style.border = "none";
			clearTimeout(copytimer);
		}, false);
		

				
		var sitesdiv = document.getElementById("org-credentials");
		
		outerdiv.appendChild(divelem);	
		//alert('here');
		
		createcardlayout(sitesdiv, outerdiv);
	}
	
}

function addCredentialToOrgPage() {
	//var els = inputform.elements;
	var siteurl, siteusername, sitepass, sitetitle;		
	
	siteurl = document.getElementById('org-secure-siteUrl').value;
	siteusername = document.getElementById('org-secure-siteuser').value;
	sitepass = document.getElementById('org-secure-sitepwd').value;	
	sitetitle = document.getElementById('org-secure-sitedesc').value;	
	
	//alert(siteurl + ' ' + siteusername+ ' ' +  sitepass+ ' ' +  sitetitle);
	
	if (siteurl !== 'undefined') {
		//alert('adding ' + siteurl + ' ' + siteusername);
		
		if (sitetitle == null || sitetitle.length == 0) {
			var sitedomain = getDomain(siteurl);
			
			if (sitedomain != null) {
				sitetitle = sitedomain.split('.')[0];
			}
		}
		
		//alert(sitedomain);
		var outerdiv = document.createElement("div");
		outerdiv.classList.add('col-md-2');
		outerdiv.classList.add('col-xs-4');
		outerdiv.classList.add('website-cred-display');
		outerdiv.style.height='100px';
		
		var divelem = document.createElement("div");
		divelem.classList.add('center-block');
		divelem.classList.add('text-center');
		//divelem.classList.add('card');
		//divelem.style.width='64px';
		divelem.style.height='80px';
		
		var imgelem = document.createElement("img");
		imgelem.setAttribute("src", "https://www.google.com/s2/favicons?domain=" + siteurl);
		imgelem.setAttribute("height", "24");
		imgelem.setAttribute("width", "24");
		imgelem.setAttribute("alt", siteurl);
		imgelem.classList.add('center-block');	
		
		var cardcaption = document.createElement("div");
		//cardcaption.classList.add('center-block');
		cardcaption.style.textAlign= 'center';
		cardcaption.style.backgroundColor= 'inherit';
		
		var p = document.createElement("p")  ;
		p.classList.add('font-weight-bold');
		//  p.style.wordWrap = "break-word"; 
		p.style.maxWidth = "100px";
		p.style.margin= 'auto';
		
		var textelem = document.createTextNode(siteusername); 
		
		p.appendChild(textelem);  				
		
		cardcaption.appendChild(p);	
		
		var cardtitle = document.createElement("p")  ;
		//cardtitle.classList.add('lead');
		cardtitle.style.maxWidth = "100px";
		cardtitle.style.margin= 'auto';
		
		if (sitetitle != null && sitetitle.trim().length > 0) {
			//console.log(sitetitle + ' ' + sitetitle.startsWith('Shared'));
			if (sitetitle.trim().startsWith('Shared')) {
				//alert('here');
				divelem.style.backgroundColor = '#ededed';
			}
			
			var sitetitlecased = sitetitle.charAt(0).toUpperCase() + sitetitle.substring(1, sitetitle.length );
			var ttextelem = document.createTextNode(sitetitlecased); 
			
			var strongtag = document.createElement('strong');
			
			strongtag.appendChild(ttextelem);  
			cardtitle.appendChild(strongtag);  	
			
			divelem.appendChild(cardtitle);	
			divelem.appendChild(document.createElement('br'));				
				
		}
		divelem.appendChild(imgelem);	
		divelem.appendChild(cardcaption);	
		
		outerdiv.addEventListener("mouseover", function(evt){
		//	evt.target.style.background='#e2e2e2';
		outerdiv.style.border = "1px solid #828282";
			
		}, false);
		
		outerdiv.addEventListener("mouseout", function(evt){
		//	evt.target.style.background='transparent';
		outerdiv.style.border = "none";
			clearTimeout(copytimer);
		}, false);
		
		outerdiv.addEventListener("click", function(evt){
			//loadExtUrl(siteurl, siteusername, sitepass);
			//copytimer = setTimeout(
			//		function() {
			            var allsitedivs = document.getElementsByClassName('website-cred-display');
			            var x;
			            for (var x = 0; x < allsitedivs.length; x++) {
			            	allsitedivs[x].style.background='transparent';
			            	makeallchildrentransparent(allsitedivs[x]);                          
	                      
	                    } 
	                    
	                    if (evt.target.classList.contains('website-cred-display'))
			                evt.target.style.background='#e2e2e2';
			            else {
			                var el = evt.target;
			                while ( !el.classList.contains('website-cred-display')) {
			                    el = el.parentElement;
			                }
			                
			                if (el.classList.contains('website-cred-display'))
			                    el.style.background='#e2e2e2';
			            }
						copyInfoToClipboard(evt, siteurl, siteusername, sitepass);
			//		}, 
			//		400
			//	);
		}, false);
				
		var sitesdiv = document.getElementById("org-credentials");
		
		outerdiv.appendChild(divelem);	
		//alert('here');
		
		createcardlayout(sitesdiv, outerdiv);
	}
	
}

function displayOrgDataClear() {
	
	//alert('Org data in system ' + orgdatainsystem);
	
	//alert('otherkeys ' + JSON.stringify(otherkeys));
	if (otherkeys == null || otherkeys.length == 0) {
		//alert('No org keys found.. will see if it has arrived in secured data');
		getsecureuserdatafromdb('ORGKEY', function(securedata) {
			//alert('securedata obj found for user ' + JSON.stringify(securedata));
			extractOrgKeysFromsecuredata(securedata);
			decryptandlayoutorgdata();
		});
	} else {
		//alert('this otherkeys should not be null or blank ' + JSON.stringify(otherkeys));
		for (var k=0; k<otherkeys.length; k++) {
			if (otherkeys[k].org) {
				if (orgownerflake == otherkeys[k].org.split(":=")[0] && orgID == otherkeys[k].org.split(":=")[1])  {
					orgkey = otherkeys[k].privkey;
					decryptandlayoutorgdata();
					break;
				}
			}
		}
		
		//alert('orgkey ' + orgkey);
		if (orgkey == null || orgkey.length == 0) {
			//alert('No org key found in otherkeys object.. will see if it has arrived in secured data');
			getsecureuserdatafromdb('ORGKEY', function(securedata) {
				//alert('securedata obj found for user ' + JSON.stringify(securedata));
				extractOrgKeysFromsecuredata(securedata);
				decryptandlayoutorgdata();
			});
		}
	}
	

}

function decryptandlayoutorgdata() {
	
	
	//alert('orgkey ' + orgkey);
	var sitesdiv = document.getElementById("org-credentials");
	
	sitesdiv.removeEventListener('mouseenter', unblur, false);
	sitesdiv.removeEventListener('mouseleave', blur, false);
	sitesdiv.classList.remove('blur');
		
	//alert("orgdatainsystem '" + orgdatainsystem + "'");
	if (orgdatainsystem.trim().length > 0 && JSON.parse(orgdatainsystem).length > 0) {
		
		var obj = JSON.parse(orgdatainsystem); 				
		
		document.getElementById("org-credentials").innerHTML = "";
		//alert('obj-len: ' + obj.length + ' key: ' + vaultkey);
		
		//alert('first recorrd ' + decryptwithstretchedkey('sites', vaultkey, obj[0].data));
		for (var j=0; j< obj.length; j++) {
			
			//var encdataobj = JSON.parse(obj[j].data);
			
			if (obj[j].section === 'org-credentials') {
				if (document.getElementById("clear-sites-btn") != null) document.getElementById("clear-sites-btn").style.display='inline-block';
				var savedhtml = document.getElementById("org-credentials").innerHTML;
				//document.getElementById("org-credentials").innerHTML = "";
				
			}
			
			
			//alert('hide begin');
			
			
			//alert('obj-j and notification : ' + j + ' : ' +  obj[j].notification);
			
			var sec = new sjcl.ecc.elGamal.secretKey(
				    sjcl.ecc.curves.c384,
				    sjcl.ecc.curves.c384.field.fromBits(sjcl.codec.base64.toBits(orgkey))
				);
			
			//alert('using orgkey ' + orgkey + ' for decrypting ' + j + ' '  + obj[j].data);
			
			if (obj[j].data != null) {
				var dataobj = JSON.parse(sjcl.decrypt(sec, obj[j].data));
				
				//var dataobj = JSON.parse(obj[j].data);
				
				//alert('data-obj length after decryption ' + dataobj.length + ' ' + JSON.stringify(dataobj));
				for (var i=0; i< dataobj.length; i++) {
					
					if (obj[j].section === 'org-credentials') {
						
						//alert(JSON.stringify(obj[j]));
						//alert(JSON.stringify(dataobj[i]));
						//document.getElementById('securedata-sites').innerHTML = "";
						document.getElementById('org-secure-siteUrl').value = dataobj[i].credential.siteUrl;
						document.getElementById('org-secure-siteuser').value = dataobj[i].credential.siteuser;
						document.getElementById('org-secure-sitepwd').value = dataobj[i].credential.sitepwd;
						document.getElementById('org-secure-sitedesc').value = dataobj[i].credential.sitedesc;
						
						document.getElementById('org-secure-seq').value = obj[j].seq;
						document.getElementById('org-secure-slt').value = obj[j].salt;
						document.getElementById('org-secure-itns').value = obj[j].iterations;
						document.getElementById('org-secure-crdate').value = obj[j].createdate;
						document.getElementById('org-secure-stdate').value = obj[j].startdate;
						document.getElementById('org-secure-upddate').value = obj[j].lastupdatedate;					
						
						addCredentialToOrgPage();
					}	
									
				}
			} else {
				if (obj[j].notification != null && obj[j].notification.length > 0) {
					if (obj[j].section === 'org-credentials') {
						document.getElementById('org-secure-notification').value = obj[j].notification;
						document.getElementById('org-secure-startdate').value = obj[j].startdate;
						document.getElementById('org-secure-endate').value = obj[j].enddate;
						addCredentialNotificationToOrgPage();
					}
				}
			}
		}
		
		document.getElementById('org-secure-siteUrl').value ='';
		document.getElementById('org-secure-siteuser').value = '';
		document.getElementById('org-secure-sitepwd').value = '';

						
	}
}

function extractOrgKeysFromsecuredata(securedata) {
	if (securedata != null && securedata !== 'ERROR') {
		otherkeys.push(securedata);
			
		addOrgPrivateKeytoUserData(securedata.org, securedata.privkey);
		
		//clearsecureuserdatafromdb('ORGKEY'); // the data has been moved to users vault. delete it...
	}
	
	for (var k=0; k<otherkeys.length; k++) {
		if (otherkeys[k].org) {
			if (orgownerflake == otherkeys[k].org.split(":=")[0] && orgID == otherkeys[k].org.split(":=")[1])  {
				orgkey = otherkeys[k].privkey;
				break;
			}
		}
	}
}

function displayorgdata() {
var sitesdiv = document.getElementById("org-credentials");
	
	//sitesdiv.removeEventListener('mouseenter', unblur, false);
	//sitesdiv.removeEventListener('mouseleave', blur, false);
	sitesdiv.classList.add('blur');
	
	
	//alert('orgdatainsystem ' + orgdatainsystem);
	if (orgdatainsystem.trim().length > 0 && JSON.parse(orgdatainsystem).length > 0) {
		
		var obj = JSON.parse(orgdatainsystem); 				
		
		//alert('obj-len: ' + obj.length + ' key: ' + vaultkey  );
		
		//alert('first recorrd ' + decryptwithstretchedkey('sites', vaultkey, obj[0].data));
		for (var j=0; j< obj.length; j++) {
			
			//alert('obj-' +j +  ' section : ' + obj[j].section + ' data '+ obj[j].data  );
			var encdataobj = JSON.parse(obj[j].data);
			//alert(encdataobj.ct);
			if (obj[j].section === 'org-credentials') {
				if (document.getElementById("clear-sites-btn") != null) document.getElementById("clear-sites-btn").style.display='inline-block';
				//var savedhtml = document.getElementById("org-credentials").innerHTML;				
				
				var p = document.createElement("p")  ;
				p.style.wordWrap = "break-word"; 
				p.style.maxWidth = "90%";
				p.style.display = 'inline-block';
				
				p.style.fontSize = "16px";				
				
				var dispenctext = '';
				
				if (encdataobj != null) {
					if (encdataobj.ct.length > 300)
						dispenctext = encdataobj.ct.substr(0,300) + '...';
					else
						dispenctext = encdataobj.ct;	
				} else {
					dispenctext = obj[j].notification;
				}
				
				var textelem = document.createTextNode(dispenctext); 
				p.appendChild(textelem); 
			
				document.getElementById("org-credentials").appendChild(p);
				
			}
						
		}
		
		document.getElementById('org-secure-siteUrl').value ='';
		document.getElementById('org-secure-siteuser').value = '';
		document.getElementById('org-secure-sitepwd').value = '';						
	}
}


function clearsecureuserdatafromdb(tag) {
	//alert('Still need to implement this method...');
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
    xhr.open('POST', '/secure/clearsecureuserdata', true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
         xhr.send(JSON.stringify({
        	 flake: orgownerflake,
        	 tag: tag 
        	
     		}));
         
}

function clearAllOrgCredentials(orgid) {
	
	/*if (vaultkey.length == 0) {
		alert('Please enter your key first. You need to decrypt the entries before you can remove them.');
		return false;
	}*/
		
	if (confirm('Do you want to remove all credentials in this view?. Click OK to continue.')) {
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
	    xhr.open('POST', '/secure/clearorgdata', true);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');     
	   
	         xhr.send(JSON.stringify({
	        	 ownerflake: orgownerflake,
	        	 section: 'org-credentials' ,
	        	 orgid: orgid,
	        	 createdate: document.getElementById('org-secure-crdate').value
	     		}));
	         
	         showOrgPage(orgownerflake, orgid);
         
         return false;
	} else {
		return false;
	}
		
	
}

function displaymembersindiv(divname, orgmembers) {
	
	//alert(orgmembers);
	var ul = document.createElement("ul");
	
	var dispfn = function() {
		document.getElementById(divname).innerHTML = '';
		
		orgmembers.forEach(function(element) {
			var li = document.createElement('li');
			var p = document.createElement('p');
			p.classList.add('text-muted');
			p.appendChild(document.createTextNode(element));
			li.appendChild(p);
	        ul.appendChild(li);
		});
		document.getElementById(divname).appendChild(ul);
	};
	
	if (orgmembers != null && orgmembers.length > 0) {
		dispfn ();
	} else {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', '/newauth/api/getOrgMembers/'+orgownerflake + '/'+orgID, false);
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    
	    xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	          // alert(xhr.responseText);
	        	//removepageloadingdiv();
	        	var jsonres = xhr.responseText;
	        	orgmembers = jsonres;
	        	dispfn();
	        }
	    }		    
	   
	    xhr.send(null);
	}
	
	
	
}