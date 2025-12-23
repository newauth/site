var responsedata = [];
var imagecounter = 0;

var authimagecontainerdivelem;
var imgs;
var images;
var attemptdiv;

var collagex = 0;
var collagey= 0;

var maxzoom = 2;
var currentzoom = 0;
var succgrid;
var impliedx = 0, impliedy = 0;

var gridSize = 2; // 2x2 grid
var zoomfurther = true;

function displayrecoverybutton() {
	attemptdiv=document.querySelector('#auth-progress-display');
	var btn = document.createElement("BUTTON");  
	btn.classList.add('btn');
	btn.classList.add('btn-xs');
	btn.classList.add('btn-default');
	btn.classList.add('pull-right');
	btn.onclick= function(ev){    
		var username = vaultkey;
		sendrecoverycode(username);
       
      };
				
	btn.innerHTML = "Recover Account";    
	if (attemptdiv != null)              
		attemptdiv.appendChild(btn);  
}

function displayAttemptIndicator( j) {
	attemptdiv=document.querySelector('#auth-progress-display');
		
		if (attemptdiv) {
			
			attemptdiv.classList.add("animated");
			attemptdiv.classList.add("flash");
			attemptdiv.classList.add("v-center");
		attemptdiv.innerHTML = '';
		var p = document.createElement("p")  ;
		p.classList.add('lead');
		//p.style.wordWrap = "break-word"; 
		p.style.maxWidth = "80%";
		p.style.display = 'inline-block';
		p.style.textDecoration= 'line-through';
		p.style.color='#600102';
		var textelem = document.createTextNode(' ' + j + ' '); 
		
		p.appendChild(textelem);  	
		attemptdiv.appendChild(p);
		}
		/*var attemptcanvas = document.createElement('canvas');
		attemptdiv.appendChild(attemptcanvas);
		var ctx = attemptcanvas.getContext("2d");    	  
   	 
		attemptcanvas.style.position = "relative";
		attemptcanvas.style.margin= "0px";
		attemptcanvas.style.display= "block";
		//attemptcanvas.width = '100';
		attemptcanvas.height = '50px';p
		
		ctx.clearRect(0, 0, attemptcanvas.width, attemptcanvas.height);
		
  	  for (var i=0; i<j; i++) {  		
  		
  	  		ctx.save();
	  	  ctx.beginPath();
	  	  
	  	  ctx.arc((i+1)*30, 12, 5, 0, 4 * Math.PI, false);
	  	  ctx.lineWidth = 8	;
	  	  ctx.strokeStyle = '#ff1010';
	  	  ctx.stroke();
  	  }*/
    	
	}
	
	
	function displayauthenticatingicon() {
		//var displayicondiv =document.querySelector('#loadingiconcontainer');
		var displayicondiv =  document.getElementById("displayauthenticatingcontainer");
		//alert('found loading container');
		displayicondiv.style.display='inline-block'; 
		//console.log('displaying authenticating message');
		
		appcalltimeoutid = setTimeout(announceapptimeouterror, 10000);
	}
	
	
	function postCollageSelection(id) {
	    
	    //clear collage first
	    var phsection = document.getElementById("auth-photos");
		
		if (phsection !== null) {
			
			//$("#auth-photos").fadeOut(400);
			phsection.style.display = 'none';
			
		}
		
		collageimagesloaded = 0;
		
		var url = "/newauth/postAuthColClickData/" + id;

		//location.href = url;
		//return false;
		displayloadingicon();
		//alert('requested url ' + url);
		loadUrlAjax(url, 'app');
		document.title = 'Newauth - Authenticate';
		loadUrlAjax('/newauth/header?page=authenticate', 'app-header');
		//alert('post collage complete');
		return false;
	}

	function sendrecoverycode(uname) {
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		
		xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	        	var jsonres = xhr.responseText;        		        	
	        	console.log('response out of sendrecoverycode ' + jsonres);
	        	var email = JSON.parse(jsonres).emaildisplay;
	        	var key = JSON.parse(jsonres).vercode;
	        	createRecoverAccountOverlay(uname, email, key);
	        }
	    }
		
	    xhr.open('POST', '/newauth/api/sendrecoverycode' , false);
	    xhr.withCredentials = true;
	    xhr.setRequestHeader('Content-Type', 'application/json');     
	   
	   
	    var reqpacket = JSON.stringify({
									 	   username: hashUserForAuthentication(uname)
									 		});
		xhr.send(reqpacket);
	}
	
	function displayFirstImage() { /// this is the image tag method.. this is hiding parts of image
		hideloadingicon();
		
    	//alert('in display first image ' );
		
		var phsection = document.getElementById("auth-photos");
		
		//alert('looking for photos section');
		if (phsection !== null) {
			//	alert('photos section found');
			document.getElementById('auth-image-main-container-id').style.top = '50px';
			document.getElementById('auth-image-main-container-id').style.left = '12px';
			
			$("#auth-photos").fadeIn(500);
			restartTimer();
		}
	}

	function displayfirstimageoncanvas() {
		//console.log('in displayfirstimageoncanvas ' );
		hideloadingicon();
		clearTimeout(appcalltimeoutid);
		var imgparent=document.getElementById("auth-images");
    	
		if (imgparent !== null) {
			 imgs = document.querySelectorAll("img");
			//$("#auth-images:first").fadeIn(500);
			
			if (imgs !== null) {
				//alert('images found first width ' + imgs[0].width);
				drawimgbyindex(imgs, 0);
				
			
				restartTimer();
			}
		}
		
		
	}
	
	function drawimgbyindex(images, index) {
		//console.log('in drawimgbyindex index ' + index + ' out of ' + images.length);
		var contelem = document.getElementById('auth-image-main-container-id');
		//document.getElementById('auth-image-main-container-id').style.top = '0px';
		//document.getElementById('auth-image-main-container-id').style.left = '0px';
		
		var info = document.getElementById("imdata"+index);
		//alert('info is ' + 	info);
		if (info != null) {
			info.style.display='block';
		}
		
		var c = document.getElementById("imgholder");
		
		c.addEventListener('click', handleauthimgclickevent , false);
		
		//alert('img width ' + imgs[0].width);
		var newsz = getnewimagesize(images[index]);
		c.width = newsz.width;
		c.height = newsz.height;
		c.top = 0;
		//c.bottom = 0;	
		var context = c.getContext("2d");
		if (index > 0) context.clearRect(0, 0, c.width, c.height);
		
		context.drawImage(images[index], 0,0, c.width, c.height);
		
		//drawGridOverImage( c, 100);// only for testing
		//console.log('in drawimgbyindex index after drawImage ' + c.width + ' ' + c.height);
	}
	
	function hideAuthImage() {
		//alert('Hiding auth image');
		var contelem = document.getElementById('auth-image-main-container-id');
		contelem.style.display = 'none';
	}
	
	function showAuthImage() {
		var contelem = document.getElementById('auth-image-main-container-id');
		contelem.style.display='table-cell'; 
	}
	
	function getnewimagesize(img) {
		
		var newwidth = img.width;
		var newheight = img.height;
		//console.log('app dims ' + document.getElementById('app').width + ' ' + document.getElementById('app').height);
		var arwin = (window.innerWidth-12)/(window.innerHeight-94);
		var arimg = img.width/img.height;
		
		if (arwin <= arimg) {
			//console.log("came in image ar bigger or equal");
			if (window.innerWidth < img.width) {
				newwidth = window.innerWidth - 12;
				newheight = newwidth / arimg;
			}
		} else {
			//console.log("came in image ar smaller : win " + window.innerHeight + " img " + img.height);
			if (window.innerHeight - 94 < img.height) {
				newheight = window.innerHeight - 94;
				newwidth = newheight * arimg;
			}
		}
		
		var out = {width: newwidth.toFixed(2), height: newheight.toFixed(2)};
		//console.log("original img " + img.width + " " + img.height + " new image size" + JSON.stringify(out));
		
		return out;
	}
  
	
	function handleauthimgclickevent(evt) {
		//alert('in handleauthimgclickevent');
		clearauthheadermessage();
		    		
		var clickdelay = gettimetoclick();
		
		var imgparent=document.getElementById("auth-images");    	
    	
		if (imgparent !== null) {
			imgs = document.querySelectorAll("img");
		}
		
	   var imgelem = imgs[imagecounter];
	   imgelem = document.getElementById("imgholder");
	    var mousePos2 = getMousePos2(imgelem, evt);
	    var message2 = 'Mouse position: ' + mousePos2.x + ',' + mousePos2.y;
	   
	   // alert( message2 + ' img-width: ' + imgelem.width);
	    x = mousePos2.x;
	    y = mousePos2.y;
	    
	   // if (currentzoom == 0) console.log(currentzoom + " impliedx , impliedy " + x + ", " + y);
	    // handle click on image on a small screen
	   // if (imgs.length == 1) {
	    if (window.innerWidth < 600)  {
			//console.log('currentzoom zoomfurther ' + currentzoom + ' ' + zoomfurther);
	    	if (currentzoom < maxzoom && zoomfurther) {
				var imgcanv = document.getElementById("imgholder");
				
				var xdiv = 0;
				var ydiv = 0;
				
				var gridclicked = getgridclicked(x,y,imgelem.width,imgelem.height, gridSize); 
				//console.log("zoom count " + currentzoom + " zooming on grid location" + JSON.stringify(gridclicked) + " x, y " + x + ", " + y);
				
				if (currentzoom > 0) {
					xdiv = (collagex + (mousePos2.x ) / Math.pow(gridSize, currentzoom )) - impliedx;
					ydiv = (collagey + (mousePos2.y) / Math.pow(gridSize, currentzoom )) - impliedy;
					//console.log(currentzoom + " divergences x , y " + xdiv + ", " + ydiv);
					
				}
				impliedx = collagex + (mousePos2.x ) / Math.pow(gridSize, currentzoom ) ;
				impliedy = collagey + (mousePos2.y) / Math.pow(gridSize, currentzoom ) ;
				
				//console.log(currentzoom + " impliedx , impliedy " + impliedx + ", " + impliedy);
								
				//console.log("collagex , collagey " + collagex + ", " + collagey);
				 
				if (currentzoom == 0 || (Math.abs(xdiv) > imgelem.width *0.1 || Math.abs(ydiv) > imgelem.height *0.1)) {
					//if (currentzoom == 0)
					//	console.log('First click... zoom further');
					//else
					//	console.log('divergence exists... zoom further');
					
					collagex +=   (imgelem.width * (gridclicked.col -1) / Math.pow(gridSize, currentzoom+1 ));
					collagey +=  (imgelem.height * (gridclicked.row -1) / Math.pow(gridSize, currentzoom+1 ));					
					
					drawGridOverImage( imgcanv, gridSize);
					zoomimagegrid(gridclicked, imgs[imagecounter],imgcanv);
					return;
				} else {
					zoomfurther = false;
					//drawGridOverImage( imgcanv, gridSize);
					//zoomimagegrid(gridclicked, imgs[imagecounter],imgcanv);
					//return;
				}
	    	}
		}
	    
	    //intervalid = setInterval("DrawCircle()", 100);
	   // if (debugappui) console.log('after mouse position ' + message2);
	   
    	if (window.innerWidth < 600) {
    		//console.log("collagex,  currentzoom, x, gridSize " + collagex + ", " + currentzoom + "," + x + "," + gridSize);
    		x = collagex + mousePos2.x/ Math.pow(gridSize, currentzoom );
    		y = collagey + mousePos2.y/ Math.pow(gridSize, currentzoom );
    		
    		//console.log(currentzoom + " impliedx , impliedy " + x + ", " + y);
    		collagex = 0;
      		collagey = 0;
      		collageimagesloaded = 0;
    	}
	   
	    //console.log("x,y being passed  " + x + ", " + y + " currentzooom " + currentzoom );
	    if (parseInt(x) >= 0 && parseInt(x) <= imgelem.width
	    		&& parseInt(y) >= 0 && parseInt(y) <= imgelem.height) {
	  	  var indivresponse = JSON.stringify({
	     	   	imgID: images[imagecounter],
	       	   	delay: clickdelay,
	       	   	clickX: parseInt(x),
	       	    clickY: parseInt(y),
	       	    imgWidth: imgelem.width,
	       	    imgHeight: imgelem.height	
	       		});	  	  
	  	  	
		       responsedata.push (indivresponse);     		 
	  
		        var img=document.getElementsByClassName("auth-image-main");
		      	img[imagecounter].style.display='none';
		      	
		      	var info = document.getElementById("imdata"+imagecounter);
				//alert('info is ' + 	info);
				if (info != null) {
					info.style.display='none';
				}
				
	    
		      	//if (debugappui) console.log('showing image ' + (imagecounter+1) + ' out of ' + img.length);
		      	//console.log('showing image ' + (imagecounter+1) + ' out of ' + imgs.length);
		      	if (imagecounter < img.length -1) {
		      		
		      		imagecounter++;
		    		
		    		//img[imagecounter].style.display='block'; 
		    		
		    		drawimgbyindex(imgs, imagecounter);
		    		//$(".auth-image-main:eq(" + imagecounter + ")").fadeIn(400);
		    		currentzoom = 0;
		    		zoomfurther = true;
		    		restartTimer();
		      	} else {
		      		if (attemptdiv) {
		      			
		      			//alert('attemptdiv html length' + attemptdiv.innerHTML.length);
		      			attemptdiv.classList.remove("animated");
		    			attemptdiv.classList.remove("flash");
		      			attemptdiv.innerHTML = '';
		      		}
		      		
		      		if (document.getElementById('imgholder') != null) {
		      			//alert('clearing imgholder');
		      			//$("#imgholder").fadeOut(200);
		      			document.getElementById('imgholder').style.display = 'none';
		      			cleardiv(document.getElementById('imgholder'));
		      		}	      		
		      		
		      		displayauthenticatingicon();
		      		
		      		  document.getElementById('authResponseForm').responsedata.value = '['+ responsedata + ']';
		      		  
		      		  //removing because this seems to be failing after refresh
		      		  authimagecontainerdivelem.removeEventListener('click', handleauthimgclickevent , true);      		 
			      		  
		      		 // alert(responsedata);
		      		  //document.forms[0].submit();		 	      		  
		      		console.log('submitting auth form. counter ' + imagecounter + ' length ' + img.length);
		      		submitFormAjax('/newauth/postAuthClickData', 'authResponseForm');
		      		collageimagesloaded = 0;
		      		currentzoom = 0;
		      		zoomfurther = true;
		      		
		      		//document.forms[0].responsedata.value = []; // clear the responsedata field
		      		responsedata = [];
		      		 // clear content also.. because it may be used later		      		
		      		images = [];
		      	}
	    }
	    		evt.stopPropagation();
	  }
	
	
	function drawcircleoverimage(cnvs, x, y, radius, authscore) {
		   var context = cnvs.getContext('2d');
	      var centerX = x;
	      var centerY = y;
	      
	      context.beginPath();
	      context.globalAlpha = 0.4; 
	      context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
	      
	      context.fillStyle = 'white';
	      if (authscore < 50)
	    	  context.fillStyle = 'darkred';
	      
	      if (authscore >= 70)
	    	  context.fillStyle = 'orange';
	      
	      if (authscore >= 89) {
	    	  context.globalAlpha = 0.1; 
	    	  context.fillStyle = 'green';
	      }
	      
	      if (authscore == 100) {
	    	  context.globalAlpha = 0; 
	    	  context.fillStyle = 'black';
	      }
	      
	      if (authscore != 100)
	    	  context.fill();
	      
	      context.lineWidth = 5;
	      //context.strokeStyle = '#003300';
	      if (authscore != 100)
	    	  context.fill();
	}
	
	function drawrectangleoverimage(image, cnvs, x,y, w,h) {
		
		var ctx = cnvs.getContext('2d');

		//ctx.restore();
		
		ctx.clearRect(0,0, cnvs.width, cnvs.height);
			
			//alert('main canvas cleared');
			ctx.globalAlpha = 1;
		  ctx.drawImage(image,0,0, cnvs.width, cnvs.height); // Or at whatever offset you like
		    
		 // alert('image drawn ');
		  ctx.globalAlpha = 0.5;
		  ctx.beginPath();
		  ctx.rect(x, y, w,h);
		  ctx.fillStyle = 'gray';
		  ctx.fill();
		 // alert('rect drawn on canvas ' + x + ' '  + y + ' ' + w + ' ' + h);
		  //ctx.save();
				
	}
	
	function drawGridOverImage( cnvs, gridsize) {
		
		if (gridsize == null) gridsize = 4;
		
		var xslice = gridsize;
		var yslice = gridsize;
    	
  	 	 var ctx = cnvs.getContext("2d");   
    	 	  ctx.strokeStyle = '#dddddd';
    	  
    	  
    	  for (var i=0; i<xslice; i++) {
    		ctx.save();
        	ctx.beginPath();
        	ctx.moveTo(0, i*(cnvs.height/xslice));
        	ctx.lineTo(cnvs.width, i*(cnvs.height/xslice));
        	ctx.closePath();
        	ctx.stroke();
        	ctx.restore();
    	  }
        
    	  for (var j=0; j<yslice; j++) {
    		  ctx.save();
        	ctx.beginPath();
        	ctx.moveTo(j*(cnvs.width/yslice), 0);
       	 	ctx.lineTo(j*(cnvs.width/yslice), cnvs.height);
        	ctx.closePath();
        	ctx.stroke();
        	ctx.restore();
    	  }
    	  //alert('after creating grid');
    }
	
	function getgridclicked(x,y,imgwidth, imgheight, gridsize) {
		
		if (gridsize == null)
			gridsize = 4;
		
		var gridloc = {};
		
		gridloc['col'] = parseInt((((x-1) * gridsize)/imgwidth ) + 1);
		gridloc['row'] = parseInt((((y-1) * gridsize)/imgheight ) + 1);
		gridloc['size'] = gridsize;
		
		return gridloc;
	}
	
	function zoomimagegrid(grid, image, can) {
		var wd = can.width;
		var ht = can.height;
		var context = can.getContext('2d');
		
		var clipsx  = parseInt((wd/grid.size) * (grid.col -1));
		if (clipsx > 2)
			clipsx = clipsx - 2;
		
		var clipsy  = parseInt((ht/grid.size) * (grid.row -1));
		if (clipsy > 2)
			clipsy = clipsy - 2;
		
		// convert canvas locations into image locations
		clipsx = parseInt(collagex * (image.width/wd));
		clipsy = parseInt(collagey * (image.height/ht));
		
		var clipwd = parseInt(image.width/(grid.size * (currentzoom + 1)));
		var clipht = parseInt(image.height/(grid.size * (currentzoom + 1)));
		
		
		var redrawtimer = setTimeout (function() {
				
			/*var tmpcan = document.createElement("CANVAS");
			tmpcan.width = wd;
			tmpcan.height = ht;
			
			tmpcan.getContext('2d').putImageData(image, 0, 0);*/
			//console.log("gridcol, gridrow, clipsx, clipsy, clipwd, clipht, wd, ht" + grid.col + "," + grid.row + "," + clipsx + "," + clipsy+ "," + clipwd+ "," + clipht+ "," + wd+ "," +ht);
			
			zoomimagecliponcanvasinsteps(image, can, grid, clipsx, clipsy, clipwd, clipht, 15); // 5 steps
			//context.clearRect(0,0,wd, ht);
			//context.drawImage(image, clipsx, clipsy, clipwd, clipht, 0,0,wd, ht);
			currentzoom++;
			//console.log ("after image draw on new cnvas");
		}, 200);
				
	}	
	
	async function zoomimagecliponcanvasinsteps(image, can, gridclicked, clipsx, clipsy, clipwd, clipht, steps) {
		var wd = can.width;
		var ht = can.height;
		var context = can.getContext('2d');
		
		for (var s=0; s<steps; s++) {
			var scl = 1 + ((s+1)/steps);
			//context.scale(scl, scl);			
			
			context.clearRect(0,0,wd, ht);
			var canx = 0;
			var cany = 0;
			
			var canwd = wd*scl/2;
			var canht = ht*scl/2;
			
			if (gridclicked.col > 1) {
				canx = wd*(1-(s+1)/steps)/2;
				//canwd = wd;
			}
			
			if (gridclicked.row > 1) {
				cany = ht*(1-(s+1)/steps)/2;
				//canht = ht;
			}
			
			//console.log("clipsx, clipsy, clipwd, clipht, canx, cany" + clipsx + "," + clipsy+ "," + clipwd + "," + clipht+ "," + canx+ "," +cany);
			context.drawImage(image, clipsx, clipsy, clipwd, clipht, canx, cany, canwd, canht);
			var date = new Date();
			var tm = date.getTime();
			//console.log('done zooming to scale '+ scl + ' ' + tm);
			await sleep(parseInt(600/steps));
		}
		
	}
	
	function sleep(ms) {
		  return new Promise(resolve => setTimeout(resolve, ms));
		}
	
	function imagedata_to_image(imagedata) {
	    var canvas = document.createElement('canvas');
	    var ctx = canvas.getContext('2d');
	    canvas.width = imagedata.width;
	    canvas.height = imagedata.height;
	    ctx.putImageData(imagedata, 0, 0);

	    var image = new Image();
	    image.src = canvas.toDataURL();
	    return image;
	}
    
  
  function getMousePos2OLD(imgelem, evt) { // this was used before canvas
      var rect = imgelem.getBoundingClientRect();
      if (debugappui) console.log('mouseposition getBoundingClientRect ' + rect.right + ',' + rect.left + ',' + rect.bottom + ',' + rect.top);
      
      if (rect.right-rect.left == 0 || rect.bottom-rect.top == 0) {
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
  
  function getMousePos2(canvas, evt) {
      var rect = canvas.getBoundingClientRect();
      return {
      	x: Math.round((evt.clientX-rect.left)/(rect.right-rect.left)*canvas.width),
          y: Math.round((evt.clientY-rect.top)/(rect.bottom-rect.top)*canvas.height)
      };
    }
  
  
  function gradientBackground()
  {
	  return false;
  /*color1 = '#101010';
  color2 = '#c2c2c2';

  document.getElementById("gradient").style.background="-webkit-gradient(linear, left top, left bottom, from("+color1+"), to("+color2+"))";
  document.getElementById("gradient").style.background="-webkit-linear-gradient("+color1+", "+color2+")";
  document.getElementById("gradient").style.background="-moz-linear-gradient(top, "+color1+", "+color2+")";
  document.getElementById("gradient").style.background="-ms-linear-gradient("+color1+", "+color2+")";
  document.getElementById("gradient").style.background="-o-linear-gradient("+color1+", "+color2+")";
  document.getElementById("gradient").style.background="linear-gradient("+color1+", "+color2+")";
	document.getElementById("gradient").style.filter="progid:DXImageTransform.Microsoft.Alpha(startColorstr='"+color1+"', endColorstr='"+color2+"')";
	*/

  }
  
  
  function clearauthheadermessage() {
	  $("#authmessagedisplay").fadeOut(100);
	  //document.getElementById('authmessagedisplay').innerHTML = '';
  }
  
  
  function createRecoverAccountOverlay(uname, eml, key) {
		
		var flakeoverlay = document.getElementById("recover-account-overlay"); // this id is setup as blocking overlay
		
		if (flakeoverlay == null) {
			//alert('in createUserFlakeOverlay .. creating new overlay');
			flakeoverlay = document.createElement("div");
			flakeoverlay.setAttribute("id", "recover-account-overlay");
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
			    	$('#recover-account-overlay').fadeOut(500);
			    	loadWelcome();
			    });
			    coldiv.appendChild(closeanchor);
			 
			 var pdh = document.createElement('p');
			 pdh.classList.add('lead');
			 pdh.setAttribute("id", "createuser-flake-text-header");
			 
			 pdh.appendChild(document.createTextNode("Please enter the recovery code you received in your email."));
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
			 
			 pd.appendChild(document.createTextNode("We just sent a recovery code to your email address " + eml + " Please enter it below"));
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
				cuflkinput.setAttribute("type", "text");
				cuflkinput.setAttribute("id", "recovery-code-input");
				cuflkinput.setAttribute("autofocus", "true");
				cuflkinput.classList.add('form-control');
				cuflkinput.classList.add('input-md');
				//cuflkinput.addEventListener('input', prepareSendButton, false);
				cuflkinput.addEventListener('input', function(){ 					
					var flk = document.getElementById('recovery-code-input').value;
					if ( flk.length > 40) {
						$('#cde-send-button').fadeIn('slow');
					} else {
						document.getElementById('cde-send-button').style.display = 'none';
					}
				}, false);
				cuflkinput.style.color = '#646464';
				
				var sendbutton = document.createElement("input");
				sendbutton.setAttribute("id", "cde-send-button");
				sendbutton.classList.add('btn');
				sendbutton.classList.add('btn-primary');
				sendbutton.classList.add('btn-md');
				//sendbutton.classList.add('pull-right');
				sendbutton.conversationID = '';
				sendbutton.changestarttime = '';
				sendbutton.type = "button";
				sendbutton.value = "Recover";
				sendbutton.style.display = 'none';
				sendbutton.addEventListener('click', function() {
											verifyrecoverycode (uname, key);
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

			  $('#recovery-code-input').focus();
		
		}
		
		settimeoutid = setTimeout(function(){ 
					//flakeoverlay.style.display = "block";
					$('#recover-account-overlay').fadeIn('slow');
				}, 500);
		
	}
  
  function verifyrecoverycode(uname, key) {
	 	
		var code = document.getElementById("recovery-code-input").value;
		
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
		        		//alert(jsonres);
		        		$('#recover-account-overlay').fadeOut('slow');
		        		loadUrlAjax('/newauth/header?page=home', 'app-header');
		        		loadUrlAjax('/newauth/welcome', 'app');
		        	} else {
		        		document.getElementById("createuser-flake-text").innerHTML = '<font color="red">Invalid code. Please check </font>';
		        	}
		        }
		    }		
		    
		    var reqpacket = JSON.stringify({
		    	username: hashUserForAuthentication(uname),
		    	verificationKeyCode: key,
		    	verificationKeyInput:code
	     		});
		     
		    
		    xhr.send(reqpacket);
		}
  }
  
  //alert('authenticate loaded');