
 // let BASE_URL = 'https://localhost:8443/';
  let BASE_URL = '/';
  let STYLESHEET = BASE_URL + "static/css/app.css"
  let CONTENT_URL = BASE_URL + 'vn/init';
  let ROOT = 'via-newauth';
  let flakesondevice;
  let oldtonewflakeconverter = {}; // converts old to new and new to old flake 
  let newtooldflakeconverter = {}; // converts old to new and new to old flake 
  let nainitialized = false;
  let overlayloaded = false;
  let highusagedevice = false;
  let hostsite = 'Default';
  let overlay;
  let displayedimgindex=0;
  
  const supportedAPI = ['init', 'message', 'bindhostuserid', 'getauthenticateduser', 'successhandler', 'failurehandler', 'logout']; // enlist all methods supported by API (e.g. `mw('event', 'user-login');`)
  
  let elements = [];

  let configurations = {};  
  let authenticateduser = {};
  
//THIS IS FROM SJCL CODE

  "use strict";var sjcl={cipher:{},hash:{},keyexchange:{},mode:{},misc:{},codec:{},exception:{corrupt:function(a){this.toString=function(){return"CORRUPT: "+this.message};this.message=a},invalid:function(a){this.toString=function(){return"INVALID: "+this.message};this.message=a},bug:function(a){this.toString=function(){return"BUG: "+this.message};this.message=a},notReady:function(a){this.toString=function(){return"NOT READY: "+this.message};this.message=a}}};
  sjcl.bitArray={bitSlice:function(a,b,c){a=sjcl.bitArray.m(a.slice(b/32),32-(b&31)).slice(1);return void 0===c?a:sjcl.bitArray.clamp(a,c-b)},extract:function(a,b,c){var d=Math.floor(-b-c&31);return((b+c-1^b)&-32?a[b/32|0]<<32-d^a[b/32+1|0]>>>d:a[b/32|0]>>>d)&(1<<c)-1},concat:function(a,b){if(0===a.length||0===b.length)return a.concat(b);var c=a[a.length-1],d=sjcl.bitArray.getPartial(c);return 32===d?a.concat(b):sjcl.bitArray.m(b,d,c|0,a.slice(0,a.length-1))},bitLength:function(a){var b=a.length;return 0===
  b?0:32*(b-1)+sjcl.bitArray.getPartial(a[b-1])},clamp:function(a,b){if(32*a.length<b)return a;a=a.slice(0,Math.ceil(b/32));var c=a.length;b=b&31;0<c&&b&&(a[c-1]=sjcl.bitArray.partial(b,a[c-1]&2147483648>>b-1,1));return a},partial:function(a,b,c){return 32===a?b:(c?b|0:b<<32-a)+0x10000000000*a},getPartial:function(a){return Math.round(a/0x10000000000)||32},equal:function(a,b){if(sjcl.bitArray.bitLength(a)!==sjcl.bitArray.bitLength(b))return!1;var c=0,d;for(d=0;d<a.length;d++)c|=a[d]^b[d];return 0===
  c},m:function(a,b,c,d){var e;e=0;for(void 0===d&&(d=[]);32<=b;b-=32)d.push(c),c=0;if(0===b)return d.concat(a);for(e=0;e<a.length;e++)d.push(c|a[e]>>>b),c=a[e]<<32-b;e=a.length?a[a.length-1]:0;a=sjcl.bitArray.getPartial(e);d.push(sjcl.bitArray.partial(b+a&31,32<b+a?c:d.pop(),1));return d},s:function(a,b){return[a[0]^b[0],a[1]^b[1],a[2]^b[2],a[3]^b[3]]},byteswapM:function(a){var b,c;for(b=0;b<a.length;++b)c=a[b],a[b]=c>>>24|c>>>8&0xff00|(c&0xff00)<<8|c<<24;return a}};
  sjcl.codec.utf8String={fromBits:function(a){var b="",c=sjcl.bitArray.bitLength(a),d,e;for(d=0;d<c/8;d++)0===(d&3)&&(e=a[d/4]),b+=String.fromCharCode(e>>>8>>>8>>>8),e<<=8;return decodeURIComponent(escape(b))},toBits:function(a){a=unescape(encodeURIComponent(a));var b=[],c,d=0;for(c=0;c<a.length;c++)d=d<<8|a.charCodeAt(c),3===(c&3)&&(b.push(d),d=0);c&3&&b.push(sjcl.bitArray.partial(8*(c&3),d));return b}};
  sjcl.codec.base64={i:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",fromBits:function(a,b,c){var d="",e=0,f=sjcl.codec.base64.i,h=0,g=sjcl.bitArray.bitLength(a);c&&(f=f.substr(0,62)+"-_");for(c=0;6*d.length<g;)d+=f.charAt((h^a[c]>>>e)>>>26),6>e?(h=a[c]<<6-e,e+=26,c++):(h<<=6,e-=6);for(;d.length&3&&!b;)d+="=";return d},toBits:function(a,b){a=a.replace(/\s|=/g,"");var c=[],d,e=0,f=sjcl.codec.base64.i,h=0,g;b&&(f=f.substr(0,62)+"-_");for(d=0;d<a.length;d++){g=f.indexOf(a.charAt(d));
  if(0>g)throw new sjcl.exception.invalid("this isn't base64!");26<e?(e-=26,c.push(h^g>>>e),h=g<<32-e):(e+=6,h^=g<<32-e)}e&56&&c.push(sjcl.bitArray.partial(e&56,h,1));return c}};sjcl.codec.base64url={fromBits:function(a){return sjcl.codec.base64.fromBits(a,1,1)},toBits:function(a){return sjcl.codec.base64.toBits(a,1)}};sjcl.hash.sha256=function(a){this.g[0]||r(this);a?(this.f=a.f.slice(0),this.c=a.c.slice(0),this.a=a.a):this.reset()};sjcl.hash.sha256.hash=function(a){return(new sjcl.hash.sha256).update(a).finalize()};
  sjcl.hash.sha256.prototype={blockSize:512,reset:function(){this.f=this.l.slice(0);this.c=[];this.a=0;return this},update:function(a){"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));var b,c=this.c=sjcl.bitArray.concat(this.c,a);b=this.a;a=this.a=b+sjcl.bitArray.bitLength(a);if(0x1fffffffffffff<a)throw new sjcl.exception.invalid("Cannot hash more than 2^53 - 1 bits");if("undefined"!==typeof Uint32Array){var d=new Uint32Array(c),e=0;for(b=512+b-(512+b&0x1ff);b<=a;b+=512)u(this,d.subarray(16*e,
  16*(e+1))),e+=1;c.splice(0,16*e)}else for(b=512+b-(512+b&0x1ff);b<=a;b+=512)u(this,c.splice(0,16));return this},finalize:function(){var a,b=this.c,c=this.f,b=sjcl.bitArray.concat(b,[sjcl.bitArray.partial(1,1)]);for(a=b.length+2;a&15;a++)b.push(0);b.push(Math.floor(this.a/0x100000000));for(b.push(this.a|0);b.length;)u(this,b.splice(0,16));this.reset();return c},l:[],g:[]};
  function u(a,b){var c,d,e,f=a.f,h=a.g,g=f[0],k=f[1],l=f[2],n=f[3],m=f[4],q=f[5],p=f[6],t=f[7];for(c=0;64>c;c++)16>c?d=b[c]:(d=b[c+1&15],e=b[c+14&15],d=b[c&15]=(d>>>7^d>>>18^d>>>3^d<<25^d<<14)+(e>>>17^e>>>19^e>>>10^e<<15^e<<13)+b[c&15]+b[c+9&15]|0),d=d+t+(m>>>6^m>>>11^m>>>25^m<<26^m<<21^m<<7)+(p^m&(q^p))+h[c],t=p,p=q,q=m,m=n+d|0,n=l,l=k,k=g,g=d+(k&l^n&(k^l))+(k>>>2^k>>>13^k>>>22^k<<30^k<<19^k<<10)|0;f[0]=f[0]+g|0;f[1]=f[1]+k|0;f[2]=f[2]+l|0;f[3]=f[3]+n|0;f[4]=f[4]+m|0;f[5]=f[5]+q|0;f[6]=f[6]+p|0;f[7]=
  f[7]+t|0}function r(a){function b(a){return 0x100000000*(a-Math.floor(a))|0}for(var c=0,d=2,e,f;64>c;d++){f=!0;for(e=2;e*e<=d;e++)if(0===d%e){f=!1;break}f&&(8>c&&(a.l[c]=b(Math.pow(d,.5))),a.g[c]=b(Math.pow(d,1/3)),c++)}}sjcl.misc.hmac=function(a,b){this.j=b=b||sjcl.hash.sha256;var c=[[],[]],d,e=b.prototype.blockSize/32;this.b=[new b,new b];a.length>e&&(a=b.hash(a));for(d=0;d<e;d++)c[0][d]=a[d]^909522486,c[1][d]=a[d]^1549556828;this.b[0].update(c[0]);this.b[1].update(c[1]);this.h=new b(this.b[0])};
  sjcl.misc.hmac.prototype.encrypt=sjcl.misc.hmac.prototype.mac=function(a){if(this.o)throw new sjcl.exception.invalid("encrypt on already updated hmac called!");this.update(a);return this.digest(a)};sjcl.misc.hmac.prototype.reset=function(){this.h=new this.j(this.b[0]);this.o=!1};sjcl.misc.hmac.prototype.update=function(a){this.o=!0;this.h.update(a)};sjcl.misc.hmac.prototype.digest=function(){var a=this.h.finalize(),a=(new this.j(this.b[1])).update(a).finalize();this.reset();return a};
  sjcl.misc.pbkdf2=function(a,b,c,d,e){c=c||1E4;if(0>d||0>c)throw new sjcl.exception.invalid("invalid params to pbkdf2");"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));"string"===typeof b&&(b=sjcl.codec.utf8String.toBits(b));e=e||sjcl.misc.hmac;a=new e(a);var f,h,g,k,l=[],n=sjcl.bitArray;for(k=1;32*l.length<(d||1);k++){e=f=a.encrypt(n.concat(b,[k]));for(h=1;h<c;h++)for(f=a.encrypt(f),g=0;g<f.length;g++)e[g]^=f[g];l=l.concat(e)}d&&(l=n.clamp(l,d));return l};
  "undefined"!==typeof module&&module.exports&&(module.exports=sjcl);"function"===typeof define&&define([],function(){return sjcl});

  // -- END SJCL
  
var vnns = vnns || {
	  
	  getuserdata: function() {
		  return authenticateduser;		  
	  },

		close: function() {
			close();
		},
		
		bindhostUser: function(data) {
			bindHostUser(data);
		}
	  
  };

  function requestStylesheet(stylesheet_url) {
    stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.type = "text/css";
    stylesheet.href = stylesheet_url;
    stylesheet.media = "all";
    document.lastChild.firstChild.appendChild(stylesheet);
  }

  function app( window ) {
	  console.log('VIANEWAUTH starting');

	    // all methods that were called till now and stored in queue
	    // needs to be called now 
	    var globalObject = window[window['VIANEWAUTH']];
	    globalObject.fns = vnns;
	    let queue = globalObject.q;
	    if (queue) {
	        for (var i = 0; i < queue.length; i++) {
	            if (queue[i][0].toLowerCase() == 'init') {
	            	
	            	sc = document.getElementsByTagName("script");

	            	for(let idx = 0; idx < sc.length; idx++)
	            	{
	            	  s = sc.item(idx);

	            	  if(s.src && s.src.match(/via_na\.js$/))
	            	  { 
	            		  let matches = s.src.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
	            		  BASE_URL =  matches && matches[1]; 
	            		  BASE_URL = "https://" + BASE_URL + "/";
	            	  
	            		  //BASE_URL =  newa.hostname; //(new URL(s.src)).hostname; 
	            		  console.log('BASE_URL set ' + BASE_URL);
	            	  }
	            	  
	            	  
	            	}
	            	
	                configurations = extendObject(configurations, queue[i][1]);
	                
	                verifyHostId(configurations.hostId);
	                
	                if (nainitialized ) {
		                if (configurations.mode == 'postauth') {
		                	console.log('VIANEWAUTH started in postauth mode ', configurations);
		                	//console.log('Data[flakes] on device ' + JSON.stringify(flakesondevice));
		                } else {
		                	console.log('VIANEWAUTH started ', configurations);	  
		                }
	                } else {
	                	console.log('VIANEWAUTH could not be started ', configurations);	  
	                }
	            }
	            else {
	                apiHandler(queue[i][0], queue[i][1]);
	            }
	        }
	    }

	    // override temporary (until the app loaded) handler
	    // for widget's API calls
	    globalObject = apiHandler;
	    globalObject.configurations = configurations;
  }
  
  /**
  Method that handles all API calls
  */
function apiHandler(api, params) {
	
	if (nainitialized) {
		  if (!api) throw Error('API method required');
		  api = api.toLowerCase();
		
		  if (supportedAPI.indexOf(api) === -1) throw Error('Method ' + api + ' is not supported');
		
		  console.log('Handling API call ' + api, params);
		
		  switch (api) {
		      // TODO: add API implementation
		      case 'message':
		          show(params);
		          break;
		      case 'bindhostuserid':
		    	  bindHostUser(params);
		    	  break;
		      case 'getauthenticateduser':
		      	  getauthenticateduser();
		      	  break;
		      case 'successhandler':
		    	  registerauthsuccesshandler(params);
		    	  break;
		      case 'failurehandler':
		    	  registerauthfailurehandler(params);
		    	  break;
		      case 'logout':
		    	  logoutfromnewauth(params);
		    	  break;
		      default:
		          console.warn('No handler defined for ' + api);
		  }
	}
}

function extendObject(a, b) {
  for (var key in b)
      if (b.hasOwnProperty(key))
          a[key] = b[key];
  return a;
}
  

function showOverlay(clienttext) {
    // convert plain HTML string into DOM elements
	//console.log('here in showOverlay..');
	if (!overlayloaded) { // preventing reload of overlay
	    let temporary = document.createElement('div');
	    
	    overlay = document.createElement('div');
	    
	    overlay.innerHTML = "<div class='via-na-overlay'></div>";
	    
	    let closeanchor = document.createElement('span');
	    closeanchor.innerHTML = '&times;';
	    closeanchor.style.float='right';
	    closeanchor.style.padding= '2px 5px';
	    closeanchor.style.fontSize= '1.6em';
	    closeanchor.style.top= '0px';
	    closeanchor.style.display = 'inline-block';
	    closeanchor.style.color = '#d3d3d3';
	    closeanchor.style.cursor = 'default';
	    closeanchor.addEventListener('mouseover', function(e) {
	    	e.target.style.color = '#eee';
	    });
	    closeanchor.addEventListener('mouseout', function(e) {
	    	e.target.style.color = '#d3d3d3';
	    });
	    
	    closeanchor.addEventListener('click', close);
	    overlay.getElementsByClassName('via-na-overlay')[0].appendChild(closeanchor);
	    
	    setoverlaystyle();
	    
	    
	    let banner = document.createElement('h2');
	    banner.style.textAlign = "center";
	    
	    let bannertext = "Sign In to " + hostsite + " via Newauth";
	    if (clienttext.length > 0) {
			bannertext = clienttext;
		}
	    let t = document.createTextNode(bannertext);
	    banner.style.position='relative';
	    banner.style.color = '#e2e2e2';
	    banner.appendChild(t);
	    overlay.getElementsByClassName('via-na-overlay')[0].appendChild(banner);
	    
	   // if (clienttext.length > 0) {
		 //   let clientbanner = document.createElement('h4');
		 //   clientbanner.style.textAlign = "center";
		 //   t = document.createTextNode(clienttext);
		 //   clientbanner.appendChild(t);
		 //   overlay.getElementsByClassName('via-na-overlay')[0].appendChild(clientbanner);
	   // }
	    
	   // alert(JSON.stringify(flakesondevice));
	       
	    for (var i=0; i<flakesondevice.length; i++) {
	    	overlay.getElementsByClassName('via-na-overlay')[0].appendChild(createflakediv(flakesondevice[i]));
	    }
	    
	    //if (!highusagedevice) {
	    	overlay.getElementsByClassName('via-na-overlay')[0].appendChild(createusernamebox());
	   // }
	    
	     let joininfo = document.createElement('h5');
	    joininfo.style.textAlign = "center";
	    joininfo.style.position = 'absolute';
	    joininfo.style.bottom = '10px';
	    joininfo.style.left = '50%'
	    joininfo.style.transform = 'translate(-50%,0)';
	    joininfo.appendChild(document.createTextNode("Do not have a Newauth account? Create it at https://newauth.io"));
	    
	    joininfo.style.color = '#d3d3d3';
	     overlay.getElementsByClassName('via-na-overlay')[0].appendChild(joininfo);
	    
	    temporary.appendChild(overlay);
	    
	    let intid = setInterval(fadeinvn, 20);
	    let opacityPercent = 0;
	    
	    function fadeinvn() {
	    	let vnopacity = parseFloat(overlay.getElementsByClassName('via-na-overlay')[0].style.opacity);
		    
	        if (vnopacity > 0.92) {
	            clearInterval(intid);
	        } else {
	        	vnopacity += .04;
	        	
	        	//console.log('vnopacity ' + vnopacity);
	            overlay.getElementsByClassName('via-na-overlay')[0].style.opacity = vnopacity;
	        }
	    }
	   
	    // append elements to body
	    //body = document.getElementsByTagName('body')[0];
	    if (temporary.children.length > 0) {
	    	//alert('children in temporary');
	        elements.push(temporary.children[0]);
	        //body.appendChild(temporary.children[0]);
	       // temporary.removeChild(temporary.children[0]);
	        document.body.appendChild(temporary);
	    }   
    
	    overlayloaded = true;
	}
   
    //document.body.addEventListener('click', close);
}

function createflakediv(flake) {
	//alert(flake.fullname + ' ' + flake.extIds);
	let dspelem = document.createElement('div'); 
	let txt = document.createTextNode(flake.giveout); 
	dspelem.style.textAlign ='center';
	dspelem.style.fontFamily = 'inherit';
	dspelem.style.backgroundColor = '#e3e3e3';
	dspelem.style.borderColor ='#aaa';
	dspelem.style.margin ='10px';
	dspelem.style.fontSize = '1em';
	dspelem.style.padding = '10px 10px';
	dspelem.style.position='relative';
	dspelem.style.left='50%';
	dspelem.style.maxWidth = '400px';
	dspelem.style.marginLeft = '-200px';
	dspelem.style.boxShadow = "2px 2px 4px lightgray";
	dspelem.style.overflowWrap= 'break-word';
	dspelem.style.wordWrap = "break-word";
	dspelem.style.cursor ='default';
	
	dspelem.addEventListener('click', function() {
		//alert(JSON.stringify(flake));
		authviaflake(flake.flake);
	    });
	   
	dspelem.appendChild(txt); 
	
	if (flake.extIds != null) {
		let dspelemin = document.createElement('div'); 
		let txtin = document.createTextNode(flake.extIds);
		
		dspelemin.style.textAlign ='bottom';
		dspelemin.style.bottom ='0';
		dspelemin.style.fontSize = '0.8em';
		dspelemin.style.padding = '2px 2px';
		dspelemin.style.margin ='2px';
		dspelemin.style.overflowWrap= 'break-word';
		dspelemin.style.wordWrap = "break-word";
		dspelemin.style.cursor ='default';
		dspelemin.appendChild(txtin); 		
		
		dspelem.appendChild(dspelemin); 
	}
	
	return dspelem;
}

function createusernamebox() {
	var dspelem = document.createElement('div'); 
	dspelem.style.position='absolute';
	dspelem.style.left='50%';
	dspelem.style.top='50%';
	dspelem.style.overflow = 'hidden';
	dspelem.style.paddingRight = '.5em';
	dspelem.style.maxWidth = "400px";
	dspelem.style.marginLeft = '-200px';
	dspelem.style.transform = 'translate(0, -50%)';
	
	var txtbox = document.createElement('input'); 
	txtbox.setAttribute("type", "password");
	txtbox.setAttribute("size", "50");
	txtbox.setAttribute("placeholder", "Newauth user name");
	txtbox.setAttribute("id", "username-input-box");
	txtbox.style.width = '300px';
	txtbox.style.height = '30px';
	
	txtbox.addEventListener('keydown', function(e){
					if (13 === e.keyCode || e.keyCode === 9) {
											let unameclr = txtbox.value;
											if (unameclr.length < 6) {
												txtbox.style.border = '1px solid red';
												txtbox.setAttribute("placeholder", "Minimum 6 characters");
												setTimeout(function(){
													txtbox.style.border = '';
													txtbox.setAttribute("placeholder", "Newauth user name");
												}, 3000);
												return;
											}
											let unamehash = hashUserForAuthentication(unameclr);
											authviausername(unamehash);
											}
					}
	);
	
	var unamebutton = document.createElement('button'); 
	var txtenter = document.createTextNode("Enter");
	unamebutton.appendChild(txtenter);
	unamebutton.style.height = '35px';
	
	
	unamebutton.addEventListener('click', function(){
											let unameclr = txtbox.value;
											if (unameclr.length < 6) {
												txtbox.style.border = '1px solid red';
												txtbox.setAttribute("placeholder", "Minimum 6 characters");
												setTimeout(function(){
													txtbox.style.border = '';
													txtbox.setAttribute("placeholder", "Newauth user name");
												}, 3000);
												return;
											}
											let unamehash = hashUserForAuthentication(unameclr);
											authviausername(unamehash);
											}
	);
	
	dspelem.appendChild(txtbox);
	dspelem.appendChild(unamebutton);
	
	
	return dspelem;
}

function showButton() {
	let tdiv = document.getElementById('via-newauth-button');    
    let button = document.createElement('button');     
    
    button.title = "Login with Newauth";
    //button.style.backgroundColor= '#767676';
    button.style.backgroundImage = "url("+ BASE_URL + "image/-4" +")";		
    //button.style.backgroundSize = 'contain';
    button.style.borderRadius = '4px';
    button.style.width = '400px';
    button.style.height = '94px';
    button.style.border = 'none';
    button.style.color = '#fdfdfd';
    button.style.padding = '15px 32px';
    button.style.textAlign ='center';
    button.style.textDecoration= 'none';
    button.style.display= 'inline-block';
    button.style.fontSize = '32px';
    button.style.fontWeight = 'bold';
    button.style.transition = "background-image 4s ease-in-out";
    
   // setInterval(function(){
    		//console.log("getting image " + BASE_URL + "image/-2" + button);
   // 		var idx = Math.floor(Math.random() * (5 - 1) + 1);
    //		button.style.backgroundImage = "url("+ BASE_URL + "image/-" + idx +")";	
   // 	}, 600);
    
    //body.appendChild(temporary);
    var t = document.createTextNode("Login");       // Create a text node
    button.appendChild(t); 
    button.onclick = function(ev){    
    	ev.preventDefault();
    	showOverlay(configurations.banner);
       // alert('seeing if show works');
    	       
      };
      tdiv.appendChild(button);
      
      document.body.appendChild(tdiv);
      
      setTimeout(function(){
			//button.style.backgroundImage = "url("+ BASE_URL + "image/-5" +")";		
			button.style.backgroundImage = "url('file:///C:/temp/abstract-bg.jpg')";	
		}, 2000);
      
}

function authviausername(usernamehash) {
	let xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	let url = BASE_URL + 'vn/auththroughusername';
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert(xhr.responseText);
        	let respjsonobj = JSON.parse(xhr.responseText);
        	if (respjsonobj.newChallenge != null) {
        		showimagesonoverlay(respjsonobj.newChallenge);
        	} else if (respjsonobj.flakejson != null) {
    			
    			authenticateduser = JSON.parse(respjsonobj.flakejson);
    			
    			//oldtonewflakeconverter[flake] = authenticateduser.flake;
    			//newtooldflakeconverter[authenticateduser.flake] = flake;
    			
    			if (flakesondevice != null) {
        			for (var i=0; i<flakesondevice.length; i++) {
        				//alert(flakesondevice[i].flake + ' ' + flake);
        		    	//if (flakesondevice[i].flake == authenticateduser.flake) {
        				if (flakesondevice[i].flake == newtooldflakeconverter[authenticateduser.flake]) { // do not want to compare with flake that came in.. because it will be different
        		    		//alert(flakesondevice[i].extIds)
        		    		authenticateduser.extIds = flakesondevice[i].extIds;
        		    	}
        		    }
    			}
    			displayflakeonverlay(authenticateduser);
    			
    			//setTimeout(close, 800);
    			setTimeout(configurations['onAuthCallback'], 1200);        			
    		}
        }
    }
	
    xhr.open('POST', url , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
    let reqpacket = JSON.stringify({
    	 					username: usernamehash,
    	 					screenwidth: window.screen.availWidth ,
    	 					screenheight: window.screen.availHeight
						});
	xhr.send(reqpacket);
}

function authviaflake(flake) {
	newtooldflakeconverter['NEWFLAKE'] = flake;
	//alert(flake)
	let xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	let url = BASE_URL + 'vn/auththroughflake';
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert(xhr.responseText);
        	let respjsonobj = JSON.parse(xhr.responseText);
        	if (respjsonobj.newChallenge != null) {
        		showimagesonoverlay(respjsonobj.newChallenge);
        	} else if (respjsonobj.flakejson != null) {
    			
    			authenticateduser = JSON.parse(respjsonobj.flakejson);
    			
    			oldtonewflakeconverter[flake] = authenticateduser.flake;
    			newtooldflakeconverter[authenticateduser.flake] = flake;
    			
    			if (flakesondevice != null) {
        			for (var i=0; i<flakesondevice.length; i++) {
        				//alert(flakesondevice[i].flake + ' ' + flake);
        		    	//if (flakesondevice[i].flake == authenticateduser.flake) {
        				if (flakesondevice[i].flake == newtooldflakeconverter[authenticateduser.flake]) { // do not want to compare with flake that came in.. because it will be different
        		    		//alert(flakesondevice[i].extIds)
        		    		authenticateduser.extIds = flakesondevice[i].extIds;
        		    	}
        		    }
    			}
    			displayflakeonverlay(authenticateduser);
    			
    			//setTimeout(close, 800);
    			setTimeout(configurations['onAuthCallback'], 1200);        			
    		}
        }
    }
	
    xhr.open('POST', url , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
    let reqpacket = JSON.stringify({
    	 					userflake: flake,
    	 					screenwidth: window.screen.availWidth ,
    	 					screenheight: window.screen.availHeight
						});
	xhr.send(reqpacket);
}

function showimagesonoverlay(respjsonobj) {
	//alert(JSON.stringify(respjsonobj.images));
	
	if (overlay.getElementsByClassName('via-na-overlay') == null) return;
	
 	overlay.getElementsByClassName('via-na-overlay')[0].innerHTML = "";    
 	displayedimgindex = 0;
	let closeanchor = document.createElement('span');
    closeanchor.innerHTML = '&times;';
    closeanchor.style.float='right';
    closeanchor.style.padding= '2px 5px';
    closeanchor.style.fontSize= '1.6em';
    closeanchor.style.top= '0px';
    closeanchor.style.display = 'inline-block';
    closeanchor.style.color = '#d3d3d3';
    closeanchor.style.cursor = 'default';
    closeanchor.addEventListener('mouseover', function(e) {
    	e.target.style.color = '#eee';
    });
    closeanchor.addEventListener('mouseout', function(e) {
    	e.target.style.color = '#d3d3d3';
    });
    
    closeanchor.addEventListener('click', close);
    overlay.getElementsByClassName('via-na-overlay')[0].appendChild(closeanchor);
    
    let imholddiv = document.createElement('div');
    overlay.getElementsByClassName('via-na-overlay')[0].appendChild(imholddiv)
	   
    if (respjsonobj.images.length == 0) {
    	showmessageonoverlay('This Newauth profile is not setup properly. Please set it up first');
    } else {
	    let clickdata = [];
	    let clickedimgid = respjsonobj.images[0].imageid; 
	    let imindiv = [];
	        
	    for (let i=0; i<respjsonobj.images.length; i++) {
	    	let im = new Image();      
	    	
	    	if (displayedimgindex == i) {
	    		//console.log(displayedimgindex + ' ' + i + ' of '+ respjsonobj.images.length);
	      	  	imindiv[i] = document.createElement("IMG");
	      	  	
	      	  	imindiv[i].setAttribute("id", respjsonobj.images[i].imageid);
	      	  	imindiv[i].alt='...Loading';
	      	  	imindiv[i].style.margin = 'auto';
	    	    //imindiv.style.border = '5px';
	    	    //imindiv.style.padding = '5px';
	      	  	imindiv[i].style.marginWidth = 'auto';
	      	  	imindiv[i].style.marginHeight = 'auto';
	      	  	imindiv[i].style.display = 'none';
	      	  	imindiv[i].style.maxWidth = (window.innerWidth * 0.8) + 'px';
	      	  	imindiv[i].style.maxHeight = (window.innerHeight * 0.9) + 'px';
	    	    //imindiv.style.width = '70%';  
	    	    
	      	  	let imgdivobj = imindiv[i];
	      	  	imindiv[i].onclick = function(evt){
	    	    	let mousePos2 = getMousePos2(imgdivobj, evt);
	    		    //let message2 = 'Mouse position: ' + mousePos2.x + ',' + mousePos2.y;    		   
	    		    //alert(message2 + ' w:' + imindiv.width + ' h:' + imindiv.height);    		    
	    	    	//alert(displayedimgindex + ' ' + clickedimgid);
	    		    
	    		    clickdata.push(
	    		    		{
			    	     	   	imgID: clickedimgid ,
			    	       	   	delay: 1234,
			    	       	   	clickX: parseInt(mousePos2.x),
			    	       	    clickY: parseInt(mousePos2.y),
			    	       	    imgWidth: imgdivobj.width,
			    	       	    imgHeight: imgdivobj.height	
		    	       		}
	    		    	);
	    	    	if (displayedimgindex === respjsonobj.images.length - 1) {
	    	    		// now call server
	    	    		//console.log(displayedimgindex + ' ' + i + ' of '+ respjsonobj.images.length);
	    	    		imgdivobj.style.display = 'none';
	    	    		postimageclickdata(clickdata);
	    	    	} else {
	    	    		//imindiv[i-1].style.display = 'block';
	    	    		imgdivobj.style.display = 'block';
	    	    		clickedimgid = respjsonobj.images[displayedimgindex+1].imageid;
	    	    		im.src = BASE_URL + 'image/' + respjsonobj.images[displayedimgindex+1].imageid;
	    	    		displayedimgindex++;
	    	    	} 	
	    	    	
	    	    };	      	  	
	    	    
	    	    imholddiv.appendChild(imindiv[i]);
	      	  	im.src = BASE_URL + 'image/' + respjsonobj.images[i].imageid;      	  	
	      	  	
	      	  	im.onload = function() {
	      	  		imgdivobj.src = this.src;
	      	  		
	      	  		if (displayedimgindex === 0) {
	      	  			imgdivobj.style.display = 'block';
	      	  		}
	      	  	};
	      	  	
	    	}
	    	
	    }
    }
}


function postimageclickdata(imdata) {
	let xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	let url = BASE_URL + 'vn/postclickdataforauth';
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert(xhr.responseText);
        	let respjsonobj = JSON.parse(xhr.responseText);
        	
        	if (respjsonobj.newChallenge != null) {
        		//setoverlaystyle();
        		overlay.getElementsByClassName('via-na-overlay')[0].style.background = '#888'; //'#09b';
        		
        		if (configurations['onAuthFailCallback']) {
        			configurations['onAuthFailCallback']();
        			//close();
        		} //else {
        		setTimeout(function(){showimagesonoverlay(respjsonobj.newChallenge);}, 400);
        		//}        		
        		
        	} else {
        		if (respjsonobj.flakejson != null) {
        			
        			authenticateduser = JSON.parse(respjsonobj.flakejson);
        			
        			oldtonewflakeconverter[newtooldflakeconverter['NEWFLAKE']] = authenticateduser.flake;
        			newtooldflakeconverter[authenticateduser.flake] = newtooldflakeconverter['NEWFLAKE'];
        			        			
        			if (flakesondevice != null) {
	        			for (var i=0; i<flakesondevice.length; i++) {
	        		    	if (flakesondevice[i].flake == newtooldflakeconverter[authenticateduser.flake]) {
	        		    		//alert(flakesondevice[i].extIds)
	        		    		authenticateduser.extIds = flakesondevice[i].extIds;
	        		    	}
	        		    }
        			}
        			
        			displayflakeonverlay(JSON.parse(respjsonobj.flakejson));
        			
        			setTimeout(close, 800);
        			setTimeout(configurations['onAuthCallback'], 1200);        			
        		}
        	}        	
        }
    }
	
    xhr.open('POST', url , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
    let reqpacket = JSON.stringify(imdata);
    showmessageonoverlay('... Authenticating');
	xhr.send(reqpacket);
}

function showmessageonoverlay(message) {
	overlay.getElementsByClassName('via-na-overlay')[0].innerHTML = "";    
	overlay.getElementsByClassName('via-na-overlay')[0].style.background = '#0a0a0a';
	
	let closeanchor = document.createElement('span');
    closeanchor.innerHTML = '&times;';
    closeanchor.style.float='right';
    closeanchor.style.padding= '2px 5px';
    closeanchor.style.fontSize= '1.6em';
    closeanchor.style.top= '0px';
    closeanchor.style.display = 'inline-block';
    closeanchor.style.color = '#d3d3d3';
    closeanchor.style.cursor = 'default';
    closeanchor.addEventListener('mouseover', function(e) {
    	e.target.style.color = '#eee';
    });
    closeanchor.addEventListener('mouseout', function(e) {
    	e.target.style.color = '#d3d3d3';
    });
    
    closeanchor.addEventListener('click', close);
    overlay.getElementsByClassName('via-na-overlay')[0].appendChild(closeanchor);
    
    let messagediv = document.createElement('div');
    let tx = document.createTextNode(message);
    
    messagediv.style.top = (window.innerHeight * 0.05)+"px";	
    messagediv.style.left = (window.innerWidth * 0.1)+"px";
    messagediv.style.color = '#d3d3d3';
    messagediv.appendChild(tx);
   
    overlay.getElementsByClassName('via-na-overlay')[0].appendChild(messagediv)
	    
}

function getMousePos2(imgelem, evt) {
    let rect = imgelem.getBoundingClientRect();
    //console.log('mouseposition getBoundingClientRect rt:' + rect.right + ', lft:' + rect.left + ', bot:' + rect.bottom + ', top:' + rect.top);
    
    if (rect.right-rect.left == 0 || rect.bottom-rect.top == 0) {
    	//alert('returning click location');
  	  return { 
  		  x: Math.round(evt.clientX),
  	  		y: Math.round(evt.clientY)
  	  };
    } else {
	    return {
	    	x: Math.round((evt.clientX-rect.left)/(rect.right-rect.left)*imgelem.width),
	        y: Math.round((evt.clientY-rect.top)/(rect.bottom-rect.top)*imgelem.height)
	    };
    }
  }


function displayflakeonverlay(flakeobj) {
	
	let candiv = overlay.getElementsByClassName('via-na-overlay')[0];
	candiv.style.background = '#fff';
	
	
	if (candiv == null) {
		alert('No div for canvas');
		return false;
	}
	
	let width = 0;
	let height = 0;
	
	if (candiv.clientWidth < candiv.clientHeight) {
		width = candiv.clientWidth *2;
		height = candiv.clientWidth*2;
	} else {
		width = candiv.clientHeight*2;
		height = candiv.clientHeight*2;
	}
	
	
	candiv.innerHTML = "<div id='flkcancontainer'></div>";
	
	candiv = document.getElementById('flkcancontainer');
	
	//candiv.style.margin='auto';
	//candiv.style.position='relative';
	//candiv.style.textAlign='center';
	candiv.style.width = '100%';
	candiv.style.height = '100%';
	//candiv.style.opacity= '0.8';
	candiv.style.left='0';
	candiv.style.top='0';
	candiv.style.position='absolute';
	candiv.style.backgroundColor = 'white';
	
	var flkcanvas = getCanvasWithFlakeImage(flakeobj, width, height, 'large');
	
	var flkiconcanvas = getCanvasWithFlakeImage(flakeobj, 100, 100, 'tiny');
	
	 //alert(size);
	
	candiv.style.background = 'url(' + flkcanvas.toDataURL() + ')';
	candiv.style.backgroundPosition = 'center center';
	candiv.style.backgroundRepeat ='no-repeat';
	
	//overlay.getElementsByClassName('via-na-overlay')[0].style.background = 'url(' + flkcanvas.toDataURL() + ')';
	//overlay.getElementsByClassName('via-na-overlay')[0].style.backgroundPosition = 'center center';
	//overlay.getElementsByClassName('via-na-overlay')[0].style.backgroundRepeat ='no-repeat';
	//overlay.getElementsByClassName('via-na-overlay')[0].style.backgroundColor = 'rgba(255,255,255,0.1)';
	
	let dimdiv = document.createElement("div");
	dimdiv.style.width = '100%';
	dimdiv.style.height = '100%';
	dimdiv.style.opacity= '0.96';
	dimdiv.style.left='0';
	dimdiv.style.top='0';
	dimdiv.style.position='absolute';
	dimdiv.setAttribute("id", "background-dimmmer");
	
	candiv.appendChild(dimdiv);
	
	overlay.getElementsByClassName('via-na-overlay')[0].appendChild(candiv);
	
	let fgdiv = document.createElement("div");
	fgdiv.style.left='50%';
	fgdiv.style.width='50%';
	fgdiv.style.height='16%';
	fgdiv.style.top='50%';
	fgdiv.style.margin='-8% 0 0 -25%';
	fgdiv.style.position='relative';
	fgdiv.style.opacity= '0.96';
	fgdiv.style.padding = '30px 30px';
	fgdiv.style.backgroundColor = '#d3d3d3';
	fgdiv.style.borderColor ='#a00';	
	
	let flkiconimg = document.createElement("img");
	flkiconimg.width = '100';
	flkiconimg.height = '100';
	flkiconimg.align = 'left';
	flkiconimg.src = flkiconcanvas.toDataURL();
	
	let textdiv = document.createElement("div");
	textdiv.style.float = 'left';
	textdiv.style.maxWidth = '70%';
	textdiv.style.height = '90%';
	//textdiv.style.overflow = 'scroll';
	textdiv.style.marginLeft = '20px';
	//alert(JSON.stringify(flakeobj));
	
	let para = document.createElement("p");
	para.style.fontSize = '80%';
	let t = document.createTextNode("Newauth user: " + flakeobj.giveout);
	
	fgdiv.appendChild(flkiconimg);
	para.appendChild(t);
	para.style.fontSize = '80%';
	textdiv.appendChild(para);
	
	para = document.createElement("p");
	para.style.fontSize = '80%';
	t = document.createTextNode("Flake: " + flakeobj.flake);
	
	para.appendChild(t);
	textdiv.appendChild(para);
	
	para = document.createElement("p");
	para.style.fontSize = '80%';
	t = document.createTextNode("Last Authenticated: " + gettimedifference(flakeobj.crtime) + ' ago');
	
	para.appendChild(t);
	textdiv.appendChild(para);
	
	//alert(JSON.stringify(flakeobj));
	para = document.createElement("p");
	para.style.fontSize = '80%';
	t = document.createTextNode("Associated " + hostsite + " IDs: " + authenticateduser.extIds);
	
	para.appendChild(t);
	textdiv.appendChild(para);
	
	
	fgdiv.appendChild(textdiv);
	
	
	
	dimdiv.appendChild(fgdiv);
	
	
}



function getCanvasWithFlakeImage(flakeobj, width, height, size) {
	let valmap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-+";
	
	var flkcanvas = createHiDPICanvas(width, height);

	flkcanvas.width = width;
	flkcanvas.height = height;
	
	//alert('flkcanvas found for canvas' + candiv.style.innerWidth);
	//candiv.appendChild(flkcanvas);
		
	if (flakeobj != null ) {
		
		var flakeval;
		var stringConstructor = "test".constructor; 
		
		// check if flakeobj or a flake are passed
		
		if (flakeobj.constructor === stringConstructor)
			flakeval = flakeobj;
		else if ( flakeobj.flake != null) {
			flakeval = flakeobj.flake
		}		
		
		var center_x = flkcanvas.width/2;
		var center_y = flkcanvas.height/2;
		
		//flkcanvas.style.border = '1px solid #343434';
		var ctx = flkcanvas.getContext("2d");
		//ctx.shadowColor = '#999';
		// ctx.shadowBlur = 4;
		// ctx.shadowOffsetX = 2;
		// ctx.shadowOffsetY = 2;
		//alert(flake.length);
		
		for (var i=0; i<flakeval.length; i++) {
			var dist = (1/valmap.length) * valmap.indexOf(flakeval.charAt(i));
				
			var ang = i * (360/flakeval.length);
			//drawPoint(ang, dist, loggedinuserflake.charAt(i) );
			drawPoint(ang, dist, flakeval.charAt(i) , center_x, center_y, ctx, size, 'false');
				
		}		
		
		if (flakeobj.constructor !== stringConstructor && flakeobj.crtime != null) {
			
				ctx.fillText(flakeobj.crtime , 2, flkcanvas.height-2); 
				
		}		
		
		if (size == 'tiny')
			drawborderllines(flkcanvas);
		
		return flkcanvas;
	}
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

function gettimedifference(timestr) {
	var currtime = new Date();
	
	var oldtime = new Date(
				parseInt(timestr.split(" ")[0].split("-")[2]),
				parseInt(timestr.split(" ")[0].split("-")[0]) - 1,
				parseInt(timestr.split(" ")[0].split("-")[1]),
				parseInt(timestr.split(" ")[1].split(":")[0]),
				parseInt(timestr.split(" ")[1].split(":")[1]),	
				parseInt(timestr.split(" ")[1].split(":")[2].split(".")[0]),
				parseInt(timestr.split(" ")[1].split(":")[2].split(".")[1]));
	
	//alert(timestr + ' ' + oldtime);
	
	var diffinms = currtime - oldtime;
	
	var diffDays = Math.floor(diffinms / 86400000); // days
	var diffHrs = Math.floor((diffinms % 86400000) / 3600000); // hours
	var diffMins = Math.floor(((diffinms % 86400000) % 3600000) / 60000); // minutes
	var diffSecs = Math.floor((((diffinms % 86400000) % 3600000) % 60000) / 1000) ; // seconds
	
	//alert(diffDays + " days, " + diffHrs + " hours, " + diffMins + " minutes, " + diffSecs + " seconds");
	
	if (diffDays > 7) {
		return timestr;
	} else {
		if (diffDays >= 1) {
			return diffDays + " days";
		} else {
			if (diffHrs >= 1) {
				return diffHrs + " hours";
			} else {
				if (diffMins >= 1) {
					return diffMins + " min";
				} else {
					return diffSecs + " sec";
				}
			}
		}
	}
	
	

}

function drawPoint(angle,distance,label, center_x, center_y, ctx, size, displayletters){
	 var radius = center_x/2;
	 distance += 0.35; // shifting all points a bit outside.
   var x = center_x + radius * Math.cos(-angle*Math.PI/180) * distance;
   var y = center_y + radius * Math.sin(-angle*Math.PI/180) * distance;
	//if (debugappui) console.log('drawing point ' + angle + ' ' + distance + ' ' + label + ' ' + center_x + ' ' + center_y);
  
	var point_size = 5;
	var font_size = "7px";
	
  if (size == 'large') {
	   ctx.strokeStyle = '#e3e3e3';
		ctx.fillStyle = "#c3c3c3";
   } else {
	   ctx.strokeStyle = "lightgrey";
		ctx.fillStyle = "grey";
   }
	   	
   if ( size != 'tiny') {
   	 ctx.moveTo(center_x, center_y);
   	 ctx.lineWidth=1;
	    ctx.lineTo(x,y);
	    ctx.stroke();
	    
	    if (displayletters != null && displayletters == 'true') {
	    	ctx.font = font_size;
	    	var x_txt = center_x + radius * Math.cos(-angle*Math.PI/180) * (distance + 0.08);
	        var y_txt = center_y + radius * Math.sin(-angle*Math.PI/180) * (distance + 0.08);
	    	ctx.fillText(label,x_txt,y_txt);
	    }
   } else {
	  
   	point_size = 2;
	   
   }
   
 
   
   ctx.beginPath();
   ctx.arc(x, y, point_size, 0, 2 * Math.PI);
   ctx.fill();
   
  

   
}



function PIXEL_RATIO() {
    let ctx = document.createElement("canvas").getContext("2d"),
        dpr = window.devicePixelRatio || 1,
        bsr = ctx.webkitBackingStorePixelRatio ||
              ctx.mozBackingStorePixelRatio ||
              ctx.msBackingStorePixelRatio ||
              ctx.oBackingStorePixelRatio ||
              ctx.backingStorePixelRatio || 1;

    return dpr / bsr;
}


function createHiDPICanvas (w, h, ratio) {
    if (!ratio) { ratio = PIXEL_RATIO; }
    let can = document.createElement("canvas");
    can.width = w * ratio;
    can.height = h * ratio;
    //can.style.width = w + "px";
    //can.style.height = h + "px";
    can.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    return can;
}


function verifyHostId(hostid) {
	let xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	let url = BASE_URL + 'vn/init';
	xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
        	//alert(xhr.responseText);
        	let respjsonobj = JSON.parse(xhr.responseText);
        	//alert(JSON.stringify(respjsonobj));
        	if (respjsonobj.deviceStatus.statuscode == 'VALID') {
        		flakesondevice = respjsonobj.flakes;
            	highusagedevice = respjsonobj.devicedata.ishighusagedevice;
            	
            	hostsite = respjsonobj.branddisplayname;
        		if (configurations.showButton === true) {showButton();} else {
        			//console.log('showButton: ' + configurations.showButton + ' Otherwise hostId: ' + hostid + ' is valid.');
        		}
        		
        		if (configurations.mode == 'postauth') {
        			authenticateduser = JSON.parse(respjsonobj.flakejson);
        		}
        		nainitialized = true;
        	} else {
        		console.warn('HostId: ' + hostid + ' is not recognized by Newauth. Please check.');
        		let bdiv = document.getElementById('via-newauth-button');
        		if (bdiv != null) {
	        		bdiv.style.fontSize =  10;
	        		bdiv.style.color = 'red';
	        		bdiv.appendChild(document.createTextNode(respjsonobj.deviceStatus.desc));
        		}
        	}
        }
    }
	
	console.log('preparing to post to ' + url);
    xhr.open('POST', url , false);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');     
   
    let reqpacket = JSON.stringify({
    	 					flake: hostid
						});
    
    if (configurations.mode == 'postauth') {
    	reqpacket = JSON.stringify({
				flake: hostid,
				usernameclear: 'LOGGEDINUSER'
		});
    }
    
	xhr.send(reqpacket);
}

function close(ev) {	
	
	let intid = setInterval(fadeoutvn, 20);
    let opacityPercent = 80;
    
    function fadeoutvn() {    	
    	
    	let vnopacity = overlay.getElementsByClassName('via-na-overlay')[0].style.opacity;	    
    	
        if (vnopacity < '0.2') {
            clearInterval(intid);
            while (elements.length > 0) {
            	let elemtoremove = elements.pop();
            	elemtoremove.parentNode.removeChild(elemtoremove);
                //elements.pop().remove();
            }
            document.body.removeEventListener('click', close);
            nainitialized = false;
        } else {
        	opacityPercent -= 5;
        	//console.log('here in fadeoutvn..' + opacityPercent	);
            overlay.getElementsByClassName('via-na-overlay')[0].style.opacity = "0."+opacityPercent;
        }
    }
    
    overlayloaded = false;
   
}

function show(data) {
	//console.log('in show');
	console.log('in show' + data.display);
}

function bindHostUser(data) { 
	//console.log('in bindHostUser');
	
	let dobind = isnewbrandusername(flakesondevice, authenticateduser, data.userId);
	
	if (dobind) {
		console.log('Binding ' + data.userId + ' to ' + JSON.stringify(authenticateduser));
		
		let xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		let url = BASE_URL + 'vn/addbranduser';
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	        	//alert(xhr.responseText);
	        	let respjsonobj = JSON.parse(xhr.responseText);
	        	
	        }
	    }
		
	    xhr.open('POST', url , false);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');     
	   
	    let reqpacket = JSON.stringify({
	    	 					brand: configurations.hostId,
	    	 					user: authenticateduser.flake,
	    	 					brandusername: data.userId
							});
	    
		xhr.send(reqpacket);
	} else {
		console.log('The site user ' + data.userId + ' already bound to logged in Newauth account ' + authenticateduser.flake + ' Skipping bind');
	}
	
}

function getauthenticateduser() {
	console.log('authenticated user ' + JSON.stringify(authenticateduser));
	let dataelem = document.getElementById('newauth-user');
	if (dataelem != null) {
		dataelem.value = encodeURIComponent(JSON.stringify(authenticateduser));
		// set local IDs also -- called extids on newauth side
		for (var i=0; i<flakesondevice.length; i++) {
	    	if (flakesondevice[i].flake == authenticateduser.flake) {
	    		//alert(flakesondevice[i].extIds.indexOf(branduser))
	    		if (flakesondevice[i].extIds != null) {
	    			let locidelem = document.getElementById('local-ids');
	    			if (locidelem != null) {
	    				locidelem.setAttribute('data-local-ids', flakesondevice[i].extIds);
	    				locidelem.appendChild(document.createTextNode(flakesondevice[i].extIds));
	    			} else
	    				console.log('Please create an input element with id: local-ids. IDs of the user on this site will be set there.');
	    		}
	    	}
	    }
	} else
		console.log('Please create an input element with id: newauth-user. Authenticated user data will be set there.');

	return authenticateduser;
}

function isnewbrandusername(flakesondevice, authenticateduser, branduser) {
	if (flakesondevice == null || authenticateduser == null)  return false;
	
	for (var i=0; i<flakesondevice.length; i++) {
    	if (flakesondevice[i].flake == authenticateduser.flake) {
    		//alert(flakesondevice[i].extIds.indexOf(branduser))
    		if (flakesondevice[i].extIds != null && flakesondevice[i].extIds.indexOf(branduser) >= 0)
    			return false;
    	}
    }
	return true;
}

function registerauthsuccesshandler(data) {	
	
	if (nainitialized) {
	
		if (data.callback && typeof data.callback === "function") {
			configurations['onAuthCallback'] = data.callback;
			console.log(' successhandler registered');
		} else {
			console.log(' successhandler could not be registered');
		}
	}
	
	
}

function registerauthfailurehandler(data) {	
	
	if (nainitialized) {
		if (data.callback && typeof data.callback === "function") {
			configurations['onAuthFailCallback'] = data.callback;
			console.log(' failurehandler registered');
		} else {
			console.log(' failurehandler could not be registered');
		}
	
	}
}

function logoutfromnewauth() {
	console.log('Log out of Newauth is not functional right now.');
}

function setoverlaystyle() {
	 overlay.getElementsByClassName('via-na-overlay')[0].style.color = '#444';
	    overlay.getElementsByClassName('via-na-overlay')[0].style.position = 'fixed';
	    overlay.getElementsByClassName('via-na-overlay')[0].style.background = '#888'; //'#09b';
	    overlay.getElementsByClassName('via-na-overlay')[0].style.width = '80%';
	    overlay.getElementsByClassName('via-na-overlay')[0].style.height = '90%';	    
	    
	    overlay.getElementsByClassName('via-na-overlay')[0].style.top = (window.innerHeight * 0.05)+"px";	
	    overlay.getElementsByClassName('via-na-overlay')[0].style.left = (window.innerWidth * 0.1)+"px";
	   
	    overlay.getElementsByClassName('via-na-overlay')[0].style.opacity = '0.8';	
	    overlay.getElementsByClassName('via-na-overlay')[0].style.boxShadow = "8px 8px 11px lightgray";	    
	
}

function hashUserForAuthentication(user) {	
	
	var saltBits = sjcl.codec.base64.toBits('sugar');
	
	var derivedKey1000 = sjcl.misc.pbkdf2(user, saltBits, 1000, 256);
	var key1000 = sjcl.codec.base64.fromBits(derivedKey1000);	
	
	var salt = sjcl.codec.base64.fromBits(saltBits);
	//alert('salt: ' + salt)
	console.log( 'Hashed username: ' + key1000);
	return key1000;
}


 // requestStylesheet(STYLESHEET);
 // document.write();
 // alert('came till here');
  app(window);
  
  
