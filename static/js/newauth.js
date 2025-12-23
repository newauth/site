var debugappui = false;
var welcomebginterval;
var apptimeoutduration = 10000;
var sessionid;
var vaultkey = ''; /// secret username or another key known only to user
var userkey; // private key of the user stored in Newauth vault
var otherkeys = [];

	
var valmap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-+="; // all possible characters in flake

var publickeyb64 = '';
var privatekeyb64 = '';
var encprivkey = '';

var loggedinuserflake;
var flakejsonobj;

var fullname;

var genericcounter = 0;
var collageimagesloaded = 0;
var flakegeneratorintid = 0;
var currentavatar = '';
var avatarcountDownDate;

var sseeventsource;
var headerflakebuttonhandler = false;

var createuserdomainverkey;
var verifiedbranddomainname;

var postcontenthome ;
var lastpostseq = 0; 
var newauthurl;
var newauthcontactflake;

// activitytimer related

var lotimer, callservertimer, lasttime, delay;
var appcalltimeoutid; // used to timeout slow running or failed responses
var initialized = false;

var allowedlapses = 0;  // these are the times we go without extending session
var interactduration = 300000;

var lapses = 0;    // CHANGE this after testing - set it to 0
var settimeoutid;
var listoftopics = {};
var listofflakes = {};
var topicname;
var topicautocompleteregistered =  false;
var topicmaxdepth;
var topicstorage;
var flakeautocompleteregistered = false;
var postimagesinterval;

var flakegiveoutmap = {};
var postlocationmap; // list of {x, y, idx} objects
var stripe = null;
var nastripekey = null;

var imgcheckinterval;

const isJSON = (str) => {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

document.addEventListener('DOMContentLoaded', updatescreenandwindowdims, false);



function getPositionOfanElement(el) {
	  var xPosition = 0;
	  var yPosition = 0;
	 
	  while (el) {
	    if (el.tagName == "BODY") {
	      // deal with browser quirks with body/window/document and page scroll
	      var xScrollPos = el.scrollLeft || document.documentElement.scrollLeft;
	      var yScrollPos = el.scrollTop || document.documentElement.scrollTop;
	 
	      xPosition += (el.offsetLeft - xScrollPos + el.clientLeft);
	      yPosition += (el.offsetTop - yScrollPos + el.clientTop);
	    } else {
	      xPosition += (el.offsetLeft - el.scrollLeft + el.clientLeft);
	      yPosition += (el.offsetTop - el.scrollTop + el.clientTop);
	    }
	 
	    el = el.offsetParent;
	  }
	  return {
	    x: xPosition,
	    y: yPosition
	  };
	}

function stopDefaultBackspaceBehaviour(event) {
    var event = event || window.event;
    if (event.keyCode == 8) {
        var elements = "HTML, BODY, TABLE, TBODY, TR, TD, DIV";
        var d = event.srcElement || event.target;
        var regex = new RegExp(d.tagName.toUpperCase());
        if (d.contentEditable != 'true') { //it's not REALLY true, checking the boolean value (!== true) always passes, so we can use != 'true' rather than !== true/
            if (regex.test(elements)) {
                event.preventDefault ? event.preventDefault() : event.returnValue = false;
            }
        }
    }
}

function updatescreenandwindowdims() {
	/*alert('screen width ' + window.screen.width + 
			' screen height ' + window.screen.height +
			'screen availwidth ' + window.screen.availWidth + 
			' screen availheight ' + window.screen.availHeight +
			' window innerwidth ' + window.innerWidth + 
			' window innerheight ' + window.innerHeight +
			' window outerwidth ' + window.outerWidth + 
			' window outerheight ' + window.outerHeight +
			' body clientwidth ' + document.body.clientWidth + 
			' body clientheight ' + document.body.clientHeight
			);*/
			
			// Get all forms in the document
    var forms = document.getElementsByTagName('form');

	for(var i = 0; i < forms.length; i++) {
        // Get all input elements in the form
        //console.log('Form id name ' + forms[i].id + ' ' + forms[i].name);
        var inputs = forms[i].getElementsByTagName('input');

        // Iterate over each input element
        for(var j = 0; j < inputs.length; j++) {
            // Check if the input's name is 'tester'
            if(inputs[j].name === 'screenwidth') {
                 
               // console.log('Setting screen dims');
                forms[i].screenwidth.value = window.screen.availWidth;
				forms[i].screenheight.value = window.screen.availHeight;
	
				forms[i].windowwidth.value = window.innerWidth;
		//document.forms[0].windowheight.value = window.innerHeight;
		// use app's height instead of full browser height
				forms[i].windowheight.value = document.getElementById('app').clientHeight;
				break;
            }
            
        }
        //break;
    }
	
	
	/*alert('window.screen.availWidth ' + window.screen.availWidth +
			'window.innerWidth ' + window.innerWidth +
			'document.body.clientWidth ' + document.body.clientWidth + 
			'window.screen.availHeight ' + window.screen.availHeight +
			'window.innerHeight ' + window.innerHeight +
			'document.body.clientHeight ' + document.body.clientHeight);*/
 
}

function attachactivitylisteners() {
	if (debugappui) console.log('attaching eventlisteners');
	
	// Attaching so many events is messing up decryption of secure data.....
	// problem was the timer vairable name 't' changed it to 'lotimer'
	window.addEventListener('load',resetSessionTimer);
	   // window.onload = setcallservertimer;
	    // DOM Events
	    document.addEventListener('mousemove', resetSessionTimer);
	    document.addEventListener('load', resetSessionTimer);
	//    document.onmousemove = resetSessionTimer;
	    document.addEventListener('mousedown', resetSessionTimer); // touchscreen presses
	    document.addEventListener('touchstart', resetSessionTimer);
	    //document.addEventListener('click', reenter_auth);     // touchpad clicks // CHANGE this after testing - set it to resetSessionTimer
	   document.addEventListener('click', resetSessionTimer); 
	    document.addEventListener('scroll', resetSessionTimer);    // scrolling with arrow keys
	    document.addEventListener("keypress", resetSessionTimer);

}

function removeactivitylisteners() {
	
	// remove event listeners also
	if (debugappui) console.log('removing eventlisteners');
	 window.removeEventListener("load", resetSessionTimer);
	    // document.onkeypress = resetTimer;
	    
	    document.removeEventListener("mousemove", resetSessionTimer);
	    document.removeEventListener("load", resetSessionTimer);
	    //document.onmousemove = resetSessionTimer;
	    document.removeEventListener("mousedown", resetSessionTimer); // touchscreen presses
	    document.removeEventListener("touchstart", resetSessionTimer);
	    //document.removeEventListener("click", reenter_auth);     // touchpad clicks // CHANGE this after testing - set it to resetSessionTimer
	   document.removeEventListener("click", resetSessionTimer);    
	    document.removeEventListener("scroll", resetSessionTimer);    // scrolling with arrow keys
	    document.removeEventListener("keypress", resetSessionTimer);	    
	    
	    initialized = false;
}

function resetSessionTimer() {
	//alert("session reset.");
	lasttime = new Date();	
	
		if (lotimer) clearTimeout(lotimer);
		//if (debugappui) console.log('setting reenter_auth timer');
		lotimer = setTimeout(reenter_auth, delay);
	
    // 1000 milisec = 1 sec
    
    if (!initialized) {
    	setcallservertimer();
    	initialized = true;
    }
    
    //if (debugappui) console.log("page activity " + lasttime.toString().substring(16,24));
}

function attachcatalogimagefilechangeeventhandler() {
	var inputfiles = document.getElementById('files-input');

	if (inputfiles != null) {
		//alert('files-input found');
		if (debugappui) console.log('attaching eventlistener for change on files-input');
		inputfiles.addEventListener('change', 
	            function(event) {
					handleImageUploadFileSelect( event, afterfilescheck);
					if (debugappui) console.log('changed again');
				},

	            false);
	}

}

function handleImageUploadFileSelect( evt, _callback) {
	var files = evt.target.files; // FileList object
	evt.target.imgcount = 0
    // files is a FileList of File objects. List some properties.
    var output = [];
    var imgcount = 0;
    if (debugappui) console.log('onchange event fired for files-input');
    for (var i = 0; i< files.length; i++) {
    	//alert(files[i].name + ' ' + files[i].type + ' ' + files[i].size);
    	
    	var reader = new FileReader();

    	reader.onload = function (e) {
    		
    	    imageExists(e.target.result, function(exists){
    	    	
    	        if (exists) {
    	        	//alert('imgcount will be increased ' + imgcount);
    	        	evt.target.imgcount++;
    	    		output.push(files[i]);
    	    		document.getElementById('file-select-feedback').value = files.length + ' files selected. ' + evt.target.imgcount + ' images.';
    	    	    
    	        } 
    	    });
    	    
    	    
    	};

    	reader.readAsDataURL(files[i]);
    	
    }
    
    _callback(evt.target.imgcount, output);
     
}

function afterfilescheck(imgcount, output) {
	//alert('callback called images -' + imgcount);
	if (imgcount > 0) {
		if (debugappui) console.log('imgcount greater than zero...' + imgcount );
		document.forms[0].files.value = output;
		
		document.getElementById('img-files-upload-btn').style.display = 'block';
	}	
}

function imageExists(url, callback) {
	//alert('in imageexists ' + url.substring(0, 20) + '  ...+' + url.length);
    var img = new Image();
    img.onload = function() { 
    	//alert('onload called from imageexists');
    	callback(true); 
    	}
    	
    img.onerror = function() {
		//alert('onerror called from imageexists');
    		//console.log('could not load file in img tag');
    		callback(false); 
    	}   	
  
    img.src = url;
}


function videoExists(url, callback) {
	const videoEl = document.createElement("video");
	  videoEl.src = url;
	  
	  videoEl.currentTime = 3;
	  
	  videoEl.onloadedmetadata = event => {
		    window.URL.revokeObjectURL(videoEl.src);
		    const { name, type } = url;
		    const { videoWidth, videoHeight } = videoEl;
		    
		   //_CANVAS.style.display = 'block';
		    console.log('Filename:'+ url.name + ' - Type:' +  url.type + ' - Size: ' + videoEl.videoWidth + 'x' +  videoEl.videoHeight);
		    console.log('canplay videomp4 ' + videoEl.canPlayType("video/mp4"));
		   
		  }
	  
	  videoEl.ontimeupdate = function() {
		  var _CANVAS = document.querySelector("#post-video-preview-canvas");
		    _CANVAS.width = videoEl.videoWidth;
		    _CANVAS.height = videoEl.videoHeight;
		    var _CANVAS_CTX = _CANVAS.getContext("2d"); 
		    
		    _CANVAS_CTX.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
		    console.log('image saved on canvas now passing to callback');
		    callback(true); 
		};
    
	// If there's an error, most likely because the file
	  // is not a video, display an error.
	  videoEl.onerror = () => {
	    console.log('File ' + url + ' not a video file');
	    callback(false); 
	  }
  
}

function uploadimages(formname) {
	document.getElementById("img-files-upload-btn").classList.add("disabled");
	if (formname && formname.length > 0) {
		if (debugappui) console.log('found formname : ' + formname + '.. will submit to singleupload');
		submitFormAjax('/singleUpload', formname);
	} else {
		if (debugappui) console.log('found no formname : ' + formname );
		submitFormAjax('/singleUpload');
	}
	return false;
}


function overloadimage(formname, seq) {
	document.getElementById("img-files-upload-btn-overwrite").classList.add("disabled");
	if (formname && formname.length > 0) {
		console.log('found formname : ' + formname + '.. will submit to singleupload');
		submitFormAjax('/singleUpload/'+seq, formname);
	} else {
		 console.log('found no formname : ' + formname );
		submitFormAjax('/singleUpload/'+seq);
	}
	return false;
}

function setcallservertimer() {
	if (callservertimer) clearTimeout(callservertimer);
	if (debugappui) console.log('setting timer for addsessiontime');
 	callservertimer = setTimeout(addsessiontime, interactduration); // call server every 5 min
}

function addsessiontime() {
	var currtime = new Date();
	var timediff = currtime - lasttime;
	
	var addback = (interactduration - timediff)/1000;
	
	if (addback > 4) {  // setting to 4 sec for testing ....have at least 30 sec of activity
		lapses = 0;
		if (debugappui) console.log('adding: ' + addback + ' s to session.' + currtime.toString().substring(16,24) + ' ' + lasttime.toString().substring(16,24) + ' lapses: ' + lapses + ' of ' + allowedlapses);
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	        	if ( xhr.getResponseHeader("SESSION_EXTENDED_TILL").length > 0) { 
	        		var oldavatarcountDownDate = avatarcountDownDate;
	        		avatarcountDownDate = xhr.getResponseHeader("SESSION_EXTENDED_TILL");
	        		//alert('new avatarcountDownDate: ' + avatarcountDownDate + ' old: ' + oldavatarcountDownDate);
    			} 
	        }
	    }
		
	    xhr.open('POST', '/addsessionduration', false);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');     
	   
	         xhr.send(JSON.stringify({
	     	   	
	     	   	data: interactduration ,
	     	   	createdate: currtime
	     	   	
	     		}));
	         
	} else {
		lapses++;
		if (debugappui) console.log('not enough duration to add: ' + addback + ' s ' + currtime.toString().substring(16,24) + ' ' + lasttime.toString().substring(16,24) + ' lapses: ' + lapses + ' of ' + allowedlapses);
	}
	lasttime = new Date();
	
	setcallservertimer();
	
}

function reenter_auth() {
	//if (debugappui) console.log('calling reenter_auth.. lapses: ' + lapses );
	if (lapses >=  allowedlapses) { //allowedlapses
		if (debugappui) console.log('calling reenter_auth.. lapses: ' + lapses + ' .. also displaying login image');
		var authoverlay = document.getElementById("re-auth-overlay");
		
		if (authoverlay == null) {
			authoverlay = document.createElement("div");
			authoverlay.setAttribute("id", "re-auth-overlay");
			document.body.appendChild(authoverlay);
		}
						
		var url = "/newauth/api/authenticate/reenter" ;
		
		var xmlhttp= window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xmlhttp.onreadystatechange = function() {
	        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
	        	
	        	document.getElementById("re-auth-overlay").innerHTML = xmlhttp.responseText;
	        	
	        	document.getElementById("re-auth-overlay").style.display = "block";
	    		if (debugappui) console.log('clearing reenter_auth timer');
	    		clearTimeout(lotimer);
	    		if (debugappui) console.log('clearing addsessiontime timer');
	    		clearTimeout(callservertimer);
	    		//alert("You are now logged out.");
	    		lapses = 0;
	    		removeactivitylisteners();
	    		
	        	if (document.querySelector('.auth-image-main-container')) { // Authentication page came up
	        		afterauthscreenload(true);
	        	} else { // got kicked back to Welcome screen
	        		clearoverlay("re-auth-overlay");
					
					let divnotification = 	'<div style="display: block; position: relative; fontSize:15px; top: 50%;  text-align: center;"' + 
					  'Your session has expired. Please login again.'+
					'</div>';

	        		document.getElementById('app').innerHTML = divnotification;
	        		afterWelcomePageLoad();
	        	}
	        }
		};
		
		xmlhttp.open('POST', url, false);
		xmlhttp.withCredentials = true;
		xmlhttp.setRequestHeader('Content-Type', 'application/json');     
		
		//alert(authoverlay.clientHeight);
		xmlhttp.send(JSON.stringify({     	   	
	    	
			userflake:loggedinuserflake,
	    	screenwidth: window.screen.availWidth,
	    	screenheight:window.screen.availHeight,
	    	winwidth: authoverlay.style.width,
	    	winheight: authoverlay.style.height,
	    	reenter: true	     	   	
     	   	
     		}));
		
		
		
	} else {
		clearTimeout(lotimer);
		if (debugappui) console.log('setting reenter_auth timer');
		lotimer = setTimeout(reenter_auth, delay);
	}
    //location.href = 'reenter_auth.php'
}


//reenter_auth after delay ms of inactivity, call server every interactduration ms and add time to the session
function trackinactivityTime(indelay, ininteractduration) {
	
    attachactivitylisteners();
    
    interactduration = ininteractduration;
    delay = indelay;

    allowedlapses=3600000/interactduration;

}

//activitytimer related ---- END

if (!String.prototype.startsWith) {
	  String.prototype.startsWith = function(searchString, position) {
	    position = position || 0;
	    return this.indexOf(searchString, position) === position;
	  };
	}

// fade out

function fadeOut(el) {
	el.style.opacity = 1;
	//alert('..in fadeout');
	(function fade() {
		if ((el.style.opacity -= .1) < 0) {
			el.style.display = "none";
		} else {
			requestAnimationFrame(fade);
		}
	})();
}

function restoreheaderandfooter() {
	
	if (document.getElementById('app-header').getAttribute('data-display') != null) {
		document.getElementById('app-header').style.display = document.getElementById('app-header').getAttribute('data-display');
		document.getElementById('app-header').style.height = document.getElementById('app-header').getAttribute('data-height');
		document.getElementById('app-footer').style.display = document.getElementById('app-footer').getAttribute('data-display');
		document.getElementById('app-footer').style.height = document.getElementById('app-footer').getAttribute('data-height');
		document.getElementById('app').style.height = document.getElementById('app').getAttribute('data-height');
		document.getElementById('app').style.overflowY = document.getElementById('app').getAttribute('data-overflow');
		document.getElementById('app').style.paddingTop = document.getElementById('app').getAttribute('data-paddingtop');
		document.getElementById('app').style.paddingBottom = document.getElementById('app').getAttribute('data-paddingBottom'); 
	}		
        	
}

function removeheaderandfooter() {
	document.getElementById('app-header').setAttribute('data-display', document.getElementById('app-header').style.display);
		document.getElementById('app-header').style.display = 'none';
		
		document.getElementById('app-header').setAttribute('data-height', document.getElementById('app-header').style.height);
		document.getElementById('app-header').style.height = '0';
		
		document.getElementById('app-footer').setAttribute('data-display', document.getElementById('app-footer').style.display);
		document.getElementById('app-footer').style.display = 'none';
		
		document.getElementById('app-footer').setAttribute('data-height', document.getElementById('app-footer').style.height);
		document.getElementById('app-footer').style.height = '0';
		        		
		document.getElementById('app').setAttribute('data-height', document.getElementById('app').style.height);
		document.getElementById('app').style.height = '100%';
		
		document.getElementById('app').setAttribute('data-overflow', document.getElementById('app').style.overflowY);
		document.getElementById('app').style.overflowY = 'hidden';
		
		document.getElementById('app').setAttribute('data-paddingtop', document.getElementById('app').style.paddingTop);
		document.getElementById('app').style.paddingTop = '0';
		
		document.getElementById('app').setAttribute('data-paddingbottom', document.getElementById('app').style.paddingBottom);
		document.getElementById('app').style.paddingBottom = '0';
}

function removealldots() {
	var elems = document.getElementsByClassName('circle');
	
	if (elems != null) {
		
		for (var c=0; c< elems.length; c++) {
			elems[c].style.display = 'none';
		}
	}
}

function submitFormAjax(url, formname)
{
    var xmlhttp= window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
   // if (debugappui) console.log(url + ' ' + formname); // Here is the response
    
    xmlhttp.onreadystatechange = function() {
    	
    	//console.log(xmlhttp.readyState + ' ' + xmlhttp.status/100); // Here is the response
        if (xmlhttp.readyState == 4 && Math.trunc(xmlhttp.status/100) == 2) {
	 	//if (xmlhttp.readyState == 4 && (xmlhttp.status == 200)) {
        	//if (debugappui) 
        	
        	if (url == '/newauth/authenticate') {
				
				if (document.getElementById('app-header') != null) {
        			removeheaderandfooter();
        			removealldots();
        		}
        		document.getElementById('app').innerHTML = xmlhttp.responseText;
        		
        		if (document.getElementById('auth-image-main-container-id') != null)
        			document.getElementById('auth-image-main-container-id').style.top = '0';
        		
        		fadeinelement('app');
        		
        		if (document.querySelector('.auth-image-main-container')) {
        			afterauthscreenload(false);
        		} else if (document.getElementById('setup-page-id')) {// Got redirected to setup page 
        			//alert('yes');
        			loadUrlAjax('/newauth/header?page=setupUser&pendSetup=true', 'app-header');
        			
        			afteranyscreenload();
        		} else if (document.getElementById('app-flk')) {// Forwarded to flake page in app
        			loadUrlAjax('/newauth/header?page=flake-page', 'app-header');
        			afteranyscreenload();
        			if (document.getElementById('flake-page-id') != null) document.getElementById('flake-page-id').style.top = '65px';
        		} else if (document.getElementById('create-page-id')) {// Forwarded to create page in app
        			loadUrlAjax('/newauth/header?page=createuser', 'app-header');
	        		loadPageScripts('app');
	        		afterCreateUserPageLoad();
	        		removealldots();
        		}else {
        			afteranyscreenload(); // authenticationresult.... for example
        		}
        		
        		
        	}
        	
        	if ( url == '/newauth/postAuthClickData') {
        		//alert(url + ' onreadystatechange 4  ' +  xmlhttp.status);
            	//console.log(url + ' within status 200: ' + xmlhttp.status + ' resp: ' + xmlhttp.responseText); // Here is the response
        		if (document.getElementById("re-auth-overlay") != null) { // this was a submit from within re-auth-overlay
	      			
        			if ('FAIL' == xmlhttp.getResponseHeader("AUTH_RESULT")) { 
        				//alert("got authresult header " + xmlhttp.getResponseHeader("AUTH_RESULT"));
        				document.getElementById("re-auth-overlay").innerHTML = xmlhttp.responseText;	      			
        				afterauthscreenload(true);
        			} else {// REMOVE the re-auth-overlay and come to the old screen
        				clearoverlay("re-auth-overlay");
        				//document.getElementById("re-auth-overlay").innerHTML = null;
        			}
        		} else { // this was a regular submit from app
        			document.getElementById('app').innerHTML = xmlhttp.responseText;
        			if (document.querySelector('.auth-image-main-container')) {
        				//console.log('AUTH_RESULT header ' + xmlhttp.getResponseHeader("AUTH_RESULT"));
        				var respheader = xmlhttp.getResponseHeader("AUTH_RESULT");
            			if ('FAIL' == respheader) {
            				//alert('failure found');
            				//cleardiv(document.getElementById("displayauthenticatingcontainer"));
            				//cleardiv(document.getElementById("displayloadingcontainer"));
            				hideloadingicon();
            				showAuthFailureDialog();
            				settimeoutid = setTimeout(function(){ 
            					clearAuthFailureDialog();
            					//alert('about to run afterauthscreenload');
            					
            				}, 1000);
            				
            				//setTimeout(function(){ 
            					afterauthscreenload(false); 
            					
            				//}, 400);
            				//afterauthscreenload(false); 
            				
            			} else {
            				hideloadingicon();
            				afterauthscreenload(false);
            			}
            			
            		} else if (document.getElementById('home-page-id')) {// Home page displayed
            			//alert('yes');
            			restoreheaderandfooter();
            			loadUrlAjax('/newauth/header?page=home', 'app-header');
            			afteranyscreenload();
            		} else if (document.getElementById('secure-page-id')) {// Got redirected to secure page 
            			//alert('yes');
            			restoreheaderandfooter();
            			loadUrlAjax('/newauth/header?page=securePage', 'app-header');
            			afteranyscreenload();
            		} else if (document.getElementById('app-flk')) {// Forwarded to flake page in app
	        			loadUrlAjax('/newauth/header?page=flake-page', 'app-header');
	        			if (document.getElementById('flake-page-id') != null) document.getElementById('flake-page-id').style.top = '65px';
	        			afteranyscreenload();
	        		} else {
	            			
            			//alert('after authenticationresult');
            			afteranyscreenload(); // authenticationresult.... for example
            		}
            		
        		}
        		
        	}
        	
        	if (url == '/createUser') {
        		//alert(xmlhttp.responseText); // Here is the response
        		document.getElementById('app').innerHTML = xmlhttp.responseText;
        		afteranyscreenload();
        		if (document.getElementById('setuppasswordcollapse')) { // CreateUser was successful
        			loadUrlAjax('/newauth/header?page=setupUser&pendSetup=true', 'app-header');
        			afterusersetupscreenload();
        		}
        	}
        	
        	if (url == "/singleUpload") { // this is an image upload... update admin-images 
        		
        		document.getElementById("img-files-upload-btn").classList.add("active");
        		if (document.getElementById('adminImages') != null)
        			document.getElementById('adminImages').innerHTML = xmlhttp.responseText;
        		
        		if (document.getElementById('initimageuploadresult') != null)
        			document.getElementById('initimageuploadresult').innerHTML = xmlhttp.responseText;
        	}
        	
        	
        	
        }
    }

    xmlhttp.open("POST",url,true);
    //xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
   // xmlhttp.setRequestHeader("Content-type","multipart/form-data");
    
    var form ;
    updatescreenandwindowdims(); // populate dimensions where applicable
    
    if (formname && formname.length > 0)
    	form = document.forms[formname];
    else
    	form = document.forms[0];
    
     //alert('formname ' + formname + ' form ' + form);
    var data = new FormData(form);
    // This is not working in IE
    //for (var pair in data.entries()) {
    ///    if (debugappui) console.log(pair[0]+ ', ' + pair[1]); 
   // }
    //alert(data);
    xmlhttp.withCredentials = true;
    if (debugappui) console.log('Posting form data'); 
    xmlhttp.send(data);
    
}
function showAuthFailureDialog() {
	//alert('showing auth failure');
	hideAuthImage();
	var loaddiv = document.getElementById("app-notify-dialog");
	
	//alert('about to show failure dialog');
	if (loaddiv == null) {
		//alert('creating failure div');
		
		loaddiv  = document.createElement("div");
		loaddiv.setAttribute("id", "app-notify-dialog");
		
		document.body.appendChild(loaddiv);
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
		 
		p.appendChild(document.createTextNode("Could not authenticate"));
		 p.style.color = "#737373"; 
		 
		 if (window.innerWidth < 600)
			 p.style.fontWeight = "140"; 
		 else
			 p.style.fontWeight = "400"; 
		
		 panl.appendChild(p);
		 
		 var pdh = document.createElement('p');
		 pdh.classList.add('lead');
		 pdh.setAttribute("id", "createuser-flake-text-header");
		 
		 pdh.appendChild(document.createTextNode("Please try again."));
		 pdh.style.color = "#737373";
		 
		 if (window.innerWidth < 600)
			 pdh.style.fontWeight = "60"; 
		 else
			 pdh.style.fontWeight = "150"; 

		 panl.appendChild(pdh);
		
		 coldiv.appendChild(panl);
		 rowdiv.appendChild(coldiv);
		 cntnr.appendChild(rowdiv);
		 
		 loaddiv.appendChild(cntnr);
	  }
	
	settimeoutid = setTimeout(function(){ 
		//flakeoverlay.style.display = "block";
		//alert('about to fadein failure div');
		//document.getElementById("app-notify-dialog").style.display = 'block';
		$('#app-notify-dialog').fadeIn('fast');
		//afterauthscreenload(false);   /// it does not work... load event handler gets called
	}, 100);

}


function showAppTimeoutDialog() {
	//alert('showing auth failure');
	if (appcalltimeoutid != null) clearTimeout(appcalltimeoutid);
	appcalltimeoutid = null;
	var loaddiv = document.getElementById("app-timeout-notify-dialog");
	
	//alert('about to show failure dialog');
	if (loaddiv == null) {
		//alert('creating failure div');
		
		loaddiv  = document.createElement("div");
		loaddiv.setAttribute("id", "app-timeout-notify-dialog");
		
		document.body.appendChild(loaddiv);
		var cntnr = document.createElement("div");
		cntnr.classList.add('container');
		cntnr.classList.add('v-center');
			
		var rowdiv = document.createElement("div");
		rowdiv.classList.add('row');
		
		
		var coldiv = document.createElement("div");
		coldiv.classList.add('col-md-8'); 
		coldiv.classList.add('col-md-offset-2');
		
		//coldiv.classList.add('center-block');
		
		 let closeanchor = document.createElement('span');
		    closeanchor.innerHTML = '&times;';
		    closeanchor.style.float='right';
		    closeanchor.style.padding= '2px 7px';
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
		    	$('#createuser-flake-overlay').fadeOut(500);
		    	removediv(document.getElementById('app-timeout-notify-dialog'));
		    	
		    	hideloadingicon();
		    	//alert('removed overlay');
		    	//loadWelcome();
		    	//fadeoutelement('app');
		    });
		    coldiv.appendChild(closeanchor);
		
		var panl = document.createElement("div");
		panl.classList.add('panel'); 
		panl.classList.add('panel-default');
		
		 var p = document.createElement('h3');
		// p.classList.add('lead');
		 
		p.appendChild(document.createTextNode("Request did not complete in time"));
		 p.style.color = "#737373"; 
		 p.style.fontWeight = "150"; 
		
		 panl.appendChild(p);
		 
		 var pdh = document.createElement('p');
		 pdh.classList.add('lead');
		 pdh.setAttribute("id", "createuser-flake-text-header");
		 
		 pdh.appendChild(document.createTextNode("Please try again."));
		 pdh.style.color = "#737373";
		 pdh.style.fontWeight = "50";
		
		 panl.appendChild(pdh);
		 
		 
		 var sendbutton = document.createElement("input");
			sendbutton.setAttribute("id", "cde-send-button");
			sendbutton.classList.add('btn');
			sendbutton.classList.add('btn-primary');
			sendbutton.classList.add('btn-sm');
			//sendbutton.classList.add('pull-right');
			
			sendbutton.type = "button";
			sendbutton.value = "Try Again";
			
			sendbutton.addEventListener('click', function() {
				//alert('button clicked');
								$('#app-timeout-notify-dialog').hide();
								removediv(loaddiv);
								loadWelcome();
								}, false);				
							
			panl.appendChild(sendbutton);
			panl.appendChild(document.createElement("p"));
		 coldiv.appendChild(panl);
		 rowdiv.appendChild(coldiv);
		 cntnr.appendChild(rowdiv);
		 
		 loaddiv.appendChild(cntnr);
	  }
	
	settimeoutid = setTimeout(function(){ 
		//flakeoverlay.style.display = "block";
		//alert('about to fadein failure div');
		//document.getElementById("app-notify-dialog").style.display = 'block';
		$('#app-timeout-notify-dialog').fadeIn('fast');
		//afterauthscreenload(false);   /// it does not work... load event handler gets called
	}, 100);

}

function showImageLoadErrorDialog() {
	//alert('showing auth failure');
	
	if (appcalltimeoutid != null) {
		console.log('clearing  appcalltimeoutid in showImageLoadErrorDialog '+ appcalltimeoutid);
		clearTimeout(appcalltimeoutid);
	}
	appcalltimeoutid = null;
	var loaddiv = document.getElementById("app-timeout-notify-dialog");
	
	//alert('about to show failure dialog');
	if (loaddiv == null) {
		//alert('creating failure div');
		
		loaddiv  = document.createElement("div");
		loaddiv.setAttribute("id", "app-timeout-notify-dialog");
		
		document.body.appendChild(loaddiv);
		var cntnr = document.createElement("div");
		cntnr.classList.add('container');
		cntnr.classList.add('v-center');
			
		var rowdiv = document.createElement("div");
		rowdiv.classList.add('row');
		
		
		var coldiv = document.createElement("div");
		coldiv.classList.add('col-md-8'); 
		coldiv.classList.add('col-md-offset-2');
		
		//coldiv.classList.add('center-block');
		
		let closeanchor = document.createElement('span');
	    closeanchor.innerHTML = '&times;';
	    closeanchor.style.float='right';
	    closeanchor.style.padding= '2px 7px';
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
	    	$('#createuser-flake-overlay').fadeOut(500);
	    	removediv(document.getElementById('app-timeout-notify-dialog'));
	    	//alert('removed overlay');
	    	//loadWelcome();
	    	//fadeoutelement('app');
	    });
	    coldiv.appendChild(closeanchor);
		
		var panl = document.createElement("div");
		panl.classList.add('panel'); 
		panl.classList.add('panel-default');
		
		 var p = document.createElement('h3');
		// p.classList.add('lead');
		 
		p.appendChild(document.createTextNode("Temporary error loading image"));
		 p.style.color = "#737373"; 
		 p.style.fontWeight = "150"; 
		
		 panl.appendChild(p);
		 
		 var pdh = document.createElement('p');
		 pdh.classList.add('lead');
		 pdh.setAttribute("id", "createuser-flake-text-header");
		 
		 pdh.appendChild(document.createTextNode("Please try again."));
		 pdh.style.color = "#737373";
		 pdh.style.fontWeight = "50";
		
		 panl.appendChild(pdh);
		 
		 
		 var sendbutton = document.createElement("input");
			sendbutton.setAttribute("id", "cde-send-button");
			sendbutton.classList.add('btn');
			sendbutton.classList.add('btn-primary');
			sendbutton.classList.add('btn-sm');
			//sendbutton.classList.add('pull-right');
			
			sendbutton.type = "button";
			sendbutton.value = "Try Again";
			
			sendbutton.addEventListener('click', function() {
				//alert('button clicked');
								$('#app-timeout-notify-dialog').hide();
								removediv(loaddiv);
								loadWelcome();
								}, false);				
							
			panl.appendChild(sendbutton);
			panl.appendChild(document.createElement("p"));
		 coldiv.appendChild(panl);
		 rowdiv.appendChild(coldiv);
		 cntnr.appendChild(rowdiv);
		 
		 loaddiv.appendChild(cntnr);
	  }
	
	settimeoutid = setTimeout(function(){ 
		//flakeoverlay.style.display = "block";
		//alert('about to fadein failure div');
		//document.getElementById("app-notify-dialog").style.display = 'block';
		$('#app-timeout-notify-dialog').fadeIn('fast');
		//afterauthscreenload(false);   /// it does not work... load event handler gets called
	}, 100);

}

function clearAuthFailureDialog() {
	
	showAuthImage();
	//alert('fading out failure div');
	$('#app-notify-dialog').fadeOut('fast');
	clearTimeout(settimeoutid);
	removediv(document.getElementById("app-notify-dialog"));
	//var loaddiv = document.getElementById("app-notify-dialog");
	// 	 	removediv(loaddiv);
	//afterauthscreenload(false); 
}

function clearoverlay(id) {
	document.getElementById(id).style.display = "none";
	
	var reaudiv = document.getElementById(id);
	removediv(reaudiv);
}

function removediv(dv) {
	if (dv != null) {
		while (dv.hasChildNodes()) {
			dv.removeChild(dv.firstChild);
		}
		
		if (dv.parentNode != null)
			dv.parentNode.removeChild(dv);
	}
}

function cleardiv(dv) {
	if (dv != null) {
		while (dv.hasChildNodes()) {
			dv.removeChild(dv.firstChild);
		}
		
	}
}

function loadUrlAjax(url, target)
{
	//displaypageloadingdiv();
    var xmlhttp= window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");

    xmlhttp.onreadystatechange = function() {
    	
        if (xmlhttp.readyState == 4 && Math.trunc(xmlhttp.status/100) == 2) {
        	
        	document.getElementById(target).innerHTML = "";
        	document.getElementById(target).innerHTML = xmlhttp.responseText;         	
        		
        	fadeinelement(target);
        	//$('#'+target).html(xmlhttp.responseText).fadeIn(2000);
        	
        	if (url == '/newauth/welcome') {
        		loadUrlAjax('/newauth/header', 'app-header');
        		afterWelcomePageLoad();
        	}
        	
        	if (url.startsWith('/newauth/orgPage')) {
        		afteranyscreenload();
        	}
        	
        	if (url == '/newauth/home') {
        		//alert('will load header  /newauth/header?page=home');
        		loadUrlAjax('/newauth/header?page=home', 'app-header');
        		afteranyscreenload();
        		//loadPageScripts('app');
        		stopSSEPolling();
        	}
        	
        	if (url.startsWith('/createUser')) {
        		loadUrlAjax('/newauth/header?page=createuser', 'app-header');
        		loadPageScripts('app');
        		afterCreateUserPageLoad();
        		removealldots();
        	}
        	
        	if (url.startsWith("/newauth/authenticate")) {
	
				if (document.getElementById('app-header') != null) {
        			removeheaderandfooter();
        			removealldots();
        		}
        		
        		if (document.querySelector('.auth-image-main-container')) { // Authentication page came up
        			loadUrlAjax('/newauth/header?page=authenticate&authMessage=If%20you%20do%20not%20recognize%20the%20images,%20check%20the%20username%20you%20entered.', 'app-header');
        			afterauthscreenload(false);
        		} else if (document.getElementById('setuppasswordcollapse')) { // got forwarded to setup
        			loadUrlAjax('/newauth/header?page=setupUser&pendSetup=true', 'app-header');
        			afterusersetupscreenload();
        		}  else if (document.getElementById('home-page-id')) {// Home page displayed
        			//alert('yes');
        			loadUrlAjax('/newauth/header?page=home', 'app-header');
        			document.getElementById('app-header').style.display = 'block';
        			afteranyscreenload();
        		} else if (document.getElementById('secure-page-id')) {// Got redirected to secure page 
        			//alert('yes');
        			loadUrlAjax('/newauth/header?page=securePage', 'app-header');
        			
        			afteranyscreenload();
        		} 
        		else if (document.getElementById('topic-page-id')) {// Topic page in app
        			//alert('yes');
        			loadUrlAjax('/newauth/header?page=brandPage', 'topic-app-header');
        			afteranyscreenload();
        		} else if (document.getElementById('app-flk')) {// Topic page in app
        			//alert('yes');
        			loadUrlAjax('/newauth/header?page=flake-page', 'app-header');
        			if (document.getElementById('flake-page-id') != null) document.getElementById('flake-page-id').style.top = '65px';
        			afteranyscreenload();
        		} else { // Authenticated by flake -- came in public page
        			loadUrlAjax('/newauth/header?page=publicPage', 'app-header');
            		afterPublicPageScreenLoad();
        		}
        	}
        	
        	if (url.startsWith("/newauth/postAuthColClickData")) {
        		//alert('url was postAuthColClickData');
        		if (document.querySelector('.auth-image-main-container')) { // Authentication page came up
        			
        			loadUrlAjax('/newauth/header?page=authenticate', 'app-header');
        			afterauthscreenload(false);
        		}
        		
        		if (document.getElementById('setuppasswordcollapse')) { // got forwarded to setup
        			loadUrlAjax('/newauth/header?page=setupUser&pendSetup=true', 'app-header');
        			afterusersetupscreenload();
        		}
        		
        		
        	}
        	        	
        	if (url == '/newauth/setupUser') {
        		loadUrlAjax('/newauth/header?page=setupUser', 'app-header');
        		afterusersetupscreenload();
        	}
        	
        	if (url.startsWith("/newauth/setimgpwd/")) {
        		//alert(xmlhttp.responseText); // Here is the response
        		var spliturl = url.split("/");
        		var params = "";
        		if (spliturl.length > 6)
        			params = "/" + spliturl[3] + "/" + spliturl[4] + "/" + spliturl[5] + "/" + spliturl[6] + "/" + spliturl[7];
        		
        		//alert(spliturl.length + 'querystring ' + params);  ///  /newauth/setimgpwd/1920/1040/1495/790/44a7dc5f-ce60-4e6f-8bc4-efcbabcf82f3
        		
        		loadUrlAjax('/newauth/imgpwdheader' + params, 'app-header');
        		afterBoxImageScreenLoad();
        	}
        	
        	if (url.startsWith("/newauth/securePage")) {
        		//alert(xmlhttp.responseText); // Here is the response
        		loadUrlAjax('/newauth/header?page=securePage', 'app-header');
        		afterSecurePageScreenLoad();
        	}
        	
        	if (url.startsWith("/newauth/publicPage")) {
        		//alert(xmlhttp.responseText); // Here is the response
        		loadUrlAjax('/newauth/header?page=publicPage', 'app-header');
        		afterPublicPageScreenLoad();
        	}
        	
        	if (url.startsWith("/newauth/header")) {
        		//alert(xmlhttp.responseText); // Here is the response
        		//alert('flakejsonobj after header ' + flakejsonobj);
        		generateFlakeOnCanvas('hdr-flake-display-btn', flakejsonobj, 60, 40, 'tiny' , false);
        		var headerflakebutton = document.getElementById("hdr-flake-display-btn");	
        		
        		if ( typeof(headerflakebutton) !== "undefined" && headerflakebutton !== null) {
        			//alert(flakejsonobj.flake);
        			if (typeof flakejsonobj != 'undefined')
        				headerflakebutton.setAttribute('title',flakejsonobj.flake);
    				headerflakebutton.addEventListener('click', 
    						function(evt) { 		
    							//alert(headerflakebutton.innerHTML);
    							var dummy = document.createElement("input");
						    	document.body.appendChild(dummy);
						    	dummy.setAttribute('value', loggedinuserflake);
						    	dummy.select();
						    	document.execCommand("copy");
						    	document.body.removeChild(dummy);
						    	displaybuttonbehavior(evt, "Flake copied");
    							displayflakeinmodal(headerflakebutton.innerHTML);
    							//alert('flake clicked '  + loggedinuserflake);
    						}
    				, false);
    				//alert('eventhandler added for flake button');
        			
        		}
        	}
          	
        }
    }

    xmlhttp.open("GET",url, true);
    xmlhttp.send();   
 
    return false;
    
}

function displaybuttonbehavior(event, msg) {
	var iddsp = document.getElementById('identity-display');
	var cln ;
		
	if (iddsp != null)
		cln = iddsp.cloneNode(true);
	else
		cln = document.createElement('div');
	
	cln.setAttribute('id', 'buttonbehavior');
	cln.style.position = 'absolute';
	
	if (event != null) {
		cln.style.top = event.target.getBoundingClientRect().top;
		cln.style.left = event.target.getBoundingClientRect().left;
	} else {
		cln.style.bottom = 10;
		cln.style.right = 50;
	}
	cln.style.opacity = "0.4";
	cln.style.fontSize = "14";
	cln.style.backgroundColor = '#fefefe';
	cln.style.boxShadow = '2px 3px 2px #ededed';
	cln.style.color = '#636363';
	cln.style.zIndex = 9999;
	cln.innerText = msg;
	cln.style.display = 'block';
	
	
	setTimeout(function(evt) {
		//console.log('searching...');
		//evt.stopPropagation();
		cln.style.opacity = "0.4";
		setTimeout(function(){removediv(cln)},300);		
		}, 2000);	
	document.body.appendChild(cln);
	
	cln.style.opacity = window.getComputedStyle(cln).getPropertyValue("opacity");
	attachtransitionstyles(cln);
	cln.style.opacity = "0.9";
	
	return cln;
}

function displaypageloadingdiv(elem) {
	
	var x=0;
	var y=0;
	
	if (elem) {
		var pos = getPositionOfanElement(elem);
		x= pos.x;
		y= pos.y;
		
		if (x == 0) x = 40;
		if (y == 0) y = 40;
	}
		
	var loaddiv = document.getElementById("loading-box");
	
	//alert('target tag ' + elem.tagName + ' ' + x + ' ' + y);
	if (loaddiv == null) {
		//alert('creating loading div');
		
		loaddiv  = document.createElement("div");
		loaddiv.setAttribute("id", "loading-box");
		loaddiv.classList.add('text-center');	

		var spinner = document.createElement("div");
		spinner.classList.add('text');
		spinner.classList.add('animated');
		spinner.classList.add('infinite');
		spinner.classList.add('pulse');
		
		spinner.appendChild(document.createTextNode("Loading"));
		
		loaddiv.appendChild(spinner);
		
		loaddiv.style.display = 'block';
		loaddiv.style.left= x+'px';
		loaddiv.style.top = y+'px';
		
		document.body.appendChild(loaddiv);
		//alert('created loading div');
	  }
}

function removepageloadingdiv() {
	var loaddiv = document.getElementById("loading-box");
	//alert('trying to remove ');
	if (loaddiv != null) {
		removediv(loaddiv);
	}
}

function afterWelcomePageLoad() {
	//alert('will run page scripts now');
	loadPageScripts('app');
	document.title = 'Newauth Welcome';
	stopSSEPolling();
}

function afterauthscreenload(reauth) {
	//alert('here ');
	imagecounter = 0;
	
	if (reauth == false)
		loadPageScripts('app');
	else
		loadPageScripts('re-auth-overlay');
	
	//alert('script evalled ');
	authimagecontainerdivelem = document.querySelector('.auth-image-main-container');
	authimagecontainerdivelem.style.display='table-cell'; 
	authimagecontainerdivelem.style.verticalAlign='middle'; 
	authimagecontainerdivelem.style.textAlign = 'center';	
	
	//authimagecontainerdivelem.addEventListener('click', handleauthimgclickevent , false);
	//imgs = authimagecontainerdivelem.querySelectorAll('.auth-image-invisible');
	
	//alert('click handler added ');
	//imgs = authimagecontainerdivelem.querySelectorAll('[id^="img"]');
	imgs = document.querySelectorAll("img");

	//console.log('images ' + imgs.length);
	if (imgs  != null && imgs.length > 0) {
		
		for (var n = 0; n < imgs.length; n++) {
			imgs[n].addEventListener('error', function() { 
				//console.log('images : ' + imgs.length + ' reauth ' + reauth);
				//	gradientBackground(); 
				
				showImageLoadErrorDialog();
				
				//console.log('after calling displayfirstimageoncanvas ' );
				}, false);
		}
		
		
			for (var n = 0; n < imgs.length; n++) {
				imgs[n].addEventListener('load', function() { 
					//console.log('images : ' + imgs.length + ' reauth ' + reauth + ' idx ' + n + ' collageimagesloaded ' + collageimagesloaded);
					//	gradientBackground(); 
					
					collageimagesloaded++;
					
					if ( collageimagesloaded == imgs.length ) {
						//alert('all collage images loaded');
						if (appcalltimeoutid != null) {
							clearTimeout(appcalltimeoutid);
						}
						appcalltimeoutid = null;
						removepageloadingdiv();
						if (imgs.length > 8) {
							displayFirstImage(); // this is actually displaying collage
						} else {
							displayfirstimageoncanvas();
						}
					} 
					//console.log('after calling displayfirstimageoncanvas ' );
					}, false);
			}
		
		
			/*imgs[0].addEventListener('load', function() { 
										//console.log('images : ' + imgs.length + ' reauth ' + reauth);
										//	gradientBackground(); 
										
										displayfirstimageoncanvas();
										
										//console.log('after calling displayfirstimageoncanvas ' );
										}, false);*/
		
		
		//alert('img load handler added ');
	}
}



function afteranyscreenload() {	
	if (appcalltimeoutid != null) {
		clearTimeout(appcalltimeoutid);
	}
	appcalltimeoutid = null;
	removepageloadingdiv();
	loadPageScripts('app');
	document.body.removeEventListener('click', topicdocumentclick);
	
}

function afterBoxImageScreenLoad() {
	
	restartTimer();
	afteranyscreenload();
	//loadPageScripts('app');
}


function afterSecurePageScreenLoad() {
	afteranyscreenload();
	//loadPageScripts('app');
	stopSSEPolling();
}


function afterPublicPageScreenLoad() {
	afteranyscreenload();
	//loadPageScripts('app');
	document.title = 'Newauth - Live';
	publicpagelinkclicked = false;
	//wsconnect('/user/queue/conversations'); NOT doing websocket
}



function loadPageScripts(divname) {
	var arr = document.getElementById(divname).getElementsByTagName('script')
	//alert('found script -- length ' + arr.length);
	for (var n = 0; n < arr.length; n++) {
		//if (!debugappui) console.log('evaluating... ' + arr[n].innerHTML);
	    eval(arr[n].innerHTML);
	}
}

function afterusersetupscreenload() {
	afteranyscreenload();
	//loadPageScripts('app');
	stopSSEPolling();
	//displayAuthScale();
}

function analyzeauthimage(imgid) {
	//alert(imgid + ' image id in analyzeauthimage');
	var im = document.createElement('img');
	
	im.addEventListener('load', function() {
		displayauthimageanalyzer(im, imgid);
	});
	
	im.src = '/image/' + imgid;
	
	document.getElementById('app').appendChild(im);
	
}

function displayremoteuseronpage(userobj) {
	
	//if (!userobj.owner) {
		
		//alert('owner ' + userobj.owner);
		
		var cdiv = document.createElement('div');
		cdiv.classList.add('circle-remote');
		//cdiv.classList.add('circle-remote-animated');
		
		var gx = userobj.gridlocation.split(',')[0];
		var gy = userobj.gridlocation.split(',')[1];
		
		if (gx.length > 2) {
			var lendiff = gx.length -2;
			
			gx = parseInt(gx)/Math.pow(10, lendiff); // this is in percent
			var winwid = window.innerWidth;		
			gx = parseInt((winwid * gx)/100);    	
		}
		
		if (gy.length > 2) {
			var lendiff = gy.length - 2;
			
			gy = parseInt(gy)/Math.pow(10, lendiff); // this is in percent
			var winh = document.getElementById('app').clientHeight;		
			gy = parseInt((winh * gy)/100) + 50;    	
		}
		
		//console.log('gx gy '+ gx  + ' ' + gy );
		
		cdiv.style.position = 'absolute'; 
		cdiv.style.left = gx + 'px'; 
		cdiv.style.top = gy + 'px';
		cdiv.style.backgroundColor = userobj.color;
		cdiv.style.zIndex = '70';
		
		var giveoutsizecorrection = userobj.giveOut.length * 3;
		var userinfo = document.createElement('div');
		userinfo.setAttribute('id', userobj.flake + '-circle-info');
		userinfo.style.position = 'absolute'; 
		userinfo.style.left = gx - parseInt(giveoutsizecorrection) + 'px'; 
		//userinfo.style.width = "200px";
		userinfo.style.height = "20px";
		userinfo.style.top = gy + 10 + 'px';
		userinfo.style.opacity = "0.6";
		userinfo.style.color = "#eaeaea";
		userinfo.style.zIndex = '80';
		userinfo.style.display = 'none';
		
		userinfo.appendChild(document.createTextNode(userobj.giveOut + '[' + userobj.flake.substring(0,4) + '...]'));
		
		cdiv.addEventListener('mouseover', function() {
			//alert('mouseove called. giveout ' + userobj.giveOut);
			//alert('mouseover called');
			fadeinviajquery( userobj.flake + '-circle-info','fast');
		});
		
		cdiv.addEventListener('mouseout', function() {
			//alert('mouseove called. giveout ' + userobj.giveOut);
			fadeoutviajquery( userobj.flake + '-circle-info','fast');
		});
		
		cdiv.addEventListener('click', function() {
			//alert('mouseove called. giveout ' + userobj.giveOut);
			showflakepageinapp(userobj.flake);
		});
		
		document.getElementById('app').appendChild(cdiv);	
		document.getElementById('app').appendChild(userinfo);	
		
		fadeinviajquery( userobj.flake + '-circle-info','fast');
		
		setTimeout(function() {
			//alert('timeout called');
			fadeoutviajquery( userobj.flake + '-circle-info','slow');
		}, 2000);
	//}
}

function fadeinviajquery(elemid,sp) {
	//console.log('mouseove called... in fadeinviajquery ' + elemid);
	var speed = sp || 'fast';
	document.getElementById(elemid).display='block';
	$('#'+elemid).fadeIn(speed);
}

function fadeoutviajquery(elemid,sp) {
	var speed = sp || 'slow';
	$('#'+elemid).fadeOut(speed);
}

function fadeincircleinfo(elem,sp) {
	var speed = sp || 'fast';
	var cinfoelemid = elem.getElementsByClassName('circle-info')[0].id;
	//console.log('current display value for div ' + document.getElementById(cinfoelemid).style.display);
	document.getElementById(cinfoelemid).style.display = 'block';
	//console.log('new display value for div ' + document.getElementById(cinfoelemid).style.display);
	//$("#"+cinfoelemid).fadeIn();
}

function fadeoutcircleinfo(elem,sp) {
	var speed = sp || 'slow';
	var cinfoelemid = elem.getElementsByClassName('circle-info')[0].id;
	
	document.getElementById(cinfoelemid).style.display = 'none';
	//$('#'+cinfoelemid).fadeOut(speed);
}

function displayauthimageanalyzer(img, imgid) {
	//alert(img + ' image object in displayauthimageanalyzer');
	
	var imganlzrdiv = document.createElement("div");
	imganlzrdiv.classList.add('modal');	
	//imganlzrdiv.classList.add('modal');	
	//imganlzrdiv.classList.add('fade');	
	imganlzrdiv.setAttribute("id", "createuser-flake-overlay");
	imganlzrdiv.style.backgroundColor = '#ffffff';
	
	let closeanchor = document.createElement('span');
    closeanchor.innerHTML = '&times;';
    closeanchor.style.float='right';
    closeanchor.style.padding= '2px 7px';
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
    	$('#createuser-flake-overlay').fadeOut(500);
    	removediv(document.getElementById('createuser-flake-overlay'));
    	//alert('removed overlay');
    	//loadWelcome();
    	//fadeoutelement('app');
    });
    imganlzrdiv.appendChild(closeanchor);
 
	
	var modaldiag  = document.createElement("div");	
	//modaldiag.classList.add('modal-dialog');	
	//modaldiag.classList.add('modal-lg');	
	
	var modalcont  = document.createElement("div");	
	//modalcont.classList.add('modal-content');	
	
	
	var imgrow  = document.createElement("div");	
	imgrow.classList.add('panel');	
	imgrow.style.margin = '0 auto';
	//imgrow.classList.add('text-center');	
	
	var imgcan  = document.createElement("div");
	imgcan.setAttribute("id", "imganalyzercanvasdiv");
	
	var newsz = getnewimagesize(img);
	
	
	imgcan.style.maxHeight = 'inherit';
	imgcan.style.maxWidth = 'inherit';
	
	var can = document.createElement('canvas');
	
	var newsz = getnewimagesize(img);
	can.width = newsz.width;
	can.height = newsz.height;
	
	imgcan.addEventListener('click', function(evt) {
		analyzeauthimageclick( imgid, img, can,newsz, evt)
	}, false);
	
	
	var context = can.getContext("2d");
	context.drawImage(img, 0,0, can.width, can.height);

	
	imgcan.appendChild(can);
	
	imgrow.appendChild(imgcan);
	
	var analysisoutputdiv = document.createElement("div");
	analysisoutputdiv.classList.add('panel');
	
	var clkp = document.createElement('p');
	clkp.setAttribute('id', 'authimganalysisclick');
	
	//analysisoutputdiv.appendChild(document.createElement('br'));
	analysisoutputdiv.appendChild(clkp);
	
	var p = document.createElement('p');
	p.setAttribute('id', 'authimganalysisoutput');
	p.classList.add('lead');
	
	var x = document.createElement("INPUT");
	x.setAttribute("type", "checkbox");
	x.setAttribute("id", "plot-click-map-check");
	analysisoutputdiv.appendChild(x);
	analysisoutputdiv.appendChild(document.createTextNode(" Plot click spatter"))
	analysisoutputdiv.appendChild(document.createElement('br'));
	analysisoutputdiv.appendChild(p);
	
	
	modalcont.appendChild(imgrow);
	modalcont.appendChild(analysisoutputdiv);
	
	
	modaldiag.appendChild(modalcont);
	
	imganlzrdiv.appendChild(modaldiag);	
	
	document.getElementById('app').appendChild(imganlzrdiv);
	//context.save();

	//$("#image-analyzer-modal").modal('show');
	$("#createuser-flake-overlay").show();
}

function analyzeauthimageclick(imgid, image, imgcan, newsz, evt) {
	var mousePos2 = getMousePos2(imgcan, evt);
    x = mousePos2.x;
    y = mousePos2.y;
    
    var step = 10;
    var iterations = 100;
    
    var loops = parseInt(Math.sqrt(iterations)/2);
    var ran = 0;
    
    getandplotclickdatafromdb(x, y, imgid, imgcan, true, image);
    
   // alert('Checked element value ' + document.getElementById('plot-click-map-check').checked);
    
    if (document.getElementById('plot-click-map-check').checked == true) {
	    for (var w=0; w<loops; w++) {
	    	for (var h=0; h<loops; h++) {
	    		
	    		var tempx1 = x- (w*step);
	    		var tempx2 = x + (w*step);
	    		
	    		var tempy1 = y- (h*step);
	    		var tempy2 = y + (h*step);
	    		
	    		if ( tempx1 >= 0 && tempx1 <= imgcan.width && tempy1 >= 0 && tempy1 <= imgcan.height) {
	    			//console.log('checking ' + tempx1 + ',' + tempy1);
	    			getandplotclickdatafromdb(tempx1, tempy1, imgid, imgcan);
	    		}
	    		
	    		if (w == 0 && h ==0) continue;
	    		
	    		if ( tempx2 >= 0 && tempx2 <= imgcan.width && tempy2 >= 0 && tempy2 <= imgcan.height) {
	    			//console.log('checking ' + tempx2 + ',' + tempy2);
	    			getandplotclickdatafromdb(tempx2, tempy2, imgid, imgcan);
	    		}
	    		
	    		if (w == 0 || h ==0) continue;
	    		
	    		if ( tempx1 >= 0 && tempx1 <= imgcan.width && tempy2 >= 0 && tempy2 <= imgcan.height) {
	    			//console.log('checking ' + tempx1 + ',' + tempy1);
	    			getandplotclickdatafromdb(tempx1, tempy2, imgid, imgcan);
	    		}
	    		
	    		if ( tempx2 >= 0 && tempx2 <= imgcan.width && tempy1 >= 0 && tempy1 <= imgcan.height) {
	    			//console.log('checking ' + tempx1 + ',' + tempy1);
	    			getandplotclickdatafromdb(tempx2, tempy1, imgid, imgcan);
	    		}
	    		
	    		ran++;
	    	}
	    }
    }
    
   // console.log('queried ' + ran*4 + ' points')
    
}

function getandplotclickdatafromdb(x,y,imgid, imgcan,printtext, image) {
	var clkresponse = JSON.stringify({
 	   	imgID: imgid,
   	   	delay: 0,
   	   	clickX: parseInt(x),
   	    clickY: parseInt(y),
   	    imgWidth: imgcan.width,
   	    imgHeight: imgcan.height	
   		});	  	

	if (typeof printtext != 'undefined' && printtext == true)
		document.getElementById('authimganalysisclick').innerText = parseInt(x) + ',' + parseInt(y);
    
    var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
    xhr.open('POST', '/newauth/api/analyzeauthimageclick', false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    xhr.onreadystatechange = function() {
  	  
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var pct = xhr.responseText.split(' ')[0];
        	drawcircleoverimage(imgcan, x, y, 4, pct);
        	
        	if (typeof printtext != 'undefined' && printtext == true) {
        		var txt = xhr.responseText;
        		document.getElementById('authimganalysisoutput').innerHTML = '';
        		document.getElementById('authimganalysisoutput').appendChild(document.createTextNode(txt.split(' ')[0]+' '));
        		document.getElementById('authimganalysisoutput').appendChild(document.createTextNode(txt.split(' ')[1]+' '));
        		document.getElementById('authimganalysisoutput').appendChild(document.createTextNode(txt.split(' ')[2]+' '));
        		document.getElementById('authimganalysisoutput').appendChild(document.createTextNode(txt.split(' ')[3]+' '));
        		var storedhash = txt.split(' ')[4];
        		var newhash = txt.split(' ')[7];
        		
        		//alert('storedhash ' + storedhash);
        		
        		for (var l=0; l < storedhash.length; l++ ) {
        			var el = document.createElement('a');
        			
        			el.addEventListener('mouseover', 
        				displayhashportiononimage.bind(this, image, imgcan, storedhash, l)
        			);
        			el.appendChild(document.createTextNode(storedhash.charAt(l)));
        			//lnkstd += '<a href="#" onclick="displayhashportiononimage(imgcan,'+storedhash+','+l+');">' + storedhash.charAt(l) + '</a>';
        			document.getElementById('authimganalysisoutput').appendChild(el);
        		}
        		
        		document.getElementById('authimganalysisoutput').appendChild(document.createTextNode(' ' + txt.split(' ')[5]+' '));
        		document.getElementById('authimganalysisoutput').appendChild(document.createTextNode(txt.split(' ')[6]+' '));
        		
        		for (var l=0; l < newhash.length; l++ ) {
        			var el = document.createElement('a');
        			
        			el.addEventListener('mouseover', 
        				displayhashportiononimage.bind(this, image, imgcan, newhash, l)
        			);
        			el.appendChild(document.createTextNode(newhash.charAt(l)));
        			//lnkstd += '<a href="#" onclick="displayhashportiononimage(imgcan,'+storedhash+','+l+');">' + storedhash.charAt(l) + '</a>';
        			document.getElementById('authimganalysisoutput').appendChild(el);
        		}
        		
        		//document.getElementById('authimganalysisoutput').appendChild(document.createTextNode(txt.split(' ')[7]));
        	}
                 	
        }
        	
     };
   
     if (parseInt(x) >= 0 && parseInt(y) >= 0 && parseInt(x) <= imgcan.width && parseInt(y) <= imgcan.height)
    	 xhr.send(clkresponse);
     else
    	 document.getElementById('authimganalysisoutput').innerText = '';
    
}

function displayhashportiononimage(img, cnvs, hash, idx) {
	hash += '';
	//alert(hash + ' ' + idx);
	//alert('char at ' + idx + ' position is: ' + hash.charAt(parseInt(idx)));
	//console.log('index ' + idx);
	
	var slicewidth = cnvs.width/Math.pow(2, idx+1);
	var sliceheight = cnvs.height/Math.pow(2,idx+1);
	
	var slicex = 0;
	var slicey = 0;
	
	for (var s=0; s<=idx; s++) {
		if (hash.charAt(parseInt(s)) == 2 || hash.charAt(parseInt(s)) == 4) {
			
				slicex += cnvs.width/Math.pow(2, s+1);
		}
		
		if (hash.charAt(parseInt(s)) == 3 || hash.charAt(parseInt(s)) == 4) {
			
				slicey += cnvs.height/Math.pow(2, s+1);
		}
		//console.log(s + ' '9 + slicex + ',' + slicey);
	}
	
	drawrectangleoverimage(img, cnvs, parseInt(slicex), parseInt(slicey),  parseInt(slicewidth), parseInt(sliceheight));
	return false;
}

function displayflakeinmodal(flake) {
	
	//var appelem = document.getElementById('app');
	var flakemod = document.getElementById('flake-display-modal');
	
	if (flakemod == null) {
		//alert(flake + ' from within displayflakemodal');
		flakemod  = document.createElement("div");
		flakemod.classList.add('modal');	
		flakemod.classList.add('fade');	
		flakemod.setAttribute("id", "flake-display-modal");
		
		var modaldiag  = document.createElement("div");	
		modaldiag.classList.add('modal-dialog');	
		modaldiag.classList.add('modal-md');	
		
		var modalcont  = document.createElement("div");	
		modalcont.classList.add('modal-content');	
		
		var namerow  = document.createElement("div");	
		//namerow.classList.add('row');	
		namerow.classList.add('panel');	
		namerow.classList.add('text-center');	
		
		var p = document.createElement('p');
		p.style.color = '#121212';
		p.classList.add('lead');	
		p.appendChild(document.createTextNode(fullname));
		
		namerow.appendChild(p);
		
		var flakepagebtn = document.createElement('IMG');
		flakepagebtn.src = '/static/icons/new-page.png';
		flakepagebtn.width = '24';
		flakepagebtn.title = 'Display flake page';
		flakepagebtn.onclick = function() {
			//alert('will show flke page' + flakejsonobj.flake);
			showflakepageinapp(flakejsonobj.flake);
		};
		
		flakepagebtn.onmouseenter = function() {
			flakepagebtn.style.border = '2px solid gray';
		};
		
		flakepagebtn.onmouseout = function() {
			flakepagebtn.style.border = 'none';
		};
		
		//namerow.appendChild(flakepagebtn);
		
		//modalcont.appendChild(namerow);   // removing this because flake page is now th default screen after login
		
		
		var frow  = document.createElement("div");	
		//namerow.classList.add('row');	
		frow.classList.add('panel');	
		frow.classList.add('text-center');	
		frow.setAttribute('id', 'flake-modal-flake-text-container');
		
		var p = document.createElement('p');
		p.style.color = '#626262';
		p.style.maxWidth = '50%';
		p.style.textAlign = 'center';
		p.style.margin = '0 auto';
		p.style.border = '1px solid darkgrey';
		//p.classList.add('btn-default');	
		p.appendChild(document.createTextNode(loggedinuserflake));
		p.setAttribute('id', 'flake-select-text');
		
		p.addEventListener("click", flakeclickhandler); 
		
		frow.appendChild(p);
		
		modalcont.appendChild(frow);
		
		
		
		var flakerow  = document.createElement("div");	
		//flakerow.classList.add('row');	
		flakerow.classList.add('panel');	
		flakerow.classList.add('text-center');	
		
		var flakecan  = document.createElement("div");
		flakecan.setAttribute("id", "flakecanvasdivmodal");
		
		flakerow.appendChild(flakecan);
		
		modalcont.appendChild(flakerow);		
		
		modaldiag.appendChild(modalcont);
		
		flakemod.appendChild(modaldiag);
		
		
		document.getElementById('app').appendChild(flakemod);
		
		//alert(JSON.stringify(flakejsonobj));
		if (flakejsonobj != null) {
		
			generateFlakeOnCanvas('flakecanvasdivmodal', flakejsonobj, 300, 300, 'medium' , 'false');
		} else if (flake != null) {
			
			generateFlakeOnCanvas('flakecanvasdivmodal', flake, 300, 300, 'medium' , 'false');
		}
	}
		
	$("#flake-display-modal").modal('show');
	
}

function flakeclickhandler(evt){ 			
	
	if (evt.target.textContent.length > 40) {
		//alert('showing full flake. revert to flake');
		//evt.target.innerHTML = '';
		//evt.target.innerHTML = '<u>' + loggedinuserflake + '</u>';
		//document.getElementById('flakecanvasdivmodal').innerHTML = '';
		//flakejsonobj.fullflake = null;
		document.getElementById('flakecanvasdivmodal').innerHTML = '';
		generateFlakeOnCanvas('flakecanvasdivmodal', flakejsonobj, 300, 300, 'medium' , false);
	} else {
		//alert('showing flake. go to full flake');
		var url = "/newauth/api/fullflakeforuser"  ;
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	        	if (xhr.responseText != null && xhr.responseText.length > 0) {
		        	flakejsonobj.fullflake= xhr.responseText;
		        	//evt.target.innerHTML = '';
		        	//evt.target.innerHTML = '<u>' + loggedinuserflake + '</u>' + flakejsonobj.fullflake.substring(16,flakejsonobj.fullflake.length);
					
		        	if (document.getElementById('flake-modal-flake-text-container').children.length == 1) {
			        	var p = document.createElement('p');
			    		p.style.color = '#626262';
			    		p.style.maxWidth = '60%';
			    		p.style.textAlign = 'center';
			    		p.style.margin = '0 auto';
			    		p.style.border = '1px solid darkgrey';
			    		//p.classList.add('btn-default');	
			    		p.appendChild(document.createTextNode(flakejsonobj.fullflake));
			    		p.setAttribute('id', 'full-flake-select-text');
			    		
			    		p.addEventListener("click", flakeclickhandler); 
			    		document.getElementById('flake-modal-flake-text-container').appendChild(document.createElement('br'));
			        	document.getElementById('flake-modal-flake-text-container').appendChild(p);
		        	}
		        	
		        	document.getElementById('flakecanvasdivmodal').innerHTML = '';
					//generateFlakeOnCanvas('flakecanvasdivmodal', flakejsonobj.flake, 300, 300, 'medium' , false);
												
					flakegeneratorintid = setInterval(function(){ 
						
								if (flakejsonobj.fullflake != null && genericcounter < (flakejsonobj.fullflake.length -15)) {
									document.getElementById('flakecanvasdivmodal').innerHTML = '';
									//generateFlakeOnCanvas('flakecanvasdivmodal', flakejsonobj.fullflake.substring(0,flakejsonobj.flake.length+genericcounter), 300, 300, 'medium' , false);
									flakejsonobj.flake = flakejsonobj.fullflake.substring(0,16+genericcounter);
									//console.log(genericcounter + ' ' + flakejsonobj.fullflake + ' ' + flakejsonobj.flake);
									generateBottomPartOfFlakeOnCanvas('flakecanvasdivmodal', flakejsonobj, 300, 300, 'medium' , false);
									genericcounter++;
								} else {
									genericcounter = 0;
									if (flakejsonobj.fullflake != null)
										flakejsonobj.flake = flakejsonobj.fullflake.substring(0,16);
									clearInterval(flakegeneratorintid);
								}
							}, 75*(1/(1+genericcounter))
						);
					
	        	} else {
	        		console.log('No full flake returned by server');
	        	}
	        }
	    }
		
	    xhr.open('POST', url , false);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');     
	   
	     var reqpacket = JSON.stringify({
	    	 					flake: loggedinuserflake
							});
		xhr.send(reqpacket);
		
	}
	if (document.selection) { // IE
        var range = document.body.createTextRange();
        range.moveToElementText(evt.target);
        range.select();
        evt.target.style.backgroundColor = '#cecece';
    } else if (window.getSelection) {
        var range = document.createRange();
       // range.selectNode(evt.target);
        range.selectNodeContents(evt.target);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        evt.target.style.backgroundColor = '#cecece';
    }
	try {
	    var successful = document.execCommand('copy');
	    var msg = successful ? 'successful' : 'unsuccessful';
	    if (debugappui) console.log('Copying text command was ' + msg);
	    
	    if (window.getSelection) {
	    	window.getSelection().removeAllRanges();
	    } else if (document.selection) {
	    	document.selection.empty();
	    }
	  } catch (err) {
	    if (debugappui) console.log('Oops, unable to copy');
	  }
	  
	  if (evt.target.id == 'full-flake-select-text')
		  document.getElementById('flake-select-text').style.backgroundColor = '#ffffff';
	  
	  if (evt.target.id == 'flake-select-text') {
		  if (document.getElementById('full-flake-select-text') != null)
			  document.getElementById('full-flake-select-text').style.backgroundColor = '#ffffff';
	  }
}

function loadCreateUserPage(ref)
{
	removehighlights();
	fadeoutelement('app');
	
	if (typeof ref != 'undefined')
		loadUrlAjax('/createUser?ref='+ref, 'app');
	else
		loadUrlAjax('/createUser', 'app');
	
	document.title = 'Newauth - Create User';
    return false;
    
}

function fadeoutelement(divId) {
	/*if (document.getElementById(divId).classList.contains("show-na")) {
		document.getElementById(divId).classList.remove("show-na");
	}
	if (!document.getElementById(divId).classList.contains("hide-na")) {
		document.getElementById(divId).classList.add("hide-na");
	}
	*/	
	
	document.getElementById(divId).classList.toggle("show-na", false); 
	document.getElementById(divId).classList.toggle("hide-na", true); 
	//console.log('fading OUT ' + divId);
	
	displayloadingicon();	
		
}

function fadeinelement(divId) {
	/*if (document.getElementById(divId).classList.contains("hide-na")) {
		document.getElementById(divId).classList.remove("hide-na");
	}
	
	if (!document.getElementById(divId).classList.contains("show-na")) {
		document.getElementById(divId).classList.add("show-na");
	}*/
	//alert('document.getElementById(divId) '+ document.getElementById(divId));
	
	
	if (document.getElementById(divId) != null) {
		
		if (document.getElementById(divId).style.display == 'none') {
			document.getElementById(divId).style.display = 'block';
		}
		//alert('toggling classes');
		document.getElementById(divId).classList.toggle("hide-na", false); 
		document.getElementById(divId).classList.toggle("show-na", true); 
	}
	//console.log('fading IN ' + divId);
}


function announceapptimeouterror() {
	showAppTimeoutDialog();
}

function displayloadingicon() {
	//var displayicondiv =document.querySelector('#loadingiconcontainer');
	var displayicondiv =  document.getElementById("displayloadingcontainer");
	//alert('found loading container');
	
	if (displayicondiv != null) {
		displayicondiv.style.display='inline-block'; 
		
		displayicondiv.style.opacity = '1';
		
		if (appcalltimeoutid == null)
			appcalltimeoutid = setTimeout(announceapptimeouterror, apptimeoutduration);
		
		console.log('setting  appcalltimeoutid in displayloadingicon '+ appcalltimeoutid);
	}
	//console.log('displaying loading icon');
}

function hideloadingicon() {
	//var displayicondiv =document.querySelector('#loadingiconcontainer');
	var displayicondiv =  document.getElementById("displayloadingcontainer");
	//alert('found displayloadingcontainer ' + displayicondiv);
	if (displayicondiv != null) {
		displayicondiv.style.display='none'; 
		fadeinelement('app');
		if (appcalltimeoutid != null) {
			console.log('clearing  appcalltimeoutid in hideloadingicon '+ appcalltimeoutid);
			clearTimeout(appcalltimeoutid);
		}
		appcalltimeoutid = null;
		
	}
	
	//removediv(displayicondiv);
}



function loaddisabledcreatemessage(refflake)
{
	
	//alert('Create account is currently available only from desktop devices. ');
	mobileusercreate(refflake);
    return false;
    
}



// fade in

function fadeIn(el, display) {
	el.style.opacity = 0;
	el.style.display = display || "block";

	(function fade() {
		var val = parseFloat(el.style.opacity);
		if (!((val += .1) > 1)) {
			el.style.opacity = val;
			requestAnimationFrame(fade);
		}
	})();
}

var waitForFinalResizeEvent = (function() {
	var timers = {};
	return function(callback, ms, uniqueId) {
		if (!uniqueId) {
			uniqueId = "Don't call this twice without a uniqueId";
		}
		if (timers[uniqueId]) {
			clearTimeout(timers[uniqueId]);
		}
		timers[uniqueId] = setTimeout(callback, ms);
	};
})();

/*window.addEventListener('resize', function() {
	waitForFinalResizeEvent(function() {

		
		var newar = window.innerWidth / window.innerHeight;
		newar = Math.round(newar * 100) / 100;
		var el = document.querySelector('.js-fade');

		if (typeof e1 !== undefined && e1) {
			el.innerHTML = newar;
			fadeIn(el);
			// fadeIn(el, "inline-block");
			setTimeout(fadeOut(el), 4000);
		}

	}, 500, "some unique string");
});*/

function authenticate(userflake, elem) {
	
	//var hash = hashUserForAuthentication(user);
	//alert('sending hash ' +  user);
	//elem.getElementByTagName("a")[0].style.color='#ebebeb';
	//elem.classList.add("clicked-once");
	
	//var username = userflake;
	removehighlights();

	fadeoutelement('app');
	var url = "/newauth/authenticate/" + userflake + "/" + 
			window.screen.availWidth
			+ "/" + window.screen.availHeight + "/" + window.innerWidth + "/"
			+ window.innerHeight;

	//location.href = url;
	
	//alert(pos.x + ' ' + pos.y);
	//displaypageloadingdiv(elem);
	loadUrlAjax(url, 'app');
	
	return false;
}

function showwelcomepage() { // This actually takes to welcome screen
	//alert('clicked');
	// remove reauthoverlay if present
	fadeoutelement('app');
	removeactivitylisteners();
	var reaudiv = document.getElementById("re-auth-overlay");
		
	while (reaudiv.hasChildNodes()) {
		reaudiv.removeChild(reaudiv.firstChild);
	}
	reaudiv.style.display = "none";
	
	var url = "/newauth/welcome"  ;
	
	//location.href = url;
	//loadUrlAjax('/header?page=setupUser', 'app-header');
	loadUrlAjax(url, 'app');
	document.title = 'Newauth Home';
	
	return false;
}

function setupUser(obj) {
	
	var url = "/newauth/setupUser"  ;
	fadeoutelement('app');
	//location.href = url;
	//loadUrlAjax('/header?page=setupUser', 'app-header');
	//displaypageloadingdiv(obj);
	loadUrlAjax(url, 'app');
	document.title = 'Newauth - Setup User';
	
	return false;
}

function showPrivateDataPage(obj) {
	
	//alert('showPrivateDataPage called');
	
	if (!document.getElementById('securePage').classList.contains('disabled')) {
		var url = "/newauth/securePage"  ;
		fadeoutelement('app');
		//location.href = url;
		//return false;
		//displaypageloadingdiv(obj);
		loadUrlAjax(url, 'app');
		fadeinelement('app')
		document.title = 'Newauth - Vault';
	}
	return false;
}

function showOrgPage (flake, orgid) {
	
	var url = "/newauth/orgPage/"+flake+"/"+orgid  ;
	fadeoutelement('app');
	//location.href = url;
	//return false;
	//displaypageloadingdiv(obj);
	//loadUrlAjax(url, 'app');
	loadOrgPage(flake, orgid);
	document.title = 'Newauth - Org';
	return false;
}

function showPublicPage(elem) {
	//if (publicpagelinkclicked == true) return false;
	
	//elem.classList.add("clicked-once");
	if (!document.getElementById('publicPage').classList.contains('disabled')) {
		fadeoutelement('app');
		var url = "/newauth/publicPage"  ;
		//publicpagelinkclicked = true;
		//location.href = url;
		//return false;
		//displaypageloadingdiv(elem);
		loadUrlAjax(url, 'app');
		document.title = 'Newauth - Live';
	}
	
	return false;
}

function showBrandPage(elem, brandname) {
	//if (publicpagelinkclicked == true) return false;
	
	//elem.classList.add("clicked-once");
	if (!document.getElementById('brandPage').classList.contains('disabled')) {
		fadeoutelement('app');
		var url = "/t/" + brandname  ;
		//publicpagelinkclicked = true;
		//location.href = url;
		//return false;
		//displaypageloadingdiv(elem);
		//loadUrlAjax(url, 'app');
		
		showurloverapp(url);
		document.title = brandname + ' At Newauth';
		
		
	}
	
	return false;
}

function logOut() {
	//alert('logging out flake: ' + loggedinuserflake);
	//document.getElementById('app').classList.remove("show-na");
	fadeoutelement('app');
	//document.getElementById('app').innerHTML = '';
	var url = "/newauth/logout"  ;
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	//removeInfoFromClipboard(); // remove any copied passwords from clipboard
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	
    		//document.open();
    		//document.write(xhr.responseText);  
    		//document.close();
    		
        	//document.body.innerHTML = xhr.responseText;
        	//afterWelcomePageLoad();
        	
        	loadWelcome();
    		
        }
    }
	
    xhr.open('POST', url , true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
     var reqpacket = JSON.stringify({
    	 					flake: loggedinuserflake
						});
	xhr.send(reqpacket);
	return false;
}

function burnFlake() {
	//document.getElementById('app').classList.remove("show-na");
	var url = "/newauth/burnflake"  ;
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	removeInfoFromClipboard(); // remove any copied passwords from clipboard
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//document.open("text/html", "replace");
    		//document.write(xhr.responseText);  
    		//document.close();
    		loadWelcome();
        }
    }
	
    xhr.open('POST', url , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
     var reqpacket = JSON.stringify({
    	 					flake: loggedinuserflake
						});
	xhr.send(reqpacket);
	return false;
}

function removeInfoFromClipboard() {
	//alert(evt.clientX + ':' +evt.clientY);
	
	var dummy = document.createElement("input");
    document.body.appendChild(dummy);
    dummy.setAttribute('value', 'NOPASSWORDSHERE');
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
    
    console.log('Cleared data from Clipboard');
}


function copytexttocbandhighlight(txt, highlight, evt) {
		var dummy = document.createElement("input");
    	document.body.appendChild(dummy);
    	dummy.setAttribute('value', txt);
    	dummy.select();
    	document.execCommand("copy");
    	document.body.removeChild(dummy);
    	displaybuttonbehavior(evt, highlight);    
	    //console.log('Copied password to Clipboard');
	}

function loadHome() {
	
	if (!document.getElementById('home').classList.contains('disabled')) {
		fadeoutelement('app');
		var url = "/newauth/home"  ;
		
		//location.href = url;
		//loadUrlAjax('/header?page=setupUser', 'app-header');
		loadUrlAjax(url, 'app');
		document.title = 'Newauth - Home';
	}
	
	return false;
}

function loadWelcome() {
	fadeoutelement('app');
	var url = "/newauth/welcome?appOnly=true"  ;
	
	//loadUrlAjax(url, 'app');
	window.location.assign('/');
	document.title = 'Newauth';
	
	return false;
}


function convertusernametohash() {
	
	var user = document.forms[0].username.value;
	
	var hash = hashUserForAuthentication(user);
	
	vaultkey = user;
	if (document.forms[0].elements.namedItem("usernameclear") != null) {
		document.forms[0].usernameclear.value=user;
	}
	
	document.forms[0].username.value=hash;
}

function submitcreatewithuserhash() {
		
	if (document.getElementById('usernameprovided').value == null || document.getElementById('usernameprovided').value.length == 0) {
	
		if (!confirm('Please confirm the username  "' + document.getElementById("usernameinput").value
						+ '"  . Newauth Username is supposed to be only known to you. Newauth does not store it in clear. ' +
						' If you need to make a note of your username, do so now. Click OK to continue.')) {
		
			return false;
		}
	}
	
	console.log('updating screen dims');
	updatescreenandwindowdims(); // populate dimensions where applicable
	
	//$(this).prop("disabled",true); // disable the button so it can not be submitted again
		document.getElementById('createuserbtn').disabled = true;
		//convertusernametohash();	
		//document.forms['create-user-form'].submit();	
		
		document.title = 'Newauth - Create User';
		//loadUrlAjax('/newauth/header?page=createUser', 'app-header'); no need.. setup user will load the header
		
		submitFormAjax('/createUser', 'create-user-form');
			
	return false;
}

function populateUserKeyPair() {// public key is saved in User's profile and private key is saved as user's secure data
	
	var pair = sjcl.ecc.elGamal.generateKeys(384)
	var pub = pair.pub.get(), sec = pair.sec.get()

	// Serialized public key:
	pub = sjcl.codec.base64.fromBits(pub.x.concat(pub.y))
	// uQuXH/yeIpQq8hCWiwCTIMKdsaX...

	
	publickeyb64 = pub;
	
	document.forms['create-user-form'].publicKey.value = publickeyb64;
	
	// Serialized private key:
	sec = sjcl.codec.base64.fromBits(sec)
	// IXkJSpYK3RHRaVrd...
	
	privatekeyb64 = sec;
	
	if (document.forms[0] && document.forms[0].publicKey) {
	
		document.forms[0].publicKey.value = pub;	
		
		var user = document.forms[0].username.value;
		
		// Now we will encrypt this privatekey by generating 
		// a stretched key derived from username, a random salt and iterations count
		//var itns = 10000;
		//var ssalt = sjcl.random.randomWords(1, 7);	
		
		//var encprivkey = sjcl.encrypt(user, sec,
		//					{
		//						ks: 256, 
		//						salt: ssalt, 
		//						iter: itns
		//					}
		//				);
		//alert('Before encrypt pvt key.');		
		
		//var encprivkey = encryptdatawithstretchedkey(privatekeyb64, user,'',0);
		var encprivkey = ''; // do not encrypt here will do later
		
		//alert('After encrypt pvt key.');
		document.forms[0].encprivatekey.value = encprivkey;
	}
	
}

function getEncMessageUsingPublickey(message, pub64) {
	var pub = new sjcl.ecc.elGamal.publicKey(
		    sjcl.ecc.curves.c384,
		    sjcl.codec.base64.toBits(pub64)
		);
	
	return sjcl.encrypt(pub, message);
}

function getDecMessageUsingPrivateKey(encmessage, encprivkey, user) {
	var decrypprivkey =  sjcl.decrypt(user, encprivkey);
	
	var sec = new sjcl.ecc.elGamal.secretKey(
		    sjcl.ecc.curves.c384,
		    sjcl.ecc.curves.c384.field.fromBits(sjcl.codec.base64.toBits(decrypprivkey))
		);
	
	return sjcl.decrypt(sec, encmessage);
}








function loadExtUrl(url, id, pwd) {
	
	if (!url.startsWith("http")) {
		url = 'http://' + url;
	}
	
	//url = "https://localhost:8443/newauth/welcome?df564d554ht6ffs54=Y";
	
	var win = window.open(url, '_blank');
	  
	  win.onload = function() {
		  //alert('in onload');
		  win.focus();
		 // alert('title ' + win.document.title + 'forms length ' + win.document.forms.lenth);
	  };
}

function submitwithuserhash() {
	clearInterval(imgcheckinterval);
	if (document.forms[0].username.value.length < 6) {
		var x = document.getElementById('username');
		x.placeholder = 'Enter Username (min 6 letters)';
		x.style.border = '2px solid red';
		setTimeout(function() {
				x.placeholder = 'User name';
				x.style.border = '1px solid #aeaeae';
			}, 3000);
		return false;
	} else {
		var x = document.getElementById('login-button');
		if (x != null) {
			x.style.transform = 'scale(1.3)';
			x.style.opacity = 1;
		}
	}
	
	fadeoutelement('app');
	convertusernametohash();
	//document.forms[0].submit();	
	document.title = 'Newauth - Authenticate';
	
	//if (document.getElementById('app-header') != null)
	//	loadUrlAjax('/newauth/header?page=authenticate&authMessage=If%20you%20do%20not%20recognize%20the%20images,%20check%20the%20profile%20you%20clicked%20on.', 'app-header');
	
	submitFormAjax('/newauth/authenticate');
	
	return false;
}

function removehighlights() {
	var highlights = document.getElementsByClassName('highlight-text');
	for (var i = 0; i < highlights.length; i++) {
		var hg = highlights[i];
		//console.log('removing ' + hg.innerText);
		hg.style.display = 'none';
	}
}

function afterCreateUserPageLoad() {
	//wsconnect('/user/queue/usernamecheck');
	//populateUserKeyPair(); -- moving it after username check
	
	//document.getElementById("privkey").innerHTML = privatekeyb64;
	//document.getElementById("pubkey").innerHTML = publickeyb64;
	
	// commenting since this is getting fired twice
	//document.getElementById("usernameinput").addEventListener("change", checkUserName);
	
	if (appcalltimeoutid != null) {
		clearTimeout(appcalltimeoutid);
	}
	appcalltimeoutid = null;
	$('input[name="usertypeinputradio"]').change(function() {
		   if($(this).is(':checked') && $(this).val() == 1) {
		        $('#brandModal').modal('show');
		   }
		});
		
		document.getElementById('na-item-amount').innerText = '$' + computeSubPrice(1);
	
	document.getElementById('bus-subs-user-count-input').addEventListener('input', function(){
			var usercount;
			
			if (document.getElementById('bus-subs-user-count-input').value.length == 0) {
				document.getElementById('bus-user-count').innerText = 1;
				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(1);
				
				return;
			}
			
			try {
				usercount = parseInt(document.getElementById('bus-subs-user-count-input').value);
				
				document.getElementById('bus-user-count').innerText = usercount;
				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(usercount);
				} catch(ex) {
					document.getElementById('bus-subs-user-count-input').style.border = '2px solid red';
					
					setTimeout(function(){
						document.getElementById('bus-subs-user-count-input').style.border = '2px solid gray';
					}, 3000);
				}
	});
	
	document.getElementById('bus-vault-chk').addEventListener('change', function(){
		document.getElementById('bus-vault-chk').checked = 'true';
		return false;		
	});
	
	document.getElementById('app-topic-page-chk').addEventListener('change', function(){
		
		if (document.getElementById('bus-subs-user-count-input').value.length == 0) {
				document.getElementById('bus-user-count').innerText = 1;
				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(1);
				
				return;
			}
			var usercount = parseInt(document.getElementById('bus-subs-user-count-input').value);				
				document.getElementById('bus-user-count').innerText = usercount;				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(usercount);			
	});
	
	document.getElementById('bus-newauth-identity-chk').addEventListener('change', function(){
		
		if (document.getElementById('bus-subs-user-count-input').value.length == 0) {
				document.getElementById('bus-user-count').innerText = 1;
				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(1);
				
				return;
			}
			var usercount = parseInt(document.getElementById('bus-subs-user-count-input').value);				
				document.getElementById('bus-user-count').innerText = usercount;				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(usercount);			
	});
	
	document.getElementById('bus-newauth-pers-img-chk').addEventListener('change', function(){
		if (document.getElementById('bus-subs-user-count-input').value.length == 0) {
				document.getElementById('bus-user-count').innerText = 1;
				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(1);
				
				return;
			}
			var usercount = parseInt(document.getElementById('bus-subs-user-count-input').value);				
				document.getElementById('bus-user-count').innerText = usercount;				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(usercount);			
	});
	
	document.getElementById('bus-newauth-brand-img-chk').addEventListener('change', function(){
		if (document.getElementById('bus-subs-user-count-input').value.length == 0) {
				document.getElementById('bus-user-count').innerText = 1;
				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(1);
				
				return;
			}
			var usercount = parseInt(document.getElementById('bus-subs-user-count-input').value);				
				document.getElementById('bus-user-count').innerText = usercount;				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(usercount);			
	});
	
	document.getElementById('bus-newauth-export-data-chk').addEventListener('change', function(){
		if (document.getElementById('bus-subs-user-count-input').value.length == 0) {
				document.getElementById('bus-user-count').innerText = 1;
				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(1);
				
				return;
			}
			var usercount = parseInt(document.getElementById('bus-subs-user-count-input').value);				
				document.getElementById('bus-user-count').innerText = usercount;				
				document.getElementById('bus-sub-chg-amt').innerText = computeSubPrice(usercount);			
	});
}
	
function computeSubPrice(users) {
	var naidentity = document.getElementById('bus-newauth-identity-chk').checked;
	
	var apptopic = document.getElementById('app-topic-page-chk').checked;
				
	var napersimage = document.getElementById('bus-newauth-pers-img-chk').checked;
				
	var nabrandimage = document.getElementById('bus-newauth-brand-img-chk').checked;
				
	var nadataexport = document.getElementById('bus-newauth-export-data-chk').checked;
	
	var naidentitycharge=0, naapptopiccharge=0,napersimagecharge=0, nabrandimagecharge=0, nadataexportcharge=0;
	
	if (naidentity) naidentitycharge = 100 + 36*users;
	
	if (napersimage) napersimagecharge = 20*users;
	
	if (apptopic) naapptopiccharge = 10*users;
	
	if (nabrandimage) nabrandimagecharge = 1000;
	
	if (nadataexport) nadataexportcharge = 100;
	
	console.log('apptopic ' +  apptopic + 'naidentity ' +  naidentity + ' napersimage ' + napersimage + ' nabrandimage ' + nabrandimage + ' nadataexport ' + nadataexport);
	
	var chg = parseInt(users*79 + naapptopiccharge + naidentitycharge + napersimagecharge+ nabrandimagecharge+ nadataexportcharge);
	
	document.getElementById('na-item-amount').innerText = '$' + chg;
	return chg;
}

function createUserFlakeOverlay(allowcreatewithemail) {
	var flakeoverlay = document.getElementById("createuser-flake-overlay"); // this id is setup as blocking overlay
	
	if (flakeoverlay == null) {
		//alert('in createUserFlakeOverlay .. creating new overlay');
		flakeoverlay = document.createElement("div");
		flakeoverlay.setAttribute("id", "createuser-flake-overlay");
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
		panl.setAttribute("id", "createuser-overlay-content");
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
		    	$('#createuser-flake-overlay').fadeOut(500);
		    	removediv(document.getElementById('createuser-flake-overlay'));
		    	//alert('removed overlay');
		    	loadWelcome();
		    	//fadeoutelement('app');
		    });
		    coldiv.appendChild(closeanchor);
		 
		 var pdh = document.createElement('p');
		 pdh.classList.add('lead');
		 pdh.setAttribute("id", "createuser-flake-text-header");
		 
		 pdh.appendChild(document.createTextNode("Please enter the Flake you received in your invitation."));
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
		 
		 pd.appendChild(document.createTextNode("Currently, Newauth membership is by invitation only. Your invitation contains a token called flake. Please enter it below. A flake can also be found on the Welcome page after the web extension install."));
		 pd.style.color = "#878787"; 
		 pd.style.fontWeight = "600";
		 
		 var pd2 = document.createElement('p');
		 pd2.classList.add('text-muted');
		 pd2.setAttribute("id", "createuser-flake-text");
		 
		 pd2.appendChild(document.createTextNode("If you do not have a flake, please enter your email address to be added to the wait list."));
		 pd2.style.color = "#878787"; 
		 pd2.style.fontWeight = "500";
		
		 inputcolp.appendChild(pd);
		 
		 if (allowcreatewithemail.length > 0 && allowcreatewithemail == 'true') {
			 //alert('allowcreatewithemail found as ' + allowcreatewithemail);
			 inputcolp.appendChild(pd2);
		 }
		 inputrowp.appendChild(inputcolp);		 
		
		 panl.appendChild(inputrowp);
			
		 var inputrowc = document.createElement("div");
			inputrowc.classList.add('row');  
			inputrowc.classList.add('text-center');
			
			var candiv = document.createElement("div");
			candiv.setAttribute("id", "cu-flake-can");
			
			inputrowc.appendChild(candiv);	
		 
			panl.appendChild(inputrowc);
			
			
			
		 var inputdiv = document.createElement("div");
			inputdiv.classList.add('panel-body');
			inputdiv.classList.add('panel-word-wrap');
			//inputdiv.style.backgroundColor = "#c2c2c2"; 
			
			var inputrow  = document.createElement("div");
				inputrow.classList.add('row');
				
			var inputcol = document.createElement("div");
			inputcol.classList.add('col-sm-8');
			inputcol.classList.add('col-sm-offset-2');
			inputcol.setAttribute('id', 'create-flk-input-holder');
			
			inputrow.appendChild(inputcol);
			
			inputdiv.appendChild(inputrow);
			var cuflkinput = document.createElement("input");
			cuflkinput.setAttribute("type", "text");
			cuflkinput.setAttribute("id", "cu-flake-input");
			cuflkinput.setAttribute("autofocus", "true");
			cuflkinput.classList.add('form-control');
			cuflkinput.classList.add('input-md');
			//cuflkinput.addEventListener('input', prepareSendButton, false);
			cuflkinput.addEventListener('input', function(){ 
				
				var divtoclear = document.getElementById("cu-flake-can");
				cleardiv(divtoclear);
				var flk = document.getElementById('cu-flake-input').value;
				generateFlakeOnCanvas('cu-flake-can', flk, 64, 64, 'tiny');
				
				if (flk.length == 8 || flk.length == 16 || flk.length == 17) {
					$('#flk-send-button').fadeIn('slow');
				} else {
					document.getElementById('flk-send-button').style.display = 'none';
				}
				
				if (flk.indexOf('@') > 0) {
					document.getElementById('flk-send-button').value = 'Get Invite';
					document.getElementById('cu-flake-can').style.display = 'none';
					$('#flk-send-button').fadeIn('slow');
				}
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
			sendbutton.value = "Validate";
			sendbutton.style.display = 'none';
			sendbutton.addEventListener('click', validatecreateuserflake, false);			
			
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
		
		
		generateFlakeOnCanvas('cu-flake-can', null, 64, 64, 'tiny');

		  $('#cu-flake-input').focus();
	
	}
	
	
	settimeoutid = setTimeout(function(){ 
				//flakeoverlay.style.display = "block";
				$('#createuser-flake-overlay').fadeIn('slow');
			}, 500);
	
}


function validatecreateuserflake() {
	document.getElementById('cu-flake-input').style.borderColor = 'default';
	var flk = document.getElementById('cu-flake-input').value;
	
	if (flk == null || flk.length == 0) {
		return false;
	}
	
	var url = "/newauth/api/validateFlake"  ;
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert(xhr.responseText);
        	var respjsonobj = JSON.parse(xhr.responseText);
        	if (respjsonobj.status.statuscode == 'VALID') {
        		document.forms['create-user-form'].refflake.value = document.getElementById('cu-flake-input').value;
        		$('#createuser-flake-overlay').fadeOut(500);
        		removediv(document.getElementById('createuser-flake-overlay'));
        	} else if (respjsonobj.status.statuscode == 'EMAIL-SENT') {
        		var contpan = document.getElementById('createuser-overlay-content');
        		cleardiv(contpan);
        		
        		var p = document.createElement('h4');
        		// p.classList.add('lead');
        		 
        		p.appendChild(document.createTextNode('An invite has been sent to ' + flk + '. Please check and follow the instructions there.'));
        		 p.style.color = "#737373"; 
        		 p.style.fontWeight = "200"; 
        		
        		 contpan.appendChild(p);
        		 
        		 var p2 = document.createElement('h5');
         		// p.classList.add('lead');
         		 
         		p2.appendChild(document.createTextNode('If you do not find an email from Newauth in your Inbox, please check your Spam folder.'));
         		 p2.style.color = "#929292"; 
         		 p2.style.fontWeight = "120"; 
         		contpan.appendChild(p2);
        		
        	} else {
        		//document.getElementById('cu-flake-input').style.boxShadow = '1px 1px 1px #888888';
        		document.getElementById('cu-flake-input').style.borderWidth = '2px';
        		document.getElementById('cu-flake-input').style.borderColor = 'red';
        		
        	}
        }
    }
	
    xhr.open('POST', url , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
     var reqpacket = JSON.stringify({
    	 					flake: flk
						});
	xhr.send(reqpacket);
}

function hashUserForAuthentication(user) {	
	
	// Each random "word" is 4 bytes, so 8 would be 32 bytes
	//var saltBits = sjcl.random.randomWords(8);
	// eg. [588300265, -1755622410, -533744668, 1408647727, -876578935, 12500664, 179736681, 1321878387]
	
	// We are using a constant salt
	
	var saltBits = sjcl.codec.base64.toBits('sugar');
	
	//alert(saltBits);
	// I left out the 5th argument, which defaults to HMAC which in turn defaults to use SHA256
	//var derivedKey1 = sjcl.misc.pbkdf2(user, saltBits, 1, 256);
	//var derivedKey2 = sjcl.misc.pbkdf2(user, saltBits, 2, 256);
	var derivedKey1000 = sjcl.misc.pbkdf2(user, saltBits, 1000, 256);
	// eg. [-605875851, 757263041, -993332615, 465335420, 1306210159, -1270931768, -1185781663, -477369628]

	// Storing the key is probably easier encoded and not as a bitArray
	// I choose base64 just because the output is shorter, but you could use sjcl.codec.hex.fromBits
	//var key1 = sjcl.codec.base64.fromBits(derivedKey1);
	//var key2 = sjcl.codec.base64.fromBits(derivedKey2);
	var key1000 = sjcl.codec.base64.fromBits(derivedKey1000);
	
	
	// eg. "2+MRdS0i6sHEyvJ5G7x0fE3bL2+0Px7IuVJoYeOL6uQ="
	
	var salt = sjcl.codec.base64.fromBits(saltBits);
	//alert('salt: ' + salt)
	if (debugappui) console.log(user + ' ' + key1000);
	// And to get the bitArray back, you would do the exact opposite
	//saltBits = sjcl.codec.base64.toBits(salt);
	
	//alert('Value: ' + user + '\n Salt: ' + salt + '\n Hash1: ' + key1
	//		+ '\n Hash2: ' + key2
	//		+ '\n Hash1000: ' + key1000);
	return key1000;
}

function displayImage(id) {
	var url = "/newauth/display/image/" + id + "/" + window.screen.availWidth
			+ "/" + window.screen.availHeight + "/" + window.innerWidth + "/"
			+ window.innerHeight;

	location.href = url;
	return false;
}

function displayImageStat(id, seq) {
	

	var statoverlay = document.getElementById("img-stat-overlay");
		
	
			console.log('in displayImageStat overlay is null  -- id seq' + id + ' ' + seq);
			statoverlay = document.createElement("div");
			statoverlay.setAttribute("id", "img-stat-overlay");
			document.getElementById('app').appendChild(statoverlay );
			
			var cntnr = document.createElement("div");
			cntnr.classList.add('container');
				
			var rowdiv = document.createElement("div");
			rowdiv.classList.add('row');

			var coldiv = document.createElement("div");
			coldiv.classList.add('col-md-6'); 
			coldiv.classList.add('col-md-offset-3');
			
			
			 let closeanchor = document.createElement('span');
		    closeanchor.innerHTML = '&times;';
		    closeanchor.style.float='right';
		    closeanchor.style.padding= '2px 7px';
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
		    	$('#img-stat-overlay').fadeOut(500);
		    	removediv(document.getElementById('img-stat-overlay'));
		    	
		    });
		    coldiv.appendChild(closeanchor);
			
			var panl = document.createElement("div");
			panl.classList.add('panel'); 
			panl.classList.add('panel-default');
			
			var pdh = document.createElement('p');
			 pdh.classList.add('lead');
			 pdh.setAttribute("id", "createuser-flake-text-header");
			 
			 pdh.appendChild(document.createTextNode("Image " + seq));
			 pdh.style.color = "#737373";
			 pdh.style.fontWeight = "50";
			
			 panl.appendChild(pdh);
			 
			 var pdh2 = document.createElement('p');
			 pdh2.classList.add('lead');
			 pdh2.setAttribute("id", "image-user-count");
			 
			 pdh2.appendChild(document.createTextNode("---"));
			 pdh2.style.color = "#737373";
			 pdh2.style.fontWeight = "60";
			
			 panl.appendChild(pdh2);
			 
			 var pdh3 = document.createElement('p');
			 //pdh3.classList.add('lead');
			 pdh3.setAttribute("id", "image-sizes");
			 
			 pdh3.appendChild(document.createTextNode("---"));
			 pdh3.style.color = "#737373";
			 pdh3.style.fontWeight = "60";
			
			 panl.appendChild(pdh3);			 
			 
			 var rowdiv2 = document.createElement("div");
			rowdiv2.classList.add('row');

			var coldiv2 = document.createElement("div");
			coldiv2.classList.add('col-md-12'); 
			
			rowdiv2.appendChild(coldiv2);
			 
			 var formholder = document.createElement('div');
			 
			 coldiv2.appendChild(formholder); 
			  panl.appendChild(rowdiv2);
			 
			var formhtml = '<form method="POST" enctype="multipart/form-data" name="admimagesoverwriteform" class="form-horizontal">		\
			           <div class="form-group">\
			           		<div class="col-md-12">\
					            <div class="input-group">\
					                <label class="input-group-btn">\
					                    <span class="btn btn-primary">\
					                        Browse&hellip; <input type="file" name="files" id="files-input-overwrite" accept="image/*" style="display: none;">\
					                    </span>\
					                </label>\
					                <input type="text" class="form-control" id="file-select-feedback-overwrite" readonly>\
					            </div>\
				            </div>\
			            </div>\
			            <div class="form-group">\
	                        <div class="has-error">\
	                            <form:errors path="url" class="help-inline"/>\
	                        </div>\
					   </div>\
			           <div class="row">\
			            	<div class="col-md-12">\
				                <div class="floatRight">\
				                    <input type="submit" value="Change"   class="btn btn-primary btn-sm" disabled id="img-files-upload-btn-overwrite">\
				                </div>\
			                </div>\
			            </div>\
			        </form>';
			
			 formholder.innerHTML = formhtml;
			 
			coldiv.appendChild(panl);
			rowdiv.appendChild(coldiv);
			cntnr.appendChild(rowdiv);
			statoverlay.appendChild(cntnr);
			
			document.getElementById('files-input-overwrite').addEventListener('change', 
	            function(event) {
					//alert('selected files ' + event.target.files.length);
					//document.admimagesoverwriteform.file = event.target.files[0];
					document.getElementById('img-files-upload-btn-overwrite').disabled = false;
				},

	            false);
			document.getElementById('img-files-upload-btn-overwrite').onclick = function() {return overloadimage('admimagesoverwriteform', seq);};

		loadimageusercount(seq, 'image-user-count');
		loadimagesizes(seq, 'image-sizes');
		setTimeout(function(){ 
					//flakeoverlay.style.display = "block";
					$('#img-stat-overlay').fadeIn('slow');
				}, 200);
			
	return false;
}

function loadimageusercount(seq, elemid) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', '/newauth/api/getimageuserscount/'+seq, false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           //alert(xhr.responseText);
        	var jsonres = xhr.responseText;
        	document.getElementById(elemid).innerHTML = jsonres + ' users';
        }
    }		    
   
    xhr.send(null);
}

function loadimagesizes(seq, elemid) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', '/newauth/api/getimagesizes/'+seq, false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           //alert(xhr.responseText);
        	var jsonres = xhr.responseText;
        	document.getElementById(elemid).innerHTML = jsonres;
        }
    }		    
   
    xhr.send(null);
}



function selectSegmentOnImage(id) {
	var url = "/newauth/setimgpwd/" + window.screen.availWidth
			+ "/" + window.screen.availHeight + "/" + window.innerWidth + "/"
			+ document.getElementById('app').clientHeight + "/" + id;

	//location.href = url;
	
	document.title = 'Newauth - Box Images';
	loadUrlAjax(url, 'app');
	return false;
}



function boxNextImage(id) {
	clearAllBoxImageCanvas();
	//alert(id);
	var url = "/newauth/setimgpwd/" + window.screen.availWidth
			+ "/" + window.screen.availHeight + "/" + window.innerWidth + "/"
			+ document.getElementById('app').clientHeight + "/" + id;

	//location.href = url;
	document.title = 'Newauth - Box Images';
	loadUrlAjax(url, 'app');
	return false;
}



// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
	var timeout;
	console.log('in debounce');
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate)
				func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow)
			func.apply(context, args);
	};
};



/// Websocket stuff

var stompClient = null;

function setConnected(connected) {
    $("#connect").prop("disabled", connected);
    $("#disconnect").prop("disabled", !connected);
    if (connected) {
        $("#conversation").show();
    }
    else {
        $("#conversation").hide();
    }
    $("#greetings").html("");
}

/*function wsconnect(url) {
	//alert('trying to connect to websocket');
    var socket = new SockJS('/newauth-websocket');
    stompClient = Stomp.over(socket);
    stompClient.connect({'sessionID': [sessionid]}, function (frame) {
        //setConnected(true);
        if (debugappui) console.log('Connected: ' + frame);
        stompClient.subscribe(url, function (response) { 
        	handleUsernamecheck(JSON.parse(response.body));        	
        });
    });
    
}

function wsdisconnect() {
    if (stompClient != null) {
        stompClient.disconnect();
    }
    if (debugappui) console.log('tearing down stomp');
    //setConnected(false);
    if (debugappui) console.log("Disconnected");
}*/

function checkUserName() {
	if (debugappui) console.log('In checkUserName');
	document.getElementById("usernamedisplay").innerHTML = '';
	document.getElementById("privkey").innerHTML ='';
	document.getElementById("privkeycheck").style.display='none';
	
	var username = document.getElementById("usernameinput").value;
	
	if (username.length < 6) {
		var x = document.getElementsByClassName("has-error");
		x[0].innerHTML = 'The username  has to be atleast 6 characters long.';
		document.getElementById("usernameinput").focus();
		
		setTimeout(clearUserNameErrorDiv, 4000)
		
		// These two handlers were needed because we need to overcome the autocollapse due to collapse class
		$('#usernamecollapse').on('hidden.bs.collapse', allowusernamedivtocollapse);		
		$('#usernamecollapse').on('shown.bs.collapse', allowusernamedivtocollapse);
		
		return false;
	}
	var clientip = ''; // document.forms[0].clientip.value
	/*stompClient.send("/app/newauth/usernamecheck", {}, JSON.stringify({'userName': hashUserForAuthentication(username),
    																	//'usernameclear':username,
    																	'clientip': clientip
   	    																}));*/
	
	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/newauth/api/oktocreateusername', false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var res = xhr.responseText;        	
        	if (res != null && res.length > 0) {
        		//alert(res);
        		
        		handleUsernamecheck(res); 
        	}
        }
    }		    
   
    xhr.send(JSON.stringify({'username': hashUserForAuthentication(username),
		//'usernameclear':username,
		'clientip': clientip
			}));
   
}

function allowusernamedivtocollapse() {
	username = document.getElementById("usernameinput").value;
	
	if (username.length < 6)
		$("#usernamecollapse").collapse("show"); // reopen
	   
	if (username.length > 6) {
		if (debugappui) console.log('in condition > 6');
		$("#usernamecollapse").collapse("hide"); // close it
		$("#usernamecollapse").off('shown.bs.collapse', allowusernamedivtocollapse);  // remove all handlers
		$("#usernamecollapse").off('hidden.bs.collapse', allowusernamedivtocollapse);
	}
}

function closePrivacySettingsBeforeSetup() {
	
	var boxed = document.getElementById("numboxed").value;
	if (boxed < 6)
		$("#privacysettingcollapse").collapse("hide"); // keep hidden
	else {
		if (debugappui) console.log('in condition > 6');
		$("#privacysettingcollapse").collapse("show"); // close it
		$("#privacysettingcollapse").off('shown.bs.collapse', closePrivacySettingsBeforeSetup);  // remove all handlers
		$("#privacysettingcollapse").off('hidden.bs.collapse', closePrivacySettingsBeforeSetup);
	}
}

function clearUserNameErrorDiv() {
	var x = document.getElementsByClassName("has-error");
	x[0].innerHTML ='';
}

function clearAliasErrorDiv() {
	var x = document.getElementsByClassName("has-error");
	x[1].innerHTML ='';
}

function clearErrorDiv(id) {
	var x = document.getElementById(id);
	x.innerHTML ='';
}


function handleusertypedone(event) {
	document.getElementById("usertypecheck").style.display='inline';
	
	var radios = document.getElementsByName("usertypeinputradio");
	
	var usertype ;
	for(var x = 0; x < radios.length; x++){
        if(radios[x].type == "radio" && radios[x].checked){
        	usertype = radios[x].value;
        }
    }    
	
	document.forms['create-user-form'].type.value = usertype;
	//alert(document.getElementById('giveoutdiv').style.visibility);
	
	if (usertype == '1') {
		
		var signedup = document.getElementById("brandsignedup").value;
		
		console.log('signedup ' + signedup);
		if (signedup == '0') {
			alert('Please Complete Subscription or Select Personal Account');
			radios[0].checked = 'checked';
			return false;
			
		}
		document.getElementById('brandnamefielddisclosure').classList.remove('hidden');
		var radios = document.getElementsByName("giveoutinputradio");
		radios[0].disabled = true;
		radios[1].checked = 'checked';
		radios[2].disabled = true;
	}
	document.getElementById('giveoutdiv').style.visibility='visible';
	
}

function showtopicsetupmodal() {
	$('#topic-setup-modal').modal('show');
	//return false;
}

function processTopicSettingsChange(topicname) {
	//alert('changing topic '+ topicname);
	var comset;
	var postset, storeset;
	var topicprivate =  false;
	/*var radios = document.getElementsByName("topiccommentinputradio");
	
	for(var x = 0; x < radios.length; x++){
        if(radios[x].type == "radio" && radios[x].checked){
        	comset = radios[x].value;        	
        }
    }*/
	comset = document.getElementById("commentsettingsselect").value;
	storeset = document.getElementById("storagesettingsselect").value;
	//radios = document.getElementsByName("topicpostinputradio");
	
	/*for(var x = 0; x < radios.length; x++){
        if(radios[x].type == "radio" && radios[x].checked){
        	postset = radios[x].value;        	
        }
    }
    */
    postset = document.getElementById("postsettingsselect").value;
	
	if (document.getElementById('topicprivatecheckbox').checked)
		topicprivate =  true;
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//console.log('topic '+ topicname + '  updated');
        	$('#topic-setup-modal').modal('hide');
        }
    }
	
    xhr.open('POST', '/newauth/api/updatetopicsetting', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    var reqpacket = JSON.stringify({
    	topic: topicname,
    	comments: comset,
    	posts: postset,
    	storage: storeset,
    	maxdepth: document.getElementById('topicmaxdepthinput').value,
    	topicprivate: topicprivate
    	});
     
   //alert('sending update packet ' + reqpacket);
    xhr.send(reqpacket);
          	
    
}

function processFlakeSettingsChange(flake) {
	//alert('changing topic '+ topicname);
	var message;
	var sessionduration;
	var groupsize;
	var flakeprivate =  false;
	var radios = document.getElementsByName("flakemessageinputradio");
	
	for(var x = 0; x < radios.length; x++){
        if(radios[x].type == "radio" && radios[x].checked){
        	message = radios[x].value;        	
        }
    }
	if (message == 'quiet')
		flakeprivate = true;
	
	groupsize = document.getElementById('chatgroupsize').value;
	var flklife = document.getElementById('flakelife').value;
	
	if (flklife == 'Until compromised')
		flklife = -1;
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//console.log('topic '+ topicname + '  updated');
        	$('#flake-setup-modal').modal('hide');
        }
    }
	
    xhr.open('POST', '/newauth/api/updateflakesetting', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    var reqpacket = JSON.stringify({
			    	flake: flake,
			    	chatgroupsize: groupsize,
			    	flakelife: flklife,
			    	qiet: flakeprivate
	    	});
     
   //alert('sending update packet ' + reqpacket);
    xhr.send(reqpacket);
          	
    
}


function handlegiveoutdone() {
	document.getElementById("giveoutcheck").style.display='inline';
	
	var radios = document.getElementsByName("giveoutinputradio");
	
	var giveout ;
	for(var x = 0; x < radios.length; x++){
        if(radios[x].type == "radio" && radios[x].checked){
        	giveout = radios[x].value;
        }
    }
    
	//alert(giveout);
	document.forms['create-user-form'].giveOut.value = giveout;
	
	if (document.getElementById('usernameprovided').value == null || document.getElementById('usernameprovided').value.length == 0)
		showusernamecaveatscreen();
	else {
		document.getElementById('createuserbtn').value = 'Update newauth Account';
		document.getElementById('msgbeforesubmit').innerText = 'You are nearly done';
		document.getElementById('usernameinput').style.display = 'none';
		//document.getElementById('usernameinput').value = document.getElementById('usernameprovided').value;
		document.getElementById('usernamediv').style.visibility='visible';
		
		if (document.getElementById('usernamepaneltitle') != null)
			document.getElementById('usernamepaneltitle').innerText += ' - selected'
		
		document.forms['create-user-form'].username.value = document.getElementById('usernameprovided').value;
		// Change username displayed
		document.getElementById("usernamedisplay").innerHTML = '<p>You have already selected a username. It is the same one you typed in the username box earlier.</p><p>Newauth stores your username as: </p><p>' + document.getElementById('usernameprovided').value + '</p>'	
		
		//handleUsernamecheck('OK');
		populateUserKeyPair();
		document.getElementById("usernamecheck").style.display='inline';
		document.getElementById("checkusernamebutton").style.display = 'none';		
		
		//alert('showing username panel briefly');
		$("#usernamecollapse").collapse("show"); // show  it
		$("#usernamecollapse").off('shown.bs.collapse', allowusernamedivtocollapse);  // remove all handlers
		$("#usernamecollapse").off('hidden.bs.collapse', allowusernamedivtocollapse);
		
		setTimeout(function(){
			$("#usernamecollapse").collapse("hide");
			document.getElementById("other-identification").style.visibility='visible';
		}, 4000);
	}
	//document.getElementById('usernamediv').style.visibility='visible';
	
}

function showusernamecaveatscreen() {
	
var flakeoverlay = document.getElementById("createuser-flake-overlay"); // this id is setup as blocking overlay
	
	if (flakeoverlay == null) {
		//alert('in createUserFlakeOverlay .. creating new overlay');
		flakeoverlay = document.createElement("div");
		flakeoverlay.setAttribute("id", "createuser-flake-overlay");
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
		panl.setAttribute("id", "createuser-overlay-content");
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
		    	$('#createuser-flake-overlay').fadeOut(500);
		    	removediv(document.getElementById('createuser-flake-overlay'));
		    	
		    });
		    coldiv.appendChild(closeanchor);
		 
		 var pdh = document.createElement('p');
		 pdh.classList.add('lead');
		 pdh.setAttribute("id", "createuser-flake-text-header");
		 
		 pdh.appendChild(document.createTextNode("Important: Your username in Newauth is secret."));
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
		 
		 pd.appendChild(document.createTextNode("Treat this username as you would treat a password in another system. Do NOT use one of your common usernames here."));
		 pd.style.color = "#878787"; 
		 pd.style.fontWeight = "600";
		 
		 var pd2 = document.createElement('p');
		 pd2.classList.add('text-muted');
		 pd2.setAttribute("id", "createuser-flake-text");
		 
		 pd2.appendChild(document.createTextNode("You will use this username to access Newauth. It is also used as a key to your vault. You can change your vault key later. If you choose your username carefully here, you can avoid having to remember two secrets."));
		 pd2.style.color = "#878787"; 
		 pd2.style.fontWeight = "500";
		
		 inputcolp.appendChild(pd);
		 inputcolp.appendChild(pd2);
		 inputrowp.appendChild(inputcolp);		 
		
		 panl.appendChild(inputrowp);
			
		 var inputrowc = document.createElement("div");
			inputrowc.classList.add('row');  
			inputrowc.classList.add('text-center');
			
			var candiv = document.createElement("div");
			candiv.setAttribute("id", "cu-flake-can");
			
			inputrowc.appendChild(candiv);	
		 
			panl.appendChild(inputrowc);
			
			
			
		 var inputdiv = document.createElement("div");
			inputdiv.classList.add('panel-body');
			inputdiv.classList.add('panel-word-wrap');
			//inputdiv.style.backgroundColor = "#c2c2c2"; 
			
			var inputrow  = document.createElement("div");
				inputrow.classList.add('row');
				
			var inputcol = document.createElement("div");
			inputcol.classList.add('col-sm-8');
			inputcol.classList.add('col-sm-offset-2');
			inputcol.setAttribute('id', 'create-flk-input-holder');
			
			inputrow.appendChild(inputcol);
			
			inputdiv.appendChild(inputrow);
			
			
			var sendbutton = document.createElement("input");
			sendbutton.setAttribute("id", "flk-send-button");
			sendbutton.classList.add('btn');
			sendbutton.classList.add('btn-primary');
			sendbutton.classList.add('btn-md');
			//sendbutton.classList.add('pull-right');
			sendbutton.conversationID = '';
			sendbutton.changestarttime = '';
			sendbutton.type = "button";
			sendbutton.value = "Got it";
			sendbutton.style.display = 'block';
			sendbutton.addEventListener('click', function() {
				$('#createuser-flake-overlay').fadeOut(500);
		    	removediv(document.getElementById('createuser-flake-overlay'));
				document.getElementById('usernamediv').style.visibility='visible';
			}, false);		
			
			//$('#flk-send-button').fadeIn('slow');
			
			var inputcol2 = document.createElement("div");
			inputcol2.classList.add('col-sm-2');
			inputrow.appendChild(inputcol2);
			
			//inputcol.appendChild(cuflkinput);
			inputcol2.appendChild(sendbutton);
			
			inputdiv.appendChild(inputrow);
		 
		 panl.appendChild(inputdiv);
		 
		 coldiv.appendChild(panl);
		 
		rowdiv.appendChild(coldiv);
		cntnr.appendChild(rowdiv);
		flakeoverlay.appendChild(cntnr);
		
	}
	
	
	settimeoutid = setTimeout(function(){ 
				//flakeoverlay.style.display = "block";
				$('#createuser-flake-overlay').fadeIn('slow');
			}, 500);
	
	
}

function handleUsernamecheck(message) {
	if (message == 'DONOTCREATE') {	
		//alert('Found exists');
		var x = document.getElementById("create-username-has-error");
		x.innerHTML = 'The username  ' + document.getElementById("usernameinput").value + '  is already taken. Please select another username.';
		//alert('The username  ' + document.forms[0].username.value + '  is already taken. Please select another username.');
		document.getElementById("usernameinput").value = '';
		document.getElementById("usernameinput").focus();
		
		$('#usernamecollapse').on('hidden.bs.collapse', allowusernamedivtocollapse);		
		$('#usernamecollapse').on('shown.bs.collapse', allowusernamedivtocollapse);
		
		setTimeout("clearUserNameErrorDiv()", 4000);
		return false;
	} else { // proper username entered
		// Change the displayed private key [because now it will be encrypted]
		
		populateUserKeyPair(); 
		
		//document.getElementById("privkey").innerHTML = privatekeyb64;
		document.getElementById("pubkey").innerHTML = publickeyb64;
		
		var username = document.getElementById("usernameinput").value;
		//encprivkey = encryptdatausingpassword(privatekeyb64, username);
		encprivkey = encryptdatawithstretchedkey(privatekeyb64, username,'',0);
		document.getElementById("privkey").innerHTML = 'Original Value: ' + privatekeyb64 + '<br><br>' + 
														'Encrypted Value: ' + JSON.parse(encprivkey).ct;
		document.getElementById("privkeycheck").style.display='inline';

		document.forms['create-user-form'].encprivatekey.value = encprivkey;
		
		var hashedusername = hashUserForAuthentication(document.getElementById("usernameinput").value);
		
		document.forms['create-user-form'].username.value = hashedusername;
		// Change username displayed
		document.getElementById("usernamedisplay").innerHTML = 'Newauth stores this as: <p>' + hashedusername + '</p>'	
		
		document.getElementById("usernamecheck").style.display='inline';
		
		document.getElementById("other-identification").style.visibility='visible';
	}
}

function handleOtherIdInput() {
	
	var errormsg = otherIDErrorMessage();
	
	if (errormsg.length > 0) {
		document.getElementById('other-id-has-error').innerHTML = errormsg;
		setTimeout(function() {clearErrorDiv('other-id-has-error');}, 4000);
		
		// These two handlers were needed because we need to overcome the autocollapse due to collapse class
		$('#otheridcollapse').on('hidden.bs.collapse', allowotheriddivtocollapse);		
		$('#otheridcollapse').on('shown.bs.collapse', allowotheriddivtocollapse);
		return false;
	}
	
	document.forms['create-user-form'].firstname.value = document.getElementById("firstnameinput").value;
	document.forms['create-user-form'].lastname.value = document.getElementById("lastnameinput").value;
	
	var usertype = document.forms['create-user-form'].type.value;
		
	//if (usertype > 0) { // this is a brand user .. check alias --doing it for all users now
		var aliasentered = document.getElementById("aliasinput").value;
		checkAlias(aliasentered, usertype);
	/*} else {
			document.forms['create-user-form'].alias.value = document.getElementById("aliasinput").value;
		
			document.getElementById("otheridcheck").style.display='inline';
			document.getElementById("contact-info-div").style.visibility='visible';
	}*/
	return true;
	
}

function checkAlias(alias, usertype) {
	if (debugappui) console.log('In checkAlias');
	
	if (alias.length == 0 && usertype == '1') {
		var x = document.getElementsByClassName("has-error");
		x[1].innerHTML = 'Alias can not be empty for a brand user';
		document.getElementById("aliasinput").focus();
		
		setTimeout(clearAliasErrorDiv, 4000)
		
		// These two handlers were needed because we need to overcome the autocollapse due to collapse class
		$('#otheridcollapse').on('hidden.bs.collapse', allowotheriddivtocollapse);		
		$('#otheridcollapse').on('shown.bs.collapse', allowotheriddivtocollapse);
		
		return false;
	}
	
	if (alias.length == 0) { // return if no alias exists
		return true;
	}
	
	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/newauth/api/oktocreatealias', false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var res = xhr.responseText;        	
        	if (res != null && res.length > 0) {
        		//alert(res);
        		
        		handleAliascheck(res); 
        	}
        }
    }		    
   
    xhr.send(JSON.stringify({
    			'alias': alias
			}));
   
}

function handleAliascheck(message) {
	if (message == 'DONOTCREATE') {	
		//alert('Found exists');
		var x = document.getElementById("other-id-has-error");
		x.innerHTML = 'The alias  ' + document.getElementById("aliasinput").value + '  is already taken. Please enter another alias.';
		//alert('The username  ' + document.forms[0].username.value + '  is already taken. Please select another username.');
		document.getElementById("aliasinput").value = '';
		document.getElementById("aliasinput").focus();
		
		$('#otheridcollapse').on('hidden.bs.collapse', allowotheriddivtocollapse);		
		$('#otheridcollapse').on('shown.bs.collapse', allowotheriddivtocollapse);
		
		setTimeout("clearAliasErrorDiv()", 4000);
		return false;
	} else { // proper alias entered
		document.forms['create-user-form'].alias.value = document.getElementById("aliasinput").value;
		
		document.getElementById("otheridcheck").style.display='inline';
		document.getElementById("contact-info-div").style.visibility='visible';
	}
}

function handleContactInfoInput() {
	
	var errormsg = contactInfoErrorMessage();
	
	if (errormsg.length > 0) {
		document.getElementById('contact-info-has-error').innerHTML = errormsg;
		setTimeout(function() {clearErrorDiv('contact-info-has-error');}, 4000);
		
		// These two handlers were needed because we need to overcome the autocollapse due to collapse class
		$('#contactcollapse').on('hidden.bs.collapse', allowotheriddivtocollapse);		
		$('#contactcollapse').on('shown.bs.collapse', allowotheriddivtocollapse);
		return false;
	}

	document.getElementById("contactcheck").style.display='inline';
	document.getElementById("password-notice-div").style.visibility='visible';
	return true;
	
}

function contactInfoErrorMessage() {
	return '';
}

function parseJsonWithFallback(inputString) {
    try {
        // Attempt to parse the original string
        return JSON.parse(inputString);
    } catch (error) {
        // Parsing failed, clean the string by removing escaped quotes
        const cleanedString = inputString.replace(/\\\"/g, '"');
        try {
            // Try parsing the cleaned string
            return JSON.parse(cleanedString);
        } catch (fallbackError) {
            console.error("Error parsing JSON:", fallbackError);
            return null; // Return null or handle the error as needed
        }
    }
}

function otherIDErrorMessage() {
	var usertype = document.forms['create-user-form'].type.value;
	
	var usernameclear = document.getElementById("usernameinput").value;
	
	var firstname = document.getElementById("firstnameinput").value;
	var lastname = document.getElementById("lastnameinput").value;
	var alias = document.getElementById("aliasinput").value;
	
	var errormsg = '';
	
	if (alias.length == 0) {		
		if (usertype == 1) { // brand user
			errormsg = 'Alias needs to contain the Brand name that you want to reserve as a brand user.';		
			return errormsg;
		}
	}
		
	if (firstname.length == 0 && lastname.length == 0 && alias.length == 0) {
		errormsg = 'Please enter at least one of firstname, lastname and Screen name';		
		
		return errormsg;
	}
	
	if (usernameclear.length > 0 && (firstname == usernameclear || lastname == usernameclear || alias == usernameclear)) {
		errormsg = 'Username can not be same as firstname, lastname or alias';
		
		return errormsg;
	}
	
	return errormsg;
}


function allowotheriddivtocollapse() {
	
	var errormsg = otherIDErrorMessage();	
	
	if (errormsg.length > 0) {
		$("#otheridcollapse").collapse("show"); // reopen
	}
	else {
		
		$("#otheridcollapse").collapse("hide"); // close it
		$("#otheridcollapse").off('shown.bs.collapse', allowotheriddivtocollapse);  // remove manually added handler
		$("#otheridcollapse").off('hidden.bs.collapse', allowotheriddivtocollapse);
	}
}


function encryptdatausingpassword(data, password) { // NOT in USE
	
	var itns = 10000;
	var ssalt = sjcl.random.randomWords(1, 7);	
	
	var encprivkey = sjcl.encrypt(password, data,
						{
							ks: 256, 
							salt: ssalt, 
							iter: itns
						}
					);
	
	return encprivkey;
}


function encryptdatawithstretchedkey(data, key, saltval, iter) {
	
	if (saltval.length == 0)
		saltval = getrandomsalt(6);
	
	if (iter == 0)
		iter = 10000;
	
	//alert('salt:' + saltval + ' iter:' + iter);
	
	var derivedKey;
	derivedKey = sjcl.misc.pbkdf2( key, saltval, iter, 256 );
	
	var passwordSalt = sjcl.codec.hex.toBits( saltval );
	//var hexKey = sjcl.codec.hex.fromBits( derivedKey );
	
//	return sjcl.encrypt(derivedKey, document.forms[type].data.value, {ks: 256, salt: sjcl.codec.hex.fromBits(passwordSalt), iter: document.forms[type].itns.value});   // removed the third param , {mode : "ccm || gcm || ocb2"} CCM is default
	return sjcl.encrypt(key, data,
									{
										ks: 256, 
										salt: sjcl.codec.hex.fromBits(passwordSalt), 
										iter: iter
									}
			);
									
}

function getrandomsalt(numWords) { // generator is already seeded during createuser page load
	var randomBase64String = '';
	while(randomBase64String.length < numWords) {
        var randomInt = sjcl.random.randomWords(1, 10)[0];
        randomBase64String += btoa(randomInt);
      }
      randomBase64String = randomBase64String.substr(0, numWords);
	return randomBase64String;
}



// For image click timer
var starttime = Date.now();

function restartTimer() {
	starttime = Date.now();
}

function gettimetoclick() {
	return Date.now() - starttime;
}



function animateClick(imgobj) {
	//alert('in animateclick');
	//displaypageloadingdiv(imgobj.parentNode);
	imgobj.classList.add("animated");
	imgobj.classList.add("flash");
	//alert('done animateclick');
}


function avatarclock() {
	// Set the date we're counting down to
	//var countDownDate = new Date("Sep 5, 2018 15:37:25").getTime();

	// Update the count down every 1 second
	var avatartimerinterval = setInterval(function() {

	  // Get todays date and time
	  var now = new Date().getTime();

	  // Find the distance between now an the count down date
	  var distance = avatarcountDownDate - now;

	  // Time calculations for days, hours, minutes and seconds
	  var days = Math.floor(distance / (1000 * 60 * 60 * 24));
	  var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	  var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
	  var seconds = Math.floor((distance % (1000 * 60)) / 1000);

	  // Display the result in the element with id="avatar-timer-display"
	  if (document.getElementById("avatar-timer-display") != null) {
		  if (days > 0)
			  document.getElementById("avatar-timer-display").innerHTML = days + "d ";
		  else  { 
			  if (hours > 0 ) 		  
			  		document.getElementById("avatar-timer-display").innerHTML =  hours + "h ";
			  else {
				  if (minutes > 0)
					  document.getElementById("avatar-timer-display").innerHTML =  minutes + "m " + seconds + "s ";
				  else if (seconds > 0)
						  document.getElementById("avatar-timer-display").innerHTML =  seconds + "s ";
				  
			  }
		  }
	  } else {
		 // alert('avatar-timer-display DIV not found... may be not on setupuser page. clearing interval.');
		  clearInterval(avatartimerinterval);
	  }
	 
	  
	// If the count down is finished, write some text
	  if (distance < 0) {
	    clearInterval(avatartimerinterval);
	    document.getElementById("avatar-timer-display").innerHTML = "EXPIRED";
	  }
	}, 1000);
}


function getReadableFileSizeString(fileSizeInBytes) {

    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
};


function ValidateEmail(mail)   
{  
 if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(mail))  
  { 
	
	return (true);
  }  
 document.getElementById("emailinputerror").innerHTML = "Please check the email address!";  
 return (false) ; 
} 


function ValidatePhone(phone) {
	
	var cleaned = phone.replace(/\s/g, "");
	
	if (isNaN(cleaned))
		return false;
	
	return true;
}


function stopSSEPolling() {
	if (sseeventsource != null) {
		sseeventsource.close();
		sseeventsource = null;
		//alert('SSE connection started in public page stopped.');
	}
	
}

function joinconversation (convid) {
	
	
	if (sseeventsource == null ) {
		//alert('creating new SSE connection');
		establishnewSSEConnection(convid);
	    
	} else {				
		if (sseeventsource.url.endsWith(convid)) {
			//alert('SSE connection for the conversation exists. readystate: ' + sseeventsource.readyState + ' url: ' + sseeventsource.url);
		} else {
			//alert('SSE connection exists for a different URL ' + sseeventsource.url + ' .. Will close the old connection and create new.');
			stopSSEPolling();
			establishnewSSEConnection(convid);
		}
	}
	
	
}


function establishnewSSEConnection(conv) {
	if(typeof(EventSource) !== "undefined") {
		sseeventsource = new EventSource("/newauth/api/joinConversation/" + conv);
		sseeventsource.addEventListener('message', function(event) {
	    	//alert();
	       // alert(event.data);
	        var type = 0;
	        	        
			var dataobj = JSON.parse(event.data);
			//alert(dataobj.author);
						
			if (dataobj.author != fullname)
    			type = 1;
    		
			if (dataobj.author == 'SYSTEM')
				type = 1000;
			
			        		
			if (dataobj.participants != null && dataobj.participants.length > 0) { // list of conv participants has come in
				var currtime = new Date();
				if (debugappui) console.log('Received participants list [ ' + dataobj.participants + '] ' + currtime.toTimeString());
				//alert(dataobj);
				var headerelem = document.getElementById("conv-header-" + dataobj.conversationID);
				
				if (headerelem != null) {
					var imgelem = document.createElement('img');
					imgelem.classList.add('user-icon');				
					
					var images = headerelem.getElementsByClassName('user-icon');
					while(images.length > 0) {
					    images[0].parentNode.removeChild(images[0]);
					}			
	
					if ( convparticipants[conv] !== undefined && convparticipants[conv].length == 1) {
						if (dataobj.participants.length == 1 )
							imgelem.src = '/static/icons/one-user-green-16.png';
						
						if (dataobj.participants.length == 0 )
							imgelem.src = '/static/icons/one-user-grey-16.png';
					}	
					
					if (convparticipants[conv] !== undefined && convparticipants[conv].length > 1) {
						if (dataobj.participants.length > 1)
							imgelem.src = '/static/icons/multiple-users-green-16.png';
						
						if (dataobj.participants.length == 0)
							imgelem.src = '/static/icons/multiple-users-grey-16.png';
					}
					
					//imgelem.style.width = '4px';
					//imgelem.style.height = '4px';
					headerelem.appendChild(imgelem);
				}
				return;
			}
			
			if (dataobj.message == null && dataobj.typing == 'true') {
				if (debugappui) console.log('Received typing event');
				var headerelem = document.getElementById("conv-header-" + dataobj.conversationID);
				var imgelem = document.createElement('img');
				imgelem.classList.add('typing-icon');
				imgelem.src = '/static/icons/pencil-16.png'
				//imgelem.style.width = '4px';
				//imgelem.style.height = '4px';
				headerelem.appendChild(imgelem);
			}
			
			if (dataobj.message == null && dataobj.typing == 'false') {
				if (debugappui) console.log('Received stopped typing event');
				var headerelem = document.getElementById("conv-header-" + dataobj.conversationID);
				var images = headerelem.getElementsByClassName('typing-icon');
				while(images.length > 0) {
				    images[0].parentNode.removeChild(images[0]);
				}
			}
			
			
			//alert('message recd ' + dataobj.message);
			if (dataobj.message != null) {
				if (debugappui) console.log('Received message ' +  dataobj.message);
				
				if (convmsgtimemap[dataobj.conversationID] !== undefined) {
					
					if (convmsgtimemap[dataobj.conversationID].indexOf(dataobj.messagecreatetime) == -1) {
						convmsgtimemap[dataobj.conversationID].push(dataobj.messagecreatetime);
						
						var headerelem = document.getElementById("conv-header-" + dataobj.conversationID);
						var images = headerelem.getElementsByTagName('img');
						while(images.length > 0) {
						    images[0].parentNode.removeChild(images[0]);
						}
						//if (debugappui) console.log('Adding message to panel . Created at: ' + dataobj.messagecreatetime);
						var cpanel = document.getElementById("conv-data-" + dataobj.conversationID);
						//alert(cpanel + ' ' + type + ' ' + dataobj.author);
						addconversationmessagetopanel(cpanel,  atob(dataobj.message), type, dataobj.messagecreatetime, dataobj.author);
					} else { // ignore this message -- repeat
						if (debugappui) console.log('ignoring message. createtime exists at position? ' + convmsgtimemap[dataobj.conversationID].indexOf(dataobj.messagecreatetime));
					}
				} else {
					var timelist = [];
					timelist.push(dataobj.messagecreatetime);
					convmsgtimemap[dataobj.conversationID] = timelist;
					if (debugappui) console.log('Adding message to panel . Created at: ' + dataobj.messagecreatetime);
					var cpanel = document.getElementById("conv-data-" + dataobj.conversationID);
					addconversationmessagetopanel(cpanel,  atob(dataobj.message), type, dataobj.messagecreatetime, dataobj.author);
				}
				
			}
		});
	} else {
		var cpanel = document.getElementById("conv-data-" + conv);
		addconversationmessagetopanel(cpanel , "This browser does not support server-sent-events. Instant messsaging will not work.", 1000);
	}
}




function loadconversation(convid, crtime, topicname, postcrtime, action) {
	
	var xhr = new XMLHttpRequest();
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var jsonres = xhr.responseText;
        	//alert('conversations JSON: '+ jsonres);
        	var data = JSON.parse(jsonres);
        	
        	if (data.length > 0) {
	        	for (var j=0; j< data.length; j++) {
	        		
	        		var type = 0;
	        		
	        		//alert('fullname "' + fullname + '" data[j].author "' + data[j].author + '"');
	        		
	        		if (data[j].author != fullname)
	        			type = 1;
	        		
	        		if (data[j].author == 'SYSTEM')
	        			type = 1000;
	        		
	        		
	        		var cpanel = document.getElementById("conv-data-" + data[j].conversationID);
	        		
	        		//alert('id ' + data[j].conversationID + ' panel ' + cpanel);
	        		addconversationmessagetopanel(cpanel, data[j].message, type, data[j].messagecreatetime, data[j].author, action);
	            	
	        	}
        	} else {
        		var cpanel = document.getElementById("conv-data-" + convid);
        		//alert('will this pop up?');
        		addconversationmessagetopanel(cpanel, "No messages found.", null, null, null, action);
        	}
        	
        }
    }
	xhr.open('POST', '/newauth/api/getconversation', false);
	xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');  
       
    var reqpacket = JSON.stringify({
    	  	messagecreatetime: crtime ,
		 	 conversationID: convid,
		 	 topicname: topicname,
		 	 postcrtime: postcrtime
 		});
     
    xhr.send(reqpacket);
}

function loadconversationsbyparticipant(convid, crtime, participant) {
	
	var xhr = new XMLHttpRequest();
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var jsonres = xhr.responseText;
        	//alert('conversations JSON: '+ jsonres);
        	var data = JSON.parse(jsonres);
        	
        	var convheading = document.getElementsByClassName('conv-modal-title')[0];
        	
        	if (convheading != null) {
        		var h4 = document.createElement('h4');
        		h4.appendChild(document.createTextNode("Conversations"));
        		
        		var lnk = document.createElement('a');
        		lnk.style.cursor = 'pointer';
        		lnk.addEventListener('click', function() {
        			var h4 = document.createElement('h4');
            		h4.appendChild(document.createTextNode("Conversations"));
            		convheading.innerHTML = '';
            		convheading.appendChild(h4);
        			displayconvosondiv(JSON.parse(document.getElementById('allconv').value), 'conv-trans-in-modal');
        		});
        		lnk.appendChild(document.createTextNode("> All"));
        		
        		convheading.innerHTML = '';
        		convheading.appendChild(h4);
        		convheading.appendChild(lnk);
        	}
        	
        	
        	displayconvosondiv(data, 'conv-trans-in-modal', true);
        	
        }
    }
	xhr.open('POST', '/newauth/api/getconversationsbyparticipant', false);
	xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');  
       
    var recipients = [];
    
    if (typeof participant != 'undefined' && participant != null) {
    	recipients.push(participant);
    }
    var reqpacket = JSON.stringify({
    	  	messagecreatetime: crtime ,
		 	 conversationID: convid,
		 	participants: recipients
 		});
     
    xhr.send(reqpacket);
}


function loadconversationmesagesbyparticipant(convid, crtime, participant) {
	
	var xhr = new XMLHttpRequest();
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var jsonres = xhr.responseText;
        	
        	var data = JSON.parse(jsonres);
        	var cpanel = document.getElementById("conv-data-" + convid);
        	cpanel.innerHTML = '';
        	//alert('data length : '+ data.length);
        	if (data.length > 0) {
	        	for (var j=0; j< data.length; j++) {
	        		
	        		var type = 0;
	        		
	        		//alert('fullname "' + fullname + '" data[j].author "' + data[j].author + '"');
	        		
	        		if (data[j].author != fullname)
	        			type = 1;
	        		
	        		if (data[j].author == 'SYSTEM')
	        			type = 1000;
	        	        	
	        		document.getElementById('conv-data-' +convid).parentNode.classList.remove('hidden');
	    			document.getElementById('conv-data-' +convid).parentNode.classList.remove('visuallyhidden');
	        		addconversationmessagetopanel(cpanel, data[j].message, type, data[j].messagecreatetime, data[j].author);
	        		
	        	}
        	} else {
        		document.getElementById('conv-data-' +convid).parentNode.classList.remove('hidden');
    			document.getElementById('conv-data-' +convid).parentNode.classList.remove('visuallyhidden');
        		addconversationmessagetopanel(cpanel, "NO messages found", 27, null, '');
        		
        	}
        	
        }
    }
	xhr.open('POST', '/newauth/api/getconversationmessagesbyparticipant', false);
	xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');  
       
    var recipients = [];
    
    if (typeof participant != 'undefined' && participant != null) {
    	recipients.push(participant);
    }
    var reqpacket = JSON.stringify({
    	  	messagecreatetime: crtime ,
		 	 conversationID: convid,
		 	participants: recipients
 		});
     
    xhr.send(reqpacket);
}

function addconversationmessagetopanel(panel , msg, type,  crtime, author, action) {//type  0 - own, 1 - other, 1000 - system, 27 - no data
	
	//var panel = document.getElementById("conv-data-" + convid);
	
	
	if (panel != null) {
		//alert('adding message to panel' + panel);
		var msgrow = document.createElement("div");
		msgrow.classList.add('row');
		
		msgrow.style.border = '1px solid #b9b9b9';
		
		 var msgcol = document.createElement("div");
		 msgcol.classList.add('col-sm-12');		
		 
		 var buffercol = document.createElement("div");
		 buffercol.classList.add('col-sm-4');
		 
		 var msgauthor = document.createElement('p');
		// msgauthor.classList.add('pull-left');
		 msgauthor.appendChild(document.createTextNode(author));
		 msgauthor.style.color = "#747474"; 
		 
		 var msgmeta = document.createElement('p');
		 //msgmeta.classList.add('pull-right');
		 if (crtime != null && crtime.length > 0)
		 msgmeta.appendChild(document.createTextNode(gettimedifference(crtime)));
		 msgmeta.style.color = "#747474"; 
			 
		 var p = document.createElement('p');
		// p.classList.add('lead');
		 
		p.appendChild(document.createTextNode(msg));
		 p.style.color = "#fefefe"; 
		
		 if (type == 0)
			 p.style.backgroundColor = "#00a2a2"; 
		
		if (type == 1) {
			//p.style.backgroundColor = "#a2a200"; 
			p.style.backgroundColor = "#a2a2a2"; 
		}
		
		if (type == 1000)
			p.style.backgroundColor = "#a200a2"; 
		
		if (type == 27)
			p.style.backgroundColor = "#fb8e8e"; 
		
		//msgmeta.style.backgroundColor = p.style.backgroundColor;
		//msgauthor.style.backgroundColor = p.style.backgroundColor;
		
		
		var msgrowinner = document.createElement("div");
		msgrowinner.classList.add('row');
		
		 var msgcolinnersplit = document.createElement("div");
		 msgcolinnersplit.classList.add('col-sm-6');
		// msgcolinnersplit.classList.add('bottom-align-text');
		 //msgrowinner.style.position = 'relative';
		 msgrowinner.appendChild(msgcolinnersplit);
		 
		 msgauthor.classList.add('pull-left');
		 msgcolinnersplit.appendChild(msgauthor);
		 msgcol.appendChild(msgcolinnersplit);
		 
		 msgcolinnersplit = document.createElement("div");
		 msgcolinnersplit.classList.add('col-sm-6');
		// msgcolinnersplit.classList.add('bottom-align-text');
		 msgmeta.classList.add('pull-right');
		 msgcolinnersplit.appendChild(msgmeta);
		 msgrowinner.appendChild(msgcolinnersplit);
		 
		// msgcol.appendChild(msgrowinner);
		 
		 var msgrowinner2 = document.createElement("div");
			msgrowinner2.classList.add('row');
			
			var msgcolinner = document.createElement("div");
			 msgcolinner.classList.add('col-sm-12');
			 msgcolinner.appendChild(msgauthor);
			 msgcolinner.appendChild(msgmeta);
			 msgcolinner.appendChild(document.createElement('br'));
			 msgcolinner.appendChild(p);
			 msgrowinner2.appendChild(msgcolinner);
		//msgcol.appendChild(msgauthor);
		//msgcol.appendChild(msgmeta);
		//msgcol.appendChild(document.createElement('br'));
		
			 msgcol.appendChild(msgrowinner2);
		//msgcol.appendChild(p);
		
		
		if (type == 1) { // other message, start row with empty buffer column
			msgrow.appendChild(buffercol);
		}
		msgrow.appendChild(msgcol);
		
		if (type == 0) { // own message, end row with empty buffer column
			msgrow.appendChild(buffercol);
		}
		
		var contolrow = document.createElement("div");
		contolrow.classList.add('row');
		var controlcol1 = document.createElement("div");
		controlcol1.classList.add('col-sm-6');
		
		
		var controlcol2 = document.createElement("div");
		controlcol2.classList.add('col-sm-6');
		
		var lnkunread = document.createElement("a");
		lnkunread.classList.add('pull-right');
		lnkunread.appendChild(document.createTextNode("Unread"));
		lnkunread.style.border = '1px solid #c2c2c2';
		lnkunread.style.color = '#878787';
		lnkunread.style.padding = '1px';
		lnkunread.style.margin = '2px';
		lnkunread.style.cursor = 'pointer';
		
		
		var lnksave = document.createElement("a");
		lnksave.classList.add('pull-right');
		lnksave.appendChild(document.createTextNode("Save"));
		lnksave.style.border = '1px solid #c2c2c2';
		lnksave.style.color = '#878787';
		lnksave.style.padding = '1px';
		lnksave.style.margin = '2px';
		lnksave.style.cursor = 'pointer';
		
		if (typeof action == 'undefined' || action == true) {
			controlcol2.appendChild(lnksave);
			controlcol2.appendChild(lnkunread);
		}
		
		
		contolrow.appendChild(controlcol1);
		contolrow.appendChild(controlcol2);
		
		
		var emptyrow = document.createElement("div");
		emptyrow.classList.add('row');
		var emptycol = document.createElement("div");
		emptycol.classList.add('col-sm-8');
		
		var p = document.createElement('p');
		p.appendChild(document.createTextNode(""));
		 
		
		emptycol.appendChild(p);
		emptyrow.appendChild(emptycol);
		
		
		 panel.appendChild(msgrow);
		 
		
		 panel.appendChild(emptyrow);
		 
		 msgcol.appendChild(contolrow);
		 
		 panel.scrollTop = panel.scrollHeight;  // scroll to the bottom
	}
}


function createMessagePanel (convid) {
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
		h5.appendChild(document.createTextNode('Messages'));
		h5.setAttribute("id", "conv-header-" + convid);		
		
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
		
		
		pbody.scrollTop = pbody.scrollHeight;  // scroll to the bottom
	}
	//document.getElementById("conversations-panel-body").appendChild(rowlem);
}



function drawPoint(angle,distance,label, center_x, center_y, ctx, size, displayletters, color){
	 var radius = center_x/2;
	 distance += 0.35; // shifting all points a bit outside.
    var x = center_x + radius * Math.cos(-angle*Math.PI/180) * distance;
    var y = center_y + radius * Math.sin(-angle*Math.PI/180) * distance;
	if (debugappui) console.log('drawing point ' + angle + ' ' + distance + ' ' + label + ' ' + center_x + ' ' + center_y);
       
    if (typeof color !== 'undefined' && color != null && color.startsWith('#')) {
    	ctx.fillStyle = color;
    	 ctx.strokeStyle = color;
    	 ctx.globalAlpha = 0.7;
	} else {
		ctx.fillStyle = "#43464b";
		 ctx.strokeStyle = "silver";
	}
	
	if (angle > 180) {
		ctx.strokeStyle = "#FAA0A0"; //"#F5A9BC";
		ctx.fillStyle = "#FAA0A0"; //"#F5A9BC";
	}
	
	var point_size = 3;
	var font_size = "8px";
	
    if ( size != 'tiny') {
	 	if ( size == 'large') {
			point_size = 3;
			ctx.lineWidth = 1;
		} else 
    		point_size = 2;
    	ctx.moveTo(center_x + radius * Math.cos(-angle*Math.PI/180) * 0.09, center_y + radius * Math.sin(-angle*Math.PI/180) * 0.09);
	    ctx.lineTo(x,y);
	    ctx.stroke();
	    
	    if (displayletters != null && displayletters == 'true') {
	    	ctx.font = font_size;
	    	var x_txt = center_x + radius * Math.cos(-angle*Math.PI/180) * (distance + 0.08);
	        var y_txt = center_y + radius * Math.sin(-angle*Math.PI/180) * (distance + 0.08);
	    	ctx.fillText(label,x_txt,y_txt);
	    }
    } else {
    	point_size = 1;
 	   
    }

    ctx.beginPath();
    ctx.arc(x, y, point_size, 0, 2 * Math.PI);
    ctx.fill();
    
}

function drawDash(angle,distance,label, center_x, center_y, ctx, size, displayletters, color){
	 var radius = center_x/2;
	 distance += 0.35; // shifting all points a bit outside.
   var x = center_x + radius * Math.cos(-angle*Math.PI/180) * distance;
   var y = center_y + 8;
	//if (debugappui) console.log('drawing point ' + angle + ' ' + distance + ' ' + label + ' ' + center_x + ' ' + center_y);
  
	var point_size = 3;
	var font_size = "10px";
	   	
 
	ctx.fillText('-', x, y);
  

   
}

function drawborderllines(canvas) {
	
	var cx=canvas.getContext("2d");
	
	cx.strokeStyle = "#343434";
	cx.beginPath();
	cx.moveTo(0,canvas.height/10);
	cx.lineTo(0,0);
	cx.stroke();
	
	cx.beginPath();
	cx.moveTo(0,0);
	cx.lineTo(canvas.width/5,0);
	cx.stroke();
	
	cx.beginPath();
	cx.moveTo(canvas.width,4*canvas.height/5);
	cx.lineTo(canvas.width,canvas.height);
	cx.stroke();
	
	cx.beginPath();
	cx.moveTo(canvas.width,canvas.height);
	cx.lineTo(canvas.width*9/10,canvas.height);
	cx.stroke();
}


function generateFlakeOnCanvas(flakecanvasid, flakeobj, width, height, size, displayletters, color) {
	
	var candiv = document.getElementById( flakecanvasid);
	
	var halfflake = false;
	
	if (candiv == null)
		return false;
	
	//alert(size);
	//alert('flakeobj ' + JSON.stringify(flakeobj));
	var flkcanvas = createHiDPICanvas(width, height);
//	flkcanvas.width = width;
//	flkcanvas.height = height;
	
	candiv.appendChild(flkcanvas);
//	flkcanvas.style.width = width;
//	flkcanvas.style.height = height;

	if (flakeobj != null ) {
		
		var flakeval;
		var stringConstructor = "test".constructor; 
		
		// check if flakeobj or a flake are passed
		
		if (flakeobj.constructor === stringConstructor)
			flakeval = flakeobj;
		else if ( flakeobj.flake != null) {
			flakeval = flakeobj.flake
		}
		
		var lengthoffullflk = flakeval.length;
		//alert('flake ' + flakeval);
		var center_x = flkcanvas.width/2;
		var center_y = flkcanvas.height/2;
		
		if (size == 'tiny') { 
			center_y = flkcanvas.height*5/8;
		
		}
		//flkcanvas.style.border = '1px solid #343434';
		var ctx = flkcanvas.getContext("2d");
		ctx.clearRect(0,0,flkcanvas.width,flkcanvas.height);
		//ctx.shadowColor = '#999';
		// ctx.shadowBlur = 4;
		// ctx.shadowOffsetX = 2;
		// ctx.shadowOffsetY = 2;
		//alert(flake.length);
		
		//alert(flakeval + ' ' + flakeval.length);
		if (flakeval.length < 25) { // this is a half flake.. copy its last char for the full length
			
			halfflake = true;
			var oldlen = flakeval.length;
			for (var i=0; i<oldlen; i++) {
				//flakeval += flakeval.charAt(oldlen-1);
				flakeval += 'z';
			} 
			
		}
		
		// draw the top with 16 points
		for (var i=0; i<16; i++) {
			var dist = (1/valmap.length) * valmap.indexOf(flakeval.charAt(i));
				
			var ang = i * (180/15);
			//drawPoint(ang, dist, loggedinuserflake.charAt(i) );
			if (ang <=  180)
				drawPoint(ang, dist, flakeval.charAt(i) , center_x, center_y, ctx, size, displayletters,color);
			
			//console.log(i + ' ' + ang);	
		}
		
		//alert('top talf drawn');
		for (var i=16; i<flakeval.length; i++) {
			var dist = (1/valmap.length) * valmap.indexOf(flakeval.charAt(i));
				
			var ang = 180 + ((i-15) * (180/(lengthoffullflk - 15)));
			//drawPoint(ang, dist, loggedinuserflake.charAt(i) );
			//console.log(i + ' ' + ang);
			
			if (ang > 180 && halfflake) {
				drawDash(ang, dist, flakeval.charAt(i) , center_x, center_y, ctx, size, displayletters, color);
			} else {
				drawPoint(ang, dist, flakeval.charAt(i) , center_x, center_y, ctx, size, displayletters, color);
			}
				
		}	
		
		/*for (var i=0; i<flakeval.length; i++) {
			var dist = (1/valmap.length) * valmap.indexOf(flakeval.charAt(i));
				
			var ang = i * (360/(flakeval.length - 1));
			
			if (halfflake)
				ang = i * (360/30);
			//drawPoint(ang, dist, loggedinuserflake.charAt(i) );
			if (ang <=  180)
				drawPoint(ang, dist, flakeval.charAt(i) , center_x, center_y, ctx, size, displayletters, color);
			
			if (ang > 180 && halfflake) {
				drawDash(ang, dist, flakeval.charAt(i) , center_x, center_y, ctx, size, displayletters, color);
			} else {
				drawPoint(ang, dist, flakeval.charAt(i) , center_x, center_y, ctx, size, displayletters, color);
			}
				
			//console.log('dreq char at ' + i + ' : ' + flakeval.charAt(i));
		}	*/	
		
		if (flakeobj.constructor !== stringConstructor && flakeobj.crtime != null) {
			ctx.fillStyle = 'black';
    	 	ctx.strokeStyle = 'black';
			if (size == 'tiny') {
				var flktxtcenter = document.createElement('div');
				flktxtcenter.style.position = 'absolute';
				flktxtcenter.style.top = '2px';
				flktxtcenter.style.left = '10px';
				flktxtcenter.style.textAlign = 'center';
				var heading = document.createElement('h4');	
				heading.style.color = '#599aab';
				heading.appendChild(document.createTextNode(flakeval.substring(0,4)));
				flktxtcenter.appendChild(heading);
				candiv.appendChild(flktxtcenter);
				//ctx.fillText(gettimedifference(flakeobj.crtime) , 2, flkcanvas.height-2); 	
			} else {
				ctx.fillText(flakeobj.crtime , 2, flkcanvas.height-2); 
			}	
		}
		
	}
	
	if (size != 'tiny') drawborderllines(flkcanvas);
	
	return flkcanvas;
}

function generateBottomPartOfFlakeOnCanvas(flakecanvasid, flakeobj, width, height, size, displayletters) {
	var valmap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-+";
	
	var candiv = document.getElementById( flakecanvasid);
	
	var halfflake = false;
	
	if (candiv == null)
		return false;
	
	 //alert(size);
	var flkcanvas = createHiDPICanvas(width, height);
	flkcanvas.width = width;
	flkcanvas.height = height;

	candiv.appendChild(flkcanvas);
	
	if (flakeobj != null ) {
		
		var flakeval;
		var stringConstructor = "test".constructor; 
		
		// check if flakeobj or a flake are passed
		
		if (flakeobj.constructor === stringConstructor) {
			return false; // we need fullflake populated for length
		} else if ( flakeobj.flake != null) {
			flakeval = flakeobj.flake
		}
		
		var lengthoffullflk = flakeobj.fullflake.length;
		var center_x = flkcanvas.width/2;
		var center_y = flkcanvas.height/2;
		
		//flkcanvas.style.border = '1px solid #343434';
		var ctx = flkcanvas.getContext("2d");
		//ctx.shadowColor = '#999';
		// ctx.shadowBlur = 4;
		// ctx.shadowOffsetX = 2;
		// ctx.shadowOffsetY = 2;
		//alert(flake.length);
		
		if (flakeval.length < 17) { // this is a half flake.. copy its last char for the full length
			//alert('currentlength ' +flakeval.length);
			halfflake = true;
			var oldlen = flakeval.length;
			for (var i=0; i<oldlen; i++) {
				//flakeval += flakeval.charAt(oldlen-1);
				flakeval += 'z';
			} 
			
		}
		
		// draw the top with 16 points
		for (var i=0; i<16; i++) {
			var dist = (1/valmap.length) * valmap.indexOf(flakeval.charAt(i));
				
			var ang = i * (180/15);
			//drawPoint(ang, dist, loggedinuserflake.charAt(i) );
			if (ang <=  180)
				drawPoint(ang, dist, flakeval.charAt(i) , center_x, center_y, ctx, size, displayletters);
			
				
		}
		
		//alert('top talf drawn');
		for (var i=16; i<flakeval.length; i++) {
			var dist = (1/valmap.length) * valmap.indexOf(flakeval.charAt(i));
				
			var ang = 180 + ((i-15) * (180/(lengthoffullflk - 15)));
			//drawPoint(ang, dist, loggedinuserflake.charAt(i) );
			
			drawPoint(ang, dist, flakeval.charAt(i) , center_x, center_y, ctx, size, displayletters);
				
		}		
		
		if (flakeobj.constructor !== stringConstructor && flakeobj.crtime != null) {
			if (size == 'tiny') {
				
				ctx.fillText(gettimedifference(flakeobj.crtime) , 2, flkcanvas.height-2); 	
			} else {
				ctx.fillText(flakeobj.crtime , 2, flkcanvas.height-2); 
			}	
		}
		
	}
	
	drawborderllines(flkcanvas);
}



function PIXEL_RATIO() {
    var ctx = document.createElement("canvas").getContext("2d"),
        dpr = window.devicePixelRatio || 1,
        bsr = ctx.webkitBackingStorePixelRatio ||
              ctx.mozBackingStorePixelRatio ||
              ctx.msBackingStorePixelRatio ||
              ctx.oBackingStorePixelRatio ||
              ctx.backingStorePixelRatio || 1;

    return dpr / bsr;
}


function createHiDPICanvas (w, h, ratio) {
    if (!ratio) { ratio = PIXEL_RATIO(); }
  //  alert('ratio ' + ratio + ' window.devicepixelratio ' + window.devicePixelRatio);
  // alert(w + ' ' + h);
    
    var can = document.createElement("canvas");
    can.width = w * ratio;
    can.height = h * ratio;
    can.style.width = w + "px";
    can.style.height = h + "px";
    
   // alert('canwidth ' + can.width + ' css width ' + can.style.width);
    can.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    can.getContext("2d").imageSmoothingEnabled = false;
    can.getContext("2d").scale(1/ratio, 1/ratio);
    return can;
}

function getdatefromdatetime(timestr) {	
	//alert(timestr);
	var ttime = Date.parse(timestr);
	var dt = new Date(ttime);
	
	//alert('parsed date ' + dt);
	return (dt.getMonth()+1) + '/'+ dt.getDate() + '/' + dt.getFullYear();
}

function gettimedifferenceinsec(timestr) {
	var currtime = Date.now();
	var oldtime;
	
	if (typeof timestr != 'number') {
		oldtime = Date.parse(timestr);
		//console.log(timestr + ' passed time is string date converted to ' + oldtime);
	} else {
		oldtime = new Date(timestr);
		//console.log(timestr + ' passed time is number date converted to ' + oldtime);
	}
	
	//console.log(timestr + ' parsed time ' + oldtime + ' curr time ' + currtime);
	var diffinms = currtime - oldtime;
	
	return Math.floor(diffinms / 1000);
}

function gettimedifference(timestr, donotreturntime) {
	var currtime = Date.now();
	var oldtime;
	
	if (typeof timestr != 'number') {
		oldtime = Date.parse(timestr);
		//console.log(timestr + ' passed time is string date converted to ' + oldtime);
	} else {
		oldtime = new Date(timestr);
		//console.log(timestr + ' passed time is number date converted to ' + oldtime);
	}
	
	//console.log(timestr + ' parsed time ' + oldtime + ' curr time ' + currtime);
	var diffinms = currtime - oldtime;
	
	return converttimediffmstocalendar(Math.abs(diffinms), donotreturntime);
	

}

function converttimediffmstocalendar(diffinms, donotreturntime) {
	var diffDays = Math.floor(diffinms / 86400000); // days
	var diffHrs = Math.floor((diffinms % 86400000) / 3600000); // hours
	var diffMins = Math.floor(((diffinms % 86400000) % 3600000) / 60000); // minutes
	var diffSecs = Math.floor((((diffinms % 86400000) % 3600000) % 60000) / 1000) ; // seconds
	
	//console.log(diffDays + " days, " + diffHrs + " hours, " + diffMins + " minutes, " + diffSecs + " seconds" + " donotreturntime " + donotreturntime);
	
	if (diffDays > 7) {
		if (typeof donotreturntime != 'undefined') {
			if (donotreturntime == true)
				return Math.floor(diffDays / 7) + ' w ';
			else 
				return diffinms;
		} else {
			return Math.floor(diffDays / 7) + ' w ';
		}
		
	} else {
		if (diffDays >= 1) {
			if (diffDays == 1) return diffDays + " d";
			return diffDays + " d";
		} else {
			if (diffHrs >= 1) {
				if (diffHrs == 1) return diffHrs + " h";
				return diffHrs + " h";
			} else {
				if (diffMins >= 1) {
					return diffMins + " m";
				} else {
					return diffSecs + " s";
				}
			}
		}
	}
	
	
}


function validateDomain() { // this sends emails with code to the whois provided in domain
	var domain = document.getElementById('domainbrandname').value;
	
	//document.getElementById('brandwebsiterow').style.display = 'none';
	if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(domain)) {
		document.getElementById('domainbrandname').style.borderColor = ""; 
		var radios = document.getElementsByName("domainchoiceinputradio");
		
		var validationtype ;
		for(var x = 0; x < radios.length; x++){
	        if(radios[x].type == "radio" && radios[x].checked){
	        	validationtype = radios[x].value;
	        }
	    }
		
		if (validationtype == 0) { // validation by txt record
				
				var xhr = new XMLHttpRequest();
				
				xhr.onreadystatechange = function() {
			        if (xhr.readyState == 4 && xhr.status == 200) {
			        	var jsonres = xhr.responseText;
			        	//alert(jsonres);   
			        	var data = JSON.parse(jsonres);		        	
			        	//alert(data.domain + ' ' + data.emails + ' ' + data.domainkey);   
			        	createuserdomainverkey = data.domainkey;
			        	var emails = data.emails;
			        	var disptext = 'Please create a TXT record in the DNS entry of domain ' + domain  + ' containing this value';
			        	
			        	disptext += '<br><br><b>newauth-domain-verify:' + flakejsonobj.flake + '</b><br><br>';
			        	
			        	disptext += 'Name of the TXT record could be @ or remain blank<br><br>';
			        	disptext += 'Time to live (TTL) of the TXT record could be 86400 or default<br><br>';
			        	
			        	disptext += 'Click Verify when you have added the TXT record.'
			        	
			        	document.getElementById("domainveroptions").style.display = 'none';
			        	document.getElementById("adddomainfeedback").innerHTML = disptext; 
			        	document.getElementById("domainverifybtn").value = 'Verify';
			        	document.getElementById("domainbrandname").style.display = 'none';
			        	document.getElementById("domainbrandname").value = domain;
					    document.getElementById("domainverifybtn").onclick = validateDomainTxt;
					    
			        } else {
			        	document.getElementById("adddomainfeedback").innerHTML = '<font color="red">' + xhr.responseText + '</font>';
			        }
			    }
				
				
				xhr.open('POST', '/newauth/api/adddomain/TXT/' +domain + '/', false);
			    xhr.setRequestHeader('Content-Type', 'application/json');  
			    
			    var reqpacket = JSON.stringify({
		     	   		domainname: domain
		     		});
			     
			    if (document.forms['create-user-form'] !== undefined)
			    	document.forms['create-user-form'].domains.value = domain;
			    //console.log('sending adddomain request');
			    document.getElementById("domainbrandname").value = '';
			    xhr.send(reqpacket);
			
		}
		
		if (validationtype == 1) { // validate by email
			if (confirm('We are sending a code to the emails associated with the domain ' + domain + '. You will need to verify the code to prove your ownership. Are you ready?')) {
				var xhr = new XMLHttpRequest();
				
				xhr.onreadystatechange = function() {
			        if (xhr.readyState == 4 && xhr.status == 200) {
			        	var jsonres = xhr.responseText;
			        	//alert(jsonres);   
			        	var data = JSON.parse(jsonres);		        	
			        	//alert(data.domain + ' ' + data.emails + ' ' + data.domainkey);   
			        	createuserdomainverkey = data.domainkey;
			        	var emails = data.emails;
			        	var disptext = 'A code has been sent to these emails <ul>' ;
			        	
			        	for (var i = 0; i < emails.length; i++) {
			        		disptext += '<li>' + emails[i] + '</li>';
			        	}
			        	disptext += '</ul><br>';
			        	
			        	disptext += 'please enter the code below.<br>'
			        	
			        	document.getElementById("adddomainfeedback").innerHTML = disptext; 
			        	document.getElementById("domainverifybtn").value = 'Verify';
			        	document.getElementById("domainbrandname").placeholder = 'Provide code here';
					    document.getElementById("domainverifybtn").onclick = validateDomainEmail;
					    
			        } else {
			        	document.getElementById("adddomainfeedback").innerHTML = '<font color="red">' + xhr.responseText + '</font>';
			        }
			    }
				
				
				xhr.open('POST', '/newauth/api/adddomain/EMAIL/' +domain + '/', false);
			    xhr.setRequestHeader('Content-Type', 'application/json');  
			    
			    var reqpacket = JSON.stringify({
		     	   		domainname: domain
		     		});
			     
			    if (document.forms['create-user-form'] !== undefined)
			    	document.forms['create-user-form'].domains.value = domain;
			    //console.log('sending adddomain request');
			    document.getElementById("domainbrandname").value = '';
			    xhr.send(reqpacket);
			    
			    return true;	
			} else {
				return false;
			}
		}
		
		
	} else { // invalid domain
		document.getElementById('domainbrandname').style.borderColor = "red"; 
	}
	
	
}

function validateDomainEmail() {
	var domainname = document.forms[0].domains.value;
	
	var code = document.getElementById("domainbrandname").value;
	
	if (code != null && code.length > 0) {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/newauth/api/verifycode', false);
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    
	    xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	          // alert(xhr.responseText);
	        	var jsonres = xhr.responseText;
	        	var data = JSON.parse(jsonres);
	        	
	        	var st = data.status.statuscode;  
	        	
	        	if (st === 'VERIFIED') {
	        		$('#brandModal').modal('hide');
	        		verifiedbranddomainname = domainname;
	        		document.getElementById('brandwebsitenamedisplay').innerHTML = domainname;
	        		//document.getElementById('brandwebsitediv').style.visibility='visible';
	        		//document.getElementById('brandwebsiterow').style.display = 'block';
	        		//document.getElementById('brandwebsiterow').style.visibility='visible'; -- these are not working because of important on the css removing the hidden class
	        		document.getElementById('brandwebsiterow').classList.remove('hidden');
	        	} else {
	        		document.getElementById("adddomainfeedback").innerHTML = '<font color="red">Invalid code. Please check </font>';
	        	}
	        }
	    }		
	    
	    var reqpacket = JSON.stringify({
	    	domain: domainname,
	    	verificationKeyCode: createuserdomainverkey,
	    	verificationKeyInput:code
     		});
	     
	    document.forms['create-user-form'].domains.value = domainname;
	    document.getElementById("domainbrandname").value = 'Provide code here';
	    xhr.send(reqpacket);
	}
}

function validateDomainTxt() {
	var domainname = document.getElementById("domainbrandname").value;
	
	var code = 'newauth-domain-verify:' + flakejsonobj.flake;
	
	if (code != null && code.length > 0) {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/newauth/api/verifycode', false);
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    
	    xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	          // alert(xhr.responseText);
	        	var jsonres = xhr.responseText;
	        	var data = JSON.parse(jsonres);
	        	
	        	var st = data.status.statuscode;  
	        	
	        	if (st === 'VERIFIED') {
	        		$('#brandModal').modal('hide');
	        		verifiedbranddomainname = domainname;
	        		document.getElementById('brandwebsitenamedisplay').innerHTML = domainname;
	        		//document.getElementById('brandwebsitediv').style.visibility='visible';
	        		//document.getElementById('brandwebsiterow').style.display = 'block';
	        		//document.getElementById('brandwebsiterow').style.visibility='visible'; -- these are not working because of important on the css removing the hidden class
	        		document.getElementById('brandwebsiterow').classList.remove('hidden');
	        	} else {
	        		document.getElementById("adddomainfeedback").innerHTML = '<font color="red">We could not verify the code. Please try again later. Do not log out before verifying again. </font>';
	        	}
	        }
	    }		
	    
	    var reqpacket = JSON.stringify({
	    	domain: domainname,
	    	verificationKeyCode: createuserdomainverkey,
	    	verificationKeyInput:code
     		});
	     
	    //document.forms['create-user-form'].domains.value = domainname;
	    //document.getElementById("domainbrandname").value = 'Provide code here';
	    xhr.send(reqpacket);
	}
}

function loadSystemCacheInfo(elem) {
	//displaypageloadingdiv(elem);
	var xhr = new XMLHttpRequest();
	xhr.open('GET', '/newauth/api/getSystemCacheInfo', false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
          // alert(xhr.responseText);
        	removepageloadingdiv();
        	var jsonres = xhr.responseText;
        	var data = JSON.parse(jsonres);        	
        	
        	populateCacheDisplay(data);
        }
    }		    
   
    xhr.send(null);
}


function loadSystemImages(elem) {
	displaypageloadingdiv(elem);
	var xhr = new XMLHttpRequest();
	xhr.open('GET', '/getSystemImages', false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
          // alert(xhr.responseText);
        	removepageloadingdiv();
        	document.getElementById('adminImages').innerHTML = xhr.responseText;
        	$("#adminimagescollapse").collapse("show"); // reopen
        }
    }		    
   
    xhr.send(null);
}

function loadSystemUsersInfo(elem) {
	//displaypageloadingdiv(elem);
	var xhr = new XMLHttpRequest();
	xhr.open('GET', '/newauth/api/getSystemUsersInfo', false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
          // alert(xhr.responseText);
        	//alert('staying');
        	removepageloadingdiv();
        	var jsonres = xhr.responseText;
        	var data = JSON.parse(jsonres);        	
        	
        	populateUsersDisplay(data);
        }
    }		    
   
    xhr.send(null);
}


function loadSystemDBInfo(elem) {
	//displaypageloadingdiv(elem);
	var xhr = new XMLHttpRequest();
	xhr.open('GET', '/newauth/api/getSystemDBInfo', false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
          // alert(xhr.responseText);
        	removepageloadingdiv();
        	var jsonres = xhr.responseText;
        	var data = JSON.parse(jsonres);        	
        	
        	populateDBDisplay(data);
        }
    }		    
   
    xhr.send(null);
}

function populateCacheDisplay(data) {
	
	document.getElementById('cachedisplay').innerHTML = '';
	var rowelem = document.createElement("div");
	rowelem.classList.add('row');
	
	var colelem = document.createElement("div");
	colelem.classList.add('col-xs-12');
	
    	for (var i = 0; i < data.length; i++) {
    		
    		var divelem = document.createElement("div");
    		divelem.classList.add('row');
    		
    		
    		
    		for (var j=0; j<4; j++) {
    			var p = document.createElement("p")  ;
    			var incol = document.createElement("div");
    			incol.classList.add('col-xs-3');

    			if (j == 0) p.appendChild(document.createTextNode(data[i].cachename));
    			
    			if (j ==1) p.appendChild(document.createTextNode(data[i].localentries));
    			
    			if (j == 2) p.appendChild(document.createTextNode(data[i].entries));
    			
    			//if (j == 3) p.appendChild(document.createTextNode(data[i].metrics));
    			
    			incol.appendChild(p);
    			divelem.appendChild(incol);
    			
    		}
    		
    		colelem.appendChild(divelem);
    		
    	}
	
	rowelem.appendChild(colelem);
    document.getElementById('cachedisplay').appendChild(rowelem);
}

function populateUsersDisplay(data) {
	
	document.getElementById('usersdisplay').innerHTML = '';
	var rowelem = document.createElement("div");
	rowelem.classList.add('row');
	
	var colelem = document.createElement("div");
	colelem.classList.add('col-xs-12');
	    		
	var divelem = document.createElement("div");
	divelem.classList.add('row');
	
	for (var j=0; j<3; j++) {
		var p = document.createElement("p")  ;
		var incol = document.createElement("div");
		incol.classList.add('col-xs-4');

		if (j == 0) p.appendChild(document.createTextNode('Users: ' + data.activeusers + '/' + data.usercount));
		
		if (j ==1) p.appendChild(document.createTextNode('Brands: ' + data.brandusercount));
		
		if (j ==2) p.appendChild(document.createTextNode('Admins: ' + data.admincount));
		//if (j == 3) p.appendChild(document.createTextNode(data[i].metrics));
		
		incol.appendChild(p);
		divelem.appendChild(incol);
		
	}
	
	colelem.appendChild(divelem);
		
	rowelem.appendChild(colelem);
    document.getElementById('usersdisplay').appendChild(rowelem);
}



function populateDBDisplay(data) {
	
	document.getElementById('dbdisplay').innerHTML = '';
	var rowelem = document.createElement("div");
	rowelem.classList.add('row');
	
	var colelem = document.createElement("div");
	colelem.classList.add('col-xs-12');
	
	var divelemouter = document.createElement("div");
	divelemouter.classList.add('row');
	
	var colelemouter = document.createElement("div");
	colelemouter.classList.add('col-xs-12');
	
	var p = document.createElement("p")  ;
	
	p.appendChild(document.createTextNode(data.clustername + '[' + data.nodes + ']'));
	colelemouter.appendChild(p);
	
	divelemouter.appendChild(colelemouter);
	
	colelem.appendChild(divelemouter);
	
	for (var i = 0; i < data.nodelist.length; i++) {
		
		var divelem = document.createElement("div");
		divelem.classList.add('row');    		
		
		for (var j=0; j<4; j++) {
			p = document.createElement("p")  ;
			var incol = document.createElement("div");
			

			if (j == 0) {
				incol.classList.add('col-xs-4');
				p.appendChild(document.createTextNode(data.nodelist[i].broadcastAddress + '(' + data.nodelist[i].address + ')'));
			}
			
			if (j ==1) {
				incol.classList.add('col-xs-2');
				p.appendChild(document.createTextNode(data.nodelist[i].datacenter));
			}
			
			if (j == 2) {
				incol.classList.add('col-xs-2');
				p.appendChild(document.createTextNode(data.nodelist[i].rack));
			}
			
			if (j == 3) {
				incol.classList.add('col-xs-4');
				p.appendChild(document.createTextNode(data.nodelist[i].cassandraVersion.major + '.' + data.nodelist[i].cassandraVersion.minor + '.' + data.nodelist[i].cassandraVersion.patch));
			}
			
			incol.appendChild(p);
			divelem.appendChild(incol);
			
		}
		
		colelem.appendChild(divelem);
		
	}
	
	rowelem.appendChild(colelem);
    document.getElementById('dbdisplay').appendChild(rowelem);
}


function convertDivToInput( fieldtoupdate, ownerflake, orgid) {
	//alert(fieldtoupdate);
	var inputdiv = document.getElementById(fieldtoupdate);
	var currentval = inputdiv.textContent;
	var displaytag = inputdiv.children[0];
	inputdiv.innerHTML = '';
	//inputdiv.innerText = '';
	
	var newinput = document.createElement("INPUT");
	newinput.setAttribute("type", "text");
	newinput.setAttribute("name", fieldtoupdate+'-INPUT');
	newinput.setAttribute("value", currentval);
	newinput.setAttribute("size", '30');
	newinput.style.color = '#888888';
	newinput.style.padding = '4px';
	newinput.style.border = 'none';
	newinput.style.borderBottom = '2px solid grey';
	
	var valchangefn = function(evt) {
		var fldname = evt.target.name;
		//alert(fldname + ' value changed to ' + evt.target.value);
		var fieldtoupdate = fldname.replace("-INPUT", "");
		var inputdiv = document.getElementById(fieldtoupdate);
		var displaytag = inputdiv.children[0];
		//inputdiv.innerHTML = '';
		displaytag.innerHTML = '';
		
		displaytag.appendChild(document.createTextNode(evt.target.value));
		
		inputdiv.appendChild(displaytag);
		
		updatenewdataindb(evt.target.value, fieldtoupdate, ownerflake, orgid);
	};
		
	newinput.addEventListener('blur', valchangefn, false);
	newinput.addEventListener("keyup", function(event) {
		 
		 // event.preventDefault();
		  
		  if (event.keyCode === 13 || event.keyCode === 9) { //  13  "Enter" 9 "Tab"
			  valchangefn(event);
		  }
		}); 
						
			
	inputdiv.appendChild(newinput);
	newinput.focus();
}


function loadhomepage() {
	document.title = 'Newauth - Home';
	loadhomepagesection('homepage-location-display');
	loadhomepagesection('homepage-occupation-display');
	loadhomepagesection('homepage-headline-display');
}

function loadorgpagedata() {
	loadhomepagesection('org-location-display', orgownerflake, orgID);
	loadhomepagesection('org-purpose-display', orgownerflake, orgID);
	loadhomepagesection('org-headline-display', orgownerflake, orgID);
}

function loadhomepagesection (sec) {
	var xhr = new XMLHttpRequest();
	var url = '/newauth/api/gethomepagedata/'+sec;
	
	if (orgownerflake != null && orgownerflake.length > 0) {
		url += '/' + orgownerflake + '/' + orgID;
	} else {
		url += '/0/0';
	}
	xhr.open('GET', url , false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var res = xhr.responseText;        	
        	if (res != null && res.length > 0) {
        		var jsonobj = JSON.parse(res);
        		
        		//alert('textvalbetweenptag ' + textvalbetweenptag);
        		if (jsonobj.data != null && jsonobj.data.length > 0) {
        			var tmp = document.createElement("DIV");
         		   	tmp.innerHTML = jsonobj.data;
         		   	var textvalbetweenptag = tmp.textContent || tmp.innerText || ""; // getting text from the data stored in DB
         		   
         		   	if (textvalbetweenptag.length > 0) {
         		   		//alert('innerhtml ' + jsonobj.data);
         		   		//document.getElementById(sec).innerHTML = jsonobj.data;
         		   		populatehomepagedatainsection(textvalbetweenptag, sec);
         		   		
         		   	} 	else {
         		   		//convertDivToInput( sec);	
         		   	}
        		} else {
        			//alert(sec);
        			//convertDivToInput( sec);	
        		}
        	}
        }
    }		    
   
    xhr.send(null);
}

function updatenewdataindb(newval, fieldtoupdate, ownerflake, orgid) {
	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/newauth/api/updatehomepagedata', false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
          // alert(xhr.responseText);
        	populatehomepagedatainsection(newval, fieldtoupdate);
        }
    }		
    
    if (typeof ownerflake == 'undefined') ownerflake = null;
    if (typeof orgid == 'undefined') orgid = null;
    
    var reqpacket = JSON.stringify({
    	section: fieldtoupdate,
    	data: newval,
    	ownerflake: ownerflake,
    	orgid: orgid
    	});
     
   //alert('sending update packet ' + reqpacket);
    xhr.send(reqpacket);
}

function populatehomepagedatainsection(textvalbetweenptag, sec) {
	
	var divelem = document.getElementById(sec);
	if (divelem != null) {
		divelem.innerHTML = '';
		
		var p = document.createElement("p");
		
		if (sec.includes("occupation"))
			p.classList.add('text-muted');
		
		if (sec.includes("headline"))
			p.classList.add('lead');
		
		p.style.color = '#323232';
		p.style.backgroundColor = 'white';	
	
		p.appendChild(document.createTextNode(textvalbetweenptag));
		
		divelem.appendChild(p);
	}
	
}


function loadOrgPage(flake, orgid) {
	//alert('loading org page with flake ' + flake + ' and orgid ' + orgid);
	var url = "/newauth/orgPage/"+flake+"/"+orgid  ;
	fadeoutelement('app');
	
	//location.href = url;
	loadUrlAjax('/newauth/header?page='+orgid, 'app-header');
	loadUrlAjax(url, 'app');
	document.title = 'Newauth - Org';
	
	return false;
}

function displayvideolink(tgtdiv, link) {
	document.getElementById(tgtdiv).innerHTML = '';
	//<iframe width="560" height="315" src="https://www.youtube.com/embed/cc02UUspsJI?rel=0" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
	 var iframe = document.createElement("iframe");
	    iframe.setAttribute("src",
	          "https://www.youtube.com/embed/" + link
	        + "?rel=0&autoplay=0&autohide=1&border=0&wmode=opaque&enablejsapi=1&modestbranding=1&showinfo=0&controls=0"); 
	    
	   // iframe.style.width  = "560";
	  //  iframe.style.height = "315";
	    
	    iframe.setAttribute("frameborder", "0");
	    
	document.getElementById(tgtdiv).appendChild(iframe);
	   
	document.getElementById(tgtdiv).style.display = 'block';
	return false;
}

function removevideo(vplayerid) {
	//alert('about to remove video');
	if (document.getElementById(vplayerid) != null) 
		document.getElementById(vplayerid).innerHTML = '';
}

function flakecheck(anchorobj, evt) {
	evt.preventDefault();
	evt.stopPropagation();
	
	var txtdiv = document.createElement('div');
	txtdiv.setAttribute('id', 'flakecheckinputdiv');
	txtdiv.style.position='absolute';
	//alert(evt.target.id);
	txtdiv.style.bottom = window.getComputedStyle(document.getElementById('username')).getPropertyValue("bottom");
	txtdiv.style.right = window.getComputedStyle(document.getElementById('username')).getPropertyValue("left");
	txtdiv.style.zIndex = '100';
	txtdiv.style.display='block';
	
	var inputbox = document.createElement('input');
	inputbox.setAttribute('id', 'flakecheckinput');
	inputbox.setAttribute('type', 'text');
	inputbox.setAttribute('placeholder', 'Search flake');
	inputbox.style.width = '150px';
	inputbox.style.height = '26px';
	inputbox.style.color = '#434343';
	inputbox.style.fontSize = '15px';
	inputbox.style.border = '2px solid grey';
	

	inputbox.addEventListener('input', function(e) {
		var val = document.getElementById('flakecheckinput').value;
		if (valmap.indexOf(val[val.length -1]) < 0) {
			document.getElementById('flakecheckinput').value = '';
			document.getElementById('flakecheckinput').style.border = "1px solid red";
		}
		if (val.length == 16) {
			inputbox.style.border = '2px solid grey';
			displayThirdPartyFlakeDetails(val, 10,20, 'app');
			$('#flakecheckinputdiv').fadeOut('fast');
			return;
		}
		return handleflakesearch();
	});		
	
	document.getElementById('app').addEventListener('click', function(e){
		if (e.target.id !== 'flakecheckinputdiv' && e.target.id !== 'flakecheckinput') 
			removediv(txtdiv);
	});
	
	txtdiv.appendChild(inputbox);
	document.getElementById('app').appendChild(txtdiv);
	//	alert('added  flakecheck');
	document.getElementById('flakecheckinput').value = '';
	$('#flakecheckinputdiv').fadeIn('fast');
	document.getElementById('flakecheckinput').focus();
	
	return false;
}

function showcontactmodal(anchorobj) {
	//var flake = 'ImwJcPH4YF5JdxMD'; //prod
	var flake = newauthcontactflake;
	generateFlakeOnCanvas('tinymessageflakeholder',newauthcontactflake , 50, 50, 'tiny');
	
	document.getElementById('tinymessageflakeholder').addEventListener('click', function(){
		
		showflakepageinapp(newauthcontactflake);
		$('#contactmodal').modal('hide');
	});
	
	$('#contactmodal').modal('show');
	//document.getElementById('messagetonewauth').focus();
	
	//return false;
}

function manageDisplay(trigger, target, morecontent) { // when mouover on trigger, show target slowly, reverse on mouseout
	var timer = 0;
	$("#" +trigger).mouseenter(function(){
	  timer = setTimeout(function(){		  
		  //alert('hiding extra-elements-in-answer ');
		  $('.extra-elements-in-answer').not("#" + target).hide(); 
	    	$("#" + target).show('fast'); 	    	
	    	
	    },250/* <--- the delay */)
	}).mouseleave(function(){
		if (typeof morecontent == 'undefined' || morecontent == false)	$("#" + target).hide(); 
		
	    clearTimeout(timer);
	});
	
}

function autoGrow(oField) {
  if (oField.scrollHeight > oField.clientHeight) {
    oField.style.height = oField.scrollHeight + "px";
  }
}

function loadtopicimage(topicname, imgid) {
	var xhr = new XMLHttpRequest();
	var url = '/newauth/api/gettopicimage/' + topicname;
	
	xhr.open('GET', url , true);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var res = xhr.responseText;        	
        	if (res != null && res.length > 0) {
        		document.getElementById(imgid).src = res;
        		
        		//alert('after autocomplete');
        	}
        }
    }		    
   
    //console.log('Calling gettopics..' + topicpart );
    xhr.send(null);
}

function topicautocomplete(inp, topicpart) {
	  /*the autocomplete function takes two arguments,
	  the text field element and an array of possible autocompleted values:*/
	//console.log('array in auto complete ' + arr);
	  var currentFocus;
	  /*execute a function when someone writes in the text field:*/
	  inp.addEventListener("input", function(e) {	     
	      
			if (settimeoutid != null)	{
				//console.log('clearing timeout ' + settimeoutid);
				clearTimeout(settimeoutid);
			}
			settimeoutid = setTimeout(function() {findtopicsuggestions(e);}, 300);
			
			document.getElementById('post-global-url').innerHTML = '';
			
			var topicval = e.target.value;			
			
			if (topicval.length > 0) {
				document.getElementById('post-global-url').innerHTML = newauthurl + '/t/' + topicval.replace('#','');				
			} else {
				document.getElementById('post-global-url').innerHTML = newauthurl + '/f/' + loggedinuserflake;
			}			
		
	  });
	  /*execute a function presses a key on the keyboard:*/
	  inp.addEventListener("keydown", function(e) {
	      var x = document.getElementById(this.id + "autocomplete-list");
	      if (x) x = x.getElementsByTagName("div");
	      if (e.keyCode == 40) {
	        /*If the arrow DOWN key is pressed,
	        increase the currentFocus variable:*/
	        currentFocus++;
	        /*and and make the current item more visible:*/
	        addActive(x);
	      } else if (e.keyCode == 38) { //up
	        /*If the arrow UP key is pressed,
	        decrease the currentFocus variable:*/
	        currentFocus--;
	        /*and and make the current item more visible:*/
	        addActive(x);
	      } else if (e.keyCode == 13) {
	        /*If the ENTER key is pressed, prevent the form from being submitted,*/
	        e.preventDefault();
	        if (currentFocus > -1) {
	          /*and simulate a click on the "active" item:*/
	          if (x) x[currentFocus].click();
	        }
	      }
	  });
	  
		function findtopicsuggestions(e) {
			var topicpart = e.target.value;
			if (topicpart.replace('#','').length > 0) {
				if (listoftopics[topicpart] != null) {
					generateoptions(e);					 
					
					document.getElementById('post-global-url').innerHTML = newauthurl + '/t/' + topicpart.replace('#','');
		    		return;
				}
				
				var xhr = new XMLHttpRequest();
				var url = '/newauth/api/gettopics/' + topicpart.replace('#','');
				
				xhr.open('GET', url , false);
			    xhr.setRequestHeader('Content-Type', 'application/json');  
			    
			    xhr.onreadystatechange = function() {
			        if (xhr.readyState == 4 && xhr.status == 200) {
			           
			        	var res = xhr.responseText;        	
			        	if (res != null && res.length > 0) {
			        		//alert(res);
			        		// console.log('got data..' +  res);
			        		 listoftopics[topicpart] = JSON.parse(res);
			        		 generateoptions(e);
			        		
			        		//alert('after autocomplete');
			        	}
			        }
			    }		    
			   
			    //console.log('Calling gettopics..' + topicpart );
			    xhr.send(null);
			}
		}
		
		function generateoptions(e) {
			 var a, b, i, val = e.target.value;      
		      /*close any already open lists of autocompleted values*/
			 //console.log('in generateoptions val ' + val);
		      closeAllLists();
		      if (!val) { return false;}
		      currentFocus = -1;
		      /*create a DIV element that will contain the items (values):*/
		      a = document.createElement("DIV");
		      a.setAttribute("id", e.target.id + "autocomplete-list");
		      a.setAttribute("class", "autocomplete-items");
		      /*append the DIV element as a child of the autocomplete container:*/
		      e.target.parentNode.appendChild(a);
		      
		      /*for each item in the array...*/
		     
		      for (var i = 0; i < listoftopics[val].length; i++) {
		    	 // console.log('adding element for ' + listoftopics[val][i]);
		        /*check if the item starts with the same letters as the text field value:*/
		        if (listoftopics[val][i].substr(1, val.length).toUpperCase() == val.toUpperCase()) {
		          /*create a DIV element for each matching element:*/
		          b = document.createElement("DIV");
		          //b.innerHTML = "<input type='hidden' value='" + listoftopics[val][i] + "'>";
		          /*make the matching letters bold:*/
		          b.innerHTML = "<strong>" + listoftopics[val][i].substr(1, val.length-1) + "<input type='hidden' value='" + listoftopics[val][i] + "'></strong>";
		          b.innerHTML += listoftopics[val][i].substr(val.length);
		          /*insert a input field that will hold the current array item's value:*/
		          
		          /*execute a function when someone clicks on the item value (DIV element):*/
		          b.addEventListener("click", function(ev) {
		              /*insert the value for the autocomplete text field:*/
		        	 // console.log('after event innerhtml' + ev.target.innerHTML);
		              inp.value = ev.target.getElementsByTagName("input")[0].value.replace('#','');
		              inp.existingTopic = "true";
		              document.getElementById('post-global-url').innerHTML = newauthurl + '/t/' + ev.target.getElementsByTagName("input")[0].value.replace('#','');
	        	 
		              /*close the list of autocompleted values,
		              (or any other open lists of autocompleted values:*/
		              closeAllLists();
		          });
		          a.appendChild(b);
		         // console.log('added element for ' + listoftopics[val][i]);
		         //  console.log(b.innerHTML);
		        }
		      }
		}
		
	  function addActive(x) {
	    /*a function to classify an item as "active":*/
	    if (!x) return false;
	    /*start by removing the "active" class on all items:*/
	    removeActive(x);
	    if (currentFocus >= x.length) currentFocus = 0;
	    if (currentFocus < 0) currentFocus = (x.length - 1);
	    /*add class "autocomplete-active":*/
	    x[currentFocus].classList.add("autocomplete-active");
	  }
	  function removeActive(x) {
	    /*a function to remove the "active" class from all autocomplete items:*/
	    for (var i = 0; i < x.length; i++) {
	      x[i].classList.remove("autocomplete-active");
	    }
	  }
	  function closeAllLists(elmnt) {
	    /*close all autocomplete lists in the document,
	    except the one passed as an argument:*/
	    var x = document.getElementsByClassName("autocomplete-items");
	    for (var i = 0; i < x.length; i++) {
	      if (elmnt != x[i] && elmnt != inp) {
	        x[i].parentNode.removeChild(x[i]);
	      }
	    }
	  }
	  /*execute a function when someone clicks in the document:*/
	  document.addEventListener("click", function (e) {
	      closeAllLists(e.target);
	  });
	}


function flakeautocomplete(inp, topicpart) {
	  /*the autocomplete function takes two arguments,
	  the text field element and an array of possible autocompleted values:*/
	//alert('array in flake auto complete ' + topicpart);
	  var currentFocus;
	  /*execute a function when someone writes in the text field:*/
	  inp.addEventListener("input", function(e) {	     
		 // console.log('input event fired  ');
			if (settimeoutid != null)	{
				//console.log('clearing timeout ' + settimeoutid);
				clearTimeout(settimeoutid);
			}
			settimeoutid = setTimeout(function() {findflakesuggestions(e);}, 300);			
			
	  });
	  /*execute a function presses a key on the keyboard:*/
	  inp.addEventListener("keydown", function(e) {
	      var x = document.getElementById(this.id + "autocomplete-list");
	      if (x) x = x.getElementsByTagName("div");
	      if (e.keyCode == 40) {
	        /*If the arrow DOWN key is pressed,
	        increase the currentFocus variable:*/
	        currentFocus++;
	        /*and and make the current item more visible:*/
	        addActive(x);
	      } else if (e.keyCode == 38) { //up
	        /*If the arrow UP key is pressed,
	        decrease the currentFocus variable:*/
	        currentFocus--;
	        /*and and make the current item more visible:*/
	        addActive(x);
	      } else if (e.keyCode == 13) {
	        /*If the ENTER key is pressed, prevent the form from being submitted,*/
	        e.preventDefault();
	        if (currentFocus > -1) {
	          /*and simulate a click on the "active" item:*/
	          if (x) x[currentFocus].click();
	        }
	      }
	  });
	  
		function findflakesuggestions(e) {
			var topicpart = e.target.value;
			if (topicpart.length > 3) {
				if (listofflakes[topicpart] != null) {
					generateoptions(e);					 
					
					//document.getElementById('post-global-url').innerHTML = newauthurl + '/t/' + topicpart.replace('#','');
		    		return;
				}
				
				var xhr = new XMLHttpRequest();
				var url = '/newauth/api/searchflakesstartingwith/' + topicpart;
				
				xhr.open('GET', url , false);
			    xhr.setRequestHeader('Content-Type', 'application/json');  
			    
			    xhr.onreadystatechange = function() {
			        if (xhr.readyState == 4 && xhr.status == 200) {
			           
			        	var res = xhr.responseText;  
			        	//alert('response from searchflakesstartingwith ' + res);
			        	if (res != null && res.length > 0) {
			        		
			        		// console.log('got data..' +  res);
			        		listofflakes[topicpart] = JSON.parse(res);
			        		if (topicpart.length == 16) {
			        			displayThirdPartyFlakeDetails(topicpart, 10,20, 'app');
			        		} else {			        		
			        			generateoptions(e);
			        		}
			        		
			        		//alert('after autocomplete');
			        	}
			        }
			    }		    
			   
			    console.log('Calling searchflakesstartingwith..' + topicpart );
			    xhr.send(null);
			}
		}
		
		function generateoptions(e) {
			 var a, b, i, val = e.target.value;      
		      /*close any already open lists of autocompleted values*/
			 //console.log('in generateoptions val ' + val);
		      closeAllLists();
		      if (!val) { return false;}
		      currentFocus = -1;
		      /*create a DIV element that will contain the items (values):*/
		      a = document.createElement("DIV");
		      a.setAttribute("id", e.target.id + "autocomplete-list");
		      a.setAttribute("class", "autocomplete-items");
		      /*append the DIV element as a child of the autocomplete container:*/
		      e.target.parentNode.appendChild(a);
		      /*for each item in the array...*/
		      
		      if (listofflakes[val].length == 0) {
		    	  b = document.createElement("DIV");
		          //b.innerHTML = "<input type='hidden' value='" + listofflakes[val][i] + "'>";
		          /*make the matching letters bold:*/
		          b.innerHTML = "No results found";
		       
		          /*insert a input field that will hold the current array item's value:*/
		          
		          a.appendChild(b);
		      }
		     
		      for (var i = 0; i < listofflakes[val].length; i++) {
		    	 // console.log('adding element for ' + listofflakes[val][i].flake.substr(0, val.length-1).toUpperCase() + ' ' + val.toUpperCase());
		        /*check if the item starts with the same letters as the text field value:*/
		        if (listofflakes[val][i].flake.substr(0, val.length).toUpperCase() == val.toUpperCase()) {
		          /*create a DIV element for each matching element:*/
		          b = document.createElement("DIV");
		          //b.innerHTML = "<input type='hidden' value='" + listofflakes[val][i] + "'>";
		          /*make the matching letters bold:*/
		          var giveout = '';
		          if (listofflakes[val][i].giveOut != null && listofflakes[val][i].giveOut != listofflakes[val][i].flake)
		        	  giveout = " [" + listofflakes[val][i].giveOut +  "]";
		         
		          b.innerHTML = "<strong>" + listofflakes[val][i].flake.substr(0, val.length) + "<input type='hidden' value='" + listofflakes[val][i].flake + "'></strong>";
		          b.innerHTML += listofflakes[val][i].flake.substr(val.length) + giveout;
		          /*insert a input field that will hold the current array item's value:*/
		          
		          /*execute a function when someone clicks on the item value (DIV element):*/
		          b.addEventListener("click", function(ev) {
		              /*insert the value for the autocomplete text field:*/
		        	 // console.log('after event innerhtml' + ev.target.innerHTML);
		              inp.value = ev.target.getElementsByTagName("input")[0].value;
		            // document.getElementById('post-global-url').innerHTML = newauthurl + '/t/' + ev.target.getElementsByTagName("input")[0].value.replace('#','');
		              displayThirdPartyFlakeDetails(ev.target.getElementsByTagName("input")[0].value, 10,20, 'app');
		  			$('#flakecheckinputdiv').fadeOut('fast');
	        	 
		              /*close the list of autocompleted values,
		              (or any other open lists of autocompleted values:*/
		              closeAllLists();
		          });
		          a.appendChild(b);
		         
		         // console.log('added element for ' + listofflakes[val][i]);
		         //  console.log(b.innerHTML);
		        }
		      }
		}
		
	  function addActive(x) {
	    /*a function to classify an item as "active":*/
	    if (!x) return false;
	    /*start by removing the "active" class on all items:*/
	    removeActive(x);
	    if (currentFocus >= x.length) currentFocus = 0;
	    if (currentFocus < 0) currentFocus = (x.length - 1);
	    /*add class "autocomplete-active":*/
	    x[currentFocus].classList.add("autocomplete-active");
	  }
	  function removeActive(x) {
	    /*a function to remove the "active" class from all autocomplete items:*/
	    for (var i = 0; i < x.length; i++) {
	      x[i].classList.remove("autocomplete-active");
	    }
	  }
	  function closeAllLists(elmnt) {
	    /*close all autocomplete lists in the document,
	    except the one passed as an argument:*/
	    var x = document.getElementsByClassName("autocomplete-items");
	    for (var i = 0; i < x.length; i++) {
	      if (elmnt != x[i] && elmnt != inp) {
	        x[i].parentNode.removeChild(x[i]);
	      }
	    }
	  }
	  /*execute a function when someone clicks in the document:*/
	  document.addEventListener("click", function (e) {
	      closeAllLists(e.target);
	  });
	}

function genericinputautocomplete(inp, topicpart) {
	  /*the autocomplete function takes two arguments,
	  the text field element and an array of possible autocompleted values:*/
	//console.log('array in flake auto complete ' + topicpart);
	  var currentFocus;
	  /*execute a function when someone writes in the text field:*/
	  inp.addEventListener("input", function(e) {	     
		 // console.log('input event fired  ');
			if (settimeoutid != null)	{
				//console.log('clearing timeout ' + settimeoutid);
				clearTimeout(settimeoutid);
			}
			settimeoutid = setTimeout(function() {findusersuggestions(e);}, 300);			
			
	  });
	  /*execute a function presses a key on the keyboard:*/
	  inp.addEventListener("keydown", function(e) {
	      var x = document.getElementById(this.id + "autocomplete-list");
	      if (x) x = x.getElementsByTagName("div");
	      if (e.keyCode == 40) {
	        /*If the arrow DOWN key is pressed,
	        increase the currentFocus variable:*/
	        currentFocus++;
	        /*and and make the current item more visible:*/
	        addActive(x);
	      } else if (e.keyCode == 38) { //up
	        /*If the arrow UP key is pressed,
	        decrease the currentFocus variable:*/
	        currentFocus--;
	        /*and and make the current item more visible:*/
	        addActive(x);
	      } else if (e.keyCode == 13) {
	        /*If the ENTER key is pressed, prevent the form from being submitted,*/
	        e.preventDefault();
	        if (currentFocus > -1) {
	          /*and simulate a click on the "active" item:*/
	          if (x) x[currentFocus].click();
	        }
	      }
	  });
	  
		function findusersuggestions(e) {
			var topicpart = e.target.value;
			if (topicpart.length > 3) {
				if (listofflakes[topicpart] != null) {
					generateoptions(e);					 
					
					//document.getElementById('post-global-url').innerHTML = newauthurl + '/t/' + topicpart.replace('#','');
		    		return;
				}
				
				var xhr = new XMLHttpRequest();
				var url = '/newauth/api/searchuserbyflakeortag/' + topicpart;
				
				xhr.open('GET', url , false);
			    xhr.setRequestHeader('Content-Type', 'application/json');  
			    
			    xhr.onreadystatechange = function() {
			        if (xhr.readyState == 4 && xhr.status == 200) {
			           
			        	var res = xhr.responseText;        	
			        	if (res != null && res.length > 0) {
			        		//alert(res);
			        		// console.log('got data..' +  res);
			        		listofflakes[topicpart] = JSON.parse(res);
			        		 generateoptions(e);
			        		
			        		//alert('after autocomplete');
			        	}
			        }
			    }		    
			   
			    console.log('Calling searchuserbyflakeortag..' + topicpart );
			    xhr.send(null);
			}
		}
		
		function generateoptions(e) {
			 var a, b, i, val = e.target.value;      
		      /*close any already open lists of autocompleted values*/
			 //console.log('in generateoptions val ' + val + ' data ' +  JSON.stringify(listofflakes[val]));
		      closeAllLists();
		      if (!val) { return false;}
		      currentFocus = -1;
		      /*create a DIV element that will contain the items (values):*/
		      a = document.createElement("DIV");
		      a.setAttribute("id", e.target.id + "autocomplete-list");
		      a.setAttribute("class", "autocomplete-items");
		      /*append the DIV element as a child of the autocomplete container:*/
		      e.target.parentNode.appendChild(a);
		      
		      if (listofflakes[val].length == 0) {
		    	  b = document.createElement("DIV");
		          //b.innerHTML = "<input type='hidden' value='" + listofflakes[val][i] + "'>";
		          /*make the matching letters bold:*/
		          b.innerHTML = "No results found";
		       
		          /*insert a input field that will hold the current array item's value:*/
		          
		          a.appendChild(b);
		      }
		      
		      /*for each item in the array...*/
		     
		      for (var i = 0; i < listofflakes[val].length; i++) {
		    	  //console.log('adding element for ' + listofflakes[val][i].giveOut.substr(0, val.length-1).toUpperCase() + ' ' + val.toUpperCase());
		        /*check if the item starts with the same letters as the text field value:*/
		        if (listofflakes[val][i].flake.substr(0, val.length).toUpperCase() == val.toUpperCase() ||
		        		listofflakes[val][i].giveOut.substr(0, val.length).toUpperCase()  == val.toUpperCase() ) {
		          /*create a DIV element for each matching element:*/
		          b = document.createElement("DIV");
		          //b.innerHTML = "<input type='hidden' value='" + listofflakes[val][i] + "'>";
		          /*make the matching letters bold:*/
		          var giveout = '';
		          if (listofflakes[val][i].giveOut != null && listofflakes[val][i].giveOut != listofflakes[val][i].flake)
		        	  giveout = " [" + listofflakes[val][i].giveOut +  "]";
		          
		          b.innerHTML = "<strong>" + listofflakes[val][i].giveOut.substr(0, val.length) + "<input type='hidden' value='" + listofflakes[val][i].flake + giveout + "'></strong>";
		          b.innerHTML += listofflakes[val][i].giveOut.substr(val.length);
		          /*insert a input field that will hold the current array item's value:*/
		          
		          /*execute a function when someone clicks on the item value (DIV element):*/
		          b.addEventListener("click", function(ev, flake) {		        	  
		        	  return function(ev) {
			              /*insert the value for the autocomplete text field:*/
			        	 // console.log('after event innerhtml' + ev.target.innerHTML);
			              inp.value = ev.target.getElementsByTagName("input")[0].value;
			              document.getElementById('orgmemberflake').value = flake;
			            
			              closeAllLists();
		        	  }
		          }( event, listofflakes[val][i].flake));
		          a.appendChild(b);
		         
		          //console.log('added element for ' + listofflakes[val][i]);
		          // console.log(b.innerHTML);
		        }
		      }
		}
		
	  function addActive(x) {
	    /*a function to classify an item as "active":*/
	    if (!x) return false;
	    /*start by removing the "active" class on all items:*/
	    removeActive(x);
	    if (currentFocus >= x.length) currentFocus = 0;
	    if (currentFocus < 0) currentFocus = (x.length - 1);
	    /*add class "autocomplete-active":*/
	    x[currentFocus].classList.add("autocomplete-active");
	  }
	  function removeActive(x) {
	    /*a function to remove the "active" class from all autocomplete items:*/
	    for (var i = 0; i < x.length; i++) {
	      x[i].classList.remove("autocomplete-active");
	    }
	  }
	  function closeAllLists(elmnt) {
	    /*close all autocomplete lists in the document,
	    except the one passed as an argument:*/
	    var x = document.getElementsByClassName("autocomplete-items");
	    for (var i = 0; i < x.length; i++) {
	      if (elmnt != x[i] && elmnt != inp) {
	        x[i].parentNode.removeChild(x[i]);
	      }
	    }
	  }
	  /*execute a function when someone clicks in the document:*/
	  document.addEventListener("click", function (e) {
	      closeAllLists(e.target);
	  });
	}

function postcontenttohome() {	
	
	if (postcontenthome == null) {
		postcontenthome = {};
		postcontenthome.files = [];
	}
	
	var textcontent = document.getElementById('indiv-post-text-input').value;
	postcontenthome.text = textcontent;	
	
	if (postcontenthome.text.length == 0 && (!postcontenthome.files || postcontenthome.files.length == 0) ) {
		console.log('nothing to post');
		return false;
	}
	
	//alert(JSON.stringify(postcontenthome));
	//alert(postcontenthome.text.length + ' ' + postcontenthome.files.length);
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert('Post added ' + xhr.responseText);
        	var newpost = JSON.parse(xhr.responseText);
        	
        	//alert('post added with seq ' + newpost.lastseq);
        	if (parseInt(newpost.lastseq) == 1) {
        		loadHome();
        	} else {
        		refreshposts(newpost);
        	}
        }
    }
	
    xhr.open('POST', '/newauth/api/postcontenttohomepage', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
    var pkt = JSON.stringify({
		"text": postcontenthome.text,
		"files": postcontenthome.files
		});
		
	var bitArray;
	
	if (pkt.length > 1000) {
		bitArray = sjcl.hash.sha256.hash(pkt.substring(0,1000));  
	} else {
		bitArray = sjcl.hash.sha256.hash(pkt);  
	}
	var digest_sha256 = sjcl.codec.hex.fromBits(bitArray);  
	
    xhr.send(JSON.stringify({
						"text": postcontenthome.text,
						"files": postcontenthome.files,
						"hash": digest_sha256
						} ));
    postcontenthome = null;
    document.getElementById('indiv-post-text-input').value = '';
    document.getElementById('indiv-post-text-input').style.height = ''; // textarea height being reset
	
    document.getElementById("attached-file-preview").innerHTML = '';
}


function bannerimgfilechangeeventhandler(bannerimgid) {
	var inputfiles = document.getElementById('bannerimgfile');

	if (inputfiles != null) {
		//alert('files-input found');
		if (debugappui) console.log('attaching eventlistener for change on bannerimgfile');
		inputfiles.addEventListener('change', 
	            function(event) {
					readbannerimage( event, bannerimgid);
					if (debugappui) console.log('changed again');
				},

	            false);
	}

}

function attachedfilechangeeventhandler() {
	var inputfiles = document.getElementById('attachedfiles');

	if (inputfiles != null) {
		//alert('files-input found');
		if (debugappui) console.log('attaching eventlistener for change on attachedfiles');
		inputfiles.addEventListener('change', 
	            function(event) {
					displaypreview( event);
					if (debugappui) console.log('changed again');
				},

	            false);
	}

}

function readbannerimage( evt, bannerimgid, _callback) {
	var files = evt.target.files; // FileList object
	
	   
	var imgcount = 0;
    if (debugappui) console.log('onchange event fired for banner img files');
    for (var i = 0; i< files.length; i++) {
    	
    	var reader = new FileReader();

    	reader.onload = (function (file) {  // Listener in a loop... using closures
    		return function(evt) {
    			updatebannerimage(evt, file, bannerimgid);    	
    	      };    						
    	    
    	})(files[i]);

    	reader.readAsDataURL(files[i]);
    	
    }
    
    if (_callback)
    	_callback(evt.target.imgcount, postcontenthome.files);
     
}

function displaypreview( evt, _callback) {
	var files = evt.target.files; // FileList object
	
	if (postcontenthome == null) {
		postcontenthome = {};
		postcontenthome.files = [];
	}
    // files is a FileList of File objects. List some properties.
	if (!postcontenthome.files)
		postcontenthome.files = [];
    
	var imgcount = 0;
    if (debugappui) console.log('onchange event fired for attachedfiles');
    for (var i = 0; i< files.length; i++) {
    	
    	var reader = new FileReader();

    	reader.onload = (function (file) {
    		return function(evt) {
    			processloadedattachedfile(evt, file);    	
    	      };    						
    	    
    	})(files[i]);

    	reader.readAsDataURL(files[i]);
    	
    }
    
    if (_callback)
    	_callback(evt.target.imgcount, postcontenthome.files);
     
}


function updatebannerimage(e, file, bannerimgid) {	
	
	 imageExists(e.target.result, function(exists){
		 var prevdiv = document.getElementById(bannerimgid);
	        if (exists) { 
	        	//show preview
	        	//alert('is an image will show preview');
	        	var img = document.createElement("img");
	        	img.src = e.target.result;
	        	
	        	var maxwidth = window.screen.availWidth/2;
	        	var maxheight = window.screen.availWidth/4;
	        	
	        	if (maxwidth < 800) maxwidth = 800;
	        	if (maxheight < 600) maxheight = 600;
	        	
	        	var resizedimg = getresizedimage(img, file.type, maxwidth, maxheight);
	        	prevdiv.src = resizedimg; //e.target.result;
	        	
	        	//prevdiv.style.backgroundColor = '#ffffff';
	        	//prevdiv.appendChild(previmg);
	        	
	        	/*postcontenthome.files.push({"name" : file.name,
					"size" : file.size,
					"type" : file.type,
					"content" : resizedimg,
					"thumbnail": getresizedimage(img, file.type, 300, 200)
				});
	        	updatenewdataindb(resizedimg, "home-banner-image");*/
	        	
	        	var xhr = new XMLHttpRequest();
	        	xhr.open('POST', '/newauth/api/updatehomepagedata', false);
	            xhr.setRequestHeader('Content-Type', 'application/json');  	            
	           
	            var reqpacket = JSON.stringify({
	            		section: "home-banner-image",
	            		data: resizedimg
	            	});
	            
	           // alert('bannerimgid ' + bannerimgid);
	            
	            if (bannerimgid.indexOf('org') >= 0) {	            	
	            	reqpacket = JSON.stringify({
	            	    	section: "org-banner-image",
	            	    	data: resizedimg,
	            	    	ownerflake: orgownerflake,
	            	    	orgid: orgID
	            	    	});
	            }
	             
	           //alert('sending update packet ' + reqpacket);
	            xhr.send(reqpacket);
	        	
	        } else {
	        	//alert('not an image');
	        	alert('Not an image file');
	        }
	        
	    /*    if (postcontenthome.files.length > 1) {
       		var countdisp = document.createElement("div");
       		countdisp.classList.add('fade-in');
       		countdisp.style.width = '300';
       		countdisp.style.height = '200';
       		countdisp.style.opacity = '0.6';
       		var heading = document.createElement("h4");
       		heading.style.background = '#515151';
       		heading.classList.add('text-center');
       		heading.appendChild(document.createTextNode("+" + (postcontenthome.files.length -1)));
	        	
       		countdisp.appendChild(heading);
	        	prevdiv.appendChild(countdisp);
       		
       	}*/
	        
	    });
}

function processloadedattachedfile(e, file) {
	
		
	 imageExists(e.target.result, function(exists){
		 var prevdiv = document.getElementById("attached-file-preview");
	        if (exists) { 
	        	//show preview
	        	//alert('is an image will show preview');
	        	var img = document.createElement("img");
	        	img.src = e.target.result;
	        	
	        	var maxwidth = window.screen.availWidth;
	        	var maxheight = window.screen.availHeight;
	        	
	        	if (maxwidth < 800) maxwidth = 800;
	        	if (maxheight < 600) maxheight = 600;
	        	
	        	var resizedimg = getresizedimage(img, file.type, maxwidth, maxheight);
	        	prevdiv.innerHTML = '';
	        	var previmg = document.createElement("IMG");
	        	previmg.classList.add('fade-in');
	        	previmg.style.objectFit = 'cover';
	        	previmg.width = '64';
	        	previmg.height = '64';
	        	previmg.src = resizedimg; //e.target.result;
	        	
	        	prevdiv.style.backgroundColor = '#ffffff';
	        	prevdiv.appendChild(previmg);
	        	
	        	postcontenthome.files.push({"name" : file.name,
					"size" : file.size,
					"type" : file.type,
					"content" : resizedimg,
					"thumbnail": getresizedimage(img, file.type, 200, 200)
				});

	        	
	        } else {
	        	//alert('not an image');
	        	prevdiv.style.backgroundColor = "#989898";
	        	prevdiv.innerHTML = "<h5>File</h5>";
	        	postcontenthome.files.push({"name" : file.name,
					"size" : file.size,
					"type" : file.type,
					"content" : e.target.result
				});

	        }
	        
	        if (postcontenthome.files.length > 1) {
        		var countdisp = document.createElement("div");
        		countdisp.classList.add('fade-in');
        		countdisp.style.width = '64';
        		countdisp.style.height = '64';
        		countdisp.style.opacity = '0.6';
        		var heading = document.createElement("h4");
        		heading.style.background = '#515151';
        		heading.classList.add('text-center');
        		heading.appendChild(document.createTextNode("+" + (postcontenthome.files.length -1)));
	        	
        		countdisp.appendChild(heading);
	        	prevdiv.appendChild(countdisp);
        		
        	}
	        
	    });
}

function getresizedimage(srcimg, type, maxwidth, maxheight) {
	var canvas = document.createElement('canvas');	
	
	//now resize the image
	var MAX_WIDTH = maxwidth;
	var MAX_HEIGHT = maxheight;
	var width = srcimg.width;
	var height = srcimg.height;
	
	//console.log('srcimg w h maxw' + width + ' '+ height + ' '+ MAX_WIDTH);
	 
	if (width > height) {
	  if (width > MAX_WIDTH) {
	    height *= MAX_WIDTH / width;
	    width = MAX_WIDTH;
	  }
	} else {
	  if (height > MAX_HEIGHT) {
	    width *= MAX_HEIGHT / height;
	    height = MAX_HEIGHT;
	  }
	}
	canvas.width = width;
	canvas.height = height;
	
	//console.log('resized w h ' + canvas.width + ' '+ canvas.height);
	var ctx = canvas.getContext("2d");
	ctx.drawImage(srcimg, 0, 0, width, height);
	
	//console.log('returning resized image ' + canvas.toDataURL("image/jpeg"));
	return canvas.toDataURL("image/jpeg");
}

function displaynopostmessageondiv( divid) {
	var cntnr = document.getElementById(divid);
	
	var row = document.createElement('div');
	row.classList.add('panel-body')  ;   //class="panel-body panel-word-wrap"
	row.classList.add('panel-word-wrap')  ;

	var col = document.createElement('div');
	col.classList.add('col-12');
	col.classList.add('text-center');
	
	var p = document.createElement('p');
	p.classList.add('lead');
	p.appendChild(document.createTextNode('This topic does not have any posts currently. '));
	
	var p2 = document.createElement('p');
	p2.appendChild(document.createTextNode('If you would like to post something to this topic, please log in and post your content here'));
	
	col.appendChild(p);
	col.appendChild(p2);
	row.appendChild(col);
	
	cntnr.appendChild(row);
}

function displaypostsondiv(posts, divid, forTopic) { // topic page does not have a header to post on a topic and has a footer
	
	var cntnr = document.getElementById(divid);
	
	if (posts != null) {
		var row = document.createElement('div');
		row.classList.add('panel-body')  ;   //class="panel-body panel-word-wrap"
		row.classList.add('panel-word-wrap')  ;

		var col = document.createElement('div');
		col.classList.add('col-xs-12');
		//col.classList.add('text-center');
	
		var inrow = document.createElement('div');
		inrow.classList.add('row');
		inrow.style.margin = '5px auto 30px auto';
		inrow.style.backgroundColor = 'white';
		inrow.setAttribute('id', 'post-content-row');
		//inrow.classList.add('no-gutters');
		col.appendChild(inrow);
		//alert('count of posts ' + posts.length );
		for (var i=0; i< posts.length; i++) {
			var postdata = JSON.parse(posts[i].data);
			//alert(posts[i].topic);
			if (i == 0) {
				//alert('setting lastpostseq to:' + posts[i].lastseq);
				lastpostseq = posts[i].lastseq;
			}
			
			//alert('flake giveout :' + posts[i].ownerflake + ' ' + posts[i].giveout);
			//alert('post tags :' + posts[i].tags);
			//flakegiveoutmap
			var postelem = null;
			
			var author = posts[i].ownerflake;
			
			if (posts[i].giveout != null && posts[i].giveout.length > 0) author = posts[i].giveout;
			
			//alert(posts[i].ownerflake + " " + author + " " + posts[i].giveout + " " + posts[i].giveouttype + " " + posts[i].convid);
			
			if (typeof postdata.files === 'undefined' || postdata.files == null || postdata.files.length == 0) { // only text
				//alert(postdata.text);
				
				postelem = createTextOnlyPostDisplay(postdata, inrow, posts[i].lastseq, posts[i].ownerflake, forTopic, posts[i].convid);
			} else {
				if (postdata.text == null || postdata.text.length == 0) { // only files
					//alert(postdata.text);
					postelem = createFileOnlyPostDisplay(postdata, inrow, posts[i].lastseq, posts[i].ownerflake, forTopic, posts[i].convid);
					
				} else { // text+files
					postelem = createTextandFilePostDisplay(postdata, inrow, posts[i].lastseq, posts[i].ownerflake, forTopic, posts[i].convid);
				}
			}
			
			if (typeof forTopic != 'undefined' && forTopic == true  )  {
				
				addauthorinfobelowpost(postelem, posts[i].createdate, posts[i].ownerflake, posts[i].lastseq, author, posts[i].tags, posts[i].topic, posts[i].convid);
			}
			
		}		
		
		row.appendChild(col);
		
		cntnr.appendChild(row);
	}
}



function displayconvosondiv(convos, divid, filterbyparticipant) {
	console.log('Starting displayconvosondiv');
	var dv = document.getElementById(divid);
	//dv.innerHTML = JSON.stringify(convos);
	dv.innerHTML = '';
	dv.style.height='70%';
	dv.style.overflowY = 'scroll';
	
	for(var x = 0; x < convos.length; x++){
		
		var panl = document.createElement('div');
		panl.classList.add('panel');
		panl.classList.add('panel-default');
		
		
		var panlh = document.createElement('div');
		panlh.classList.add('panel-heading');
		
		panl.appendChild(panlh);
		
		var rw = document.createElement('div');
		rw.classList.add('row');
		//rw.addAttribute('id', convos[x].convid);
		
		if (typeof filterbyparticipant == 'undefined' || filterbyparticipant ==  false) {
			rw.addEventListener('click', function(convid) {
				
				return function() {
					//alert('handling div click');
					var otherconv = document.getElementsByClassName('conv-details');
					
					for (var o=0; o<otherconv.length; o++){
						otherconv[o].innerHTML = '';
						otherconv[o].parentNode.classList.add('hidden');
						otherconv[o].parentNode.classList.add('visuallyhidden');
					}
				
				loadconversation(convid);
				//document.getElementById('conv-data-' +convid).innerHTML = 'will show ' + convid + ' here';
				document.getElementById('conv-data-' +convid).parentNode.classList.remove('hidden');
				document.getElementById('conv-data-' +convid).parentNode.classList.remove('visuallyhidden');
				};
			}(convos[x].convid)
			);
		}
		var cl1 = document.createElement('div');
		cl1.classList.add('col-xs-4');
		cl1.style.cursor = 'pointer';
		//alert('convo data ' + JSON.stringify(convos[x]));
		var convdate = new Date(convos[x].createdate); // not used anymore 
		
		var headerstr = convos[x].flake.substring(0,4) + '... ';
		
		//if (convos[x].flakecreatetime != null && convos[x].flakecreatetime.length > 0) {
			headerstr += gettimedifference(convos[x].flakecreatetime, true);
		//}
		cl1.appendChild(document.createTextNode(headerstr));
		
		var cl2 = document.createElement('div');
		cl2.classList.add('col-xs-4');
		var cl3 = document.createElement('div');
		cl3.classList.add('col-xs-4');
		
		if (typeof convos[x].tags != 'undefined') {
			var ctags = convos[x].tags;
			var alltags = ctags.toString().split(",");
			//alert('hello');
			for (var o=0; o<alltags.length; o++) {
				var ln = document.createElement('a');
				ln.style.paddingRight = '5px';
				ln.style.cursor = 'pointer';
				ln.addEventListener('click', function(event, alink, convid){
					return function(event) {
						//alert('handling link click');
						event.stopPropagation();
						
						//alert('Will show convs for ' + alink);
						if (document.getElementById('msg-flake-recipient-input') != null)
							document.getElementById('msg-flake-recipient-input').value = alink;
						
						if (typeof filterbyparticipant != 'undefined' && filterbyparticipant == true) {
							var otherconv = document.getElementsByClassName('conv-details');
							
							for (var o=0; o<otherconv.length; o++){
								otherconv[o].innerHTML = '';
								otherconv[o].parentNode.classList.add('hidden');
								otherconv[o].parentNode.classList.add('visuallyhidden');
							}
							
							loadconversationmesagesbyparticipant(convid, null, alink);
						} else
							loadconversationsbyparticipant(null, null, alink);
					};
				}(event,alltags[o], convos[x].convid)
				);
				
				ln.appendChild(document.createTextNode(alltags[o]));
				ln.classList.add('pull-right');
				cl3.appendChild(ln);
				//var sp = document.createElement('span');
				//sp.appendChild(document.createTextNode('&nbsp;'));
				//cl3.appendChild(sp);
			}
			
		}
		
		rw.appendChild(cl1);
		rw.appendChild(cl2);
		rw.appendChild(cl3);
		
		var rwdesc = document.createElement('div');
		rwdesc.classList.add('panel-body');
		rwdesc.classList.add('hidden');
		rwdesc.classList.add('visuallyhidden');
		rwdesc.style.transition = 'all 3s ease-in-out';
		rwdesc.style.display = 'block';
		//rwdesc.style.display = 'none';
				
		var cldesc = document.createElement('div');
		cldesc.classList.add('col-xs-12');
		cldesc.classList.add('conv-details');
		cldesc.setAttribute('id', 'conv-data-' + convos[x].convid);
		
		
		rwdesc.appendChild(cldesc);
		
		panlh.appendChild(rw);
		
		panl.appendChild(panlh);
		panl.appendChild(rwdesc);
		
		dv.appendChild(panl);
	}
	
	console.log('about to end .. showing displayconvosondiv');
	$('#convertransmodal').modal('show');
}

function displaynewpost(post, div) {
	var cntnr = document.getElementById(div);
	
	if (post != null) {
		
		if (document.getElementById('post-content-row') == null) {
			var row = document.createElement('div');
			row.classList.add('panel-body')  ;   //class="panel-body panel-word-wrap"
			row.classList.add('panel-word-wrap')  ;
			
			var col = document.createElement('div');
			col.classList.add('col-12');
			col.classList.add('text-center');
		
			var inrow = document.createElement('div');
			inrow.classList.add('row');
			inrow.style.margin = '5px';
			inrow.setAttribute('id', 'post-content-row');
			
			col.appendChild(inrow);
			row.appendChild(col);
			
			cntnr.appendChild(row);
		}
		
		var contentrow = document.getElementById('post-content-row');
		
		//alert(JSON.stringify(post.lastseq));
		var postdata = JSON.parse(post.data);
		
		//alert('flake from post ' + post.ownerflake);
		if (typeof postdata.files === 'undefined' || postdata.files == null || postdata.files.length == 0) { // only text
			//alert(postdata.text);
			
			createTextOnlyPostDisplay(postdata, contentrow, post.lastseq);
		} else {
			if (postdata.text == null || postdata.text.length == 0) { // only files
				//alert(postdata.text);
				createFileOnlyPostDisplay(postdata, contentrow, post.lastseq);
				
			} else { // text+files
				createTextandFilePostDisplay(postdata, contentrow, post.lastseq);
			}
		}
		
		lastpostseq = post.lastseq;
	}
}

function addauthorinfobelowpost(elem, createdate, flake, seq, author, tags, topic, convid) {
	//alert('in addauthorinfobelowpost cdate ' + createdate);
	var postfooter = document.createElement('div');
	postfooter.classList.add('row');
	postfooter.classList.add('text-center');
	//postfooter.classList.add('no-gutters');
	//postfooter.style.position = 'absolute';
	//postfooter.style.bottom = '0px';
	//postfooter.style.width = '100%';
	//postfooter.style.borderTop = '1px solid gray';
	postfooter.style.color = '#a3a3a3';
	
	//alert(gettimedifference(createdate));
	
	var incol1 = document.createElement('div');
	incol1.classList.add('col-md-4');
	incol1.classList.add('col-xs-6');
	incol1.style.left='3px';
	var dateandtimeparts = createdate.split(' '); //11-27-2019 21:25:18.276 date
	 var dateparts = dateandtimeparts[0].split("-");
	 
	 var yyyyMMdddate = dateparts[2] + "/" + dateparts[0] + "/" + dateparts[1] + " " + dateandtimeparts[1].split(".")[0] + " MST";
	
	var incol2 = document.createElement('div');
	incol2.classList.add('col-md-4');
	incol2.classList.add('col-xs-1');
	incol2.classList.add('text-center');
	
	var incol3 = document.createElement('div');
	incol3.classList.add('col-md-4');
	incol3.classList.add('col-xs-5');
	incol3.classList.add('pull-right');
	//incol3.style.right = '3px';
	
	var link = document.createElement('p');
	//link.setAttribute('href', '/f/' + flake);
	//link.style.leftMargin = '20px';
	link.innerText = author;
	//link.style.float = 'left';
	
	incol3.appendChild(document.createTextNode(gettimedifference(yyyyMMdddate, true) + ' ago'));
	
	incol1.appendChild(link);
	
	//postfooter.appendChild(document.createElement('hr'));
	postfooter.appendChild(incol1);
	postfooter.appendChild(incol2);
	postfooter.appendChild(incol3);
	
	if (typeof tags !== 'undefined' && tags != null && tags.length > 0) {
		var posttags = document.createElement('div');
		posttags.style.display = 'none';
		posttags.innerText = tags;
		posttags.setAttribute('name', 'post-tags');
		
		postfooter.appendChild(posttags);
	}
	
	if (typeof topic !== 'undefined' && topic != null && topic.length > 0) {
		var topc = document.createElement('div');
		topc.classList.add('row');
		//topc.classList.add('no-gutters');
		//topc.style.left = '3px';
		
		var topccol = document.createElement('div');
		topccol.classList.add('col-xs-12');
		//topccol.style.display = 'inline';
		//topccol.style.left = '0px';
		topccol.innerHTML = '<p>Posted to topic: ' + topic + '</p>';
		topccol.setAttribute('name', 'post-topic');
		
		topc.appendChild(topccol);
		postfooter.appendChild(topc);
	}
	
	if (typeof convid !== 'undefined' && convid != null && convid.length > 0) {
		var convicon = document.createElement('img');
		convicon.classList.add('img-responsive');
		//convicon.classList.add('center-block');
		convicon.classList.add('pull-right');
		convicon.style.display = 'inline';
		convicon.style.float = 'left';
		convicon.style.opacity = '.6';
		convicon.width ='14';
		convicon.height = '14';
		//convicon.style.paddingRight = '6px';
		convicon.src = '/static/icons/comment_64.png';
		convicon.onclick = function(){
			loadpostcommmentsontopicpage(convid, flake, seq, topic);
		};
		
		incol3.appendChild(convicon);
	}
	
	elem.parentNode.appendChild(postfooter);
	
}

function loadpostcommmentsontopicpage(convid, flake, seq, topic) {
	
	var cmtdivid = "post-comments";
	
	if (window.innerWidth < 600 || window.innerHeight < 600)
		cmtdivid = "post-comments-mobile";
	
	document.getElementById(cmtdivid).innerHTML = '';
	///loadpostcomments/{convid}/{topic}
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	var url = '/newauth/api/loadpostcomments/' + convid + '/' + topic;
	//alert('in loadpostcommmentsontopicpage ' + convid + ' ' + topic);
	xhr.open('GET', url , false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var res = xhr.responseText;        	
        	if (res != null && res.length > 0) {
        		//alert(res);
        		//console.log('got comments..' +  res);
        		var cleanedcmt = res.replace(/<\/?[^>]+>/gi, '');
        		var cmobj = JSON.parse(cleanedcmt);
        		
        		var loadedcom = 0;
        		for (var i=0; i< cmobj.length; i++) {
        			if (cmobj[i].ok)
        				loadedcom++;
        			displaycommentondiv(cmobj[i], cmtdivid);
        		}
        		
        		if (cmobj.length == 0)
        			document.getElementById(cmtdivid).innerHTML = '<p> No comments to display</p>';
        		else
        			document.getElementById('cmt-count').innerText = '[' + loadedcom + ']';
        		
        		
        		document.getElementById("full-post-display").appendChild(document.getElementById('display-post-comments-modal'));
        		document.getElementById('flk-send-button').onclick = function() {
    				//alert('Add click fired 1');
    				addCommentToPost(convid, topic, flake, seq, crtime);
    			};
        		if (window.innerWidth < 600 || window.innerHeight < 600) {
        			if (cmobj.length > 0) {
        				document.getElementById('topic-post-comment-button').src = '/static/icons/comment-fill-64.png';
        			}
        			//$('#display-post-comments-modal').modal('show');
        		}
        		
        	}
        }
    }		    
   
    xhr.send(null);
	
}

function highlighttopic(topic) {
	document.getElementById('innerhex-'+topic).style.cursor= 'pointer';
	//console.log('mouseenter fired ' +  topic);
	$('#topicname-'+topic).fadeIn(400);
}
function unhighlighttopic(topic) {
	//console.log('mouse leave fired ' + topic);
	document.getElementById('innerhex-'+topic).style.cursor= 'default';
	$('#topicname-'+topic).fadeOut(400);
	//document.getElementById('topicname-'+topic).style.display='none';
}



function showurlinapp(url) {
	//alert('will show topic ' + topic + ' in app');	
	
	//document.body.innerHTML = '';
	fadeoutelement('app');
	var displayloadingcontainer = document.createElement("div");
	displayloadingcontainer.setAttribute("id", "displayloadingcontainer");
	displayloadingcontainer.style.position = 'absolute';
	displayloadingcontainer.style.margin = 'auto'; 
	displayloadingcontainer.style.top='0'; 
	displayloadingcontainer.style.left='0'; 
	displayloadingcontainer.style.right='0'; 
	displayloadingcontainer.style.bottom='0'; 
	displayloadingcontainer.style.width= '200px'; 
	displayloadingcontainer.style.height= '40px' ;	
			
	var loader = document.createElement('div');
	loader.classList.add('loader');
	loader.innerHTML = "<h4>Loading...</h4>";
	displayloadingcontainer.appendChild(loader);	
	
	displayloadingcontainer.style.zIndex = '1000';
	displayloadingcontainer.style.opacity = '1';
	
	document.getElementById('app').appendChild(displayloadingcontainer);
	displayloadingicon();	
	
	//alert('loader added ' );	
	
	var flakeoverlay = document.getElementById("url-in-app-display"); // this id is setup as blocking overlay
	
	if (flakeoverlay != null) {
		removediv(flakeoverlay);
	}	
	
	flakeoverlay = document.createElement("div");
	flakeoverlay.setAttribute("id", "url-in-app-display");
	document.body.appendChild(flakeoverlay);	
	
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	//var url = '/t/' +  topic;
	//alert('in getfullfilefrompost ' + seq + ' ' + flake);
	xhr.open('GET', url , false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var res = xhr.responseText;        	
        	if (res != null && res.length > 0) {
        		//alert(res);
        		// console.log('got data..' +  res);
        		
        		removediv(document.getElementById('app'));
        		
        		flakeoverlay.innerHTML = res;
        		flakeoverlay.style.display = 'inline-block';
        		loadPageScripts('url-in-app-display');
        		clearTimeout(appcalltimeoutid);
        		fadeinelement('app');
        	}
        }
    }		    
   
    xhr.send(null);
    return false;
}


function showurloverapp(url) { // thisdoes not remove the app div
	//alert('will show topic ' + topic + ' in app');	
	
	//document.body.innerHTML = '';
	fadeoutelement('app');
	var displayloadingcontainer = document.createElement("div");
	displayloadingcontainer.setAttribute("id", "displayloadingcontainer");
	displayloadingcontainer.style.position = 'absolute';
	displayloadingcontainer.style.margin = 'auto'; 
	displayloadingcontainer.style.top='0'; 
	displayloadingcontainer.style.left='0'; 
	displayloadingcontainer.style.right='0'; 
	displayloadingcontainer.style.bottom='0'; 
	displayloadingcontainer.style.width= '200px'; 
	displayloadingcontainer.style.height= '40px' ;	
			
	var loader = document.createElement('div');
	loader.classList.add('loader');
	loader.innerHTML = "<h4>Loading...</h4>";
	displayloadingcontainer.appendChild(loader);	
	
	displayloadingcontainer.style.zIndex = '1000';
	displayloadingcontainer.style.opacity = '1';
	
	document.getElementById('app').appendChild(displayloadingcontainer);
	displayloadingicon();	
	
	//alert('loader added ' );	
	
	var flakeoverlay = document.getElementById("url-over-app-display"); // this id is setup as blocking overlay
	
	if (flakeoverlay != null) {
		removediv(flakeoverlay);
	}	
	
	flakeoverlay = document.createElement("div");
	flakeoverlay.setAttribute("id", "url-over-app-display");
	document.body.appendChild(flakeoverlay);	
	
	let closeanchor = document.createElement('span');
    closeanchor.innerHTML = '&times;';
    closeanchor.style.float='right';
    closeanchor.style.padding= '5px';
    closeanchor.style.fontSize= '4em';
    closeanchor.style.top= '-0.4em';
    closeanchor.style.right = '0px';
    closeanchor.style.zIndex = '10000';
    closeanchor.style.position= 'absolute';
    closeanchor.style.display = 'inline-block';
    closeanchor.style.color = 'darkgray';
    closeanchor.style.cursor = 'default';
    closeanchor.addEventListener('mouseover', function(e) {
    	e.target.style.color = '#d3d3d3';
    });
    closeanchor.addEventListener('mouseout', function(e) {
    	e.target.style.color = '#a2a2a2';
    });
    
    closeanchor.addEventListener('click', function() {
    	hideloadingicon();
    	$("#url-over-app-display").fadeOut(200);
    	if (postimagesinterval) clearInterval(postimagesinterval);
    	if (settimeoutid) clearTimeout(settimeoutid);
    	
    	document.body.removeEventListener('click', topicdocumentclick);
    	document.title = 'newauth';

    	//alert('closing ');
    	fadeinelement('app');
    	//loadWelcome();
    });
   
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	//var url = '/t/' +  topic;
	//alert('in getfullfilefrompost ' + seq + ' ' + flake);
	xhr.open('GET', url , false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var res = xhr.responseText;        	
        	if (res != null && res.length > 0) {
        		//alert(res);
        		// console.log('got data..' +  res);        		
        		
        		flakeoverlay.innerHTML = res;
        		flakeoverlay.appendChild(closeanchor);
        		flakeoverlay.style.display = 'inline-block';
        		loadPageScripts('url-over-app-display');
        		clearTimeout(appcalltimeoutid);
        		//fadeinelement('app');
        	}
        }
    }		    
   
    xhr.send(null);
    return false;
}

function showflakepageinapp(flake) {
	fadeoutelement('app');
	var displayloadingcontainer = document.createElement("div");
	displayloadingcontainer.setAttribute("id", "displayloadingcontainer");
	displayloadingcontainer.style.position = 'absolute';
	displayloadingcontainer.style.margin = 'auto'; 
	displayloadingcontainer.style.top='0'; 
	displayloadingcontainer.style.left='0'; 
	displayloadingcontainer.style.right='0'; 
	displayloadingcontainer.style.bottom='0'; 
	displayloadingcontainer.style.width= '200px'; 
	displayloadingcontainer.style.height= '40px' ;	
			
	var loader = document.createElement('div');
	loader.classList.add('loader');
	loader.innerHTML = "<h4>Loading...</h4>";
	displayloadingcontainer.appendChild(loader);	
	
	displayloadingcontainer.style.zIndex = '1000';
	displayloadingcontainer.style.opacity = '1';
	
	document.getElementById('app').appendChild(displayloadingcontainer);
	displayloadingicon();	
	
	//alert('loader added ' );	
	
	var flakeoverlay = document.getElementById("topic-in-app-display"); // this id is setup as blocking overlay
	
	if (flakeoverlay != null) {
		removediv(flakeoverlay);
	}	
	
	flakeoverlay = document.createElement("div");
	flakeoverlay.setAttribute("id", "topic-in-app-display");
	document.body.appendChild(flakeoverlay);	
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	var url = '/f/' +  flake;
	//alert('in getfullfilefrompost ' + seq + ' ' + flake);
	xhr.open('GET', url , false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var res = xhr.responseText;        	
        	if (res != null && res.length > 0) {
        		//alert(res);
        		// console.log('got data..' +  res);
        		
        		//removediv(document.getElementById('app'));
        		
        		flakeoverlay.innerHTML = res;
        		flakeoverlay.style.display = 'inline-block';
        		loadPageScripts('topic-in-app-display');
        		clearTimeout(appcalltimeoutid);
        		
        		let closeanchor = document.createElement('span');
    		    closeanchor.innerHTML = '&times;';
    		    closeanchor.style.float='right';
    		    closeanchor.style.padding= '2px 7px';
    		    closeanchor.style.fontSize= '3em';
    		    closeanchor.style.top= '0px';
    		    closeanchor.style.right = '0px';
    		    closeanchor.style.zIndex = '10000';
    		    closeanchor.style.position= 'absolute';
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
    		    	hideloadingicon();
    		    	document.body.removeEventListener('click', topicdocumentclick);
    		    	$('#topic-in-app-display').fadeOut(200);
    		    	if (postimagesinterval) clearInterval(postimagesinterval);
    		    	if (settimeoutid) clearTimeout(settimeoutid);
    		    	fadeinelement('app');
    		    	//loadWelcome();
    		    });
    		   flakeoverlay.appendChild(closeanchor);
    		  
        	//	fadeinelement('app');
        	}
        }
    }		    
   
    xhr.send(null);
}

function displaycommentondiv(commentobj, targetdivid) {
	
	document.getElementById(targetdivid).style.height = '50%';	
	document.getElementById(targetdivid).style.overflowY = 'scroll';
	document.getElementById(targetdivid).style.backgroundColor = '#fdfdfd';
	if (window.innerWidth > 600 && window.innerHeight > 600)
		document.getElementById(targetdivid).style.boxShadow ='2px 2px 3px #9a9a9a';
	document.getElementById(targetdivid).style.opacity = 0.9;
	var inrow = document.createElement('div');
	inrow.classList.add('row');
	inrow.style.margin = '5px';
	
	inrow.setAttribute("id", "comment-row-" + commentobj.conversationid + '-' + commentobj.crtime);
	
	var col = document.createElement('div');
	col.classList.add('col-12');
	
	var holder = document.createElement('div');
	holder.style.width = '100%';
	
	//holder.style.border = '1px solid darkgrey';
	holder.style.padding='6px';
	//holder.style.boxShadow= '3px 5px 4px #aeaeae';
	holder.style.borderBottom = '1px solid black';
	
	//alert('ok' + commentobj.ok);
	if (!commentobj.ok) {
		
		var removebtn = document.createElement("input");
		removebtn.setAttribute("id", "remove-" + commentobj.conversationid + '-' + commentobj.crtime);
		removebtn.classList.add('btn');
		removebtn.classList.add('btn-primary');
		removebtn.classList.add('btn-xs');
		removebtn.classList.add('pull-right');
		
		removebtn.type = "button";
		removebtn.value = "Remove";
		removebtn.style.backgroundColor = 'tomato';	    
	    
	    var allowbtn = document.createElement("input");
	    allowbtn.setAttribute("id", "allow-" + commentobj.conversationid + '-' + commentobj.crtime);
	    allowbtn.classList.add('btn');
	    allowbtn.classList.add('btn-primary');
	    allowbtn.classList.add('btn-xs');
		//sendbutton.classList.add('pull-right');
		
	    allowbtn.type = "button";
	    allowbtn.value = "Allow";
	    allowbtn.style.backgroundColor = 'green';	
           
	    allowbtn.addEventListener('click', function() {
	    	//alert('will allow this comment .. still to implement');
			finalizecomment(commentobj.conversationid , commentobj.crtime, commentobj.author, true);		
			
		});
		
		removebtn.addEventListener('click', function() {
	    	//alert('will remove this comment .. still to implement');
	    	finalizecomment(commentobj.conversationid , commentobj.crtime, commentobj.author,false);			
	    	
	    });
		
		holder.appendChild(allowbtn); 
		
	    holder.appendChild(removebtn);
	}
	var para = document.createElement('p');
	para.style.textAlign = 'left';
	//para.classList.add('lead');
	para.appendChild(document.createTextNode(commentobj.comment));
	
	//holder.appendChild(document.createElement('br'));
	holder.appendChild(para);
	
	var authrow = document.createElement('div');
	authrow.classList.add('row');
	authrow.style.color = '#898989';
	
	var authcol1 = document.createElement('div');
	authcol1.classList.add('col-xs-8');
	authcol1.style.fontSize = '8';
	
	authcol1.appendChild(document.createTextNode(commentobj.author));
	authrow.appendChild(authcol1);
	
	var authcol2 = document.createElement('div');
	authcol2.classList.add('col-xs-4');
	//authrow.appendChild(authcol2);
	
	var authcol3 = document.createElement('div');
	authcol3.classList.add('col-xs-4');
	authcol3.style.fontSize = '8';
	
	var timediff = gettimedifference(new Date(commentobj.crtime), true) ;
	authcol3.appendChild(document.createTextNode(timediff));
	
	authrow.appendChild(authcol3);
	
	holder.appendChild(authrow);
	
	col.appendChild(holder);

	inrow.appendChild(col);
	
	document.getElementById(targetdivid).appendChild(inrow);
	
}

function finalizecomment(conversationid , crtime, author, allow) {
	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/newauth/api/finalizecomment', false);
    xhr.setRequestHeader('Content-Type', 'application/json');  	  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           if (allow) {
        	   document.getElementById("allow-" + conversationid + '-' + crtime).style.display = 'none';
        	   document.getElementById("remove-" + conversationid + '-' + crtime).style.display = 'none';
           } else {
        	   cleardiv(document.getElementById("comment-row-" + conversationid + '-' + crtime));
           }
        	
        }
    }		    
   
    var reqpacket = JSON.stringify({
    		conversationid: conversationid,
    		crtime: crtime,
    		author: author,
    		topic: topicname,
    		ok: allow
    	});
    
  // alert('sending update packet ' + reqpacket);
    xhr.send(reqpacket);
}

function createTextOnlyPostDisplay(postdata, div, seq, flake, forTopic, convid) {
	
	//alert('text only');
	
	var incol = document.createElement('div');
	//incol.classList.add('col-md-4');
	incol.classList.add('col-xs-12');
	//incol.classList.add('row');
	var divid = '';
	
	if (typeof flake == 'undefined' || flake == null) {
		divid = 'post-seq-' + seq;
	} else {
		divid = 'post-seq-' + seq + '-' + flake;
		seq +=  '-' + flake;
	}
	
	incol.setAttribute('id', divid);	
	incol.style.marginBottom = '40px';
	incol.style.boxShadow= '3px 5px 7px #c9c9c9';
	
	var fixedsizecol = document.createElement('div');
	fixedsizecol.classList.add('row');
	fixedsizecol.style.border = '1px solid lightgrey';
	fixedsizecol.style.margin = "10px";
	fixedsizecol.style.padding = "0px";
	fixedsizecol.style.maxHeight = '200px';
	fixedsizecol.style.backgroundColor = 'white';
	
	//var fixedsizerow = document.createElement('div');
	//fixedsizerow.classList.add('row');
	//fixedsizerow.appendChild(fixedsizecol);
	incol.appendChild(fixedsizecol);
	
	
	if (typeof forTopic == 'undefined' || forTopic == false  )
		addpostheader(fixedsizecol, seq);	
	
	var divforp = document.createElement('div');
	divforp.style.margin = "10px";
	divforp.style.overflowY= 'hidden';
	divforp.style.overflowX= 'hidden';
	//divforp.style.height = '260px';
	divforp.style.textAlign= "left";
	divforp.style.padding = "10px 10px 0px 5px";
	
	divforp.addEventListener('mouseover', function(e) {
		incol.style.opacity = "0.8";
    	highlightpostheader(seq);
    });
	
	divforp.addEventListener('mouseout', function(e) {
		incol.style.opacity = "1";
    	unhighlightpostheader(seq);
    });
	
	divforp.addEventListener('click', function(e) {	
		fadeoutelement('app');
		displayfulluserpost(postdata.text, flake, convid);
    });
    
	var p = document.createElement('p');
	//p.style.position= "relative";
	p.style.textOverflow = 'ellipsis';
	p.style.overflow= 'hidden';
	p.classList.add('first-line-bold');
	p.style.color = '#848484';
	//var strong = document.createElement('strong');
	//p.style.bottom= "0";	
	
	var maxchars = 92;
	p.appendChild(document.createTextNode(postdata.text.substring(0, maxchars)));
	
	if (postdata.text.length > maxchars) {
		var hrf = document.createElement('a');
		hrf.addEventListener('click', function(e) {			
			displayfulluserpost(postdata.text);
	    });
		hrf.appendChild(document.createTextNode('   ...more'));
		p.appendChild(hrf);
	}
	
	//p.appendChild(strong);
	
	divforp.appendChild(p);
	fixedsizecol.appendChild(divforp);
	
	//alert('in text only this seq ' + parseInt(seq) + ' lastpostseq ' + parseInt(lastpostseq));
	if (parseInt(seq) < lastpostseq) {
		div.appendChild(incol);
	} else {
		var lastpost = document.querySelectorAll('div[id^="post-seq-' +lastpostseq + '"]')[0];
		div.insertBefore(incol, lastpost);
	}
	
	return fixedsizecol;
}

function createTextandFilePostDisplay(postdata, div, seq, flake, forTopic, convid) {
	
	//alert('text and file with flake' + flake);
	var incol = document.createElement('div');
	//incol.classList.add('col-md-4');
	incol.classList.add('col-xs-12');
	//incol.classList.add('row');
	//incol.classList.add('text-center');
	var divid = '';
	
	if (typeof flake == 'undefined' || flake == null) {
		divid = 'post-seq-' + seq;
	} else {
		divid = 'post-seq-' + seq + '-' + flake;
		seq +=  '-' + flake;
	}
	
	incol.setAttribute('id', divid);
	//incol.classList.add('border');
	//incol.style.maxHeight = '200px';
	incol.style.marginBottom = '40px';
	incol.style.boxShadow= '3px 5px 7px #c9c9c9';
	
	
	var fixedsizecol = document.createElement('div');
	fixedsizecol.classList.add('row');
	fixedsizecol.style.border = '1px solid lightgrey';
	fixedsizecol.style.margin = "10px";
	fixedsizecol.style.padding = "0px";
	fixedsizecol.style.backgroundColor = 'white';
	fixedsizecol.style.maxHeight = '200px';
	
	//var fixedsizerow = document.createElement('div');
	//fixedsizerow.classList.add('row');
	//fixedsizerow.appendChild(fixedsizecol);
	incol.appendChild(fixedsizecol);
	
	
	if (typeof forTopic == 'undefined' || forTopic == false  )
		addpostheader(incol,seq);	
	
	var hasobjectfile = false;
	var hasobjectfilewithimage = false;
	
	postdata.files.forEach(function (item, index) {
		  if (item.type.indexOf('image') < 0) hasobjectfile = true;
		});
	
	if (hasobjectfile) {
		postdata.files.forEach(function (item, index) {
			  if ( item.type.indexOf('image') >= 0) hasobjectfilewithimage = true;
			});
	}
	
	if (!hasobjectfile) {
		var divforimg = document.createElement('div');
		divforimg.classList.add('col-xs-4');
		divforimg.classList.add('col-md-3');
		//divforimg.style.padding = "0px";
		//divforimg.style.position = "relative";
		
		postdata.files.forEach(function (file, index) {
			var img = document.createElement('img');
			//img.style.top = "0";
			//img.style.width = "100%";
			//img.style.position = "absolute";			
			img.style.maxHeight = '100%';
			//img.style.objectFit = 'cover';
			img.classList.add("img-responsive");
			img.classList.add("center-block");
			img.src = file.thumbnail;
			img.addEventListener('mouseenter', function(e) {
				incol.style.opacity = "0.8";
		    	highlightpostheader(seq);
		    });
			
			if (parseInt(index) > 0) {
				img.style.display = 'none';
			} else {
				img.classList.add("img-responsive");
				img.classList.add("center-block");
			}
			
			img.addEventListener('mouseleave', function(e) {
				incol.style.opacity = "1";
		    	unhighlightpostheader(seq);
		    });
			
			divforimg.appendChild(img);
		});
				
		fixedsizecol.appendChild(divforimg);
			
		divforimg.addEventListener('click', function(e) {	
			fadeoutelement('app');
			//alert(JSON.stringify(postdata));
			getfullfilefrompost(seq, postdata.text, flake, convid);
	    });
	    
		if (parseInt(seq) < lastpostseq) {
			div.appendChild(incol);
		} else {
			var lastpost = document.querySelectorAll('div[id^="post-seq-' +lastpostseq + '"]')[0];
			div.insertBefore(incol, lastpost);
		}
	} else if (hasobjectfilewithimage) {
		
		var divforimg = document.createElement('div');
		//divforimg.style.padding = "0px";
		//divforimg.style.position = "relative";
		divforimg.classList.add('col-xs-4');
		divforimg.classList.add('col-md-3');
		divforimg.style.height = '70px';
		
		
		postdata.files.forEach(function (file, index) {
			if ( file.type.indexOf('image') >= 0) {
				var img = document.createElement('img');
				//img.style.top = "0";
				//img.style.width = "100%";
				//img.style.position = "absolute";			
				img.style.maxHeight = '100%';
				//img.style.objectFit = 'cover';
				img.classList.add("img-responsive");
				img.classList.add("center-block");
				img.src = file.thumbnail;
				img.addEventListener('mouseenter', function(e) {
					incol.style.opacity = "0.8";
			    	highlightpostheader(seq);
			    });
				
				//if (index > 0) {
				//	img.style.display = 'none';
				//}
				
				img.addEventListener('mouseleave', function(e) {
					incol.style.opacity = "1";
			    	unhighlightpostheader(seq);
			    });
				
				divforimg.appendChild(img);
			}
			
			if (file.type.indexOf('image') < 0) {
				//alert('File type ' + file.type + ' name ' + file.name);
				var heading = document.createElement('div');
				heading.setAttribute('id', 'obj-heading-'+seq);
				heading.style.top = '0px';
				heading.style.maxWidth = '90%';
				heading.style.width = '90%';
				heading.style.color = '#323232';
				heading.style.textAlign = 'center';
				heading.style.backgroundColor = '#d2d2d2';
				heading.style.opacity = '0.8';
				heading.style.position = 'absolute';
				heading.style.top = '0px';
				heading.style.margin = '0 auto';
				heading.style.display='none';
				heading.appendChild (document.createTextNode(file.type.replace("application/", "")));
				divforimg.appendChild(heading);
				
				
				var obj = document.createElement('div');
				obj.setAttribute('id', 'obj-filename-'+seq);
				//alert('file alone type ' + postdata.files[0].type);
				//obj.src = postdata.files[0].thumbnail;
				//obj.type = postdata.files[0].type;
				//obj.style.width = '100px';
				//obj.style.height = '100px';
				obj.style.color = '#323232';
				obj.style.margin = '40px 0px 0px 10px';
				obj.style.position = 'absolute';
				//alert(divforimg.height);
				//obj.style.top = parseInt(divforimg.height/2) + 'px';
				obj.style.top = '50px';
				obj.style.backgroundColor = '#d2d2d2';
				obj.style.opacity = '0.8';
				obj.style.display='none';
				obj.appendChild (document.createTextNode(file.name));
				divforimg.appendChild(obj);
				
				divforimg.addEventListener('mouseover', function(e) {		
					
			    	$('#obj-heading-'+seq).show();
			    	$('#obj-filename-'+seq).show();
			    });
				
				divforimg.addEventListener('mouseout', function(e) {					
					$('#obj-heading-'+seq).hide();
			    	$('#obj-filename-'+seq).hide();
			    });
			}
			
		});
				
		fixedsizecol.appendChild(divforimg);
			
		divforimg.addEventListener('click', function(e) {	
			fadeoutelement('app');
			//alert(JSON.stringify(postdata));
			getfullfilefrompost(seq, postdata.text, flake, convid);
	    });
	    
		if (parseInt(seq) < lastpostseq) {
			div.appendChild(incol);
		} else {
			var lastpost = document.querySelectorAll('div[id^="post-seq-' +lastpostseq + '"]')[0];
			div.insertBefore(incol, lastpost);
		}
	
	} else { // object alone
		//alert('file type ' + postdata.files[0].type);
		var divforobj = document.createElement('div');
		divforobj.classList.add('col-xs-4');
		divforobj.classList.add('col-md-3');
		//divforobj.style.padding = "0px";
		//divforobj.style.margin = "0px";
		//divforobj.style.width = "100%";
		//divforobj.style.top = "0px";
		divforobj.style.height = '70px';
		divforobj.style.backgroundColor = '#c3c3c3';
		divforobj.style.opacity = '0.8';
		
		divforobj.addEventListener('mouseenter', function(e) {
			incol.style.opacity = "0.8";
	    	highlightpostheader(seq);
	    });
		
		divforobj.addEventListener('mouseleave', function(e) {
			incol.style.opacity = "1";
	    	unhighlightpostheader(seq);
	    });
		
		divforobj.appendChild (document.createTextNode(postdata.files[0].type.replace("application/", "")));
		
		var obj = document.createElement('div');
		
		//alert('file alone type ' + postdata.files[0].type);
		//obj.src = postdata.files[0].thumbnail;
		//obj.type = postdata.files[0].type;
		//obj.style.width = '100px';
		//obj.style.height = '100px';
		//obj.style.margin = '40px 0px 0px 10px';
		//obj.style.position = 'absolute';
		obj.style.backgroundColor = '#d2d2d2';
		obj.style.opacity = '0.8';
		obj.appendChild (document.createTextNode(postdata.files[0].name));
		divforobj.appendChild(obj);
		
		divforobj.addEventListener('click', function(e) {	
			fadeoutelement('app');
			getfullfilefrompost(seq, postdata.text, flake);
	    });
		fixedsizecol.appendChild(divforobj);
		
	}
	
	//alert('in text and file   this seq ' + seq + 'last post seq ' + lastpostseq);
	if (parseInt(seq) < lastpostseq) {
		div.appendChild(incol);
	} else {
		var lastpost = document.querySelectorAll('div[id^="post-seq-' +lastpostseq + '"]')[0];
		div.insertBefore(incol, lastpost);
	}
	
	var inrow2 = document.createElement('div');
	//inrow2.classList.add('caption');
	//inrow2.classList.add('text-center');
	//inrow2.style.bottom= "0";
	//inrow2.style.position= "absolute";
	inrow2.style.textAlign= "left";
	inrow2.style.position= "relative";
	inrow2.style.padding = "10px 5px 0px 3px";
	
	var incol2 = document.createElement('div');
	//incol2.classList.add('col-md-12');
	incol2.classList.add('col-xs-8');
	incol2.classList.add('col-md-9');
	//incol2.classList.add('text-center');
	
	//inrow2.appendChild(incol2);
	
	var p = document.createElement('p');
	p.style.width = "100%";
	p.style.position= "relative";
	p.style.maxHeight = '80px';
	p.style.overflow = 'hidden';
	p.style.color = '#848484';
	//var strong = document.createElement('strong');
	var maxchars = 92;
	p.classList.add('first-line-bold');
	p.appendChild(document.createTextNode(postdata.text.substring(0, maxchars)));
	
	if (postdata.text.length > maxchars) {
		var hrf = document.createElement('a');
		hrf.onclick = function() {
			loadfulluserpost(postdata, null);
		}
		hrf.appendChild(document.createTextNode('   ...more'));
		p.appendChild(hrf);
	}
	
	//p.appendChild(strong);
	
	incol2.appendChild(p);
	fixedsizecol.appendChild(incol2);
	
	return fixedsizecol;
}


function createFileOnlyPostDisplay(postdata, div, seq, flake, forTopic, convid) {
	//alert(' File only ' +flake);
	var incol = document.createElement('div');
	//incol.classList.add('col-md-4');
	incol.classList.add('col-xs-12');
	//incol.classList.add('row');
	incol.classList.add('text-center');
	
	var divid = '';
	
	if (typeof flake == 'undefined' || flake == null) {
		divid = 'post-seq-' + seq;
	} else {
		divid = 'post-seq-' + seq + '-' + flake;
		seq +=  '-' + flake;
	}
	
	incol.setAttribute('id', divid);
	
	//incol.style.maxHeight = '200px';
	incol.style.marginBottom = '40px';
	incol.style.boxShadow= '3px 5px 7px #c9c9c9';


	var fixedsizecol = document.createElement('div');
	fixedsizecol.classList.add('row');
	fixedsizecol.style.border = '1px solid lightgrey';
	fixedsizecol.style.margin = "10px";
	fixedsizecol.style.padding = "0px";
	fixedsizecol.style.backgroundColor = 'white';
	fixedsizecol.style.maxHeight = '200px';
	
	//var fixedsizerow = document.createElement('div');
	//fixedsizerow.classList.add('row');
	//fixedsizerow.appendChild(fixedsizecol);
	incol.appendChild(fixedsizecol);
	
	
	if (typeof forTopic == 'undefined' || forTopic == false  )
		addpostheader(fixedsizecol,seq);
	
	var hasobjectfile = false;
	var hasobjectfilewithimage = false;
	
	postdata.files.forEach(function (item, index) {
		  if (item.type.indexOf('image') < 0) hasobjectfile = true;
		});
	
	if (hasobjectfile) {
		postdata.files.forEach(function (item, index) {
			  if ( item.type.indexOf('image') >= 0) hasobjectfilewithimage = true;
			});
	}
	
	//alert('hasobjectfile hasobjectfilewithimage ' + hasobjectfile + ' ' + hasobjectfilewithimage);
	if (!hasobjectfile) {
		var divforimg = document.createElement('div');
		divforimg.style.padding = "0px";
		divforimg.style.position = "relative";
		
		postdata.files.forEach(function (file, index) {
			var img = document.createElement('img');
			img.style.top = "0";
			img.style.width = "100%";
			//img.style.position = "absolute";			
			img.style.maxHeight = '100%';
			img.style.objectFit = 'cover';
			
			img.src = file.thumbnail;
			img.addEventListener('mouseover', function(e) {
				incol.style.opacity = "0.8";
		    	highlightpostheader(seq);
		    });
			
			//alert('index value ' + index);
			if (parseInt(index) > 0) {
				img.style.display = 'none';
			} else {
				img.classList.add("img-responsive");
				img.classList.add("center-block");
			}
			
			img.addEventListener('mouseout', function(e) {
				incol.style.opacity = "1";
		    	unhighlightpostheader(seq);
		    });
			
			divforimg.appendChild(img);
		});
				
		fixedsizecol.appendChild(divforimg);
			
		divforimg.addEventListener('click', function(e) {	
			fadeoutelement('app');
			//alert(JSON.stringify(postdata));
			getfullfilefrompost(seq, postdata.text, flake, convid);
	    });
	    
		if (parseInt(seq) < lastpostseq) {
			div.appendChild(incol);
		} else {
			var lastpost = document.querySelectorAll('div[id^="post-seq-' +lastpostseq + '"]')[0];
			div.insertBefore(incol, lastpost);
		}
	} else if (hasobjectfilewithimage) {
		
		var divforimg = document.createElement('div');
		divforimg.style.padding = "0px";
		divforimg.style.position = "relative";
		
		postdata.files.forEach(function (file, index) {
			if ( file.type.indexOf('image') >= 0) {
				var img = document.createElement('img');
				img.style.top = "0";
				img.style.width = "100%";
				//img.style.position = "absolute";			
				img.style.maxHeight = '100%';
				img.style.objectFit = 'cover';
				
				img.src = file.thumbnail;
				img.addEventListener('mouseover', function(e) {
					incol.style.opacity = "0.8";
			    	highlightpostheader(seq);
			    });
				
				var existingimages = divforimg.querySelectorAll('img');
				if (existingimages.length == 1) {
					img.style.display = 'none';
				} else {
					img.classList.add("img-responsive");
					img.classList.add("center-block");
				}
				
				img.addEventListener('mouseout', function(e) {
					incol.style.opacity = "1";
			    	unhighlightpostheader(seq);
			    });
				
				divforimg.appendChild(img);
			}
			
			if (file.type.indexOf('image') < 0) {
				//alert('File type ' + file.type + ' name ' + file.name);
				var heading = document.createElement('div');
				//heading.classList.add("text-center");
				heading.style.maxWidth = '90%';
				heading.style.width = '90%';
				heading.style.textAlign = 'center';
				heading.style.top = '0px';
				heading.setAttribute('id', 'obj-heading-'+seq);
				//heading.style.margin='0 auto';
				//heading.style.fontSize='18px';
				heading.style.position = 'absolute';
				heading.style.color = '#323232';
				heading.style.backgroundColor = '#d2d2d2'
					heading.style.opacity = '0.8';
				heading.style.display='none';
				heading.appendChild (document.createTextNode(file.type.replace("application/", "")));
				divforimg.appendChild(heading);
				
				var obj = document.createElement('div');
				obj.setAttribute('id', 'obj-filename-'+seq);
				//alert('file alone type ' + postdata.files[0].type);
				//obj.src = postdata.files[0].thumbnail;
				//obj.type = postdata.files[0].type;
				//obj.style.width = '100px';
				//obj.style.height = '100px';
				obj.style.color = '#323232';
				obj.style.margin = '40px 0px 0px 10px';
				obj.style.position = 'absolute';
				obj.style.top = '50px';
				obj.style.backgroundColor = '#d2d2d2';
				obj.style.opacity = '0.8';
				obj.style.display='none';
				obj.appendChild (document.createTextNode(file.name));
				divforimg.appendChild(obj);
				
				divforimg.addEventListener('mouseover', function(e) {		
					
			    	$('#obj-heading-'+seq).show();
			    	$('#obj-filename-'+seq).show();
			    });
				
				divforimg.addEventListener('mouseout', function(e) {					
					$('#obj-heading-'+seq).hide();
			    	$('#obj-filename-'+seq).hide();
			    });
			}
			
		});
				
		fixedsizecol.appendChild(divforimg);
			
		divforimg.addEventListener('click', function(e) {	
			fadeoutelement('app');
			//alert(JSON.stringify(postdata));
			getfullfilefrompost(seq, postdata.text, flake, convid);
	    });
	    
		if (parseInt(seq) < lastpostseq) {
			div.appendChild(incol);
		} else {
			var lastpost = document.querySelectorAll('div[id^="post-seq-' +lastpostseq + '"]')[0];
			div.insertBefore(incol, lastpost);
		}
	
	} else { // object alone
		//alert('file type ' + postdata.files[0].type);
		var divforobj = document.createElement('div');
		divforobj.style.padding = "0px";
		divforobj.style.margin = "0px";
		divforobj.style.width = "100%";
		divforobj.style.top = "0px";
		//divforobj.style.height = '200px';
		divforobj.style.color = '#323232';
		divforobj.style.backgroundColor = '#d2d2d2';
		
		divforobj.addEventListener('mouseover', function(e) {
			incol.style.opacity = "0.8";
	    	highlightpostheader(seq);
	    });
		
		divforobj.addEventListener('mouseout', function(e) {
			incol.style.opacity = "1";
	    	unhighlightpostheader(seq);
	    });
		
		divforobj.appendChild (document.createTextNode(file.type.replace("application/", "")));
		
		var obj = document.createElement('div');
		
		//alert('file alone type ' + postdata.files[0].type);
		//obj.src = postdata.files[0].thumbnail;
		//obj.type = postdata.files[0].type;
		//obj.style.width = '100px';
		//obj.style.height = '100px';
		obj.style.margin = '40px 0px 0px 10px';
		obj.style.position = 'absolute';
		obj.style.backgroundColor = '#d2d2d2';
		obj.style.color = '#323232';
		obj.style.opacity = '0.8';
		obj.appendChild (document.createTextNode(file.name));
		divforobj.appendChild(obj);
		
		divforobj.addEventListener('click', function(e) {	
			fadeoutelement('app');
			getfullfilefrompost(seq, postdata.text, flake, convid);
	    });
		fixedsizecol.appendChild(divforobj);
		
		if (parseInt(seq) < lastpostseq) {
			div.appendChild(incol);
		} else {
			var lastpost = document.querySelectorAll('div[id^="post-seq-' +lastpostseq + '"]')[0];
			div.insertBefore(incol, lastpost);
		}
	}
	
	//alert('this seq ' + seq + 'last post seq ' + lastpostseq);
	/*if (parseInt(seq) < parseInt(lastpostseq)) {
		div.appendChild(incol);
	} else {
		var lastpost = document.getElementById('post-seq-' + lastpostseq);
		div.insertBefore(incol, lastpost);
	}*/
	
	return fixedsizecol;
}

function highlightpostheader(seq) {
	
	if (document.getElementById("post-header-"+seq) != null)
		document.getElementById("post-header-"+seq).style.opacity = "0.8";
}

function unhighlightpostheader(seq) {
	if (document.getElementById("post-header-"+seq) != null)
		document.getElementById("post-header-"+seq).style.opacity = "0.1";
}


function getfullfilefrompost(seq, textdata, flake, convid) {
	//displayloadingicon();
	//console.log('loading icon should be visible');
	var xhr = new XMLHttpRequest();
	
	var postdiv = document.getElementById('post-seq-' + seq);
	var tags = null;
	
	if (postdiv != null) {
		var tagsdiv = postdiv.querySelector('div[name="post-tags"]');		
		
		if (tagsdiv != null ){
			tags = tagsdiv.innerText;
			
			//alert('tags found for posts ' + tags);
		}
	}
	
	seq = seq + "";
	if (seq.indexOf('-') >= 0)
		seq = seq.split('-')[0];
	
	var url = '/newauth/api/getpostfullimage/' + flake + '/' + seq;
	//alert('in getfullfilefrompost ' + seq + ' ' + flake);
	xhr.open('GET', url , false);
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
           
        	var res = xhr.responseText;        	
        	if (res != null && res.length > 0) {
        		//alert(res);
        		// console.log('got data..' +  res);
        		 loadfulluserpost(JSON.parse(res), textdata, tags, convid, flake, seq);
        		
        	}
        }
    }		    
   
    xhr.send(null);
}

function loadfulluserpost(postdata, textdata, tags, convid, flake, seq) { // this is different from displayfulluserpost ... how??? No idea :)
												// this one is being used for out-of-app direct access to topics
												// used for displaying full file content after pulling it from server
//	console.log('got data..' +  JSON.stringify(postdata));
//	console.log('got textdata..' +  JSON.stringify(postdata));
	
	hideloadingicon();
	if (appcalltimeoutid != null) {
		clearTimeout(appcalltimeoutid);
	}
	appcalltimeoutid =  null;
	var flakeoverlay = document.getElementById("full-post-display"); // this id is setup as blocking overlay
	
	if (flakeoverlay != null) {
		removediv(flakeoverlay);
	}
	
	//if (flakeoverlay == null) {
		//alert('in createUserFlakeOverlay .. creating new overlay');
		flakeoverlay = document.createElement("div");
		flakeoverlay.setAttribute("id", "full-post-display");
		flakeoverlay.classList.add('effect7');
		
		document.body.appendChild(flakeoverlay);
		
		var cntnr = document.createElement("div");
		cntnr.classList.add('container-fluid');
		//cntnr.style.position = 'relative';
		
		var rowdivhdr = document.createElement("div");
		rowdivhdr.classList.add('row');	
		//rowdivhdr.classList.add('center-block');		
		//rowdivhdr.classList.add('form-group');	
		//rowdivhdr.classList.add('fixed');	
		//rowdivhdr.style.width = '80%';
		rowdivhdr.style.zIndex = 100;			
		
		var coldivhdr = document.createElement("div");
		coldivhdr.classList.add('col-xs-12');
		coldivhdr.classList.add('col-md-12');
		//coldivhdr.classList.add('col-md-offset-2');
		coldivhdr.classList.add('text-center');		
		
		//coldivhdr.appendChild(document.createTextNode('Posted at ' + postdata.createdate + ' by ' + postdata.giveout));
		
		var para = document.createElement('p');
		
		var link = document.createElement('a');
		//link.setAttribute('href', '/f/' + postdata.ownerflake);
		link.onclick = function () {
			displayThirdPartyFlakeDetails(postdata.ownerflake, x,y, "full-post-display");
		};
		if (postdata.giveouttype === 'A')
			link.innerHTML = '<em>'+ postdata.giveout + '</em>';
		
		if (postdata.giveouttype === 'N')
			link.innerHTML = '<strong>'+ postdata.giveout + '</strong>';
		
		if (postdata.giveouttype == null || postdata.giveouttype === 'F') {
			link.setAttribute("id", "tiny-flake-display");
			
		}
		
		link.style.fontSize = '15px';
		//para.appendChild(link);
		var sp = document.createElement('div');
		//sp.style.float = 'right';
		var tnode = document.createTextNode(getdatefromdatetime(postdata.createdate));
		
		para.style.color = '#727272';
		para.style.maxWidth = '100';
		para.appendChild(tnode);
		sp.appendChild(para);
		
		var innerrowhdr = document.createElement("div");
		innerrowhdr.classList.add('row');
		var innercol1 = document.createElement("div");
		innercol1.classList.add('col-xs-4');
		innercol1.classList.add('col-md-4');
		var innercol2 = document.createElement("div");
		innercol2.classList.add('col-xs-4');
		innercol2.classList.add('col-md-4');
		
		var innercol3 = document.createElement("div");
		innercol3.classList.add('col-xs-4');
		innercol3.classList.add('col-md-4');
		
		innercol1.appendChild(link);
		innercol2.appendChild(sp);
		innerrowhdr.appendChild(innercol1);
		innerrowhdr.appendChild(innercol2);		
		
		
		var hdrmenubtns = document.createElement("div");
		hdrmenubtns.classList.add('row');
		hdrmenubtns.classList.add('no-gutters');
		
		var btn1col = document.createElement("div");
		btn1col.classList.add('col-xs-4');
		btn1col.classList.add('col-md-4');
		var btn2col = document.createElement("div");
		btn2col.classList.add('col-xs-4');
		btn2col.classList.add('col-md-4');
		
		var btn3col = document.createElement("div");
		btn3col.classList.add('col-xs-4');
		btn3col.classList.add('col-md-4');
		
		hdrmenubtns.appendChild(btn1col);	
		hdrmenubtns.appendChild(btn2col);	
		hdrmenubtns.appendChild(btn3col);	
		
		 
		 let closeanchor = document.createElement('div');
		//closeanchor.innerHTML = '&times;';
		    closeanchor.innerHTML = '<img width="16" height="16" src="/static/icons/cross-sign.png"/>';
		    closeanchor.style.float='right';
		    closeanchor.style.padding= '8px';
		    closeanchor.style.opacity = 0.5;
		   // closeanchor.style.fontSize= '3em';
		    closeanchor.style.top= '0px';
		    closeanchor.style.display = 'inline-block';
		    //closeanchor.style.color = '#535353';
		    closeanchor.style.cursor = 'default';
		    closeanchor.addEventListener('mouseover', function(e) {
		    	e.target.style.opacity = 0.8;
		    });
		    closeanchor.addEventListener('mouseout', function(e) {
		    	e.target.style.opacity = 0.5;
		    });
		    
		    
		    closeanchor.addEventListener('click', function(e) {
		    	e.stopPropagation();
		    	
		    	if (document.getElementById('display-post-comments-modal') != null) {
		    		//alert('does it come here?');
		    		document.getElementById("topic-page-id").appendChild(document.getElementById('display-post-comments-modal'));
		    		$('#display-post-comments-modal').modal('hide');
		    		document.body.addEventListener('click', topicdocumentclick);
		    	}
		    	$('#full-post-display').fadeOut(200);
		    	//$('.modal-backdrop').remove();
		    	if (postimagesinterval) clearInterval(postimagesinterval);
		    	if (settimeoutid) clearTimeout(settimeoutid);
		    	fadeinelement('app');
		    	
		    });
		    btn3col.appendChild(closeanchor);
		   
		   let reflink = document.createElement('img');
		  // reflink.innerHTML = '<img width="12" height="12" src=/>';
		 //  reflink.style.width = '10';
		 //  reflink.style.height = '10';
		 //  reflink.style.marginRight = '20';
		 //  reflink.style.float='right';
		 //  reflink.style.padding= '2px 7px';
		 //  reflink.style.top= '0px';
		   reflink.src = "/static/icons/link-50.png";
		   reflink.width = 24;
		   reflink.height = 24;
		   
		   if (window.innerWidth < 600 || window.innerHeight < 600) {
			   reflink.width =16;
			   reflink.height = 16;
			}
		   reflink.style.display = 'inline-block';
		   reflink.style.cursor = 'default';
		   reflink.addEventListener('mouseover', function(e) {
		    	e.target.style.color = '#d3d3d3';
		    });
		   reflink.addEventListener('mouseout', function(e) {
		    	e.target.style.color = '#a2a2a2';
		    });
		    
		   reflink.addEventListener('click', function() {
		    	//$('#post-links-modal').modal('show');
			   displaypublicrefsforpost(flake, seq);
		    	
		    });
		   btn2col.appendChild(reflink);
		    
		   if (typeof convid !== 'undefined' && convid != null && convid.length > 0) {
				var convicon = document.createElement('img');
				convicon.setAttribute('id', 'topic-post-comment-button');
				convicon.style.display = 'block';
				convicon.style.float = 'right';
				//convicon.style.float = 'right';
				convicon.style.opacity = '.7';
				convicon.width =24;
				convicon.height = 24;
				
				if (window.innerWidth < 600 || window.innerHeight < 600) {
					convicon.width =18;
					convicon.height = 18;
				}
				//convicon.style.paddingRight = '15px';
				//convicon.style.zIndex = '105';
				convicon.src = '/static/icons/comment_32.png';
				convicon.title = 'Leave a comment';
				convicon.onclick = function(){
					$('#display-post-comments-modal').modal('show');
					document.getElementById('flk-send-button').onclick = function() {
						//alert('Add click fired 2');
						addCommentToPost(convid, postdata.topic, flake, seq, postdata.crtime);
					};
					//displaycommmentsonpostpage(convid, topicname, flake, seq, postdata.crtime);
				};
				
				btn1col.appendChild(convicon);
				
			}
		   
		   innercol3.appendChild(hdrmenubtns);	
		   innerrowhdr.appendChild(innercol3);		
		   coldivhdr.appendChild(innerrowhdr);
			
			rowdivhdr.appendChild(coldivhdr);
			
			cntnr.appendChild(rowdivhdr);
			
			//cntnr.appendChild(document.createElement('hr'));
			
			var rowdiv = document.createElement("div");
			rowdiv.classList.add('row');
			rowdiv.style.marginTop = '50px';
			
			var coldiv = document.createElement("div");
			coldiv.classList.add('col-md-12'); 
			coldiv.classList.add('text-center');
			coldiv.style.float = 'none';
			coldiv.style.margin = '0 auto';
			//coldiv.style.overflowY = 'scroll';
			//coldiv.classList.add('col-md-offset-2');
			
			//coldiv.classList.add('center-block');
			
			var panl = document.createElement("div");
			//panl.classList.add('panel'); 
			//panl.classList.add('panel-default');
			
			 var p = document.createElement('h3');
			// p.classList.add('lead');
			 
			p.appendChild(document.createTextNode(""));
			 p.style.color = "#737373"; 
			 p.style.fontWeight = "900"; 
			
			// panl.appendChild(p);
		 
		 if (typeof postdata.data !== 'undefined') {
			var filesdata = JSON.parse(postdata.data);
			var hasobjectfile = false;
			var hasobjectfilewithimage = false;
			
			if (filesdata != null) {
				filesdata.forEach(function (item, index) {
				  if (item.type.indexOf('image') < 0) hasobjectfile = true;
				});
			
				if (hasobjectfile) {
					filesdata.forEach(function (item, index) {
					  if ( item.type.indexOf('image') >= 0) hasobjectfilewithimage = true;
					});
				}
			}
			//alert('should come here ' + hasobjectfile);
			
			 //var filedata = JSON.parse(postdata.data)[0];
			 var pdh = null;
			 if (!hasobjectfile) {
				 if (filesdata != null) {
					 filesdata.forEach(function (filedata, index) {
						 if (filedata.type.indexOf('image') >= 0) {
							 pdh = document.createElement('img');
							 pdh.style.maxWidth = "100%";
							 pdh.style.maxHeight = "80%";
							 pdh.style.top = "0";
							// pdh.style.position = "absolute";
							 pdh.style.zIndex = "1";
							// pdh.style.maxHeight = '70%';
							 //pdh.style.objectFit = 'cover';
							 pdh.style.padding = '0px';
							// pdh.classList.add("img-responsive");
							// pdh.classList.add("center-block");
							 pdh.src = filedata.content;
							 
							 var imgarr = JSON.parse(postdata.data);
							 if(imgarr.length > 1) {
								 var imgholder = document.createElement('div');
								// imgholder.classList.add('stack'+1);
								 imgholder.style.position = 'relative';
								 imgholder.addEventListener('mouseover', function(e) {
									 	showadditionalcontentindicator(pdh);
								    	settimeoutid = setTimeout(function() {
												    		updateimagesonelement(imgarr, pdh);
												    	}, 600);
								    });
								 imgholder.addEventListener('mouseout', function(e) {
								    	clearInterval(postimagesinterval);
								    	clearTimeout(settimeoutid);
								    });
								
								 imgholder.appendChild(pdh); 
								 panl.appendChild(imgholder);
							 } else {
								 panl.appendChild(pdh);
							 }
						 } 
					 });
				 }
			 } else {
				 if (filesdata != null) {
					 filesdata.forEach(function (filedata, index) {
						 if (filedata.type.indexOf('image') < 0) {
							// alert('will show full content');
							 
							 if (window.navigator && window.navigator.msSaveOrOpenBlob) {
								 var objdata = filedata.content.replace(/^[^,]+,/, '');
								 var blob = base64toBlob(objdata, filedata.type);
								 window.navigator.msSaveOrOpenBlob(blob, filedata.name);
							 } else if (window.navigator.userAgent.match(/iPad/i) || window.navigator.userAgent.match(/iPhone/i)) {
								 var fallbk = document.createElement("a");
								 
								// var objdata = filedata.content.replace(/^[^,]+,/, '');
								// var blob = base64toBlob(objdata, filedata.type);
								 fallbk.setAttribute('href', filedata.content);
								 fallbk.setAttribute('download',filedata.name);
								 //fallbk.click();
								//  setTimeout(function(){
								    // For Firefox it is necessary to delay revoking the ObjectURL
								//    window.URL.revokeObjectURL(blob);
								//  }, 100);
								 fallbk.appendChild(document.createTextNode(' Click to download the file'));
								 panl.appendChild(document.createTextNode('Document preview is not working. '));
								 panl.appendChild(fallbk);
								    					 
							 } else {
								pdh = document.createElement('object');
								 
								 if (window.innerWidth > 800) {
									 pdh.style.width = parseInt(window.innerWidth*66/100) + 'px';
									 pdh.style.height = parseInt(window.innerHeight*70/100) + 'px';
								 }
								 pdh.setAttribute("data", filedata.content);
								 pdh.setAttribute("id", "createuser-flake-text-header");
								 
								 if (filedata.type.length == 0)
									 pdh.setAttribute("type", "text/plain");
								 else
									 pdh.setAttribute("type", filedata.type);
								 				 
								 // pdh.appendChild(document.createTextNode("Post"));
								 pdh.style.color = "#737373";
								 pdh.style.fontWeight = "700";
								 
								 
								/* pdh = document.createElement("iframe");
								 pdh.setAttribute("src", filedata.content); 
								 if (window.innerWidth > 800) {
									 pdh.setAttribute("width", parseInt(window.innerWidth*66/100) + 'px'); 
									 pdh.setAttribute("height", parseInt(window.innerHeight*70/100) + 'px'); 
								 } else {
								 	 pdh.setAttribute("width", parseInt(window.innerWidth*66/100) + 'px'); 
									 pdh.setAttribute("height", parseInt(window.innerHeight*80/100) + 'px'); 
								 }
								 if (filedata.type.length == 0)
									 pdh.setAttribute("type", "text/plain");
								 else
									 pdh.setAttribute("type", filedata.type);
								    
								 pdh.setAttribute("frameborder", "0");*/
								 
								 var emb = document.createElement("embed");
								 //emb.setAttribute("src", filedata.content);
								 emb.setAttribute("src", filedata.content);
								 emb.setAttribute("type", filedata.type);
								 if (window.innerWidth > 800) {
									 emb.setAttribute('width', parseInt(window.innerWidth*66/100) + 'px');
									 emb.setAttribute('height', parseInt(window.innerHeight*70/100) + 'px');
									
								 }
								 
								 var fallbk = document.createElement("a");
								 
								 //alert(filedata.type);
								var objdata = filedata.content.replace(/^[^,]+,/, '');
								 
								 var blob = base64toBlob(objdata, filedata.type);
								 
								//  alert(filedata.content.substring(0, 50)  + '\n' + objdata.substring(0, 50) + '\n' + 'BLOB created');
								
								 fallbk.setAttribute('href', filedata.content);
								 fallbk.setAttribute('download',filedata.name);
								 //fallbk.click();
								  setTimeout(function(){
								    // For Firefox it is necessary to delay revoking the ObjectURL
								    //window.URL.revokeObjectURL(blob);
								  }, 100);
								  emb.appendChild(document.createTextNode('Document preview is not working.'));
								 fallbk.appendChild(document.createTextNode('Click to download the file'));
								 emb.appendChild(fallbk);
								  				 
								 //pdh.appendChild(emb);
								// panl.appendChild(pdh);
								 panl.appendChild(emb);
							 }
						 }
					 });
				 }
			 }
		 }
		 
		 var inputrowp = document.createElement("div");
			inputrowp.classList.add('row');
			
		var inputcolp = document.createElement("div");
		inputcolp.classList.add('col-sm-8');
		inputcolp.classList.add('col-sm-offset-2');
		 
		 var pd = document.createElement('div');
		 //pd.classList.add('text-muted');
		 //pd.style.textAlign = 'center';
		 pd.style.wordWrap = 'break-word';
		 pd.style.padding = '5px';
		 pd.style.height = window.innerHeight * 70/100;
		 pd.style.overflowY = 'auto';
		 pd.setAttribute("id", "createuser-flake-text");
		 var textpresent = false;
		 if (typeof postdata.text  !== 'undefined') {
			 //pd.appendChild(document.createTextNode(postdata.text));
			 
			 var lines = postdata.text.split(/\r\n|\n\r|\n|\r/);
			 
			 for (var l=0; l<lines.length; l++) {
				var p = document.createElement('p');
					if (l == 0) p.classList.add('first-line-bold');
		 			p.classList.add('text-muted');
		 			p.style.textAlign = 'left';
		 			p.appendChild(document.createTextNode(lines[l]));
		 			pd.appendChild(p);
			 }
			 //console.log(lines);
			 textpresent =  true;
		 } else {
			 if (textdata != null) {
				 //pd.appendChild(document.createTextNode(textdata));
				 var lines = textdata.split(/\r\n|\n\r|\n|\r/);
				 for (var l=0; l<lines.length; l++) {
					var p = document.createElement('p');
						if (l == 0) p.classList.add('first-line-bold');
			 			p.classList.add('text-muted');
			 			p.style.textAlign = 'left';
			 			p.appendChild(document.createTextNode(lines[l]));
			 			pd.appendChild(p);
				 	}
			 	//console.log(lines);
				 textpresent =  true;
			 }
		 }
		 pd.style.color = "#878787"; 
		 
		
		 if (textpresent ==  true) {
			 inputcolp.appendChild(pd);
			 inputrowp.appendChild(inputcolp);		 
				
			 panl.appendChild(inputrowp);		
			
		 }		 
		  
		 coldiv.appendChild(panl);
		 
		rowdiv.appendChild(coldiv);
		cntnr.appendChild(rowdiv);
		flakeoverlay.appendChild(cntnr);
			
		if (postdata.giveouttype == null || postdata.giveouttype === 'F') {
			document.getElementById('tiny-flake-display').width = '50';
			document.getElementById('tiny-flake-display').height = '50';
			//alert(postdata.giveout);
			generateFlakeOnCanvas('tiny-flake-display', postdata.giveout, 50, 50, 'tiny');
		}
	//}	
	
		if (typeof tags !== 'undefined' && tags != null) {
			splashTagsInbackground(flakeoverlay, tags);
		}
	settimeoutid = setTimeout(function(){ 
				//flakeoverlay.style.display = "block";
				$('#full-post-display').fadeIn('fast');
				document.getElementById('full-post-display').style.zIndex = '10000';
			}, 100);
}

function displaypublicrefsforpost(flake, seq) {
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var res = xhr.responseText;
        	
        	if (res != null && res.length > 0)
        		loadpublicrefsforpost(JSON.parse(res));
        	else
        		loadpublicrefsforpost(null);
        }
    }
	
    xhr.open('POST', '/newauth/api/getpostrefs', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');  
    
    xhr.send(JSON.stringify({
		"flake": flake,
		"sequence": seq
	} ));
}

function loadpublicrefsforpost(refs) {
	
	var flakeoverlay = document.getElementById('public-ref-display');
		
	if (flakeoverlay == null) {
		//alert('in displaycommmentsonpostpage .. creating new overlay topic name ' + topic);
		flakeoverlay = document.createElement("div");
		flakeoverlay.setAttribute("id", "public-ref-display");
		
		
		document.getElementById("full-post-display").appendChild(flakeoverlay);
		
		var cntnr = document.createElement("div");
		cntnr.classList.add('container-fluid');
		//cntnr.classList.add('v-center');
			
		var rowdiv = document.createElement("div");
		rowdiv.classList.add('row');
		rowdiv.classList.add('no-gutters');		
		
		var coldiv = document.createElement("div");
		coldiv.classList.add('col-md-4'); 
		coldiv.classList.add('col-md-offset-8');
		coldiv.classList.add('col-xs-12'); 
		
		var panl = document.createElement("div");
		panl.classList.add('panel'); 
		panl.classList.add('panel-default');
		panl.style.boxShadow = "3px 5px 4px #aeaeae";
		
		flakeoverlay.addEventListener('click', function() {
	    	$('#do-comment-overlay').fadeOut(400);
	    	removediv(document.getElementById('public-ref-display'));
	    	
	    });
		
		panl.addEventListener('click', function(e) {
	    	e.stopPropagation();
	    	
	    });
		
		panl.setAttribute("id", "public-ref-display-content");
		 var p = document.createElement('h3');
		// p.classList.add('lead');
		 
		 if (refs != null) {
			 p.appendChild(document.createTextNode("This post has been shared as"));
		 }
		//p.classList.add('text-left');
		 p.style.color = "#737373"; 
		 p.style.fontWeight = "500"; 
		
		 panl.appendChild(p);
		 
		 let closeanchor = document.createElement('span');
		    closeanchor.innerHTML = '&times;';
		    closeanchor.style.float='right';
		    closeanchor.style.padding= '2px 7px';
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
		    	$('#public-ref-display').fadeOut(200);
		    	removediv(document.getElementById('public-ref-display'));
		    	
		    });
		    coldiv.appendChild(closeanchor);
		 
			
			
		 var inputdiv = document.createElement("div");
			inputdiv.classList.add('panel-body');
			inputdiv.classList.add('panel-word-wrap');
			//inputdiv.style.backgroundColor = "#c2c2c2"; 
			
			var inputrow  = document.createElement("div");
				inputrow.classList.add('row');
				
			var inputcol = document.createElement("div");
			inputcol.classList.add('col-xs-10');
			inputcol.classList.add('col-xs-offset-1');
			
			inputcol.setAttribute('id', 'create-flk-input-holder');
			
			if (refs == null) {
				var para = document.createElement('p');
				para.classList.add('text-left');
				//para.classList.add('lead');
				para.appendChild(document.createTextNode("This post has not been shared on another topic or flake"));
				
				inputcol.appendChild(para);
			} else {
				for (var i=0; i<refs.length; i++) {
					
					var innerrow = document.createElement('div');
					innerrow.classList.add('row');
					var innercol1 = document.createElement('div');
					innercol1.classList.add('col-xs-9');
					var innercol2 = document.createElement('div');
					innercol2.classList.add('col-xs-3');
					
					innerrow.appendChild(innercol1);
					innerrow.appendChild(innercol2);
					
					var para = document.createElement('p');
					para.classList.add('text-left');
					para.classList.add('lead');
					para.appendChild(document.createTextNode(refs[i]));
					
					var sp = document.createElement('button');
					sp.style.float = 'right';
					sp.style.top = '0';
					sp.appendChild(document.createTextNode('Copy Link'));
					
					var copybtn = document.createElement("input");
					copybtn.setAttribute("id", "copy-url-" + refs[i]);
					copybtn.classList.add('btn');
					//copybtn.classList.add('btn-primary');
					copybtn.classList.add('btn-xs');
					copybtn.classList.add('pull-right');
					
					copybtn.type = "button";
					copybtn.value = "Copy Link";
					//copybtn.style.backgroundColor = 'tomato';	
					
					copybtn.addEventListener('click', function( uri) {
						//alert(newauthurl + refs[i]);
						return function() {
							var dummy = document.createElement("input");
						    document.body.appendChild(dummy);
						    dummy.setAttribute('value', newauthurl + uri);
						    dummy.select();
						    document.execCommand("copy");
						    document.body.removeChild(dummy);
						    removediv(document.getElementById('public-ref-display'));
						}
					    				    	
				    }(refs[i]));
					
					innercol1.appendChild(para);
					innercol2.appendChild(copybtn);
					inputcol.appendChild(innerrow);
				}
			}
			
			inputrow.appendChild(inputcol);
			
			inputdiv.appendChild(inputrow);			
			
			
		panl.appendChild(inputdiv);
		 
		 coldiv.appendChild(panl);
		 
		rowdiv.appendChild(coldiv);
		
			
		cntnr.appendChild(rowdiv);
		

		flakeoverlay.appendChild(cntnr);
	

		  $('#comment-input').focus();
	
	}
	
	settimeoutid = setTimeout(function(){ 
				//flakeoverlay.style.display = "block";
				$('#public-ref-display').fadeIn('fast');
			}, 200);
	
}





function displaycommmentsonpostpage(convid, topic, flake, seq, crtime) {
	
	var flakeoverlay = document.getElementById("do-comment-overlay"); // this id is setup as blocking overlay
	
	if (flakeoverlay == null) {
		//alert('in displaycommmentsonpostpage .. creating new overlay topic name ' + topic);
		flakeoverlay = document.createElement("div");
		flakeoverlay.setAttribute("id", "do-comment-overlay");		
		
		document.getElementById("full-post-display").appendChild(flakeoverlay);
		
		var cntnr = document.createElement("div");
		cntnr.classList.add('container-fluid');
		//cntnr.classList.add('v-center');
			
		var rowdiv = document.createElement("div");
		rowdiv.classList.add('row');
		rowdiv.classList.add('no-gutters');		
		
		var coldiv = document.createElement("div");
		coldiv.classList.add('col-md-4'); 
		coldiv.classList.add('col-md-offset-8');
		coldiv.classList.add('col-xs-12'); 
		
		var panl = document.createElement("div");
		panl.classList.add('panel'); 
		panl.classList.add('panel-default');
		
		flakeoverlay.addEventListener('click', function() {
	    	$('#do-comment-overlay').fadeOut(400);
	    	removediv(document.getElementById('do-comment-overlay'));
	    	
	    });
		
		panl.addEventListener('click', function(e) {
	    	e.stopPropagation();
	    	
	    });
		
		panl.setAttribute("id", "do-comment-overlay-content");
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
		    	$('#do-comment-overlay').fadeOut(200);
		    	removediv(document.getElementById('do-comment-overlay'));
		    	
		    });
		    coldiv.appendChild(closeanchor);
		 
			
			
		 var inputdiv = document.createElement("div");
			inputdiv.classList.add('panel-body');
			inputdiv.classList.add('panel-word-wrap');
			//inputdiv.style.backgroundColor = "#c2c2c2"; 
			
			var inputrow  = document.createElement("div");
				inputrow.classList.add('row');
				
			var inputcol = document.createElement("div");
			inputcol.classList.add('col-sm-8');
			inputcol.classList.add('col-sm-offset-2');
			inputcol.classList.add('col-xs-9');
			
			inputcol.setAttribute('id', 'create-flk-input-holder');
			
			inputrow.appendChild(inputcol);
			
			inputdiv.appendChild(inputrow);			
			
			var cuflkinput = document.createElement("textarea");
			cuflkinput.setAttribute("type", "text");
			cuflkinput.style.fontSize= "14px";
			cuflkinput.style.color= "#848484";	
			cuflkinput.setAttribute("placeholder", "Add your comments");
			cuflkinput.setAttribute("id", "comment-input");
			cuflkinput.setAttribute("autofocus", "true");
			cuflkinput.classList.add('form-control');
			cuflkinput.classList.add('input-md');
			//cuflkinput.addEventListener('input', prepareSendButton, false);
			cuflkinput.addEventListener('keydown', function(e){ 				
				
				autoGrow(event.target);
			
			}, false);
			
			cuflkinput.addEventListener('input', function(){ 				
				
					$('#flk-send-button').fadeIn('slow');
				
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
			sendbutton.value = "Add";
			sendbutton.style.display = 'none';
			//sendbutton.addEventListener('click', function() {
			//	//alert('Add click fired');
			//	addCommentToPost(convid, topic, flake, seq, crtime);
			//}, false);			
			
			sendbutton.onclick = function() {
				//alert('Add click fired topic '+ topic);
				addCommentToPost(convid, topic, flake, seq, crtime);
			};
			
			//alert('add button evt handler set');
			
			var inputcol2 = document.createElement("div");
			inputcol2.classList.add('col-sm-2');
			inputcol2.classList.add('col-xs-3');
			inputrow.appendChild(inputcol2);
			
			inputcol.appendChild(cuflkinput);
			inputcol2.appendChild(sendbutton);
			
			inputdiv.appendChild(inputrow);
			
			inputdiv.appendChild(document.createElement('br'));		

			var inputrow2  = document.createElement("div");
			inputrow2.classList.add('row');
			
		var inputcol3 = document.createElement("div");
		inputcol3.classList.add('col-sm-8');
		inputcol3.classList.add('col-sm-offset-2');
		inputcol3.classList.add('col-xs-9');
		inputcol3.setAttribute('id', 'create-flk-input-holder');
		
		inputrow2.appendChild(inputcol3);
		
		inputdiv.appendChild(inputrow2);	
		inputdiv.appendChild(document.createElement('br'));		
		
		var commauthor = document.createElement("input");
		commauthor.setAttribute("type", "text");
		commauthor.setAttribute("placeholder", "Name (optional)");
		commauthor.setAttribute("id", "comment-author-input");
		commauthor.classList.add('form-control');
		commauthor.classList.add('input-md');
		
		inputcol3.appendChild(commauthor);
		 
		 panl.appendChild(inputdiv);
		 
		 coldiv.appendChild(panl);
		 
		rowdiv.appendChild(coldiv);
		
		var notifydiv = document.createElement('div');
		notifydiv.style.display = 'none';
		notifydiv.setAttribute('id', 'add-comment-notify-div');
		
		
		cntnr.appendChild(rowdiv);
		
		panl.appendChild(notifydiv);
		flakeoverlay.appendChild(cntnr);
	

		  $('#comment-input').focus();
	
	}
	
	settimeoutid = setTimeout(function(){ 
				//flakeoverlay.style.display = "block";
				$('#do-comment-overlay').fadeIn('fast');
			}, 200);
}

function addCommentToPost(convid, topic, flake, seq, crtime) {
	var cmt = document.getElementById('comment-input').value;
	var author = document.getElementById('comment-author-input').value;
	//alert('will add text to convid ' + convid + ' author ' + author + ' topic ' + topic + ' comment ' + cmt + ' crtime ' + crtime);
	
	if (cmt.length > 0) {
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	        	if (document.getElementById('display-post-comments-modal') != null) {
	        		$('#display-post-comments-modal').modal('hide');
	        		//alert('modal hide called');
	        	}
	        	if (document.getElementById('do-comment-overlay') != null) {
	        		$('#do-comment-overlay').fadeOut(400);
	        		removediv(document.getElementById('do-comment-overlay'));
	        	}
	        }
	    }
		
	    xhr.open('POST', '/newauth/api/addcommenttopost', false);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');  
	    
	    xhr.send(JSON.stringify({
			"comment": cmt,
			"author": author,
			"conversationid": convid,
			"topic": topic,
			"flake": flake,
			"seq": seq,
			"crtime": crtime
		} ));
	
	} else {
		var notify = document.getElementById('add-comment-notify-div');
		notify.style.display = 'inline';
		notify.innerHTML = '<p color="red"> You have not added any comment.</p>'
	}
	
}

function sendmessagetoflake(flake) {
	var msg = document.getElementById('msg-flake-input').value;
	var authr = document.getElementById('msg-flake-author-input').value;
	var recp = document.getElementById('msg-flake-recipient-input').value;
	
	//console.log('document.getElementById("msg-flake-author-input").readOnly ' + document.getElementById('msg-flake-author-input').readOnly);
	if (typeof document.getElementById('msg-flake-author-input').readOnly == 'undefined' || document.getElementById('msg-flake-author-input').readOnly == false) {
		if (authr.length == 0) {
			document.getElementById('msg-flake-author-input').style.border = '2px solid red';
			return false;
		}
	} 
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var resptxt = xhr.responseText;
        	//alert(resptxt);
        	var conv = [];
        	conv.push(JSON.parse(resptxt));
        	//console.log('conv pushed to array');
        	populateflakeconversationindiv(conv, 'flake-messages');        	
        	
        	if (window.innerWidth <= 600) {
        		document.getElementById('flake-msg-modal').classList.remove('modal-md');
        		document.getElementById('flake-msg-modal').classList.remove('modal-lg');
        	}
        	$('#display-flake-messages-modal').modal('show');
        	
        	document.getElementById('flake-messages').scrollTop = document.getElementById('flake-messages').scrollHeight;
        	$('.modal-backdrop').removeClass("modal-backdrop");
        	document.getElementById('msg-flake-input').value = ''; // textarea being reset
        	document.getElementById('msg-flake-input').style.height = ''; // textarea height being reset
        	
        }
    }
	//console.log('opening ajax');
    xhr.open('POST', '/newauth/api/messagetoflake', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');  
    document.getElementById('msg-flake-author-input').style.border = '';
    xhr.send(JSON.stringify({
		"flake": flake,
		"comment": msg,
		"author": authr,
		"recipient": recp
	} ));
}

function loadflakeconvinmodal(conv) {
	
	populateflakeconversationindiv(conv, 'flake-messages');
	
	$('#display-flake-messages-modal').modal('show');
	
	document.getElementById('flake-messages').scrollTop = document.getElementById('flake-messages').scrollHeight;
	//alert(rowcontdiv.scrollHeight + ' ' + rowcontdiv.clientHeight);
	$('.modal-backdrop').removeClass("modal-backdrop");
}


function populateflakeconversationindiv(conv, divname) {
	var targetdiv = document.getElementById(divname);
	
	if (targetdiv != null) {
		if (conv != null && conv.length > 0) {
			
			var rowcontdiv = document.createElement('div');
			rowcontdiv.classList.add('row');
			
			rowcontdiv.setAttribute('id', 'flake-message-row');
			//rowcontdiv.style.maxHeight="60%";			
			
			var colcontdiv = document.createElement('div');
			colcontdiv.classList.add('col-xs-12');
			
			for (var i=0; i< conv.length; i++) {
				var rowdiv = document.createElement('div');
				rowdiv.classList.add('row');
				
				var coldiv = document.createElement('div');
				coldiv.classList.add('col-xs-9');
				
				if (typeof conv[i].author != 'undefined' && fullname != conv[i].author) {
					coldiv.classList.add('col-xs-offset-3');					
				} 
				
				var colauthrow = document.createElement('div');				
				colauthrow.classList.add('row');
				
				var colcontentrow = document.createElement('div');				
				colcontentrow.classList.add('row');
				
				//alert("author and fullname " + conv[i].author + " " + fullname);
				//alert(JSON.stringify(conv[i]));
				if (typeof conv[i].author == 'undefined' || conv[i].author.length == 0 || fullname == conv[i].author) {
					colcontentrow.classList.add('message-by-self');
					//colauthrow.classList.add('message-by-self');
				} else {
					colcontentrow.classList.add('message-by-other');
					//colauthrow.classList.add('message-by-other');
				}				
				
				var cmntcol = document.createElement('div');				
				cmntcol.classList.add('col-xs-9');
				
				var timecol = document.createElement('div');				
				timecol.classList.add('col-xs-3');
				
				var authcol = document.createElement('div');				
				authcol.classList.add('col-xs-12');
				
				var authtxt = document.createElement('p');
				authtxt.classList.add('text-muted');				
				authtxt.style.margin = '5 0 0 0';
				authtxt.style.textAlign = 'left';
				
				authtxt.appendChild(document.createTextNode(conv[i].author));
				authcol.appendChild(authtxt);
				
				colauthrow.appendChild(authcol);
				
				var cmnt = document.createElement('p');
				cmnt.style.overflowWrap= 'break-word';
				cmnt.style.textAlign = 'left';
				cmnt.style.margin = '5 0 0 0';
				cmnt.appendChild(document.createTextNode(conv[i].comment));
				cmntcol.appendChild(cmnt);
				
				var spforbutton = document.createElement('span');
				
				var tm = document.createElement('p');
				tm.style.textAlign = 'right';
				tm.style.margin = '5 0 0 0';
				var tdiff = gettimedifference(conv[i].crtime, true);
				
				var tspl = tdiff.split(' ');
				
				tm.appendChild(document.createTextNode(tspl[0] + tspl[1].charAt(0)));  
				timecol.appendChild(tm);
				colcontentrow.appendChild(cmntcol);
				colcontentrow.appendChild(spforbutton);
				colcontentrow.appendChild(timecol);
				
				coldiv.appendChild(colauthrow);
				coldiv.appendChild(colcontentrow);
				
				if (typeof conv[i].author != 'undefined' && fullname != conv[i].author && document.getElementById("manageflake").innerHTML.length > 0) {
					
					coldiv.addEventListener('mouseenter', function(evt, auth, thisdiv) {
						return function(evt) {
							
							var otherreplybuttons = document.getElementsByClassName('tmp-reply-btn');
							if (otherreplybuttons != null ) {
								for (var b=0; b<otherreplybuttons.length; b++) {
									otherreplybuttons[b].style.display='none';
								}
								
							}

							var replybutton = document.createElement("input");
							//replybutton.setAttribute("id", "copy-url-" + refs[i]);
							replybutton.classList.add('btn');
							//copybtn.classList.add('btn-primary');
							replybutton.classList.add('btn-xs');
							replybutton.classList.add('pull-right');
							replybutton.classList.add('tmp-reply-btn');
							
							replybutton.type = "button";
							replybutton.value = "Reply";
							
							replybutton.addEventListener('click', function() {
								//alert(auth);
								document.getElementById('msg-flake-recipient-input').value = auth;
							});
							
							if (thisdiv.getElementsByTagName('span')[0].innerHTML == '') {
								thisdiv.getElementsByTagName('span')[0].appendChild(replybutton);
							} else {
								thisdiv.getElementsByTagName('span')[0].getElementsByClassName('tmp-reply-btn')[0].style.display = 'inline-block';
							}
						};
						
					}(event , conv[i].author, coldiv));
				}
				rowdiv.appendChild(coldiv);
				
				colcontdiv.appendChild(rowdiv);
			} 
			
			rowcontdiv.appendChild(colcontdiv);
			
			//var rowcontdiv = document.getElementById('flake-messages');
			//rowcontdiv.scrollTop = 300;			
			
			// NOW add the message input div also
			//var msgbox = document.getElementById("msg-box-bottom");
			//document.getElementById('msg-flake-input').placeholder ='Type your message';
			//msgbox.classList.remove('hidden');
			//msgbox.style.bottom = '0';
			//msgbox.style.width = '100%';
			
			//document.getElementById('flake-conv-modal-body-msg-input').appendChild(msgbox);
			//alert('before append ' + targetdiv.scrollHeight);
			targetdiv.appendChild(rowcontdiv);
			//alert('after append ' + targetdiv.scrollHeight);
			//targetdiv.scrollTop = 100; //targetdiv.scrollHeight;
			

			//console.log('scrolltop location ' + targetdiv.style.height);
		}
	}
	
}


function displayThirdPartyFlakeDetails(flake, x,y, fadeoutdivid) {
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	var elemtofade;
	if (typeof fadeoutdivid === 'undefined' || fadeoutdivid == null )
		elemtofade = document.documentElement;
	else
		elemtofade = document.getElementById(fadeoutdivid);
	
	elemtofade.style.transitionTimingFunction= 'ease';
	elemtofade.style.opacity = 0.2;
	elemtofade.style.transition = 'opacity 1s';
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var resptxt = xhr.responseText;
        	//alert(resptxt);
        	showFlakeDetail(JSON.parse(resptxt), x, y, fadeoutdivid);
        }
    }
	
    xhr.open('POST', '/fc/'+flake, false); // calling flakecheck
    xhr.withCredentials = true;
    
    xhr.send(JSON.stringify({
		"reset": "hello"
	} ));
}

function runAdHocFunction() {
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");	
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	alert('done');
        }
    }
	
    xhr.open('POST', '/newauth/api/adhoc', false); // calling flakecheck
    xhr.withCredentials = true;
    
    xhr.send(JSON.stringify({
		"adhoc": "adhoc"
	} ));
    return false;
}

function lockUserImages() {
	
	if (document.getElementById('img-lock-flake').value.length == 0) {
		document.getElementById('img-lock-flake').style.border = '1px solid red';
		return false;
	}
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");	
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	alert('User images locked now');
        }
    }
	
    xhr.open('POST', '/newauth/api/lockuserimages', false); // calling flakecheck
    xhr.withCredentials = true;
     xhr.setRequestHeader('Content-Type', 'application/json');     
   
    var fl = document.getElementById('img-lock-flake').value ;
    xhr.send(JSON.stringify({
		"flake": fl
	}) );
    return false;
}

function deleteUser() {
	
	if (document.getElementById('img-lock-flake').value.length == 0) {
		document.getElementById('img-lock-flake').style.border = '1px solid red';
		return false;
	}
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");	
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	alert('User deleted');
        }
    }
	
    xhr.open('POST', '/newauth/api/deleteuser', false); // calling flakecheck
    xhr.withCredentials = true;
     xhr.setRequestHeader('Content-Type', 'application/json');     
   
    var fl = document.getElementById('img-lock-flake').value ;
    xhr.send(JSON.stringify({
		"flake": fl
	}) );
    return false;
}


function showFlakeDetail(flakedata, x, y,  fadeoutdivid) {
	var flakeoverlay = document.getElementById("flake-details-overlay"); // this id is setup as blocking overlay
	//flakeoverlay.style.zIndex = '1200';
	//flakeoverlay.style.backgroundColor= '#777';
	//flakeoverlay.style.opacity = 0.7;
	
	/*if (x > 0) {
		flakeoverlay.style.position = 'absolute';
		flakeoverlay.style.left = x ;
		//flakeoverlay.style.width = '100%';
	}
	
	if (y>0) {
		flakeoverlay.style.position = 'absolute';
		flakeoverlay.style.bottom = y ;
		//flakeoverlay.style.width = '100%';
	}*/
	var elemtofade;
	
	 var inputflakeelem = document.getElementById('flakecheckinput');
	 var flakevalinput ='';
	 
	 if (inputflakeelem != null) {
		 flakevalinput = inputflakeelem.value;
	 } else {
		 flakevalinput = flakedata.flake;
	 }
	
	if (typeof fadeoutdivid === 'undefined' || fadeoutdivid == null ) {
		elemtofade = document.documentElement;
		elemtofade.style.transitionTimingFunction= 'ease';
    	elemtofade.style.opacity = 1;
    	elemtofade.style.transition = 'opacity 1s';
	} else
		elemtofade = document.getElementById(fadeoutdivid);
	
	if (flakeoverlay == null) {
		//alert('in createUserFlakeOverlay .. creating new overlay');
		flakeoverlay = document.createElement("div");
		flakeoverlay.setAttribute("id", "flake-details-overlay");
		flakeoverlay.style.zIndex = '12000';
		
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
		
		flakeoverlay.addEventListener('click', function() {
			//alert('click fired on overlay');
			$('#flake-details-overlay').fadeOut(500);
	    	removediv(flakeoverlay);
	    	
	    	elemtofade.style.transitionTimingFunction= 'ease';
	    	elemtofade.style.opacity = 1;
	    	elemtofade.style.transition = 'opacity 1s';
	    	
	    });
		
		panl.addEventListener('click', function(e) {
	    	e.stopPropagation();
	    	
	    });
		
		 var p = document.createElement('h4');
		// p.classList.add('lead');
		 
		p.appendChild(document.createTextNode('Flake: ' +flakevalinput));
		 p.style.color = "#737373"; 
		 
		 if (window.innerWidth < 600)
			 p.style.fontWeight = "500"; 
		 else
			 p.style.fontWeight = "900"; 
		
		 panl.appendChild(p);
		 
		var flakepagebtn = document.createElement('IMG');
		flakepagebtn.src = '/static/icons/new-page.png';
		flakepagebtn.width = '24';
		flakepagebtn.title = 'Display flake page';
		flakepagebtn.onclick = function() {
			//alert('will show flke page' + flakejsonobj.flake);
			$('#flake-details-overlay').fadeOut(100);
	    	removediv(flakeoverlay);	    	
	  
			showflakepageinapp(flakevalinput);
			elemtofade.style.transitionTimingFunction= 'ease';
	    	elemtofade.style.opacity = 1;
	    	elemtofade.style.transition = 'opacity 1s';
		};
		
		flakepagebtn.onmouseenter = function() {
			flakepagebtn.style.opacity = 0.7;
		};
		
		flakepagebtn.onmouseout = function() {
			flakepagebtn.style.opacity =1;
		};
		
		panl.appendChild(flakepagebtn);
	
		 
		 let closeanchor = document.createElement('span');
		    closeanchor.innerHTML = '&times;';
		    closeanchor.style.float='right';
		    closeanchor.style.padding= '2px 7px';
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
		    	//alert('click fired on close button');
		    	$('#flake-details-overlay').fadeOut(500);
		    	removediv(flakeoverlay);
		    	
		    	elemtofade.style.transitionTimingFunction= 'ease';
		    	elemtofade.style.opacity = 1;
		    	elemtofade.style.transition = 'opacity 1s';
		    	
		    });
		    coldiv.appendChild(closeanchor);
		 
		 var pdh = document.createElement('p');
		 pdh.classList.add('lead');
		 pdh.setAttribute("id", "createuser-flake-text-header");
		 
		 if (flakedata == null || flakedata.crtime == null) {
			 pdh.style.color = "#d52323";
			 
			 pdh.appendChild(document.createTextNode("Invalid flake " ));
		 } else {
			 pdh.style.color = "#737373";
			 var dateandtimeparts = flakedata.crtime.split(' '); //11-27-2019 21:25:18.276 date
			 var dateparts = dateandtimeparts[0].split("-");
			 
			 var yyyyMMdddate = dateparts[2] + "/" + dateparts[0] + "/" + dateparts[1] + " " + dateandtimeparts[1].split(".")[0] + " MST";
			 pdh.appendChild(document.createTextNode("Created " + gettimedifference(yyyyMMdddate, true) + ' ago')); 
			 //pdh.appendChild(document.createTextNode("Created " + gettimedifference('2019/11/27 21:25:18 MST') + ' ago'));
		 }
		 
		 if (window.innerWidth < 600)
			 pdh.style.fontWeight = "120";
		 else
			 pdh.style.fontWeight = "200";
		 
		
		 panl.appendChild(pdh);
		 
		 var inputrowp = document.createElement("div");
			inputrowp.classList.add('row');
			
		var inputcolp = document.createElement("div");
		inputcolp.classList.add('col-sm-8');
		inputcolp.classList.add('col-sm-offset-2');
		 
		 var pd = document.createElement('p');
		 pd.classList.add('text-muted');
		 pd.setAttribute("id", "createuser-flake-text");
		 
		 
		 if (flakedata == null || flakedata.crtime == null) {
			 pd.appendChild(document.createTextNode("This flake has not been created yet."));
		 } else {
			 if (flakedata.giveouttype == 'F')
				 pd.appendChild(document.createTextNode("By: anonymous"));
			 
			 if (flakedata.giveouttype == 'A')
				 pd.appendChild(document.createTextNode("By: " + flakedata.giveout + " [Alias]"));
			 
			 if (flakedata.giveouttype == 'N')
				 pd.appendChild(document.createTextNode("By: " + flakedata.giveout));
		 }
		 
		 pd.style.color = "#878787"; 
		 if (window.innerWidth < 600)
			 pd.style.fontWeight = "350";
		 else
			 pdh.style.fontWeight = "600";
		
		 inputcolp.appendChild(pd);
		 inputrowp.appendChild(inputcolp);		 
		
		 panl.appendChild(inputrowp);			
				
		 var inputrowc = document.createElement("div");
			inputrowc.classList.add('row');  
			inputrowc.classList.add('text-center');
			
			var candiv = document.createElement("div");
			candiv.style.padding = '10px';
			candiv.setAttribute("id", "cu-flake-can");
			
			inputrowc.appendChild(candiv);	
		 
			panl.appendChild(inputrowc);			
		
		 coldiv.appendChild(panl);
		 
		rowdiv.appendChild(coldiv);
		cntnr.appendChild(rowdiv);
		
		if (flakedata != null && typeof flakedata.posts !== 'undefined' && flakedata.posts != null) {
			var topicset = new Set();
			for (var i=0; i<flakedata.posts.length; i++) {
				topicset.add(flakedata.posts[i].topic);
			}
			
			var topicrow = document.createElement('div');
			topicrow.classList.add('row');
			
			var topiccol = document.createElement('div');
			topiccol.classList.add('col-md-12');
			topiccol.classList.add('pull-left');
			
			topicrow.appendChild(topiccol);
			
			topiccol.appendChild(document.createTextNode("Other topics by this user: "));
			//for (var t of topicset) {
			for (var it = topicset.values(), t= null; t=it.next().value;) {
				var anc = document.createElement('a');
				anc.href = '/t/' + t;				
				anc.appendChild(document.createTextNode(t));
				
				topiccol.appendChild(anc);
			}
			panl.appendChild(topicrow);
			//alert(t + ' appended to container');
		}
		flakeoverlay.appendChild(cntnr);
	} 
	
	if (flakedata != null && flakedata.giveout != null)
		generateFlakeOnCanvas('cu-flake-can', flakedata.giveout, 160, 120, 'medium');
	
	settimeoutid = setTimeout(function(){ 
		//flakeoverlay.style.display = "block";
		//alert('will display flake info now');
		$('#flake-details-overlay').fadeIn('fast');
	}, 200);
	//alert('Now create flake details with ' + flakedata.giveout + ' ' + flakedata.crtime);
}

function splashTagsInbackground(div , tags) {
	//alert(tags);
	var cvs = document.createElement('canvas');
	cvs.height = window.innerHeight;
	cvs.width = window.innerWidth;
	cvs.style.top = "35px";
	cvs.style.position = 'absolute';
	var context = cvs.getContext('2d');
	context.fillStyle = "white";
	context.fillRect(0, 0, cvs.width, cvs.height);	
	
	var indivtags = tags.split(/[,;|]+/);
	
	for (var i=0; i<indivtags.length-1 ; i++ ) {
		var ystep = window.innerHeight  /(2* indivtags.length);
		//alert(ystep);
		var fsz = 26 - (indivtags[i].length/8);
		
		//alert(indivtags[i] + ' size ' + parseInt(fsz));
		context.save();
		var transx = parseInt(window.innerWidth*0.03) + parseInt(window.innerWidth*0.04) * (i%2 + 1);
		var transy = ystep*(i+1);
		var widthshift = Math.pow((window.innerWidth /transx) - 1,  i%2 ); 
		//alert(widthshift * transx);
		 context.translate(widthshift * transx, transy);
		 context.rotate(Math.pow(-1, i%2) * 7 * ((i%2)+1) * (Math.PI / 180));
		
		 context.textAlign = "center";
		 context.fillStyle = "lightgrey";
		 context.font = "normal  bold " + parseInt(fsz) + "px serif";
		 context.fontFamily = "Impact";
		 //context.fillText(indivtags[i], 200, 100*(i+1));
		 
		 var textx = 50 + (10*i*Math.pow(-1, i%2));
		 var texty = ystep*(i+1);
		 
		 //if (i == 1)  alert(textx + " " + texty);
		 wrapTextincanvas(context, indivtags[i], textx, texty, window.innerWidth /6, 25);
		 context.restore();
	}

	var dataUrl = cvs.toDataURL();
	div.style.background='url('+dataUrl+')';
	
}

function base64toBlob(base64Data, contType) { // needed for displaying PDF in chrome/android
    var contentType = contType || '';
    var sliceSize = 1024;
    var byteCharacters = atob(base64Data);
    var bytesLength = byteCharacters.length;
    var slicesCount = Math.ceil(bytesLength / sliceSize);
    var byteArrays = new Array(slicesCount);

    for (var sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
        var begin = sliceIndex * sliceSize;
        var end = Math.min(begin + sliceSize, bytesLength);

        var bytes = new Array(end - begin);
        for (var offset = begin, i = 0; offset < end; ++i, ++offset) {
            bytes[i] = byteCharacters[offset].charCodeAt(0);
        }
        byteArrays[sliceIndex] = new Uint8Array(bytes);
    }
    return new Blob(byteArrays, { type: contentType });
}

function fileToBase64(file) {
	  return new Promise((resolve, reject) => {
	    const reader = new FileReader();
	    reader.readAsDataURL(file);
	    reader.onload = () => resolve(reader.result);
	    reader.onerror = error => reject(error);
	  });
	}

function wrapTextincanvas(context, text, x, y, maxWidth, lineHeight) {
    var words = text.split(' ');
    var line = '';

    for(var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + ' ';
      var metrics = context.measureText(testLine);
      var testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        context.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      }
      else {
        line = testLine;
      }
    }
    context.fillText(line, x, y);
  }

function showadditionalcontentindicator(image) {
	
	if (document.getElementById('additional-content-indicator') == null) {
	//alert(image.parentNode);
		var dotdiv = document.createElement('div');
		dotdiv.setAttribute('id', 'additional-content-indicator');
		dotdiv.innerHTML = "<p style='color:#727272; width:100%; height:100%; position:absolute; bottom:20px;'>Hover over image to see more images</p>";
		dotdiv.style.width = '100%';
		dotdiv.style.height = '100%';
		dotdiv.style.color = "#727272";
		dotdiv.style.bottom = "20px";
		dotdiv.style.position = 'absolute';
		dotdiv.style.top = 0;
		dotdiv.style.left = 0;
		dotdiv.style.opacity = 1; 
		dotdiv.style.transition= 'opacity 0.6s ease 0s';
		dotdiv.style.textAlign = 'center';
		
		image.parentNode.appendChild(dotdiv);
	}
	
}

function updateimagesonelement(imgarray, elem) {
	//alert('in updateimagesonelement');
	var counter = 0;
	postimagesinterval = setInterval(function() {
		elem.src = imgarray[counter].content;
		if (counter < imgarray.length -1 ) {counter++;}
		else {counter = 0;}
	}, 2200)
}

function displayfulluserpost(content) {
	var flakeoverlay = document.getElementById("full-post-display"); // this id is setup as blocking overlay
	
	if (flakeoverlay != null) {
		removediv(flakeoverlay);
	}
	
	//if (flakeoverlay == null) {
		//alert('in createUserFlakeOverlay .. creating new overlay');
		flakeoverlay = document.createElement("div");
		flakeoverlay.setAttribute("id", "full-post-display");
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
		    	fadeinelement('app');
		    	$('#full-post-display').fadeOut(200);
		    	//removediv(document.getElementById('fullpostdisplay'));
		    	
		    });
		    coldiv.appendChild(closeanchor);
		 
		 var pdh = document.createElement('p');
		 pdh.classList.add('lead');
		 pdh.setAttribute("id", "createuser-flake-text-header");
		 
		 pdh.appendChild(document.createTextNode("Post"));
		 pdh.style.color = "#737373";
		 pdh.style.fontWeight = "700";
		
		 //panl.appendChild(pdh);
		 
		 var inputrowp = document.createElement("div");
			inputrowp.classList.add('row');
			
		var inputcolp = document.createElement("div");
		inputcolp.classList.add('col-sm-8');
		inputcolp.classList.add('col-sm-offset-2');
		 
		 var pd = document.createElement('p');
		 pd.classList.add('text-muted');
		 pd.style.textAlign = 'left';
		 pd.style.wordWrap = 'break-word';
		 pd.setAttribute("id", "createuser-flake-text");
		 
		 pd.appendChild(document.createTextNode(content));
		 pd.style.color = "#878787"; 
		 pd.style.fontWeight = "600";
		
		 inputcolp.appendChild(pd);
		 inputrowp.appendChild(inputcolp);		 
		
		 panl.appendChild(inputrowp);		
		 
		 coldiv.appendChild(panl);
		 
		rowdiv.appendChild(coldiv);
		cntnr.appendChild(rowdiv);
		flakeoverlay.appendChild(cntnr);
			
	//}	
	
	settimeoutid = setTimeout(function(){ 
				//flakeoverlay.style.display = "block";
				$('#full-post-display').fadeIn('fast');
			}, 100);
}


function addpostheader(column, seq) {
	//alert('in addpostheader');
	var hdrdiv = document.createElement("div");
	hdrdiv.setAttribute("id", "post-header-"+seq);
	hdrdiv.style.margin = "0";
	hdrdiv.style.width = "100%";
	hdrdiv.style.height = "20px";
	hdrdiv.style.position = "absolute";
	hdrdiv.style.top = "0";
	hdrdiv.style.left = "0";
	hdrdiv.style.backgroundColor = '#ffffff';
	hdrdiv.style.zIndex = "10";
	hdrdiv.style.opacity = "0.1";
	hdrdiv.style.transition= "opacity .6s";
	//hdrdiv.appendChild(document.createTextNode("&nbsp;"));
	
	hdrdiv.addEventListener('mouseover', function(e) {
		hdrdiv.style.opacity = "0.9";
    	
    });
	
	column.appendChild(hdrdiv);
	
	let signanchor = document.createElement('span');
    signanchor.innerHTML = '<img src=/static/icons/pencil-16.png>';
    signanchor.style.float='left';
    signanchor.style.height='20px';
    signanchor.style.padding= '1px 3px';
    signanchor.style.margin= '0px';
    
    signanchor.style.fontSize= '1.4em';
    signanchor.style.top= '0px';
    signanchor.style.display = 'inline-block';
    signanchor.style.color = '#a2a2a2';
    signanchor.style.cursor = 'default';
    signanchor.addEventListener('mouseover', function(e) {
    	e.target.style.color = '#d3d3d3';
    });
    signanchor.addEventListener('mouseout', function(e) {
    	e.target.style.color = '#a2a2a2';
    });
    
    signanchor.addEventListener('click', function(e) {  
    	e.stopPropagation();
    	showsignuserpostmodal(seq);
    });
    hdrdiv.appendChild(signanchor);
    
	let closeanchor = document.createElement('span');
    closeanchor.innerHTML = '&times;';
    closeanchor.style.float='right';
    closeanchor.style.height='20px';
    closeanchor.style.padding= '1px 3px';
    closeanchor.style.margin= '0px';
    
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
    	
    	deleteuserpost(seq);
    });
    hdrdiv.appendChild(closeanchor);
	
}

function refreshposts(newpost) { // this is the last post added	
	
  displaynewpost(newpost, 'user-posts-display');
  	
}

function deleteuserpost(seq) {
	var origseq = seq;
	seq = seq + "";
	
	if (seq.indexOf('-') >=0 ) {
		seq = seq.split('-')[0];
	}
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert('Post removed '+ origseq);
        	removepostfrompage(origseq);
        }
    }
	
    xhr.open('POST', '/newauth/api/deleteuserpost', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
    xhr.send(JSON.stringify({
						"sequence": seq
						} ));
}

function showsignuserpostmodal(seq) {
	//alert(seq);
	document.getElementById('post-preview-in-modal').innerHTML = '';
	document.getElementById('post-preview-in-modal').innerHTML = document.getElementById('post-seq-' + seq).innerHTML;
	document.getElementById('posttopic').value = '';
	document.getElementById('posttags').value = '';
	document.getElementById('postseq').value = seq;
	
	document.getElementById('signuserpost-btn').display = 'block';
	
	document.getElementById("usersignpostnotify").innerHTML = "";
	document.getElementById('post-global-url').innerHTML = newauthurl + '/f/' + loggedinuserflake;
	
	$('#signuserpostmodal').modal('show');
}

function handletopicchange() {
	
	//if (!topicautocompleteregistered) {
		topicautocomplete(document.getElementById("posttopic"), []); // registering is because it is nnot running the first time after data comes back
	//	topicautocompleteregistered = true;
	//}
	
	

}

function handleflakesearch() {
	//console.log('in handleflakesearch');
	//if (!flakeautocompleteregistered) {
		flakeautocomplete(document.getElementById("flakecheckinput"), []); // registering is because it is nnot running the first time after data comes back
	//	flakeautocompleteregistered = true;
	//}
	
	

}

function handlegenericsearch() { // This will be invoked when we search by user name, flake, alias etc
	//console.log('in handleflakesearch');
	//if (!flakeautocompleteregistered) {
		genericinputautocomplete(document.getElementById("orgmembersearchinput"), []); // registering is because it is nnot running the first time after data comes back
	//	flakeautocompleteregistered = true;
	//}
	
	

}


function signuserpost() { //seq, topic, tags
	//alert('in signuserpost');
	//return false;
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert('Post added');
        	//removepostfrompage(seq);
        	var url = document.getElementById('post-global-url').innerText;
        	document.getElementById("usersignpostnotify").innerHTML = "Your Post will be available very soon at <a href='" + url +"'>" + url + "</a>";
        	document.getElementById('signuserpost-btn').display = 'none';
        	//$('#signuserpostmodal').modal('hide');
        }
        
        if (xhr.status == 406) {
        	document.getElementById("usersignpostnotify").innerHTML = "<br><p class='text-danger'>The topic owner is not allowing posts currently.</p>";
        }
    }
	//alert('will send the post ');
    xhr.open('POST', '/newauth/api/signuserpost', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
    
    var topic = document.getElementById('posttopic').value;
    if (document.getElementById('posttopic').existingTopic == "true") {
    	//alert("Existing topic clicked");
    	topic = "#" + topic;
    }
   
    var seqtosend = document.getElementById('postseq').value;
    
    if (seqtosend.indexOf('-') >= 0) {
    	seqtosend = seqtosend.split('-')[0];
    }
    
    var tagsarr = [];
    
    var inputtags = document.getElementById('posttags').value;
    
    if (inputtags.length > 0) {
    	var splittags = inputtags.split(",;");
    	for (var i=0; i< splittags.length; i++) tagsarr.push(splittags[i]);
    }
    
    var req = JSON.stringify({
		"sequence": seqtosend,
		"topic": topic,
		"tags": tagsarr
		} );
    
    //alert (req);
    xhr.send(req);
    //alert(' post sent');
    document.getElementById('posttopic').existingTopic = "false";
}

function  removepostfrompage(seq) {
	var origseq = seq;
	var postdiv = document.getElementById('post-seq-' + origseq);
	seq = seq + "";
	
	if (seq.indexOf('-') >=0 ) {
		seq = seq.split('-')[0];
	}
	if (parseInt(seq) == parseInt(lastpostseq)) {
		
    	lastpostseq -= 1;
    	//alert('reducing lastpostseq new value ' + lastpostseq);
    }
	
	if (parseInt(lastpostseq) == 0) {
		loadHome();
	} else {
	
		if (postdiv != null) {
			//removediv(postdiv);
			$('#' + 'post-seq-' + origseq).hide('slow');
		}
	}
}


function showpurchasedialog(item) {
	
	if (item == 'BUS-VAULT-SUB') {
		//brandModal
	} else {
		populateitemdetailsinpaymentdialog(item);
	}
	console.log('item data loaded');
	if (stripe == null) {		
		var scriptfetch   = document.createElement("script");
		scriptfetch.type  = "text/javascript";
		scriptfetch.setAttribute("src","https://polyfill.io/v3/polyfill.min.js?version=3.52.1&features=fetch");
		
		var stripescript   = document.createElement("script");
		stripescript.type  = "text/javascript";
		stripescript.setAttribute("src","https://js.stripe.com/v3/");

		document.body.appendChild(scriptfetch);
		document.body.appendChild(stripescript);
		
		stripescript.addEventListener("load", function() {
					//if (nastripekey == null)
					//	nastripekey = "pk_test_ngbi1o6t13ZaBnCS6JMkgw5l00PvBaGMHm";
					
					stripe = Stripe(nastripekey);					

					afterstripeloaded(item);
				}, false);		
	} else {
		afterstripeloaded(item);
	}
	
}

function populateitemdetailsinpaymentdialog(item) {
	//alert ('hi');
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var itemdata = JSON.parse(xhr.responseText);
        	
        	if (typeof itemdata.amount !== 'undefined' )
        		document.getElementById('na-item-amount').innerText = itemdata.amount;
        	
        	if (typeof itemdata.summary !== 'undefined' )
        		document.getElementById('na-item-small-description').innerText = itemdata.summary;
        	
        	if (typeof itemdata.description !== 'undefined' )
        		document.getElementById('na-item-description').innerText = itemdata.description;
        	
        	if (typeof itemdata.imageurl !== 'undefined' && itemdata.imageurl != null)
        		document.getElementById('na-item-photo').src = itemdata.imageurl;
   
        }    
       
    }
	
	var itemname = document.getElementById(item).value;
    xhr.open('POST', '/newauth/api/getitemdetail', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
    
    var req = JSON.stringify({
		"name": itemname
		} );
    
   // alert (req);
    xhr.send(req);
}

function afterstripeloaded(item) {
	
	loadjscssfile("/static/css/pymt-temp.css", "css");		
	var itemname = '';
	var card;
	if (document.getElementById(item) != null)
		itemname = document.getElementById(item).value;
	
	var purchase = {
			  items: [{ name: itemname }]
			};
			
	if (item == 'BUS-VAULT-SUB')
		purchase = getBusinessVaultOrder();
	
	fetch("/secure/paymentintent", {
		  method: "POST",
		  headers: {
		    "Content-Type": "application/json"
		  },
		  body: JSON.stringify(purchase)
		})
		  .then(function(result) {
		    return result.json();
		  })
		  .then(function(data) {
		    var elements = stripe.elements();
		    var style = {
		      base: {
		        color: "#32325d",
		        fontFamily: 'Arial, sans-serif',
		        fontSmoothing: "antialiased",
		        fontSize: "16px",
		        "::placeholder": {
		          color: "#32325d"
		        }
		      },

		      invalid: {
		        fontFamily: 'Arial, sans-serif',
		        color: "#fa755a",
		        iconColor: "#fa755a"
		      }

		    };

		  
			    card = elements.create("card", { style: style });
	
			    // Stripe injects an iframe into the DOM
			    card.mount("#card-element");
			    console.log('new card element mounted');
			    card.on("change", function (event) {
			      // Disable the Pay button if there are no card details in the Element
			      document.querySelector("button").disabled = event.empty;
			      document.querySelector("#card-error").textContent = event.error ? event.error.message : "";
			    });
			    
			   // console.log('latest clientsecret ' + data.clientSecret);
			    var form = document.getElementById("payment-form");
			    form.addEventListener("submit", form.submitfn = function(event, cardobj, cltsecret) {
			      return function(event) {
				      event.preventDefault();
				      // Complete payment when the submit button is clicked
				      //payWithCard(stripe, card, data.clientSecret);
				      document.querySelector("#submit-payment").disabled = true;
				      payWithCard(stripe, cardobj, cltsecret);
			      };
			    }(event, card, data.clientSecret)
			    );
		   
		    
		  });
	
	
	var payWithCard = function(stripe, card, clientSecret) {
		  loading(true);
		  stripe
		    .confirmCardPayment(clientSecret, {
		      payment_method: {
		        card: card
		      }
		    })
		    .then(function(result) {
		      if (result.error) {
		        // Show error to your customer
		        showError(result.error.message);
		      } else {
		        // The payment succeeded!
		        orderComplete(result.paymentIntent.id);
		      }
		    });
		};
		
		/* ------- UI helpers ------- */

		// Shows a success message when the payment is complete
		var orderComplete = function(paymentIntentId) {
		  loading(false);
		//  document
		 //   .querySelector(".result-message a")
		 //   .setAttribute(
		 //     "href",
		 //     "https://dashboard.stripe.com/test/payments/" + paymentIntentId
		 //   );

		  document.querySelector(".result-message").classList.remove("hidden");
		  document.querySelector("#submit-payment").disabled = false;
		  
		  processorderinnewauth(itemname, paymentIntentId);
		  
		  if (item == 'BUS-VAULT-SUB') {
		  	//document.getElementById('btnusertypeaccept').disabled = false;
		  	document.getElementById("brandsignedup").value = 1;
		  }
		 
		};

		// Show the customer the error from Stripe if their card fails to charge
		var showError = function(errorMsgText) {
		  loading(false);
		  var errorMsg = document.querySelector("#card-error");
		  errorMsg.textContent = errorMsgText;
		  setTimeout(function() {
		    errorMsg.textContent = "";
		  }, 4000);
		};

		// Show a spinner on payment submission
		var loading = function(isLoading) {
		  if (isLoading) {
		    // Disable the button and show a spinner
		    document.querySelector("#submit-payment").disabled = true;
		    document.querySelector("#spinner").classList.remove("hidden");
		    document.querySelector("#button-text").classList.add("hidden");
		  } else {
		    document.querySelector("#submit-payment").disabled = false;
		    document.querySelector("#spinner").classList.add("hidden");
		    document.querySelector("#button-text").classList.remove("hidden");
		  }
		};

	//console.log('About to show pmt overlay');
	
	//$('#payment-overlay').show();
		console.log('about to show paymentoverlay');
		
	if (item == 'BUS-VAULT-SUB') {
		$('#brandModal').modal('hide'); 
	
		$("#paymentOverlayModal").on('hidden.bs.modal', function(){
			console.log('payment modal hidden.. unmounting card element');
			card.unmount();
			
		});
	}
		
	$('#paymentOverlayModal').modal('show'); 
}

function getBusinessVaultOrder() {
	var purchase = {};
	document.getElementById('na-sub-items').innerHTML = '';
	//console.log('previous sub items cleared');
	var usercount = 1;
	
	if (document.getElementById('bus-subs-user-count-input').value.length > 0)
		usercount = parseInt(document.getElementById('bus-subs-user-count-input').value);
	
	document.getElementById('order-user-count-display').innerHTML = usercount + '<p>Users</p>';
	purchase.items = [];
			
	document.getElementById('na-item-small-description').innerText = 'Business account';	
	var vltli = document.createElement('LI');
	vltli.appendChild(document.createTextNode('Business Vault'))
	purchase.items.push({ name: 'BUS-VAULT-SUB', quantity: usercount });
	
	document.getElementById('na-sub-items').appendChild(vltli);
	if (document.getElementById('bus-topic-page-chk').checked) {
		purchase.items.push({name: 'BUS-TOPIC-PAGE-SUB'});
		
		var topicli = document.createElement('LI');
		topicli.appendChild(document.createTextNode('Brand Page'))
		document.getElementById('na-sub-items').appendChild(topicli);
	}
	
	if (document.getElementById('app-topic-page-chk').checked) {
		purchase.items.push({name: 'APP-TOPIC-PAGE-SUB', quantity: usercount});
		
		var topicli = document.createElement('LI');
		topicli.appendChild(document.createTextNode('Apps Pages'))
		document.getElementById('na-sub-items').appendChild(topicli);
	}
	
	if (document.getElementById('bus-newauth-identity-chk').checked) {
		purchase.items.push({ name: 'BUS-NEWAUTH-IDENTITY-SUB', quantity: usercount });
		
		var idli = document.createElement('LI');
		idli.appendChild(document.createTextNode('Newauth Login'))
		document.getElementById('na-sub-items').appendChild(idli);
	}
					
	if (document.getElementById('bus-newauth-pers-img-chk').checked) {
		purchase.items.push({ name: 'BUS-NEWAUTH-PERS-IMAGE-SUB', quantity: usercount });
		
		var perli = document.createElement('LI');
		perli.appendChild(document.createTextNode('User personal images'))
		document.getElementById('na-sub-items').appendChild(perli);
	}
					
	if (document.getElementById('bus-newauth-brand-img-chk').checked) {
		purchase.items.push({name: 'BUS-NEWAUTH-BRAND-IMAGE-SUB'});
		var brdli = document.createElement('LI');
		brdli.appendChild(document.createTextNode('Brand Image'))
		document.getElementById('na-sub-items').appendChild(brdli);
	}
					
	if (document.getElementById('bus-newauth-export-data-chk').checked) {
		purchase.items.push({name: 'BUS-NEWAUTH-EXPORT-DATA-SUB'});
		
		var expli = document.createElement('LI');
		expli.appendChild(document.createTextNode('Vault Data export'))
		document.getElementById('na-sub-items').appendChild(expli);
	}
	
	return purchase;
}

function loadjscssfile(filename, filetype){
    if (filetype=="js"){ //if filename is a external JavaScript file
        var fileref=document.createElement('script')
        fileref.setAttribute("type","text/javascript")
        fileref.setAttribute("src", filename)
    }
    else if (filetype=="css"){ //if filename is an external CSS file
        var fileref=document.createElement("link")
        fileref.setAttribute("rel", "stylesheet")
        fileref.setAttribute("type", "text/css")
        fileref.setAttribute("href", filename)
    }
    if (typeof fileref!="undefined")
        document.getElementsByTagName("head")[0].appendChild(fileref)
}

function removejscssfile(filename, filetype){
    var targetelement=(filetype=="js")? "script" : (filetype=="css")? "link" : "none" //determine element type to create nodelist from
    var targetattr=(filetype=="js")? "src" : (filetype=="css")? "href" : "none" //determine corresponding attribute to test for
    var allsuspects=document.getElementsByTagName(targetelement)
    for (var i=allsuspects.length; i>=0; i--){ //search backwards within nodelist for matching elements to remove
    if (allsuspects[i] && allsuspects[i].getAttribute(targetattr)!=null && allsuspects[i].getAttribute(targetattr).indexOf(filename)!=-1)
        allsuspects[i].parentNode.removeChild(allsuspects[i]) //remove element by calling parentNode.removeChild()
    }
}

function processorderinnewauth(itemname, paymentIntentId) {
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
			if (itemname.indexOf('IMG') > 0) {
        		document.getElementById('img-sub-content').innerHTML = "";
        	
        		displaypersonalauthimages('img-sub-content');
        	}
        	
        	 setTimeout(function(){
		  			//alert('payment complete. will close dialog');
		  			removejscssfile("/static/css/pymt-temp.css", "css");
		  			document.querySelector(".result-message").classList.add("hidden");
		  			
		  			if (itemname == 'BUS-VAULT-SUB')
		  				document.querySelector("#signedup").value = '1';
		  			$('#paymentOverlayModal').modal('hide');
		  			
        	 }, 2000);
        }        
    }
	
	//var itemname = document.getElementById(item).value;
    xhr.open('POST', '/newauth/api/processorder', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
    
    var req = JSON.stringify({
		"name": itemname,
		"paymentintentid":  paymentIntentId
		} );
    
   // alert (req);
    xhr.send(req);
}




function displaypersonalauthimages(divid) {
	var tgt = document.getElementById(divid);
	
	var para = document.createElement('p');
	para.classList.add('lead');
	para.appendChild(document.createTextNode('These are your personal images. Box them to use for authentication.'))
	
	tgt.appendChild(para);
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert(xhr.responseText);
        	var imlist = JSON.parse(xhr.responseText);
        	setupUser();
        	
        
        }        
    }
	
	//var itemname = document.getElementById(item).value;
    xhr.open('POST', '/newauth/api/getpersonalauthimages', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
    
    var req = JSON.stringify({
		
		} );
    
   // alert (req);
    xhr.send(req);
}

function readpersonalimagefile( evt, bannerimgid, _callback) {
	evt.stopPropagation();
	evt.preventDefault();
	var files = evt.target.files; // FileList object		
	   
	var imgcount = 0;
   // console.log('onchange event fired for personal img file ' );
    for (var i = 0; i< files.length; i++) {
    	
    	var reader = new FileReader();

    	reader.onload = (function (file) {  // Listener in a loop... using closures
    		//console.log('reader onload fired..');
    		return function(event) {
    			updatepersonalauthimage(event, file, bannerimgid);    	
    	      };    						
    	    
    	})(files[i]);

    	reader.readAsDataURL(files[i]);
    	
    }
    
    if (_callback)
    	_callback(evt.target.imgcount, postcontenthome.files);
     
}




function updatepersonalauthimage(e, file, bannerimgid) {	
	
	 imageExists(e.target.result, function(exists){
		 var prevdiv = document.getElementById(bannerimgid);
		 
		 document.getElementById('allocatephotos').innerHTML = '<div class="loader"><h4>Loading...</h4></div>';
		// console.log('loading icon placed in div');
		 var seq = bannerimgid.split("-")[1];
	        if (exists) { 
	        	//show preview
	        	//alert('is an image will show preview');
	        	var img = document.createElement("img");
	        	img.src = e.target.result;
	        	
	        	var maxwidth = window.screen.availWidth;
	        	var maxheight = window.screen.availWidth/2;
	        	
	        	if (maxwidth < 800) maxwidth = 800;
	        	if (maxheight < 600) maxheight = 600;
	        	
	        	var resizedimg = getresizedimage(img, file.type, maxwidth, maxheight);
	        	prevdiv.src = resizedimg; //e.target.result;	
	        	//prevdiv.style.display = 'block';
	        	prevdiv.height = null;
	        	prevdiv.style.padding = null;
	        	prevdiv.style.background = null;
	        	prevdiv.style.maxHeight = '64px';
	        	prevdiv.style.maxWidth = '64px';
	        	prevdiv.style.opacity=1;
	        	
	        	prevdiv.parentNode.style.opacity=1;
	        	
	        	var xhr = new XMLHttpRequest();
	        	xhr.open('POST', '/updatepersonalauthimage', false);
	            xhr.setRequestHeader('Content-Type', 'application/json');    
	            
	            xhr.onreadystatechange = function() {
	                if (xhr.readyState == 4 && xhr.status == 200) {
	                	setupUser();	                	
	                	
	                }        
	            }
	            
	            fileToBase64(file).then(
	            	function(data){	
	            		var reqpacket = JSON.stringify({
		            		sequence: seq,
		            		data: data.split(",")[1]
		            	});
	            		//alert('sending this as personal image ' + JSON.stringify(reqpacket));
	            		xhr.send(reqpacket);
	            		
	            	}
	            );            
	        	
	        } else {
	        	//alert('not an image');
	        	alert('Not an image file');
	        }
	
	        
	    });
}

function loadOrderDetails() {
	
	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/newauth/api/getallorders', false);
    xhr.setRequestHeader('Content-Type', 'application/json');    
    xhr.withCredentials = true;
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	var ords = JSON.parse(xhr.responseText);
        	
        	var tgt = document.getElementById('orderdetails');
        	tgt.innerHTML = "";
        	for (var i = 0; i< ords.length; i++) {
        		var r = document.createElement('div');
        		r.classList.add('row');
        		var c1 = document.createElement('div');
        		c1.classList.add('col-xs-3');
        		var d = new Date(ords[i].orderdate);
        		//console.log('order status from DB ' + ords[i].status )
        		c1.appendChild(document.createTextNode(d.toLocaleDateString("en-US")));
        		
        		var c2 = document.createElement('div');
        		c2.classList.add('col-xs-4');
        		c2.appendChild(document.createTextNode(ords[i].summary));
        		
        		var c3 = document.createElement('div');
        		c3.classList.add('col-xs-2');
        		c3.appendChild(document.createTextNode("$"+ ords[i].amount));
        		
        		var c4 = document.createElement('div');
        		c4.classList.add('col-xs-3');
        		var canbutton = document.createElement('button');
        		canbutton.setAttribute('type','button');
        		canbutton.classList.add('btn-default');
        		canbutton.classList.add('btn-xs');
        		canbutton.appendChild(document.createTextNode('Cancel'));
        		canbutton.addEventListener('click', function(orddate, name,pmtid){
        			return function() {
        				cancelorder(orddate, name, pmtid);
        			};
        		}(ords[i].orderdate, ords[i].name, ords[i].paymentintentid));
        		
        		if (gettimedifferenceinsec(ords[i].orderdate)/86400 < 30) {
        			if (typeof ords[i].status != 'undefined' && ords[i].status == 'cancelled') {
        				c4.appendChild(document.createTextNode('Refunded'));
        			}  else 
        				c4.appendChild(canbutton);
        		} else
        			c4.appendChild(document.createTextNode('Trial period expired.'));
        		
        		r.appendChild(c1);
        		r.appendChild(c2);
        		r.appendChild(c3);
        		r.appendChild(c4);
        		
        		tgt.appendChild(r);
        	}
        }        
    }    
   
	var reqpacket = JSON.stringify({
		
	});
	//alert('sending this as personal image ' + JSON.stringify(reqpacket));
	xhr.send(reqpacket);
   
}

function cancelorder(orderdate, name, pmtid) {
	//alert(orderdate + ' ' + name + ' ' +  pmtid);
	
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert(xhr.responseText);
        	setupUser();        
        }        
    }
	
	//var itemname = document.getElementById(item).value;
    xhr.open('POST', '/newauth/api/cancelorder', false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
    
    var req = JSON.stringify({
    	orderdateinmillis: orderdate,
			name: name,
			paymentintentid: pmtid 
		} );
    
   // alert (req);
    xhr.send(req);
}

function showinfocontent(cntid, event) {

	var videlem = document.getElementById('newauth-intro-video-player').getElementsByTagName('iframe')[0];
	
	if (videlem != null)
		videlem.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
	
	document.getElementById('newauth-intro-video-player').style.display = 'none';
		
	var allinfbtn = document.getElementsByClassName('info-btn');
	for (var c=0; c<allinfbtn.length; c++) {
		allinfbtn[c].style.backgroundColor = 'white';
	}

	event.target.style.backgroundColor = '#a5a5a5';
	var allcont = document.getElementsByClassName('content-display');
	
	for (var c=0; c<allcont.length; c++) {
		allcont[c].style.display = 'none';
	}
	
	document.getElementById(cntid).style.display = 'block';
}