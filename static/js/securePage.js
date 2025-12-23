var userdatainsystem;

var filenametodownload, ftypetodownload, datatodownload;

var filedatamap = {};

var copytimer, settimeoutid;

var lastfileseq=101;
var filecontentobject = [];
var selectedfiles = {};

var copyclickmap = {};




var handleFileSelect = function(evt) {
    var files = evt.target.files;
    
    for (var i=0; i< files.length; i++) {
	    var file = files[i];
	
	    if (files && file) {
	        var reader = new FileReader();
	
	        reader.onload = (function( file) {
	        	
	        	return function(evt) {
	        		
	        		populateFileContent(evt, file);
	        		//alert(Object.keys(selectedfiles).length + ' of ' +files.length);
	        		if (Object.keys(selectedfiles).length === files.length)
	        			document.getElementById('vault-file-upload-button').disabled = false;
	              };
	            
	        })(file);
	
	        if (file.type.length == 0)
	        	 reader.readAsText(file);
	        else
	        	reader.readAsBinaryString(file);
	    }
    }
};

var handleImportFileSelect = function(evt) {
    var files = evt.target.files;    

	    var file = files[0];
	
	//alert(file.name + ' ' + file.type);
	    if (files && file) {
	        var reader = new FileReader();
	
	        reader.onload =  function(evt) {
	        		if (file.size/1024/1024 < 1) {
		        		loadcredcsvfile(evt, file.name);
		        		//alert(Object.keys(selectedfiles).length + ' of ' +files.length);
		        		document.getElementById('vault-file-import-button').disabled = false;
	        		} else {
						document.getElementById("csvfiledisplay").appendChild(document.createTextNode('Files larger than 1 MB not allowed'));
						console.log('Too large a file. More than 1 MB');
					}
	              };
	     
	        reader.readAsText(file);
	        
	    }
   
};

function loadcredcsvfile (evt, filename) {
	var existcsvdata = document.getElementById('cred-csv-data').value;
		
	var lines = evt.target.result.split(/\r?\n/);
	
	//alert('filename ' + filename);
	var contdiv = null;
	
	if (lines.length > 0) {
		contdiv = document.getElementById("csvfiledisplay");
		contdiv.innerHTML = '';
		contdiv.style.height = 100;
		contdiv.style.overflowY = 'scroll';
		contdiv.style.overflowX = 'hidden';
		
		var rw = document.createElement('div');
		rw.classList.add('row');
		rw.style.borderBottom = 'solid 1px grey';
		
		var c1 = document.createElement('div');
		c1.classList.add('col-xs-3');
		c1.innerHTML = '<strong>Site</strong>';
		rw.appendChild(c1);
		
		var c2 = document.createElement('div');
		c2.classList.add('col-xs-3');
		c2.innerHTML = '<strong>Username</strong>';
		rw.appendChild(c2);
		var c3 = document.createElement('div');
		c3.classList.add('col-xs-3');
		c3.innerHTML = '<strong>Password</strong>';
		rw.appendChild(c3);
		var c4 = document.createElement('div');
		c4.classList.add('col-xs-3');
		c4.innerHTML = '<strong>Description</strong>';
		rw.appendChild(c4);
		
		contdiv.appendChild(rw);
		
		document.getElementById("remove-header-id").classList.remove('hidden');
		document.getElementById("remove-header").addEventListener('change', function(){
					if (document.getElementById("remove-header").checked == true) {
						if (document.getElementById("header-possible") != null) {
							document.getElementById("header-possible").style.display='none';
							var jsonexistcsvdata = JSON.parse(document.getElementById('cred-csv-data').value);
							jsonexistcsvdata.splice(0,1);
							document.getElementById('cred-csv-data').value = JSON.stringify(jsonexistcsvdata);
							//console.log('New csv creds ' + document.getElementById('cred-csv-data').value);
							document.getElementById("remove-header").disabled = true;
						}
					} else {
						if (document.getElementById("header-possible") != null)
							document.getElementById("header-possible").style.display='block';
					}
		});
		
	}
	
    for(var line = 0; line < lines.length; line++){
	//  console.log('Importing ' + lines[line]);
	    
      var datavals = lines[line].split(",");
      
      if (datavals.length != 4) {
	   // console.log('Wrong format ' + datavals);
	    continue;
	  } else {
      	  
			var thiscred = {
							"siteUrl":  datavals[0] ,
							"sitedesc":  datavals[3] , 
							"siteuser":  datavals[1]  ,
							"sitepwd":   datavals[2]  ,
							"source": filename
						};
			
			if ( existcsvdata.length == 0){
				existcsvdata = JSON.stringify(thiscred);
			} else {
				existcsvdata += ',' + JSON.stringify(thiscred);
			}
			
			var rw = document.createElement('div');
			rw.classList.add('row');
			
			if (line == 0)
				rw.setAttribute('id', 'header-possible');
				
			var c1 = document.createElement('div');
			c1.classList.add('col-xs-3');
			c1.appendChild(document.createTextNode(datavals[0]));
			c1.style.overflowX = 'hidden';
			rw.appendChild(c1);
			
			var c2 = document.createElement('div');
			c2.classList.add('col-xs-3');
			c2.appendChild(document.createTextNode(datavals[1]));
			c2.style.overflowX = 'hidden';
			rw.appendChild(c2);
			var c3 = document.createElement('div');
			c3.classList.add('col-xs-3');
			c3.appendChild(document.createTextNode(datavals[2]));
			c3.style.overflowX = 'hidden';
			rw.appendChild(c3);
			var c4 = document.createElement('div');
			c4.classList.add('col-xs-3');
			c4.appendChild(document.createTextNode(datavals[3]));
			c4.style.overflowX = 'hidden';
			rw.appendChild(c4);
			
			contdiv.appendChild(rw);
			console.log('added one row');
		  
	  }
    }
    
    if (existcsvdata.length  == 0 ) {
		contdiv.appendChild(document.createTextNode("No valid credential data found. Please check the file you selected"));
	} else {
		//console.log('New csv creds ' + existcsvdata);
		document.getElementById('cred-csv-data').value = '[' + existcsvdata + ']';
	}
}

function populateFileContent(evt, file) {
		var binaryString = evt.target.result;
		//alert('setting selectedfiles for ' + file.name + ':' + file.type + ':' + file.size + ' bin str ' + btoa(binaryString));
	selectedfiles[file.name + ':' + file.type + ':' + file.size] = btoa(binaryString);	
}


function unblur() {
		 var attribute = this.getAttribute("id");
	    this.classList.remove('blur');
	};
	
function blur() {
	    var attribute = this.getAttribute("id");
	    this.classList.add('blur');
	};

	function registereventhandlers() {
		var classname = document.getElementsByClassName("blur");
		for (var i = 0; i < classname.length; i++) {
		    classname[i].addEventListener('mouseenter', unblur, false);
		    classname[i].addEventListener('mouseleave', blur, false);
		}
	}
	
	function checkKey() {
		var val = document.getElementById("keybox").value;
		if (val.length ==0) {
			alert('Invalid key.');
			return false;
		}
		
		vaultkey = val;
		displayUserDataClear();
		
		return false;
	}

	function displaykeyalert(alerttxt) {
		//alert('about to show alert ' + alerttxt);	
		//document.getElementById("no-key-alert").innerHTML = '<p class="lead"><mark>' + alerttxt + '</mark></p>';
		//document.getElementById("no-key-alert-holder").style.display = 'block';
		//document.getElementById("no-key-alert").innerHTML = '<p class="lead"><mark>' + alerttxt + '</mark></p>';
		//alert('will show key alert');
		$("#key-input-div").fadeIn(600);
		$("#no-key-alert-holder").fadeIn(600);
		
	}
	
	function processvaultsearch () {
		if (settimeoutid != null)	{
			//console.log('clearing timeout ' + settimeoutid);
			clearTimeout(settimeoutid);
		}
		settimeoutid = setTimeout(function() {displayUserDataClear(document.getElementById('vault-search-input').value);}, 200);
		
	}
	
	function changevaultkey() {
		var newvaultkey = document.getElementById('newvaultkey').value;
		
		if (vaultkey == newvaultkey) {
			document.getElementById('vault-key-update-notification').innerHTML = 'This key is identical to your current key';
			//$('#vaultkeymodal').modal('hide');
			document.getElementById('newvaultkey').value = '';
			return;
		}
		
		if (newvaultkey.length < 6) {
			document.getElementById('vault-key-update-notification').innerHTML = 'Please choose a vault key longer than 6 characters';
			//$('#vaultkeymodal').modal('hide');
			document.getElementById('newvaultkey').value = '';
			return;
		}
		
		var filedatasalt = '';
		var filedataitns = 0;
		var filedatacreatedate;
		var filedatalastupdatedate;
		
		if (JSON.parse(userdatainsystem).length > 0) {
			document.getElementById('vault-key-update-notification').innerHTML = 'Update in progress...';
			var obj = JSON.parse(userdatainsystem); 				
			
			//alert('obj-len: ' + obj.length + ' key: ' + vaultkey);
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");			
			
			//alert('first recorrd ' + decryptwithstretchedkey('sites', vaultkey, obj[0].data));
			for (var j=0; j< obj.length; j++) {
				
				if (obj[j].sequence === 0) {
					var originaldata = sjcl.decrypt(vaultkey, obj[j].data); 
					var encwithnewvaultkey = encryptdatawithstretchedkey(originaldata, newvaultkey,'',0); // this only encrypts the data
					
					xhr.open('POST', '/secure/adduserdata', false);
				    xhr.withCredentials = true;
				    xhr.setRequestHeader('Content-Type', 'application/json');    
				     
				    var newdata = {
				     	   	salt: obj[j].salt,
				     	   	iterations: obj[j].iterations,
				     	   	data: encwithnewvaultkey ,
				     	   	sequence: obj[j].sequence,
				     	    createdate: obj[j].createdate
				     		};
				   // alert('will send this data for seq ' + obj[j].sequence + ' ' + JSON.stringify(newdata));
			         xhr.send(JSON.stringify(newdata));
				} else {
					//alert('seq ' +  obj[j].sequence);
					encruptanduploaddatawithdiffvaultkey(obj[j], vaultkey, newvaultkey); // this encrypts and saves the data
					
					if (obj[j].sequence == '3') {
						
						// ALSO encrypt individual files
						
						filedatasalt = obj[j].salt;
						filedataitns = obj[j].iterations;
						filedatacreatedate= obj[j].createdate;
						filedatalastupdatedate= obj[j].lastupdatedate;
						
						//alert('data in seq 3 ' + obj[j].data);
						var originaldata = decryptwithstretchedkey('oth', vaultkey, obj[j].data);
						var dataobj = JSON.parse(originaldata);
						
						var maxfileseq = dataobj[0].fileseq;
						//alert('data-obj length ' + dataobj.length + ' ' + dataobj);
						for (var i=0; i< dataobj.length; i++) {
							
							xhr.open('POST', '/secure/getuserdata', false); // needs to be synchronous false means synchronous
						    xhr.withCredentials = true;
						    xhr.setRequestHeader('Content-Type', 'application/json');   
						    
						    xhr.onreadystatechange = (function(fileseq) {
						    	
							    return function(evt) {
							    	//alert('getfilecontentfromdb returned status ' + xhr.status + ' ' + xhr.responseText);
							    	//alert('fileseq '+ fileseq);
							        if (xhr.readyState == 4 && xhr.status == 200) {	   
							        	//alert(xhr.responseText);
							        	var udobj = JSON.parse(xhr.responseText);
							        	//alert(udobj.data);
							        	if (udobj != null) {
								        	var originaldata = decryptwithstretchedkey('oth', vaultkey, udobj.data);
								        	var encryptedfiledata =	encryptdatawithstretchedkey(originaldata, 
																		newvaultkey, 
																		filedatasalt, 
																		filedataitns);		
													        	
								        	var xhr2 = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
								        	xhr2.open('POST', '/secure/adduserdata', false);
								    	    xhr2.withCredentials = true;
								    	    xhr2.setRequestHeader('Content-Type', 'application/json');   
								    	    
								    	    xhr2.onreadystatechange = (function(fseq) {
								    	    	return function(evt) {
											    	if (xhr2.readyState == 4 && xhr2.status == 200) {	
											    		if (maxfileseq == fseq) {
											    			console.log('File content ' + fseq + ' saved with new vault key');
											    			document.getElementById('vault-key-update-notification').innerHTML = 'Your Vault Key has been updated successfully. Please make a note of it, if you need to.';
											    		}
											        } 
								    	    	};
										    })(fileseq);
								    	    
								    	    var newfiledata = {
										     	   	salt: filedatasalt,
										     	   	iterations: filedataitns,
										     	   	data: encryptedfiledata ,
										     	   	sequence: fileseq,
										     	   createdate: filedatacreatedate
										     		};
								    	    
								    	    //alert('will send new file data ' + fileseq + ' ' + JSON.stringify(newfiledata));
								    		
									    	  xhr2.send(JSON.stringify(newfiledata));		     		
							        	}
							        } 
							    };
						    })(dataobj[i].fileseq);
						   
						    var filedatareq = {
						     	   	sequence: dataobj[i].fileseq,
						     	   	createdate: filedatacreatedate
					     		};
						   // alert('sending file data req for seq ' + dataobj[i].fileseq);
					         xhr.send(JSON.stringify(filedatareq));
						}
						
						filedatamap = {};
					} else { // NO files 
					
						if (parseInt(obj[j].sequence) == obj.length - 1) {
							document.getElementById('vault-key-update-notification').innerHTML = 'Your Vault Key has been updated successfully. Please make a note of it, if you need to.';
						}
					}
				}
				
			}
			vaultkey = newvaultkey;
			//document.getElementById('newvaultkey').value = '';
			//$('#vaultkeymodal').modal('hide');
		}
		
	}
	
	function encruptanduploaddatawithdiffvaultkey(data, oldkey, newkey) {
		var type = '';
		
		//alert('data sequence' + data.sequence);
		if (data.sequence == '1') 
			type = 'sites';
		
		if (data.sequence == '2') 
			type = 'fin';
		
		if (data.sequence == '3') 
			type = 'oth';
		
		//alert('in encruptanduploaddatawithdiffvaultkey data of type ' + type + ' old key ' + oldkey);
		try {
			var originaldata = decryptwithstretchedkey(type, oldkey, data.data);
			//alert('original data while switching vault key '+ originaldata);
			var encwithnewvaultkey = encryptdatawithstretchedkey(originaldata, 
													newkey, 
													data.salt, 
													data.iterations);
			
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			xhr.open('POST', '/secure/adduserdata', false);
		    xhr.withCredentials = true;
		    xhr.setRequestHeader('Content-Type', 'application/json');    
		    
		    var newdata = {
		     	   	salt: data.salt,
		     	   	iterations: data.iterations,
		     	   	data: encwithnewvaultkey ,
		     	   	sequence: data.sequence	,
		     	   createdate: data.createdate
		     		};
		    
		   // alert('will send this data ' + JSON.stringify(newdata));
		    xhr.send(JSON.stringify(newdata));
		         
		} catch(e) {
			
			vaultkey = '';
			//alert('am i here?');
			displaykeyalert('Could not decrypt existing data with your old Vault key. Please come back to this page and provide you original vault key before updating it. ');
			//break;
			return false;
		}
	}
	
	
	
	function displayUserDataClear(filteronstr) {		
		var filteredsites = 0;
		var filteredfiles = 0;
		//alert('displayUserDataClear called ' + vaultkey);	
		//vaultkey = '';
		
		var sitesdiv = document.getElementById("securedata-sites");
		
		sitesdiv.removeEventListener('mouseenter', unblur, false);
		sitesdiv.removeEventListener('mouseleave', blur, false);
		sitesdiv.classList.remove('blur');
		
		sitesdiv = document.getElementById("securedata-fin");
		
		sitesdiv.removeEventListener('mouseenter', unblur, false);
		sitesdiv.removeEventListener('mouseleave', blur, false);
		sitesdiv.classList.remove('blur');
		
		sitesdiv = document.getElementById("securedata-oth");
		
		sitesdiv.removeEventListener('mouseenter', unblur, false);
		sitesdiv.removeEventListener('mouseleave', blur, false);
		sitesdiv.classList.remove('blur');
		
		//alert(userdatainsystem.length);
		if (JSON.parse(userdatainsystem).length > 0) {
			
			// NO need for intro
			document.getElementById("vault-intro").style.display='none';
			
			var obj = JSON.parse(userdatainsystem); 				
			
			//alert('obj-len: ' + obj.length + ' key: ' + vaultkey);
			
			//alert('first recorrd ' + decryptwithstretchedkey('sites', vaultkey, obj[0].data));
			for (var j=0; j< obj.length; j++) {
				
				//var encdataobj = JSON.parse(obj[j].data);
				
				if (obj[j].sequence === 0) {
					//lastupdatedate":"08-06-2020 20:05:48","createdate":"12-17-2019 17:02:12"
					if (obj[j].lastupdatedate != obj[j].createdate) {
						document.getElementById('vault-key-last-change-info').innerText = 'You changed your vault key on ' + obj[j].lastupdatedate;
					}
					
				}
				
				if (obj[j].sequence === 1) {
					document.getElementById("clear-sites-btn").style.display='inline-block';
					//alert('obj[j].copies' + obj[j].copies);
					if (typeof obj[j].copies != 'undefined' && obj[j].copies.length > 0) {
		
						document.getElementById("revert-sites-btn").setAttribute('data-current', obj[j].lastupdatedate);
						
						for (var c=0; c<obj[j].copies.length; c++ ) {
							if (obj[j].lastupdatedate == obj[j].copies[c]) {
								
								document.getElementById("revert-sites-btn").style.display='inline-block';
								
								if (c == obj[j].copies.length -1)
									document.getElementById("revert-sites-btn").setAttribute('data-next', obj[j].copies[0]);
								else
									document.getElementById("revert-sites-btn").setAttribute('data-next', obj[j].copies[c+1]);
							}
						}
					}
					
					var savedhtml = document.getElementById("securedata-sites").innerHTML;
					document.getElementById("securedata-sites").innerHTML = "";
					try {
						var originaldata = decryptwithstretchedkey('sites', vaultkey, obj[j].data);
						obj[j].data = originaldata;
						//alert('original data after decrypt ' + JSON.stringify(originaldata));
					} catch(e) {
						//alert(' decrypt failed with key ' + vaultkey );
						document.getElementById("securedata-sites").innerHTML = savedhtml;
						vaultkey = '';
						displaykeyalert('The key you entered is incorrect. Most users use their username as the key here. You need to provide the same key you entered while adding data here. ');
						//break;
						return false;
					}
				}
				
				if (obj[j].sequence === 2) { 
					document.getElementById("clear-fin-btn").style.display='inline-block';
					var savedhtm = document.getElementById("securedata-fin").innerHTML;
					document.getElementById("securedata-fin").innerHTML = "";
					try {
						var origdata = decryptwithstretchedkey('fin', vaultkey, obj[j].data);
						obj[j].data = origdata;
					} catch(e) {
						document.getElementById("securedata-fin").innerHTML = savedhtm;
						vaultkey = '';
						displaykeyalert('The key you entered is incorrect. Most users use their username as the key here. You need to provide the same key you entered while adding data here.');
						//break;
						return false;
					}
				}
				
				
				if (obj[j].sequence === 3) { 
					//alert('trying to open filelist');
					document.getElementById("clear-oth-btn").style.display='inline-block';
					var savedhtm = document.getElementById("securedata-oth").innerHTML;
					document.getElementById("securedata-oth").innerHTML = "";
					try {
						//alert('vaultkey used ' + vaultkey);
						var origdata = decryptwithstretchedkey('oth', vaultkey, obj[j].data);
						obj[j].data = origdata;
						
					} catch(e) {
						//alert('exception thrown while decrypting ' + JSON.stringify(e));
						document.getElementById("securedata-oth").innerHTML = savedhtm;
						vaultkey = '';
						displaykeyalert('The key you entered is incorrect. Most users use their username as the key here. You need to provide the same key you entered while adding data here.');
						//break;
						return false;
					}
				}
				
				//alert('hide begin');
				
				// If data decrypted properly, remove the key input box
				//document.getElementById("key-input-div").style.display = "none";
				removeKeyboxAndAlert();
				
				//if (j ==2)
				//	alert('obj-j data seq : ' + obj[j].sequence + ' data ----- ' + obj[j].data);
				
				var dataobj = JSON.parse(obj[j].data);
				
				//alert('data-obj length ' + dataobj.length + ' ' + dataobj);
				for (var i=0; i< dataobj.length; i++) {
					
					if (obj[j].sequence === 1) {
						
						//alert(JSON.stringify(obj[j]));
						//document.getElementById('securedata-sites').innerHTML = "";
						document.getElementById('sites-siteUrl').value =dataobj[i].siteUrl;
						document.getElementById('sites-siteuser').value = dataobj[i].siteuser;
						document.getElementById('sites-sitepwd').value = dataobj[i].sitepwd;
						document.getElementById('sites-sitedesc').value = dataobj[i].sitedesc;
						document.getElementById('sites-sitename').value = dataobj[i].sitename;
						
						
						//console.log('dataobj[i].sharedwith ' + dataobj[i].sharedwith);
						if (typeof dataobj[i].sharedwith != 'undefined')
							document.getElementById('sites-sharedwith').value = JSON.stringify(dataobj[i].sharedwith);
						else
							document.getElementById('sites-sharedwith').value = '';
						
						document.getElementById('sites-seq').value = obj[j].sequence;
						document.getElementById('sites-slt').value = obj[j].salt;
						document.getElementById('sites-itns').value = obj[j].iterations;
						document.getElementById('sites-crdate').value = obj[j].createdate;
						document.getElementById('sites-upddate').value = obj[j].lastupdatedate;
						document.getElementById('sites-accdate').value = obj[j].lastaccessdate;
						
						if (document.getElementById('sites-last-update-display').innerText.length == 0) {
							document.getElementById('sites-last-update-display').innerText = gettimedifference(obj[j].lastupdatedate, true);
							document.getElementById('sites-last-access-display').innerText = gettimedifference(obj[j].lastaccessdate, true);
						}
						
						var count = parseInt(i  +1);
						document.getElementById('vault-site-count').innerText =  ' (' + count + ')';
						
						if (typeof filteronstr == 'undefined' || 
									dataobj[i].siteUrl.toLowerCase().indexOf(filteronstr.toLowerCase()) >= 0 || 
									dataobj[i].siteuser.toLowerCase().indexOf(filteronstr.toLowerCase()) >= 0 ||
									dataobj[i].sitepwd.indexOf(filteronstr) >= 0) {
							filteredsites ++;
							addWebsiteToSecurePage();
							if (typeof filteronstr != 'undefined') document.getElementById('vault-filteredsite-count').innerText = filteredsites + ' of';
							
						}
						
						if (typeof filteronstr === 'undefined' ) document.getElementById('vault-filteredsite-count').innerText = '';
						if (filteredsites == 0 ) document.getElementById('vault-filteredsite-count').innerText = ' 0 of';
					}					
					
					if (obj[j].sequence === 2) {
						//document.getElementById('securedata-fin').innerHTML = "";
						//alert('drawing ' + i + ' fin data');
						//alert(JSON.stringify(dataobj[i]));
						document.getElementById('fin-institution').value =dataobj[i].institution;
						document.getElementById('fin-accType').value = dataobj[i].accType;
						document.getElementById('fin-acctNum').value = dataobj[i].acctNum;
						
						document.getElementById('fin-seq').value = obj[j].sequence;
						document.getElementById('fin-slt').value = obj[j].salt;
						document.getElementById('fin-itns').value = obj[j].iterations;
						document.getElementById('fin-crdate').value = obj[j].createdate;
						document.getElementById('fin-upddate').value = obj[j].lastupdatedate;
						
						addFinDataToSecurePage();
					}
					
					if (obj[j].sequence === 3) {
						//alert('got file data back: dataobj ' + dataobj[i]['secure-file'] + ' ' +  dataobj[i].filetype);						
						//alert('fileseq from db ' + i + ' ' + dataobj[i].fileseq);
						//document.getElementById('secure-file-content').value =dataobj[i].filecontent; // commenting because filecontent is not read here
						
						document.getElementById('oth-seq').value = obj[j].sequence;
						document.getElementById('oth-slt').value = obj[j].salt;
						document.getElementById('oth-itns').value = obj[j].iterations;
						document.getElementById('oth-crdate').value = obj[j].createdate;
						document.getElementById('oth-upddate').value = obj[j].lastupdatedate;
						document.getElementById('oth-accdate').value = obj[j].lastaccessdate;
						
						//addFileDataToSecurePage(dataobj[i]['secure-file'], dataobj[i].filetype, dataobj[i].filesize, dataobj[i].fileseq);
						if (typeof filteronstr == 'undefined' || 
								dataobj[i].filename.toLowerCase().indexOf(filteronstr.toLowerCase()) >= 0 || 
								dataobj[i].filetype.toLowerCase().indexOf(filteronstr.toLowerCase()) >= 0 ) {
							addFileDataToSecurePage(dataobj[i]);
							filteredfiles++;
							if (typeof filteronstr != 'undefined') document.getElementById('vault-filteredfile-count').innerText = filteredfiles + ' of';
						}
						
						if (i == 0) { // read the first fileseq, that should be the largest
							lastfileseq = dataobj[i].fileseq;
							//alert('lastfileseq from db ' + lastfileseq);
						}
						
						var count = parseInt(i  +1);
						document.getElementById('vault-file-count').innerText = ' ' + count ;
						if (typeof filteronstr === 'undefined' ) document.getElementById('vault-filteredfile-count').innerText = '';
						if (filteredfiles == 0 ) document.getElementById('vault-filteredfile-count').innerText = ' 0 of';
					}
					
				}
			}
			document.getElementById('sites-siteUrl').value ='';
			document.getElementById('sites-siteuser').value = '';
			document.getElementById('sites-sitepwd').value = '';
			document.getElementById('sites-sitedesc').value = '';
			document.getElementById('sites-sitename').value = '';
			document.getElementById('sites-sharedwith').value = '';
			
			document.getElementById('fin-institution').value ='';
			document.getElementById('fin-accType').value = '';
			document.getElementById('fin-acctNum').value = '';
			
			document.getElementById('vault-search-input').style.display='block';	
			document.getElementById('vaultkeychangebutton').classList.remove('hidden');	
		}
		
		
	}
	
	function revertvaultdata(type) {
		
		let confmsg = 'Do you want to restore the previous version of your vault content?';
		if (confirm(confmsg)) {
			if (type == '1') {
				var curr = document.getElementById("revert-sites-btn").getAttribute('data-current');
				var next = document.getElementById("revert-sites-btn").getAttribute('data-next');
				
				//alert('curent ' + curr + ' going to ' + next);
				var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
				
			    xhr.open('POST', '/secure/revertuserdata', false);
			    xhr.withCredentials = true;
			    xhr.setRequestHeader('Content-Type', 'application/json');    		    
			    
			    xhr.onreadystatechange = function() {
			    	if (xhr.readyState == 4 && xhr.status == 200) {	   
			    	
			    		 showPrivateDataPage();
			        } 
			    }
		  
		         xhr.send(JSON.stringify({
		     	   	sequence: 1,
		     	   	createdate: document.getElementById('sites-crdate').value,
		     	   	lastupdatedate: next
		     		}));		         
			}
		}
	}
	
	function removeKeyboxAndAlert() {
		
		$("#key-input-div").hide('slow');
		
		//document.getElementById("no-key-alert-holder").style.display = "none";
		$("#no-key-alert-holder").hide('slow');
   
	}
	
	function displayUserData() { // this displays the ENCRYPTED data as received from server
		
		if (JSON.parse(userdatainsystem).length > 0) {
			// NO need for intro
			document.getElementById("vault-intro").style.display='none';
			
			var obj = JSON.parse(userdatainsystem); 				
			
			//alert('obj-len: ' + obj.length + ' dataobj length: ' + dataobj.length);
			for (var j=1; j< obj.length; j++) {
				//alert('decrypting ' + j + ' ' + obj[j].data);
				var encdataobj = JSON.parse(obj[j].data);
				//alert('encrypted data ' + encdataobj.ct);
				
				var rowelem = document.createElement("div");
				rowelem.classList.add('row');
									
				var divelem = document.createElement("div");
				divelem.classList.add('col-xs-12');				
									
				var p = document.createElement("p")  ;
				p.style.wordWrap = "break-word"; 
				p.style.maxWidth = "90%";
				p.style.display = 'inline-block';
				
				p.style.fontSize = "16px";				
				
				var dispenctext = '';
				
				if (encdataobj.ct.length > 300)
					dispenctext = encdataobj.ct.substr(0,300) + '...';
				else
					dispenctext = encdataobj.ct;			
				
				var textelem = document.createTextNode(dispenctext); 
				p.appendChild(textelem); 
				
				addinfolabel(divelem);
				divelem.appendChild(p);
				
				rowelem.appendChild(divelem);
				
				if (obj[j].sequence === 1) {	
					document.getElementById("securedata-sites").innerHTML = "";
					document.getElementById("securedata-sites").appendChild(rowelem);				
				}
				
				if (obj[j].sequence === 2) { 
					document.getElementById("securedata-fin").innerHTML = "";
					document.getElementById("securedata-fin").appendChild(rowelem);				
				}				
				
				if (obj[j].sequence === 3) { 	
					document.getElementById("securedata-oth").innerHTML = "";
					document.getElementById("securedata-oth").appendChild(rowelem);
							
				}						
			}
		}
		
		
	}
	
	function addinfolabel(div) {
		
		var p = document.createElement("p")  ;
		p.style.wordWrap = "break-word"; 
		p.style.maxWidth = "90%";
		p.style.display = 'inline-block';
		
		p.classList.add('lead');	
		
		var textelem = document.createTextNode("You can decrypt this data only with the key you used to add this data"); 
		p.appendChild(textelem);  
		div.appendChild(p);
	}
	
	
	function submitencuserdata(type, newdata) {
		if (vaultkey.length == 0) {
			
			createvaultpagekeyoverlay();
			//alert('Please enter your key first. This key will be used to encrypt your data. Most users use their username as the key. You can use a different key if you want');
			//document.getElementById(type+'-data').value = '';
			//$('#' + type + 'Modal').modal('hide');
			return false;
		}
		// first check if values filled in -- only for new data
		
		if (newdata) {
			if (type === 'sites') {
				if (document.getElementById('sites-sitepwd').value.length == 0) return false;
			}
			
			if (type === 'fin') {
				if (document.getElementById('fin-institution').value.length == 0) return false;
			}
			
			if (!createUserData(type)) {
				 $('#' + type + 'Modal').modal('hide');
				return false;
			}
		}
		//alert('after createdata');
		if (type === 'sites')
			document.getElementById(type+'-seq').value = '1';
		
		if (type === 'fin')
			document.getElementById(type+'-seq').value = '2';
		
		if (type === 'oth')
			document.getElementById(type+'-seq').value = '3';		
		
		var cleardata =  document.getElementById(type+'-data').value ;
		
		//var encrypteddata =	JSON.stringify( encryptwithstretchedkey(type, vaultkey));
		var encrypteddata =	encryptwithstretchedkey(type, vaultkey);
		//alert(cleardata + ' --> enc data: ' +  encrypteddata);	
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
	    xhr.open('POST', '/secure/adduserdata', false);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');    
	    
	    
		    xhr.onreadystatechange = function() {
		    	if (xhr.readyState == 4 && xhr.status == 200) {	  
					if (type != 'oth') { 
			    		if ($('#' + type + 'Modal').hasClass('in')) {
			    			//console.log('#' + type + 'Modal is open, will close');
			    		   $('#' + type + 'Modal').modal('hide');
			    		}
			    		showPrivateDataPage();
		    		}
		        } 
		    }
	   
	   
	         xhr.send(JSON.stringify({
	     	   	group: type,
	     	   	salt: document.getElementById(type+'-slt').value,
	     	   	iterations: document.getElementById(type+'-itns').value,
	     	   	data: encrypteddata ,
	     	   	sequence: document.getElementById(type+'-seq').value,
	     	   	createdate: document.getElementById(type+'-crdate').value,
	     	   	lastupdatedate: document.getElementById(type+'-upddate').value
	     		}));
	         
         if (type === 'oth') { // add content also as a separate item        	 
        	 
        	 for (var i = 0; i < filecontentobject.length; i++) {
        		 
        		 //alert('FILE CONTENT obj before saving to DB: ' + JSON.stringify(filecontentobject[i]));
	        	 document.getElementById(type+'-data').value = JSON.stringify(filecontentobject[i]) ;
	        	 
	        	 cleardata = document.getElementById(type+'-data').value ;
	        	// alert('adding content seq ' + document.getElementById(type+'-data').value);
	     		encrypteddata =	encryptwithstretchedkey(type, vaultkey);
					     		
	     		xhr.open('POST', '/secure/adduserdata', false);
	    	    xhr.withCredentials = true;
	    	    xhr.setRequestHeader('Content-Type', 'application/json');   
	    	    
	    	    xhr.onreadystatechange = function() {
			    	if (xhr.readyState == 4 && xhr.status == 200) {	  
			    		   $('#' + type + 'Modal').modal('hide');
			    		 showPrivateDataPage();
			        } 
			    }
	    	    
	     		xhr.send(JSON.stringify({
		     	   	group: type,
		     	   	salt: document.getElementById(type+'-slt').value,
		     	   	iterations: document.getElementById(type+'-itns').value,
		     	   	data: encrypteddata ,
		     	   	sequence: filecontentobject[i].fileseq,
		     	   	createdate: document.getElementById(type+'-crdate').value,
		     	   	lastupdatedate: document.getElementById(type+'-upddate').value
		     		}));
        	 }
         }
	   // showDataAddDiv(type + 'Div');	         
	        
	    return false;		 
	}
	
	function addimportedcredentialsfromfile() {
		if (vaultkey.length == 0) {
			
			createvaultpagekeyoverlay();
			//alert('Please enter your key first. This key will be used to encrypt your data. Most users use their username as the key. You can use a different key if you want');
			//document.getElementById(type+'-data').value = '';
			//$('#' + type + 'Modal').modal('hide');
			return false;
		}
		
		var userdatainsystemobj = JSON.parse(userdatainsystem);
		
		if (userdatainsystemobj.length > 0) {			
				
			var existingsites = '';
			//var obj = JSON.parse(userdatainsystemobj[0].data); 
			
			for (var x=0; x< userdatainsystemobj.length; x++) {
				if (userdatainsystemobj[x].sequence === 1) {
				
					var obj = JSON.parse(decryptwithstretchedkey('sites', vaultkey, userdatainsystemobj[x].data)); 
					
					//alert(JSON.stringify(obj));
					for (var i=0; i< obj.length; i++) {
						
						existingsites += JSON.stringify(obj[i]);
						
						if (i < obj.length )
							existingsites +=  ", ";
					}
				}
			}
			
			document.getElementById('cred-csv-data').value = document.getElementById('cred-csv-data').value.replace('[','');
			document.getElementById('cred-csv-data').value = document.getElementById('cred-csv-data').value.replace(']','');
			document.getElementById('sites-data').value = '[' + existingsites + document.getElementById('cred-csv-data').value + ']';
	
		} else {
			document.getElementById('sites-data').value = '[' + document.getElementById('cred-csv-data').value + ']';
		}
		
		//alert(document.getElementById('sites-data').value);
		submitencuserdata('sites', false);
		 $('#importfilemodal').modal('hide');
	}

	function createUserData(type) {
		var userdata = '';	
		
		//alert('createUserData called ' );	
		
		if (type === 'sites' ) {
			
			userdata = '"siteUrl":"' + document.getElementById('sites-siteUrl').value + '", ' +
						'"siteuser":"' + document.getElementById('sites-siteuser').value + '", ' +
						'"sitepwd":"' + document.getElementById('sites-sitepwd').value + '", ' +
						'"sitedesc":"' + document.getElementById('sites-sitedesc').value + '", ' +
						'"sitename":"' + document.getElementById('sites-sitename').value + '", ';
			
			addWebsiteToSecurePage();
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
				  return false;
			  }

			   
			  var fileobject = {"filename": file.name,
					  			"filetype": file.type,
					  			"filesize": file.size,
					  			"fileseq": lastfileseq + 1,
					  			"createtime": Date.now()
					  			};
			  
			  //alert('selectedfiles object : ' + file.name + ':' + file.type + ':' + file.size + selectedfiles);
			 // var b64content = '"' + document.getElementById("secure-file-content").value + '"';
			  filecontentobject.push( {"filename": file.name,
			  						"filetype": file.type,
			  						"filesize": file.size,
			  						"fileseq": lastfileseq  + 1,
			  						"content": 	selectedfiles[file.name + ':' + file.type + ':' + file.size]
			  						});
			  
				userdata += JSON.stringify(fileobject) ; 
			   
			   //document.getElementById('oth-content-data').value=filecontentobject;
			   
			 // alert('File seq after instantiation: ' + filecontentobject.fileseq);
			   
			   if (i < files.length -1)
				   userdata +=  ', ';
			   
			   //addFileDataToSecurePage(file.name, file.type, file.size, lastfileseq + 1 + i );
			   lastfileseq = lastfileseq + 1;
			   
			   //alert('setting lastfileseq to ' + lastfileseq);
			   addFileDataToSecurePage(fileobject);
			} //for
			
			selectedfiles = {};
			
		}			
		
		//alert(userdatainsystem);
		var userdatainsystemobj = JSON.parse(userdatainsystem);
		
		//alert('userdatainsystemobj.length ' + userdatainsystemobj.length + ' type ' + type);
		if (userdatainsystemobj.length > 0) {
			if (type === 'sites' ) {
				
				var existingsites = '';
				//var obj = JSON.parse(userdatainsystemobj[0].data); 
				
				for (var x=0; x< userdatainsystemobj.length; x++) {
					if (userdatainsystemobj[x].sequence === 1) {
					
						var obj = JSON.parse(decryptwithstretchedkey('sites', vaultkey, userdatainsystemobj[x].data)); 
						
						//alert(JSON.stringify(obj));
						for (var i=0; i< obj.length; i++) {
							
							existingsites += JSON.stringify(obj[i]);
							
							if (i < obj.length )
								existingsites +=  ", ";
						}
					}
				}
				
				document.getElementById('sites-data').value = '[' + existingsites + '{' + userdata.substring(0, userdata.length-2) + '}]';
			} 
			
			if (type === 'fin') {
				
				var existingfin = '';
				
				for (var x=0; x< userdatainsystemobj.length; x++) {
					if (userdatainsystemobj[x].sequence === 2) {
						
						var obj = JSON.parse(decryptwithstretchedkey('fin', vaultkey, userdatainsystemobj[x].data)); 
						
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
				
				for (var x=0; x< userdatainsystemobj.length; x++) {
					if (userdatainsystemobj[x].sequence === 3) {				
					
						var obj = JSON.parse(decryptwithstretchedkey('oth', vaultkey, userdatainsystemobj[x].data)); 
						
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
		
		return true; /// data created correctly
	}

	
	function getHostName(url) {
		
		const aurl = document.createElement('a');
		
		if (url.indexOf('http') == -1) {
			url = "http://" + url;
		}
		
		aurl.setAttribute('href', url);

		return aurl.hostname;
	}
	
	function getDomain(text) {
	    const urlPattern = /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)(?:\/.*)?$/;
		  const match = text.match(urlPattern);
		  return match ? match[1] : null;
	}
	
	
	function addWebsiteToSecurePage() {
		//var els = inputform.elements;
		var siteurl, siteusername, sitepass, sitetitle, sitesharedwith, sitedesc, sitename;		
		
		siteurl = document.getElementById('sites-siteUrl').value;
		siteusername = document.getElementById('sites-siteuser').value;
		sitepass = document.getElementById('sites-sitepwd').value;	
		sitesharedwith = document.getElementById('sites-sharedwith').value;	
		sitedesc = document.getElementById('sites-sitedesc').value;	
		sitename = document.getElementById('sites-sitename').value;	
		
		var sitedomain =  null;
		
		if (siteurl !== 'undefined') {
			
			sitedomain = getDomain(siteurl);
			//console.log('adding ' + siteurl + ' ' + siteusername + ' ' + sitedomain);
			
			if (sitedomain != null) {
				sitetitle = sitedomain.split('.')[0];
			} else if (sitename != null) {
				sitetitle = sitename;
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
		
		var imgelem = null;
		if (sitedomain != null) {
			imgelem = document.createElement("img");
			imgelem.setAttribute("src", "https://www.google.com/s2/favicons?domain=" + sitedomain);
			imgelem.setAttribute("height", "24");
			imgelem.setAttribute("width", "24");
			imgelem.setAttribute("alt", siteurl);
			imgelem.classList.add('center-block');	
		} else {
			imgelem = document.createElement("p");
			//imgelem.setAttribute("src", "https://www.google.com/s2/favicons?domain=" + sitedomain);
			imgelem.style.fontWeight = 'bold';
			imgelem.setAttribute("height", "24");
			imgelem.setAttribute("width", "24");
			imgelem.setAttribute("alt", siteurl);
			imgelem.classList.add('center-block');	
			
			imgelem.appendChild(document.createTextNode(siteurl.substring(0, 15)));
		}
		
		var cardcaption = document.createElement("div");
		//cardcaption.classList.add('center-block');
		cardcaption.style.textAlign= 'center';
		
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
		
		//console.log('adding ' + siteurl + ' title ' + sitetitle + ' shared ' + sitesharedwith);
		
		if ( sitetitle != 'undefined' && sitetitle != null && sitetitle.length > 0) {
			//alert(sitetitle[0]);
			//console.log('adding ' + siteurl + ' title ' + sitetitle + ' shared ' + sitesharedwith);
			
			var sitetitlecased = sitetitle.charAt(0).toUpperCase() + sitetitle.substring(1, 15 );
			var ttextelem = document.createTextNode(sitetitlecased); 
			
			if (sitesharedwith.length > 0) {
				ttextelem = document.createTextNode(sitetitlecased + '*'); 
			}
			
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
						copyInfoToClipboard(evt, siteurl, siteusername, sitepass, sitesharedwith);
			//		}, 
			//		400
			//	);
		}, false);
				
		var sitesdiv = document.getElementById("securedata-sites");
		
		outerdiv.appendChild(divelem);	
		
		createcardlayout(sitesdiv, outerdiv);
		}
		
	}
	
	function makeallchildrentransparent(node) {
	
	    for (var i = 0; i < node.childNodes.length; i++) {
	      var child = node.childNodes[i];
	      makeallchildrentransparent(child);
	      if (child.style)
	    	  child.style.background='transparent';;
	    }

	}
	function copyInfoToClipboard(evt, siteurl, siteusername, sitepass, siteshared) {
		//alert(evt.clientX + ':' +evt.clientY);
		
		evt.target.style.background='#e2e2e2';
		
		var pagename; 
		
		if (document.getElementById("securedata-sites") == null)
			pagename = "Org";
	    
	    if (copyclickmap[siteurl+siteusername] == null) {
	    	for (var member in copyclickmap) delete copyclickmap[member];
	    	copyclickmap[siteurl+siteusername] = 1;
	    	//document.getElementById('sitessettingfootercollapse').style.display='block';
	    	$("#sitessettingfootercollapse").collapse("show");
	    	
	    	var dummy = document.createElement("input");
		    document.body.appendChild(dummy);
		    dummy.setAttribute('value', siteusername);
		    dummy.select();
		    document.execCommand("copy");
		    document.body.removeChild(dummy);
		    
		    var footerdiv = document.getElementById('sitessettingfootercontent');
		    
		    if (footerdiv != null) {
		    	var h5 = document.createElement('p');
		    	h5.setAttribute('id', 'sitesettingnotification');
		    	h5.appendChild(document.createTextNode('Username ' + siteusername + ' for ' + siteurl + ' copied to clipboard. Click once more to open the site in a different window'));
		    	footerdiv.innerHTML = '';
				let shortsite = siteurl;
				
				if (shortsite.length > 15)
					shortsite = siteurl.substring(0, 15);
				
		    	//footerdiv.appendChild(h5);
				displaybuttonbehavior(evt, 'Username copied to clipboard. Click again to open ' + shortsite);
		    	
		    	var delbtn = document.createElement("BUTTON");  
		    	delbtn.classList.add('btn');
		    	delbtn.classList.add('btn-xs');
		    	delbtn.classList.add('pull-right');
		    	delbtn.style.marginRight = '10px';
		    	delbtn.classList.add('btn-default');
		    	delbtn.onclick= function(ev){    
					deletesiteinfo(siteurl, siteusername, pagename);		       
			      };
							
			      delbtn.innerHTML = "Delete Credential";     
			      
			      var cpbtn = document.createElement("BUTTON");  
			      cpbtn.classList.add('btn');
			      cpbtn.classList.add('btn-xs');
			      cpbtn.classList.add('pull-right');
			      cpbtn.style.marginRight = '10px';
			      cpbtn.classList.add('btn-default');
			      cpbtn.onclick= function(ev){    
						changepasswordmodal(siteurl, siteusername, pagename);		       
				      };
								
				      cpbtn.innerHTML = "Change password";     
			      
			   //   footerdiv.appendChild(document.createElement("br")); 
				      
			      var shrbtn = document.createElement("BUTTON");  
			      shrbtn.classList.add('btn');
			      shrbtn.classList.add('btn-xs');
			      shrbtn.classList.add('pull-right');
			      shrbtn.style.marginRight = '10px';
			      shrbtn.classList.add('btn-default');
			      shrbtn.onclick= function(ev){    
						sharesiteinfomodal(siteurl, siteusername, sitepass, pagename);		       
				      };
				
				  shrbtn.innerHTML = "Share Credential";     	
				  
				  var vwbtn = document.createElement("BUTTON");  
  			      vwbtn.classList.add('btn');
  			      vwbtn.classList.add('btn-xs');
  			      vwbtn.classList.add('pull-right');
  			      vwbtn.style.marginRight = '10px';
  			      vwbtn.classList.add('btn-default');
  			      vwbtn.onclick= function(ev){    
  						viewsiteinfo(siteurl, siteusername);		       
  				      };
  				
  				  vwbtn.innerHTML = "View Credential";     				    
  
			      var cpyuserbtn = document.createElement("BUTTON");  
			      cpyuserbtn.classList.add('btn');
			      cpyuserbtn.classList.add('btn-xs');
			      cpyuserbtn.classList.add('btn-default');
			      cpyuserbtn.style.marginLeft = '10px';
			      cpyuserbtn.onclick= function(ev){    
						copyusernametocb(siteurl, siteusername, sitepass, pagename);		       
				      };
								
			      cpyuserbtn.innerHTML = "Copy Password";                  
			      footerdiv.appendChild(cpyuserbtn); 
				  footerdiv.appendChild(vwbtn);  
			      
			      footerdiv.appendChild(delbtn); 
			      footerdiv.appendChild(cpbtn);  // change password
			      
			      if (document.getElementsByClassName("user-org") != null) {
			    	  //alert(document.getElementsByClassName("user-org").length);
			    	  var orgelems = document.getElementsByClassName("user-org");
			    	  
			    	  var orglist = [];
			    	  for (var o=0; o<orgelems.length; o++) {
			    		  //alert(orgelems[o].getAttribute("data-orgid"));
				    	  
			    		  orglist.push(orgelems[o].getAttribute("data-orgid"));
			    	  }
					  if (orglist != null && orglist.length > 0) {
						  footerdiv.appendChild(shrbtn);  
						  
						  var sitesharedwith = '';
						  if (typeof siteshared !== 'undefined' &&  siteshared.length > 0)
							  sitesharedwith = JSON.parse(siteshared);
						  
						  if (sitesharedwith.length > 0) {
							  var sharestr = '';
							  
							  for(let i = 0 ; i < sitesharedwith.length; i++) {		
								  
								  if (i < 4) {
									  sharestr += sitesharedwith[i];
									  
									  if (i < sitesharedwith.length -1 ) {
										  sharestr += ', ';
									  }
								  } else {
									  if (i == 4) {
										  sharestr += '...'; 
									  } else {
										  break;
									  }
								  }
							  }
							  var shareinf = document.createElement('p');
							  shareinf.setAttribute('id', 'siteshareinfo');
							  shareinf.classList.add('text-muted');
							  shareinf.classList.add('pull-right');
							  shareinf.style.padding = '3px';
							  shareinf.style.paddingRight = '5px';
							  
							  shareinf.appendChild(document.createTextNode('Shared with ' + sharestr));
							  footerdiv.appendChild(shareinf);
						  }
					  }
			      }
				     
		    }
		    
		    
	    } else {
	    	if (copyclickmap[siteurl+siteusername] == 1) { // open url only if it is the second click on this block
	    		for (var member in copyclickmap) delete copyclickmap[member];
	    		//document.getElementById('sitessettingfootercollapse').style.display='none'; // keep the footer active
	    		//alert('cleared copyclickmap');
	    		evt.target.style.background='#e2e2e2';
	    		loadExtUrl(siteurl, siteusername, sitepass);
	    		copyclickmap[siteurl+siteusername] ++;
	    	} 
	    	
	    }
	    
	}
	
	function viewsiteinfo(siteurl, siteusername) {
		
		if (JSON.parse(userdatainsystem).length > 0) {
					
			var obj = JSON.parse(userdatainsystem); 				
			
			for (var j=0; j< obj.length; j++) {
				
				if (obj[j].sequence == 1) {
					var dataobj = JSON.parse(decryptwithstretchedkey('sites', vaultkey, obj[j].data));
					
					//alert('dataobj '  + dataobj);
					
					for (var i=0; i< dataobj.length; i++) {
						if (siteurl == dataobj[i].siteUrl && siteusername == dataobj[i].siteuser) {
							
							//alert('this cred ' + JSON.stringify(dataobj[i]));
							
							document.getElementById('sites-view-siteUrl').value =dataobj[i].siteUrl;
							document.getElementById('sites-view-siteuser').value = dataobj[i].siteuser;
							
							document.getElementById('sites-view-sitepwd').value = dataobj[i].sitepwd;
							document.getElementById('sites-view-sitedesc').value = dataobj[i].sitedesc;
							document.getElementById('sites-view-sitename').value = dataobj[i].sitename;
							
							if (typeof dataobj[i].oldpwds != 'undefined' && dataobj[i].oldpwds.length >0) {
								document.getElementById('sites-view-siteoldpass').style.display = 'block';
								document.getElementById('sites-view-siteoldpass-tbl').innerHTML = '';
								var row = document.createElement('tr');
								const passhcell = document.createElement('th');
								const changedhCell = document.createElement('th');
								passhcell.style.fontSize = '11px';
								changedhCell.style.fontSize = '11px';
								passhcell.textContent = "Password";
								changedhCell.textContent = "Changed";
								row.appendChild(passhcell);
								row.appendChild(changedhCell);
								document.getElementById('sites-view-siteoldpass-tbl').appendChild(row);
								for (let d = dataobj[i].oldpwds.length - 1; d >= 0; d--) {
								    const obj = dataobj[i].oldpwds[d];
								
									row = document.createElement('tr');
							         const passcell = document.createElement('td');
							         const changedCell = document.createElement('td');
							         passcell.textContent = obj.password;
							         changedCell.textContent = gettimedifference(obj.changed, true) + ' ago';
									 passcell.style.fontSize = '10px';
									 changedCell.style.fontSize = '10px';
							         row.appendChild(passcell);
							         row.appendChild(changedCell);
							         document.getElementById('sites-view-siteoldpass-tbl').appendChild(row);
							     };
							} else {
								document.getElementById('sites-view-siteoldpass').style.display = 'none';
								document.getElementById('sites-view-siteoldpass-tbl').innerHTML = '';
							}
								


							//console.log('dataobj[i].sharedwith ' + dataobj[i].sharedwith);
							if (typeof dataobj[i].sharedwith != 'undefined' && dataobj[i].sharedwith.length >0) {
								document.getElementById('sites-view-sharedwith-div').style.display = 'block';
								document.getElementById('sites-view-sharedwith').value = JSON.stringify(dataobj[i].sharedwith);
								let sharedlist = dataobj[i].sharedwith.join("<br>");
								document.getElementById('sites-view-sharedwith-disp').innerHTML = sharedlist;
							} else {
								document.getElementById('sites-view-sharedwith').value = '';
								document.getElementById('sites-view-sharedwith-div').style.display = 'none';
								document.getElementById('sites-view-sharedwith-disp').innerHTML = '';
							}

							document.getElementById('sites-view-seq').value = obj[j].sequence;
							document.getElementById('sites-view-slt').value = obj[j].salt;
							document.getElementById('sites-view-itns').value = obj[j].iterations;
							document.getElementById('sites-view-crdate').value = obj[j].createdate;
							document.getElementById('sites-view-upddate').value = obj[j].lastupdatedate;
							document.getElementById('sites-view-accdate').value = obj[j].lastaccessdate;
							
							document.getElementById('cred-ctrl-data').innerHTML = "Salt:" + obj[j].salt + "|" + 
																					" Iter:"+ obj[j].iterations + "|" + 
																					" Created:" + new Date(obj[j].createdate).toLocaleDateString() + "|" + 
																					" Updated:" + gettimedifference(obj[j].lastupdatedate , true) + ' ago'+ "|" + 
																					" Accessed:" +  gettimedifference(obj[j].lastaccessdate , true) + ' ago';
							
							break;	
						}
					}
					break;
				}
			}
		}

		
		$("#sitesviewModal").modal('show');
	}
	
	function sharesiteinfomodal(siteurl, siteusername, sitepwd, pagename, sitedesc, sitename) {
		
		delete copyclickmap[siteurl+siteusername];
		document.getElementById("orgsharemodal-orgcheckboxes").innerHTML = '';
		document.getElementById('orgsharemodal-sites-siteurl-disp').innerHTML = '';
		//document.getElementById('orgsharemodal-sites-siteuser-disp').innerHTML = '';		
		
		$('#sitessettingfootercollapse').collapse("hide");
		
		document.getElementById('orgsharemodal-sites-siteurl-disp').appendChild(document.createTextNode(siteusername + ' at ' + siteurl));
		//document.getElementById('orgsharemodal-sites-siteuser-disp').appendChild(document.createTextNode(siteusername));
		
		document.getElementById('orgsharemodal-sites-siteurl').value = siteurl;
		document.getElementById('orgsharemodal-sites-siteuser').value = siteusername;
		document.getElementById('orgsharemodal-sites-sitepwd').value = sitepwd;
		document.getElementById('orgsharemodal-sites-sitedesc').value = sitedesc;
		document.getElementById('orgsharemodal-sites-sitename').value = sitename;
		
		var orgelems = document.getElementsByClassName("user-org");

	  	  for (var o=0; o<orgelems.length; o++) {
				var dv = document.createElement('DIV');
				dv.classList.add("form-check");
				var lbl = document.createElement('label');
				lbl.classList.add("form-check-label");
				
				var inp = document.createElement('input');
				inp.classList.add("form-check-input");
				inp.setAttribute("type", "checkbox");
				inp.setAttribute("name", "orgsharemodal-selected-orgs-checkbox");
				inp.value = orgelems[o].getAttribute("data-orgid");
				
				
				//inp.onclick = (function(orgid, orgname) {
				//	return function() {
				//		alert(orgid + ' '+ orgname);
				//		sharesitewithorg(orgid,siteurl,siteusername);
				//	};
				//})(orgelems[o].getAttribute("data-orgid"), orgelems[o].getAttribute("data-orgname"));
				
				lbl.appendChild(inp);	
				lbl.appendChild(document.createTextNode(" " + orgelems[o].getAttribute("data-orgname")));
				dv.appendChild(lbl);
				
				document.getElementById("orgsharemodal-orgcheckboxes").appendChild(dv);
	  	  }
	  	  
	  	 $('#datetimepickerst').datetimepicker();
	        $('#datetimepickeren').datetimepicker({
	            useCurrent: false //Important! See issue #1075
	        });
	        $("#datetimepickerst").on("dp.change", function (e) {
	            $('#datetimepickeren').data("DateTimePicker").minDate(e.date);
	        });
	        $("#datetimepickeren").on("dp.change", function (e) {
	            $('#datetimepickerst').data("DateTimePicker").maxDate(e.date);
	        });
	
		$("#orgsharemodal").modal('show');
	}
	
	function sharecredentialwithorgs() {
		var els = document.getElementsByName("orgsharemodal-selected-orgs-checkbox");
		
		var orglist = [];
		
		//alert('org owner flake ' + orgownerflake + ' other keys ' + JSON.stringify(otherkeys));
		//alert(els.length);
		for (var i=0;i<els.length;i++){
		  if ( els[i].checked ) {
			 
			  orglist.push(els[i].value);
			  
			  // get orgownerflake
			  var orgelems = document.getElementsByClassName("user-org");

		  	  for (var o=0; o<orgelems.length; o++) {
		  		  //console.log(orgelems[o].getAttribute("data-orgid") + ' ' + els[i].value);
		  		  if (orgelems[o].getAttribute("data-orgid") == els[i].value) {
		  			orgownerflake = orgelems[o].getAttribute("data-orgownerflake");
		  			break;
		  		  }
		  	  }
			  			  
			  extractorgkeyandaddsite(els[i].value, orgownerflake, function(orgid, orgowner, key) {
				
				  var radios = document.getElementsByName("infoshareoption");
					for(var i = 0, max = radios.length; i < max; i++) {
					   if (radios[i].checked) {
						   if (radios[i].value == 'R') {
							  // alert('Instant share.. will add it to existing creds');
							   readcurrentcredetialsinorg(orgid, orgowner, key, 0, null);
						   } else if (radios[i].value == 'T') { // is time fenced data... no need to get exiting data
							   console.log('Time fenced share.. will add it as fresh data');
							   //addsitetoorgcredentials(orgid,orgowner, key, null);
							   var stdate = document.getElementById('datetimepickerst').getElementsByTagName("INPUT")[0].value;
							   readcurrentcredetialsinorg(orgid, orgowner, key, 1, stdate );
						   }
					   }
					}				
			  });			 
			 
		  }
		}
		
		if (orglist.length == 0) {
			document.getElementById('share-credential-update-notification').innerHTML = "Please select an org. ";
		        
		}
		
		//alert('will share ' + document.getElementById('orgsharemodal-sites-siteurl').value + ' with org ' + JSON.stringify(orglist));		
		// first cheeck if we have orgkey	
		
	}
	
	function extractorgkeyandaddsite(orgid,orgownerFlake, fn) {
		orgID = orgid;
		orgownerflake = orgownerFlake;
		
		orgkey = null; // making sure it does not pick the key for a different org when called in loop
		
		//console.log('in extractorgkeyandaddsite  for  ' + orgid + ' ' + orgownerFlake);
		if (otherkeys == null || otherkeys.length == 0) {
			console.log('No org keys found.. will see if it has arrived in secured data');
			getsecureuserdatafromdb('ORGKEY', function(securedata) {
				//alert('securedata obj found for user ' + JSON.stringify(securedata));
				extractOrgKeysFromsecuredata(securedata);
				fn(orgid,orgownerFlake, orgkey);
			});
		} else {
			//console.log('this otherkeys should not be null or blank ' + JSON.stringify(otherkeys));
			for (var k=0; k<otherkeys.length; k++) {
				if (otherkeys[k].org) {
					if (orgownerflake == otherkeys[k].org.split(":=")[0] && orgid == otherkeys[k].org.split(":=")[1])  {
						orgkey = otherkeys[k].privkey;
						//decryptandlayoutorgdata();
						fn(orgid,orgownerFlake, orgkey);
						//console.log('orgkey found ' + orgkey);
						break;
					}
				}
			}
			
			if (orgkey == null || orgkey.length == 0) {
				console.log('No org key found in otherkeys object.. will see if it has arrived in secured data');
				getsecureuserdatafromdb('ORGKEY', function(securedata) {
					//alert('securedata obj found for user ' + JSON.stringify(securedata));
					extractOrgKeysFromsecuredata(securedata);
					fn(orgid,orgownerFlake, orgkey);
				});
			}
		}
	}
	
	function readcurrentcredetialsinorg(orgid,orgownerFlake, orgkey, seq, startdate) {	
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
	    xhr.open('POST', '/secure/readorgcredentials', true);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    
	    xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	          // alert('Current credentials in db ' + xhr.responseText);
	        	//removepageloadingdiv();
	        	var jsonres = xhr.responseText;
	        	
	        	if (jsonres != null && jsonres.length > 0) {
	        		var currjsonobj = JSON.parse(jsonres);
	        		addsitetoorgcredentials(orgid,orgownerFlake, orgkey, currjsonobj);
	        	} 
	        	
	        }
	    }	
	   
         xhr.send(JSON.stringify({
        	 ownerflake: orgownerFlake,
        	 section: 'org-credentials' ,
        	 orgid: orgid,
        	 seq: seq,
        	 startdate: startdate
     		}));
	         	
	}
	
	function addsitetoorgcredentials(orgid,orgownerFlake, orgkey, currcreds) {
		//alert('readcurrentcredetialsinorg will be adding site to ' + orgid + ' ' + orgownerFlake + ' with key "' +  orgkey + '"');
		
		var newcred =  {"key": "publickey of the user", 
						"credential": {
							"siteUrl":  document.getElementById('orgsharemodal-sites-siteurl').value ,
							"sitedesc": " Shared Credential ", 
							"siteuser": document.getElementById('orgsharemodal-sites-siteuser').value ,
							"sitepwd":  document.getElementById('orgsharemodal-sites-sitepwd').value ,
							"sitename":  document.getElementById('orgsharemodal-sites-sitename').value 
						}
						};
		
		var dataseq = 1;

		var dataobj = [];
		
		if (currcreds != null ) {
			console.log('There are existing credentials. Need to add to them.');
			
			var sec = new sjcl.ecc.elGamal.secretKey(
				    sjcl.ecc.curves.c384,
				    sjcl.ecc.curves.c384.field.fromBits(sjcl.codec.base64.toBits(orgkey))
				);
			
			//alert('using orgkey ' + orgkey + ' for decrypting ' + j + ' '  + obj[j].data);
			
			for (var o=0; o<currcreds.length; o++) {
		  		  //console.log(orgelems[o].getAttribute("data-orgid") + ' ' + els[i].value);
		  		  if (currcreds[o].data != null && currcreds[o].seq == 0 ) {
		  			dataobj = JSON.parse(sjcl.decrypt(sec, currcreds[o].data));
					dataobj.push(newcred);
					dataseq = 0;
		  			break;
		  		  }
		  	  }
			
		} else {
			console.log('There are no existing credentials. Need to create them.');
			dataobj = [];
			dataobj.push(newcred);
		}
		
		if (dataobj.length == 0) {
			dataobj.push(newcred);
		}
		
		//if (currcreds != null)
			//alert('current credentials ' + JSON.stringify(currcreds));
		
		//alert('adding to org ' + JSON.stringify(dataobj));
		var newencpayload =	getEncMessageUsingPublickey(JSON.stringify(dataobj), currcreds[0].publicKey); 
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
	    xhr.open('POST', '/secure/addorgdata', false);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');    
	    
	    xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	        	addsharenoticetocred(orgid,orgownerflake);
	        	//alert('here');
	          document.getElementById('share-credential-update-notification').innerHTML = "Credential has been shared successfully with the Org. It will be available in the Org page. ";
	        	
	        }
	    }	    
	    
	    var stdate = document.getElementById('datetimepickerst').getElementsByTagName("INPUT")[0].value;
	    var endate = document.getElementById('datetimepickeren').getElementsByTagName("INPUT")[0].value;
	    var notify = document.getElementById('inform-receiver').checked;
	    
	    stdate = stdate.replace(/\//g, "-");
	    endate = endate.replace(/\//g, "-");		
	    		
	    stdate = stdate.replace(/ AM| PM/, ":00.000");
	    endate = endate.replace(/ AM| PM/, ":00.000");
	    
	    console.log('going to addorgdata inform-receiver ' +  notify + ' start ' + stdate + ' end ' +endate );
	   
         xhr.send(JSON.stringify({
	     	   	group: 'org-secure',
	     	   	section: 'org-credentials',
	     	   	data: newencpayload ,
	     	   	ownerflake: orgownerflake,
	     	   	orgid: orgid ,     	   	
	     	   	createdate: currcreds.createdate,
	     	   	startdate: stdate,
	     	   	enddate: endate,
	     	   	seq: dataseq,
	     	    dononotify: ( !notify)
     		}));
	}
	
	function addsharenoticetocred(orgid,orgownerFlake) {
		var siteurl = document.getElementById('orgsharemodal-sites-siteurl').value;
		var siteuname = document.getElementById('orgsharemodal-sites-siteuser').value;		
		
		var orgname = '';
		
		var orgelems = document.getElementsByClassName("user-org");

		for (var o=0; o<orgelems.length; o++) {
	  		  //console.log(orgelems[o].getAttribute("data-orgid") + ' ' + els[i].value);
	  		  if (orgelems[o].getAttribute("data-orgid") == orgid && orgelems[o].getAttribute("data-orgownerflake") == orgownerFlake ) {
	  			orgname = orgelems[o].getAttribute("data-orgname");
	  			break;
	  		  }
	  	  }
		
		var obj = JSON.parse(userdatainsystem); 				
		
		//alert('obj-len: ' + obj.length + ' key: ' + vaultkey);
		
		//alert('first recorrd ' + decryptwithstretchedkey('sites', vaultkey, obj[0].data));
		for (var j=0; j< obj.length; j++) {
			
			//var encdataobj = JSON.parse(obj[j].data);
			
			if (obj[j].sequence === 1) {
				//document.getElementById("clear-sites-btn").style.display='inline-block';
				var savedhtml = document.getElementById("securedata-sites").innerHTML;
				//document.getElementById("securedata-sites").innerHTML = "";
				try {
					var originaldata = decryptwithstretchedkey('sites', vaultkey, obj[j].data);
					obj[j].data = originaldata;
					
					var sitesobj = JSON.parse(obj[j].data);
					//alert(JSON.stringify(originaldata));
					
					for (var i=0; i< sitesobj.length; i++) {
						//if (i == 0) alert(JSON.stringify(sitesobj[i]));
						
						if (sitesobj[i].siteUrl == siteurl && sitesobj[i].siteuser == siteuname) {

							if (typeof sitesobj[i].sharedwith == 'undefined')
								sitesobj[i].sharedwith = [];
							
							sitesobj[i].sharedwith.push(orgname);
							console.log('Orgname ' + orgname + ' tagged with the credential');
							
						}
					}
									
					//alert('updated object' + JSON.stringify(sitesobj));
					if (sitesobj.length > 0) {
						document.getElementById('sites-data').value = JSON.stringify(sitesobj);
						obj[j].data = JSON.stringify(sitesobj);
						submitencuserdata('sites', false);
						$("#orgsharemodal").modal('hide');
					} 
					 
				} catch(e) {
					
					document.getElementById("securedata-sites").innerHTML = savedhtml;
					vaultkey = '';
					displaykeyalert('The key you entered is incorrect. Most users use their username as the key here. You need to provide the same key you entered while adding data here. ');
					$("#changesitepwdmodal").modal('hide');
					break;
					
					return false;
				}
			}
		}
	
		return false;
	}
	
	function changepasswordmodal(siteurl, siteuser, pagename) {
		document.getElementById('chgmodal-sites-siteUrl').value = siteurl;
		document.getElementById('chgmodal-sites-siteuser').value = siteuser;
		
		$("#changesitepwdmodal").modal('show');
	}
	

	function copyusernametocb(siteurl, siteusername, sitepass, pagename) {
		var dummy = document.createElement("input");
	    document.body.appendChild(dummy);
	    dummy.setAttribute('value', sitepass);
	    dummy.select();
	    document.execCommand("copy");
	    document.body.removeChild(dummy);
	    
	    var notidiv = document.getElementById('sitesettingnotification');
	    cleardiv(notidiv);
	    copyclickmap[siteurl+siteusername] = 2;
	    notidiv.appendChild(document.createTextNode('Password for user ' + siteusername + ' @ ' + siteurl + ' copied to clipboard.'));
	    
	    console.log('Copied password to Clipboard');
	}
	
	
	function changesitepassword() {
		var siteurl = document.getElementById('chgmodal-sites-siteUrl').value;
		var siteuname = document.getElementById('chgmodal-sites-siteuser').value;
		
		var newpass = document.getElementById('chgmodal-sites-sitepwd').value;
		
		var obj = JSON.parse(userdatainsystem); 				
		
		//alert('obj-len: ' + obj.length + ' key: ' + vaultkey);
		
		//alert('first recorrd ' + decryptwithstretchedkey('sites', vaultkey, obj[0].data));
		for (var j=0; j< obj.length; j++) {
			
			//var encdataobj = JSON.parse(obj[j].data);
			
			if (obj[j].sequence === 1) {
				//document.getElementById("clear-sites-btn").style.display='inline-block';
				var savedhtml = document.getElementById("securedata-sites").innerHTML;
				//document.getElementById("securedata-sites").innerHTML = "";
				try {
					var originaldata = decryptwithstretchedkey('sites', vaultkey, obj[j].data);
					obj[j].data = originaldata;
					
					var sitesobj = JSON.parse(obj[j].data);
					//alert(JSON.stringify(originaldata));
					
					for (var i=0; i< sitesobj.length; i++) {
						//if (i == 0) alert(JSON.stringify(sitesobj[i]));
						
						if (sitesobj[i].siteUrl == siteurl && sitesobj[i].siteuser == siteuname) {
							
							if (newpass.length == 0 || newpass == sitesobj[i].sitepwd) {
								alert('Invalid new password. It is either blank or same as old password.');
								$("#changesitepwdmodal").modal('hide');
								return false;
							}
							//alert('deleting ' + JSON.stringify(sitesobj[i]));
							
							var confmsg = 'Do you want to change the password for ' + siteuname + ' @ ' + siteurl;
							
							if (typeof sitesobj[i].source != 'undefined' && sitesobj[i].source.length > 0) {
								confmsg = 'This credential was imported from ' + sitesobj[i].source + '. You may want to update this password in the file first. Click OK to update the password in the vault first.';
							}
							
							if (confirm(confmsg)) {
								if (typeof sitesobj[i].oldpwds == 'undefined' ) {
									sitesobj[i].oldpwds = [];
								} 
								sitesobj[i].oldpwds.push({
													"password":sitesobj[i].sitepwd,
												    "changed": new Date()
												});
								
								sitesobj[i].sitepwd = newpass;
								
								//alert('old passwords ' + sitesobj[i].oldpwds);
								
								if (copyclickmap[siteurl+siteuname] == 1) { //clearing clickmap
						    		for (var member in copyclickmap) delete copyclickmap[member];
								}
							}
							
						}
					}
									
					//alert('updated object' + JSON.stringify(sitesobj));
					if (sitesobj.length > 0) {
						document.getElementById('sites-data').value = JSON.stringify(sitesobj);
						obj[j].data = JSON.stringify(sitesobj);
						submitencuserdata('sites', false);
					} 
					$("#changesitepwdmodal").modal('hide');
					 
				} catch(e) {
					
					document.getElementById("securedata-sites").innerHTML = savedhtml;
					vaultkey = '';
					displaykeyalert('The key you entered is incorrect. Most users use their username as the key here. You need to provide the same key you entered while adding data here. ');
					$("#changesitepwdmodal").modal('hide');
					break;
					
					return false;
				}
			}
		}
		//}
		
		$("#changesitepwdmodal").modal('hide');
		return false;
	}
	
	function deletesiteinfo(siteurl, siteuname, pagename) {
		
		if (confirm('Do you want to delete credentials stored for ' + siteuname + ' @ ' + siteurl)) {
		
			var obj = {};
			
			if (typeof pagename == 'undefined') obj =  JSON.parse(userdatainsystem); 
			else  obj = JSON.parse(orgdatainsystem);			
		
		//alert('obj-len: ' + obj.length + ' key: ' + vaultkey);
		
		//alert('first recorrd ' + decryptwithstretchedkey('sites', vaultkey, obj[0].data));
		for (var j=0; j< obj.length; j++) {
			
			//var encdataobj = JSON.parse(obj[j].data);
			
			if (obj[j].sequence === 1) {
				//document.getElementById("clear-sites-btn").style.display='inline-block';
				var savedhtml = "";
				
				if (typeof pagename == 'undefined' || pagename == null) {
					savedhtml = document.getElementById("securedata-sites").innerHTML;
				} else {
					if (pagename == 'Org')
						savedhtml = document.getElementById("org-credentials").innerHTML;
				}
				//document.getElementById("securedata-sites").innerHTML = "";
				try {
					var originaldata = decryptwithstretchedkey('sites', vaultkey, obj[j].data);
					obj[j].data = originaldata;
					
					var sitesobj = JSON.parse(obj[j].data);
					//alert(JSON.stringify(originaldata));
					
					for (var i=0; i< sitesobj.length; i++) {
						//if (i == 0) alert(JSON.stringify(sitesobj[i]));
						
						if (sitesobj[i].siteUrl == siteurl && sitesobj[i].siteuser == siteuname) {
							//alert('deleting ' + JSON.stringify(sitesobj[i]));
							delete sitesobj[i];
							//displayUserDataClear();
							// alert('after delete' + JSON.stringify(sitesobj));
						}
					}
					//alert('after delete out of loop' + JSON.stringify(sitesobj));
					
					var cleanedsitesobj = sitesobj.filter(function (el) {
						  return el != null;
						});

					
					//alert('cleaned object' + JSON.stringify(cleanedsitesobj));
					if (cleanedsitesobj.length > 0) {
						document.getElementById('sites-data').value = JSON.stringify(cleanedsitesobj);
						obj[j].data = JSON.stringify(cleanedsitesobj);
						submitencuserdata('sites', false);
					} else {
						clearAll('sites');
					}
					 
				} catch(e) {
					if (document.getElementById("securedata-sites") != null) {
						document.getElementById("securedata-sites").innerHTML = savedhtml;
					} else {
						 document.getElementById("org-credentials").innerHTML = savedhtml ;
					}
					
					vaultkey = '';
					displaykeyalert('The key you entered is incorrect. Most users use their username as the key here. You need to provide the same key you entered while adding data here. ');
					break;
					return false;
				}
			}
		}
		}
	}
	
	function findnumberofchidrennodes(parentdiv, classname) {
		
		var out = 0;
		for (var i = 0; i < parentdiv.children.length; i++) {
		    if (parentdiv.children[i].className == classname) {
		    	out ++;
		    }
		}
		
		return out;
	}
	
	function createcardlayout(parentdiv, elem) {
		
		if (parentdiv.children.length == 0) {
			
			var rowelem = document.createElement("div");
			rowelem.classList.add('row');
			
			rowelem.appendChild(elem);
			parentdiv.appendChild(rowelem);
			
			//alert('element added to first row' +  elem);
			
		} else {
			//for (var i = parentdiv.children.length - 1; i > 0 ; i--) {
			for (var i = 0; i < parentdiv.children.length; i++) {
			    if (parentdiv.children[i].className == "row") {
			    	var siterow = parentdiv.children[i];
			    	
			    	if (findnumberofchidrennodes(siterow, 'col-xs-2') < 6) {
			    		siterow.appendChild(elem);
			    	} else {
			    		//alert('chilren in this row ' + i + ' ' + siterow.children.length);
			    		if (i == parentdiv.children.length - 1) {
				    		var rowelem = document.createElement("div");
							rowelem.classList.add('row');
							
							rowelem.appendChild(elem);
							parentdiv.appendChild(rowelem);
			    		}
			    	}
			     
			    }        
			}
		}
	}


	function addFinDataToSecurePage() {
		//var els = inputform.elements;
		var institution, accnumber, accttype;		
		
		institution = document.getElementById('fin-institution').value;
		accnumber = document.getElementById('fin-acctNum').value;
		accttype = document.getElementById('fin-accType').value;
		
		//var rowelem = document.createElement("div");
		//rowelem.classList.add('row');
		//rowelem.classList.add('col-xs-2');
		
		var divelem = document.createElement("div");
		divelem.classList.add('col-xs-2');
		//divelem.classList.add('card');
		
		var el = document.createElement("div");
		el.classList.add('text-center');
		
		var p = document.createElement("p")  ;
		p.classList.add('lead');
		p.style.wordWrap = "break-word"; 
		p.style.maxWidth = "80%";
		p.style.display = 'inline-block';
		var textelem = document.createTextNode(institution); 
		
		p.appendChild(textelem);  	
		el.appendChild(p);
		
		var br = document.createElement("br")  ;
		el.appendChild(br);
			
		p = document.createElement("p")  ;
		p.style.wordWrap = "break-word"; 
		p.style.maxWidth = "80%";
		p.style.display = 'inline-block';
		var textelem = document.createTextNode(accttype);		
		p.appendChild(textelem); 
		el.appendChild(p);
		
		br = document.createElement("br")  ;
		el.appendChild(br);
			
		p = document.createElement("p")  ;
		p.style.wordWrap = "break-word"; 
		p.style.maxWidth = "50%";
		p.style.display = 'inline-block';
		var textelem = document.createTextNode(accnumber);		
		p.appendChild(textelem); 
		el.appendChild(p);
		
		divelem.appendChild(el);
		//rowelem.appendChild(divelem);
		
		
		
		//document.getElementById("securedata-fin").appendChild(divelem);
		
		createcardlayout(document.getElementById("securedata-fin"), divelem);		
		
	}
	
	function addFileDataToSecurePage(fileobj) {
		//var els = inputform.elements;
		//alert(JSON.stringify(fileobj));
		//alert ('addFileDataToSecurePage called');
		var filename = fileobj.filename;
		var filetype = fileobj.filetype;
		var filesize = fileobj.filesize;
		var fileseq = fileobj.fileseq;
		var filedate = fileobj.createtime;
		
		//var content = filedatamap[filename+fileseq]['content'];
		
		//alert('addfiledata called ' + content);
		
		//alert('"filename":"' + filename + '", {"filetype":"' +  filetype + '", "content":"' content + '"}');
		//alert(' adding "filename":"' + filename + '", {"filetype":"' +  filetype + '", "content":""}');
		//var fileobjtext = ' {"filetype":"' +  filetype + '", "filesize":"' + filesize + '", "content":"' + content + '", "fileseq":"' + fileseq + '"}'; 
				
		filedatamap[filename+ fileseq] = fileobj;
		
		var rowelem = document.createElement("div");
		rowelem.classList.add('row');
		
		var divelem = document.createElement("div");
		divelem.classList.add('col-xs-4');
		
		var a = document.createElement('a');
		a.classList.add('filecontentlink');
		if (filetype.length == 0) {
			filetype = 'text';
		}
		//var dataurl = 'data:' + filetype + ';base64,' + content;
		
		if (filetype.startsWith('image')) {
			//a.href = '#';
			a.href = "javascript:loadfilecontentonmodal('" + filename + "','" + fileseq + "');";
			
		} else {
			a.href = "javascript:loadfilecontentonmodal('" + filename + "','" + fileseq + "');";
			/// a.setAttribute('data-href', dataurl);
		}
	    
		
	    /*a.setAttribute('data-toggle', "modal");
	    a.setAttribute('data-target', "#fileContentModal");
	    a.setAttribute('data-filename', filename);	*/
	    
	    a.innerHTML = filename ;
	    
	    divelem.appendChild(a);
	    
	    rowelem.appendChild(divelem);
	    
	    divelem = document.createElement("div");
	    divelem.classList.add('col-xs-4');
	    
	    var p = document.createElement("p")  ;
		p.style.wordWrap = "break-word"; 
		p.style.maxWidth = "50%";
		p.style.display = 'inline-block';
		
		var textelem = document.createTextNode(getReadableFileSizeString(filesize)); 
		p.appendChild(textelem);  	
		divelem.appendChild(p);
		
		rowelem.appendChild(divelem);
	    
	    divelem = document.createElement("div");
	    divelem.classList.add('col-xs-4');
	    
	    var p = document.createElement("p")  ;
		p.style.wordWrap = "break-word"; 
		p.style.maxWidth = "50%";
		p.style.display = 'inline-block';
		
		var textelem = document.createTextNode(new Date(filedate).toLocaleString()); 
		p.appendChild(textelem);  	
		divelem.appendChild(p);
		
		rowelem.appendChild(divelem);
		
		document.getElementById("securedata-oth").insertBefore(rowelem, document.getElementById("securedata-oth").firstChild);
	
		
	}
	
	function getuserdatafromdb(sequence, fn) {
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
	    xhr.open('POST', '/secure/getuserdata', false); // needs to be synchronous false means synchronous
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');   
	    
	    xhr.onreadystatechange = function() {
	    	//alert('getfilecontentfromdb returned status ' + xhr.status + ' ' + xhr.responseText);
		    if (xhr.readyState == 4 && xhr.status == 200) {	   
		        if (xhr.responseText != null && xhr.responseText.length > 0) {
		        	var udobj = JSON.parse(xhr.responseText);
		        	//alert('data in user vault for seq ' + sequence + ' ' + udobj.data);
		        	var originaldata = 'ERROR';		        	
		        		
		        		try {
		        			//alert('vaultkey ' + vaultkey);
		        			originaldata = sjcl.decrypt(vaultkey, udobj.data); 
		        			//originaldata = JSON.stringify(udobj);
		        		} catch(e) {
		        			console.log('Could not decrypt payload based on vault key. Error > ' + e);
		        			//throw e;
		        		}
			        	
			        	//alert('decrypted content recd from db: ' + JSON.parse(originaldata));
		        		//alert('about to return originaldata ' + originaldata);
			        	fn( originaldata);
	        	} else {
	        		//alert('no data in sequence 0 .. will generate fresh keys');
	        		console.log('There was NO key data in DB for this User, generating fresh userkey');
	        		generatenewuserkey();
	        		fn( 'ERROR');
	        	}
	        } 
	    }
	   
         xhr.send(JSON.stringify({
	     	   	sequence: sequence
	     	   	
     		}));
	}
	
	
	function getsecureuserdatafromdb(tag, fn) {
		
		if (userkey == null || userkey.length == 0) {
			getuserdatafromdb(0, function(keydata) {																		
				
				if (keydata != 'ERROR') {
					//alert('full userdata for seq 0 '+ keydata);
					
					if (typeof keydata === "string" && keydata.indexOf('"') < 0) {
						userkey = keydata;
					} else {	
						var jsonobjindb = JSON.parse(keydata);
						userkey = jsonobjindb[0];
						
						for (var i=1; i<jsonobjindb.length; i++ ) {
							if (jsonobjindb[i].org)
								otherkeys.push(jsonobjindb[i]);
						}	
					}
					
					if (userkey != null && userkey.length > 0) {
						readsecuredataforuserbytag(tag, fn);
					}
					
					//alert('userkey found '+ userkey + ' otherkeys found ' + JSON.stringify(otherkeys));
					//$('#vault-page-key-overlay').fadeOut('slow');
				} else {
					console.log('Invalid Keydata received for user ' +  keydata);
				}
			});
		} else {
			readsecuredataforuserbytag(tag, fn);
		}
				
	}
	
	function readsecuredataforuserbytag(tag, fn) {
		
		if (userkey == null || userkey.length == 0) {
			console.log('No user key found. Can not read secure data');
			return;
		}
				
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
	    xhr.open('POST', '/secure/getsecureuserdata', false); // needs to be synchronous false means synchronous
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');   
	    
	    xhr.onreadystatechange = function() {
	    	//alert('getfilecontentfromdb returned status ' + xhr.status + ' ' + xhr.responseText);
		    if (xhr.readyState == 4 && xhr.status == 200) {	   
		        if (xhr.responseText != null && xhr.responseText.length > 0) {
		        	var udobj = JSON.parse(xhr.responseText);
		        	//alert('userkey ' + userkey + ' encrypted data ' + udobj.data);
		        	var originaldata = 'ERROR';		        	
		        		
		        		try {
		        			
		        			var sec = new sjcl.ecc.elGamal.secretKey(
		        				    sjcl.ecc.curves.c384,
		        				    sjcl.ecc.curves.c384.field.fromBits(sjcl.codec.base64.toBits(userkey))
		        				);
		        			
		        			originaldata = JSON.parse(sjcl.decrypt(sec, udobj.data));
		        			//console.log('originaldata ' + JSON.stringify(originaldata));
		        		} catch(e) {
		        			console.log('Could not decrypt payload based on user key. Error > ' + e);
		        			//throw e;
		        		}
			        	
			        	//alert('decrypted content recd from db: ' + JSON.parse(originaldata).content);
		        		//alert('about to return originaldata ' + originaldata);
			        	fn( originaldata);
	        	} else {
	        		console.log('There was NO secure message with that tag for this User');
	        		//fn( 'ERROR');
	        	}
	        } 
	    }
	   
         xhr.send(JSON.stringify({
	     	   	tag: tag
	     	   	
     		}));
	}
	
	function generatenewuserkey() {
		
		var pair = sjcl.ecc.elGamal.generateKeys(384);
		var pub = pair.pub.get(), sec = pair.sec.get();

		// Serialized public key:
		pub = sjcl.codec.base64.fromBits(pub.x.concat(pub.y));
		// uQuXH/yeIpQq8hCWiwCTIMKdsaX...
	
		// Serialized private key:
		sec = sjcl.codec.base64.fromBits(sec);
		// IXkJSpYK3RHRaVrd...
		var encprivkey =  encryptdatawithstretchedkey(sec, vaultkey,'',0);
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
	    xhr.open('POST', '/secure/rotateuserkeys', false); // needs to be synchronous false means synchronous
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');   
	    
	    xhr.onreadystatechange = function() {
	    	//alert('getfilecontentfromdb returned status ' + xhr.status + ' ' + xhr.responseText);
		    if (xhr.readyState == 4 && xhr.status == 200) {	   
		        if (xhr.responseText != null && xhr.responseText.length > 0) {
		        	
	        	} else {
	        		
	        	}
	        } 
	    }
	   
         xhr.send(JSON.stringify({
        	 publicKey: pub,
        	 encprivatekey: encprivkey
	     	   	
     		}));
	}
	
	function getfilecontentfromdb(filename, fileseq) {
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
	    xhr.open('POST', '/secure/getuserdata', false); // needs to be synchronous false means synchronous
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');   
	    
	    xhr.onreadystatechange = function() {
	    	//alert('getfilecontentfromdb returned status ' + xhr.status + ' ' + xhr.responseText);
	        if (xhr.readyState == 4 && xhr.status == 200) {	   
	        	//alert(xhr.responseText);
	        	var udobj = JSON.parse(xhr.responseText);
	        	//alert(udobj.data);
	        	if (udobj != null) {
		        	var originaldata = decryptwithstretchedkey('oth', vaultkey, udobj.data);
		        	//alert('decrypted content recd from db: ' + originaldata);
		        	document.getElementById("secure-file-content").value = JSON.parse(originaldata).content;
		        	filedatamap[filename+fileseq]['content'] = JSON.parse(originaldata).content;
		        	
		        	//alert('content after read from db ' + originaldata);
		        	updatefilecontentmodal(filename, fileseq);
	        	}
	        } 
	    }
	   
         xhr.send(JSON.stringify({
	     	   	sequence: fileseq,
	     	   	createdate: document.getElementById('oth-crdate').value
     		}));
	}
	
	function updatefilecontentmodal(filename, fileseq) {
		var ftype = filedatamap[filename+fileseq]['filetype'];
		//var ftype = 'abc';
		var filesize = filedatamap[filename+fileseq]['filesize'];
		
		var fileseq = filedatamap[filename+fileseq]['fileseq'];
		
		var content = filedatamap[filename+fileseq]['content'];
		//datatodownload=content;
		filenametodownload=filename;
		//alert('in updatefilecontentmodal ' + ftype + ' ' + filesize + ' ' + content.substring(0,25));
		
		document.getElementById("file-header").innerHTML = filename + ' Size:[' + getReadableFileSizeString(filesize) + '] Created:[ ' + document.getElementById('oth-crdate').value + ']';
			
		var dataurl = 'data:' + ftype + ';base64,' + content;
		
		if (ftype.startsWith('image')) 
			document.getElementById('filedisplayarea').innerHTML = '<img src="' + dataurl + '" class="modal-image-display"/>';
		else
			document.getElementById('filedisplayarea').innerHTML =  '<object width="100%" data="' + dataurl + '">';
			
		 $("#fileContentModal").modal('show');
	}
	
	function loadfilecontentonmodal(filename, fileseq) {
		document.getElementById('filedisplayarea').innerHTML = '';
		var content =null;
		
		if (typeof filedatamap[filename+fileseq]  != 'undefined') {
			content = filedatamap[filename+fileseq]['content'];
		}
		//alert('content in filedatamap ' + content);
		if (typeof content  === 'undefined' || content == null || content.length == 0 ) {
			//alert('in loadfilecontentonmodal getting data from db' + JSON.stringify(filedatamap[filename]));
			// try to get it from local storage
			//if (filedatamap[filename+fileseq] != null)
			
			getfilecontentfromdb(filename, fileseq);				
			
		} else {
			updatefilecontentmodal(filename, fileseq);
		}
		
		//alert('content recd ' + content);
		
		
	}
	
	
	
	function decryptwithstretchedkey(type, keyval, encval) {
		
		var passwordSalt;
		var derivedKey;
		
		//alert ('passwordSalt: ' + document.getElementById(type+'-slt').value);
		
		if (document.getElementById(type+'-slt').value == '')
			passwordSalt = sjcl.codec.hex.toBits( "cf7488cd1e48e84990f51b3f121e161318ba2098aa6c993ded1012c955d5a3e8" );
		else
			passwordSalt = sjcl.codec.hex.toBits( document.getElementById(type+'-slt').value );
		
		if (document.getElementById(type+'-itns').value == '0') {
			document.getElementById(type+'-itns').value = 10000;
			derivedKey = sjcl.misc.pbkdf2( keyval, passwordSalt, 100, 256 );
		} else 
			derivedKey = sjcl.misc.pbkdf2( keyval, passwordSalt, document.getElementById(type+'-itns').value, 256 );		
		
		//var hexKey = sjcl.codec.hex.fromBits( derivedKey );
		
		//return sjcl.decrypt(derivedKey, encval);  
		//alert(keyval + ' <> ' + encval )
		var original;
		try {
			original = sjcl.decrypt(keyval, encval); 
		} catch(e) {
			//alert('about to throw?');
			throw e;
		}
		return  original;
	}
	
	
	function encryptwithstretchedkey(type, keyval) {
		
		var passwordSalt;
		var derivedKey;
		
		if (document.getElementById(type+'-slt').value == '') {
			document.getElementById(type+'-slt').value = "cf7488cd1e48e84990f51b3f121e161318ba2098aa6c993ded1012c955d5a3e8";
			passwordSalt = sjcl.codec.hex.toBits( document.getElementById(type+'-slt').value );
		} else
			passwordSalt = sjcl.codec.hex.toBits( document.getElementById(type+'-slt').value );
		
		if (document.getElementById(type+'-itns').value == 0) {
			document.getElementById(type+'-itns').value = 10000;
			derivedKey = sjcl.misc.pbkdf2( keyval, passwordSalt, 10000, 256 );
		} else
			derivedKey = sjcl.misc.pbkdf2( keyval, passwordSalt, document.getElementById(type+'-itns').value, 256 );
		
		
		return encryptdatawithstretchedkey(document.getElementById(type+'-data').value, 
										keyval, 
										document.getElementById(type+'-slt').value, 
										document.getElementById(type+'-itns').value);
		//var hexKey = sjcl.codec.hex.fromBits( derivedKey );
		
//		return sjcl.encrypt(derivedKey, document.forms[type].data.value, {ks: 256, salt: sjcl.codec.hex.fromBits(passwordSalt), iter: document.forms[type].itns.value});   // removed the third param , {mode : "ccm || gcm || ocb2"} CCM is default
		//return sjcl.encrypt(username, document.getElementById(type+'-data').value,
		//							{
		//							ks: 256, 
		//							salt: sjcl.codec.hex.fromBits(passwordSalt), 
		//							iter: document.getElementById(type+'-itns').value
		//							}
		//	);
										
	}

	function fileUpload(){
	    var x = document.getElementById("secure-file");
	    var txt = "";
	    if ('files' in x) {
	        if (x.files.length == 0) {
	            txt = "Select one or more files.";
	        } else {
	            for (var i = 0; i < x.files.length; i++) {
	                txt += "<br><strong>" + (i+1) + ". file</strong><br>";
	                var file = x.files[i];
	                if ('name' in file) {
	                    txt += "name: " + file.name + "<br>";
	                }
	                if ('size' in file) {
	                    txt += "size: " + file.size + " bytes <br>";
	                }
	            }
	        }
	    } 
	    else {
	        if (x.value == "") {
	            txt += "Select one or more files.";
	        } else {
	            txt += "The files property is not supported by your browser!";
	            txt  += "<br>The path of the selected file: " + x.value; // If the browser does not support the files property, it will return the path of the selected file instead. 
	        }
	    }
	    document.getElementById("filedisplay").innerHTML = txt;
	}
	
	function fileImport() {
		var x = document.getElementById("import-file");
	    var txt = "";
	    if ('files' in x) {
	        if (x.files.length == 0) {
	            txt = "Select a file";
	        } else {
	            for (var i = 0; i < x.files.length; i++) {
	                txt += "<br><strong>" + (i+1) + ". file</strong><br>";
	                var file = x.files[i];
	                if ('name' in file) {
	                    txt += "name: " + file.name + "<br>";
	                }
	                if ('size' in file) {
	                    txt += "size: " + file.size + " bytes <br>";
	                }
	            }
	        }
	    } 
	    else {
	        if (x.value == "") {
	            txt += "Select a file";
	        } else {
	            txt += "The files property is not supported by your browser!";
	            txt  += "<br>The path of the selected file: " + x.value; // If the browser does not support the files property, it will return the path of the selected file instead. 
	        }
	    }
	    document.getElementById("csvfiledisplay").innerHTML = txt;
	}


	
	function downloadfile () {
	   // var blob = new Blob([datatodownload], {type: ftypetodownload});
		datatodownload = document.getElementById('secure-file-content').value;
		var blob = b64toBlob(datatodownload, ftypetodownload);
	    if(window.navigator.msSaveOrOpenBlob) {
	        window.navigator.msSaveBlob(blob, filenametodownload);
	    }
	    else{
	        var elem = window.document.createElement('a');
	        elem.href = window.URL.createObjectURL(blob);
	        elem.download = filenametodownload;        
	        document.body.appendChild(elem);
	        elem.click();        
	        document.body.removeChild(elem);
	    }
	    $('#fileContentModal').modal('hide');
	    clearFilecontent();
	    return false;
	}
	
	function clearFilecontent() {
		//alert('in clearFilecontent');
		document.getElementById("secure-file-content").value = null;
		document.getElementById('filedisplayarea').innerHTML = '';
		filenametodownload=null;
	}
	
	
	function b64toBlob(b64Data, contentType, sliceSize) {
        contentType = contentType || '';
        sliceSize = sliceSize || 512;

       // alert('b64 file: '+ b64Data);
        var byteCharacters = atob(b64Data);
        var byteArrays = [];

        for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            var slice = byteCharacters.slice(offset, offset + sliceSize);

            var byteNumbers = new Array(slice.length);
            for (var i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
        }

      var blob = new Blob(byteArrays, {type: contentType});
      return blob;
}
	
function clearAll(type) {
		
		if (vaultkey.length == 0) {
			//alert('Please enter your key first. You need to decrypt the entries before you can remove them.');
			createvaultkeyoverlay();
			//return false;
		}
		
		var entries = '';
		
		if (type === 'sites')
			entries = 'Websites';
		
		if (type === 'fin')
			entries = 'Accounts';
		
		if (type === 'oth')
			entries = 'Files';
	
		
		if (confirm('Do you want to remove all ' + entries + ' in this view?. Click OK to continue.')) {
			
			var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			
		    xhr.open('POST', '/secure/clearuserdata', true);
		    xhr.withCredentials = true;
		    xhr.setRequestHeader('Content-Type', 'application/json');  
		    
		    xhr.onreadystatechange = function() {
		    	if (xhr.readyState == 4 && xhr.status == 200) {	   
		    		 showPrivateDataPage();
		    		 lastfileseq=100;
		        } 
		    }
		   
	         xhr.send(JSON.stringify({
	        	 sequence: document.getElementById(type+'-seq').value ,
	        	 createdate: document.getElementById(type+'-crdate').value
	     		}));
	         		  
	         return false;
		} else {
			return false;
		}
			
		
	}


function createvaultpagekeyoverlay(fnaftersuccess) {
	
	var flakeoverlay = document.getElementById("vault-page-key-overlay"); // this id is setup as blocking overlay
	
	if (flakeoverlay == null) {
		//alert('in createUserFlakeOverlay .. creating new overlay');
		flakeoverlay = document.createElement("div");
		flakeoverlay.setAttribute("id", "vault-page-key-overlay");
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
		    closeanchor.style.fontSize= '2em';
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
		    	$('#vault-page-key-overlay').fadeOut(500);
		    	
		    });
		    coldiv.appendChild(closeanchor);
		 
		 var pdh = document.createElement('p');
		 pdh.classList.add('lead');
		 pdh.setAttribute("id", "createuser-flake-text-header");
		 
		 var leadtext = '';
		 if (userdatainsystem == null) {
			 leadtext = 'Please enter a Vault Key';
		 } else {
			 leadtext = 'Please enter your Vault Key';
		 }
		 
		 pdh.appendChild(document.createTextNode(leadtext));
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
		 
		 var subtext = '';
		 if (userdatainsystem == null) {
			 subtext = 'Enter your secret username as your vault key.';
		 } else {
			 subtext = 'Enter your secret username as your vault key.';
		 }
		 pd.appendChild(document.createTextNode(subtext));
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
			cuflkinput.setAttribute("id", "vault-page-key-input");
			cuflkinput.setAttribute("autofocus", "true");
			cuflkinput.classList.add('form-control');
			cuflkinput.classList.add('input-md');
			//cuflkinput.addEventListener('input', prepareSendButton, false);
			cuflkinput.addEventListener('input', function(event){ 					
				var flk = document.getElementById('vault-page-key-input').value;
				if ( flk.length >= 6) {
					$('#page-cde-send-button').fadeIn('slow');
				} else {
					document.getElementById('page-cde-send-button').style.display = 'none';
				}				
				
			}, false);
			
			
			cuflkinput.addEventListener('keyup', function(event) {
				
				if ( event.keyCode === 13) {

					vaultkey = document.getElementById('vault-page-key-input').value;
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
												$('#vault-page-key-overlay').fadeOut('slow');
											} else {
												document.getElementById('vault-page-key-input').style.borderColor = 'red';
												vaultkey = '';
											}
										});
				}
			});
			cuflkinput.style.color = '#646464';
			
			var sendbutton = document.createElement("input");
			sendbutton.setAttribute("id", "page-cde-send-button");
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
										vaultkey = document.getElementById('vault-page-key-input').value;
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
																	$('#vault-page-key-overlay').fadeOut('slow');
																} else {
																	document.getElementById('vault-page-key-input').style.borderColor = 'red';
																	vaultkey = '';
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

		  $('#vault-page-key-input').focus();
	
	}
	
	settimeoutid = setTimeout(function(){ 
				//flakeoverlay.style.display = "block";
				$('#vault-page-key-overlay').fadeIn('slow');
			}, 500);
	
}


