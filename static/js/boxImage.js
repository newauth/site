var radius = 20;
var linewidth = 3;
var iintervalid, ointervalid, otimeoutid, x, y;
var clickevt;
var confirmedclicks ;
var boxedimages;

var serversentclkdata;
var nextimgid;
var imgcanvas;
var img;
var context;


    
    function getMousePos2(canvas, evt) {
        var rect = canvas.getBoundingClientRect();
        return {
        	x: Math.round((evt.clientX-rect.left)/(rect.right-rect.left)*canvas.width),
            y: Math.round((evt.clientY-rect.top)/(rect.bottom-rect.top)*canvas.height)
        };
      }
    
    function drawInwardCircle() {
    	//alert('creating incanvas');
    	  var cnvs = document.getElementById("incircleCanvas");
    	  
    	  if (cnvs == null) {
    		 // alert('creating incanvas');
    		  cnvs = document.createElement('canvas');
    		  cnvs.id = 'incircleCanvas';

      		document.body.appendChild(cnvs); // adds the canvas to the body element
      		}
    	  var ctx = cnvs.getContext("2d");    	  
    	 
    	  cnvs.style.position = "absolute";
    	  cnvs.width = 40;
    	  cnvs.height = 40;
    	 
    	// alert('y' + y + 'imgcanvas.getBoundingClientRect().top ' + imgcanvas.getBoundingClientRect().top);
    	  cnvs.style.left = x + imgcanvas.getBoundingClientRect().left - 20 + "px";
    	  cnvs.style.top = y + imgcanvas.getBoundingClientRect().top - 20 + "px";  
    	  
    	  ctx.clearRect(0, 0, cnvs.width, cnvs.height);
    	  
    	  ctx.save();
    	  ctx.beginPath();
    	  
    	  ctx.arc(20, 20, radius, 0, 4 * Math.PI, false);
    	  ctx.lineWidth = 3;
    	  ctx.strokeStyle = '#ffffff';
    	  ctx.stroke();
    	  radius -= 3;
    	  ctx.restore();
    	  
    	  if (radius < 2) {
      		radius = 20;
      		clearInterval(iintervalid);
      		//drawGridAroundClick();
      		
      		//setTimeout(clearAllCanvas, 3000);
      	}
    	      	  
   	}
    
    
    function DrawOutwardCircle(startradius, endradius){
    	//alert('outward intervalid ' + ointervalid);
    	if (!confirmedclicks || confirmedclicks < 3) {
    		clearTimeout(otimeoutid);
    		return;
    	}
    	
    	
  	  var cnvs = document.getElementById("outcircleCanvas");
  	  if (cnvs == null) {
  		  cnvs = document.createElement('canvas');
  		  cnvs.id = 'outcircleCanvas';

    		document.body.appendChild(cnvs); // adds the canvas to the body element
    	}
  	  var ctx = cnvs.getContext("2d");    	  
  	 
  	  cnvs.style.position = "absolute";
  	  cnvs.width = 2*endradius;
  	  cnvs.height = 2*endradius;
  	  cnvs.style.left = x + imgcanvas.getBoundingClientRect().left - endradius + "px";
  	  cnvs.style.top = y + imgcanvas.getBoundingClientRect().top - endradius + "px";  
  	  
  	  ctx.clearRect(0, 0, cnvs.width, cnvs.height);
  	  
  	  ctx.save();
  	  ctx.beginPath();
  	  
  	  ctx.arc(endradius, endradius, radius, 0, 4 * Math.PI, false);
  		
  	  ctx.lineWidth = linewidth;
  	  ctx.strokeStyle = '#ffffff';
  	  ctx.stroke();
  	  radius += 2;
  	  ctx.restore();  
  	  
  	  if (radius == 18) {
  		ctx.lineWidth = linewidth + 4;
  	  }
  	 
  	  if (radius > endradius -2) {
    		radius = startradius;
    		linewidth = 3;
    		clearTimeout(otimeoutid);
    		//drawGridAroundClick();
    		
    		//setTimeout(clearAllCanvas, 3000);
      }
  	  
  	  setTimeout(clearAllBoxImageCanvas, 5000); // draw circle only for 5 sec
   	  
 	}
    
    function drawGridAroundClick() {
    	var cnvs = document.getElementById("partialGridCanvas");
    	if (cnvs == null) {
  		  cnvs = document.createElement('canvas');
  		  cnvs.id = 'partialGridCanvas';

    		document.body.appendChild(cnvs); // adds the canvas to the body element
    	}
    	
  	 	 var ctx = cnvs.getContext("2d");   
    	//ctx.clearRect (0, 0, cnvs.width, cnvs.height);
    	
    	cnvs.style.position = "absolute";
    	  cnvs.width = 60;
    	  cnvs.height = 60;
    	  //cnvs.style.left = x + imgcanvas.offsetLeft - 30 + "px";
    	  //cnvs.style.top = y + imgcanvas.offsetTop - 30 + "px"; 
    	  
    	 // cnvs.style.left = x  - 30 + "px";
    	 // cnvs.style.top = y  - 30 + "px"; 
    	  
    	  //alert('Just XY, left: ' + cnvs.style.left + ' top: ' + cnvs.style.top);
    	  cnvs.style.left = x + imgcanvas.getBoundingClientRect().left - 20 + "px";
    	  cnvs.style.top = y + (imgcanvas.getBoundingClientRect().top) - 20 + "px";  
    	  
    	  //alert('With bounding rect, left: ' + cnvs.style.left + ' top: ' + cnvs.style.top);
    	  
    	  ctx.clearRect(0, 0, cnvs.width, cnvs.height);
    	  ctx.strokeStyle = '#ffffff';
    	  
    	  
    	  for (var i=0; i<5; i++) {
    		ctx.save();
        	ctx.beginPath();
        	ctx.moveTo(0, i*20);
        	ctx.lineTo(cnvs.width, i*20);
        	ctx.closePath();
        	ctx.stroke();
        	ctx.restore();
    	  }
        
    	  for (var j=0; j<5; j++) {
    		  ctx.save();
        	ctx.beginPath();
        	ctx.moveTo(j*20, 0);
       	 	ctx.lineTo(j*20, cnvs.height);
        	ctx.closePath();
        	ctx.stroke();
        	ctx.restore();
    	  }
    	
    }
    
    
    
    
    function startDrawingOutwardCircle() {
    	ointervalid = setInterval(function() { DrawOutwardCircle(4, 20); }, 200);
    }
    
    function clearAllBoxImageCanvas() {
    	//alert('clear canvas called');
    	if (iintervalid)
    		clearInterval(iintervalid);
    	//alert('after clear iinterval');
    	
    	if (ointervalid) {
    		clearInterval(ointervalid);
    		clearTimeout(otimeoutid);
    	}
    	//alert('after clear ointerval');
    	
    	var cnvs = document.getElementById("partialGridCanvas");
    	if (cnvs) {
    		//document.removeChild(cnvs);
    		cnvs.parentNode.removeChild(cnvs);
    	}
 	 	
   		
   		cnvs = document.getElementById("incircleCanvas"); 
   		if (cnvs) {
   			//alert('removing circleCanvas');
   			//document.removeChild(cnvs);
   			cnvs.parentNode.removeChild(cnvs);
   		}
   		
   		cnvs = document.getElementById("outcircleCanvas"); 
   		if (cnvs) {
   			//alert('removing circleCanvas');
   			//document.removeChild(cnvs);
   			cnvs.parentNode.removeChild(cnvs);
   		}
    	
    }
    
    function showBoxNotificationDialog(text, bannertxt) {
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
    		 
    		if (typeof bannertxt != 'undefined') {
				p.appendChild(document.createTextNode(bannertxt));
			} else {
    			p.appendChild(document.createTextNode("Success"));
    		}
    		 p.style.color = "#737373"; 
    		 p.style.fontWeight = "400"; 
    		
    		 panl.appendChild(p);
    		 
    		 var pdh = document.createElement('p');
    		 pdh.classList.add('lead');
    		 pdh.setAttribute("id", "createuser-flake-text-header");
    		 
    		 pdh.appendChild(document.createTextNode(text));
    		 pdh.style.color = "#737373";
    		 pdh.style.fontWeight = "150";
    		
    		 panl.appendChild(pdh);
    		
    		 coldiv.appendChild(panl);
    		 rowdiv.appendChild(coldiv);
    		 cntnr.appendChild(rowdiv);
    		 
    		 loaddiv.appendChild(cntnr);
    	  }
    	
    	setTimeout(function(){ 
    		//flakeoverlay.style.display = "block";
    		//alert('about to fadein failure div');
    		//document.getElementById("app-notify-dialog").style.display = 'block';
    		$('#app-notify-dialog').fadeIn('fast');
    		//afterauthscreenload(false);   /// it does not work... load event handler gets called
    	}, 100);

    }
    
    function clearBoxNotificationDialog () {
    	$('#app-notify-dialog').fadeOut('fast');
    	removediv(document.getElementById("app-notify-dialog"));
    	clearTimeout(settimeoutid);
    }
    
	function showBoxingInstructions(boxed) {
		
		// minboxed is not being drawn from here.. showPostMinBoxedInstruction
		var boxinsoverlay;
		 if (boxed == 'minboxed') {
			 boxinsoverlay = document.getElementById("minbox-instruct-overlay"); // this id is setup as blocking overlay , Needs to be shown once only
		 } else if (boxed == 'closeclicks') {
			 boxinsoverlay = document.getElementById("app-notifications-overlay"); // this id is setup as blocking overlay , but it will be cleared after close
		 } else {
			 boxinsoverlay = document.getElementById("box-instruct-overlay"); // this id is setup as blocking overlay. Needs to be shown once only
		 }
		
		
		if (boxinsoverlay == null) {
			//alert('in showBoxingInstructions .. creating new overlay for ' +  boxed);
			boxinsoverlay = document.createElement("div");
			
			if (boxed == 'closeclicks') {
				boxinsoverlay.setAttribute("id", "app-notifications-overlay");
			} else if (boxed == 'minboxed') {
				boxinsoverlay.setAttribute("id", "minbox-instruct-overlay");
			} else {
				boxinsoverlay.setAttribute("id", "box-instruct-overlay");
			}
			document.body.appendChild(boxinsoverlay);
			
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
			 
			 if (boxed == 'minboxed') {
				 p.appendChild(document.createTextNode("You have boxed minimum required images."));
			 } else if (boxed == 'closeclicks') {
				 p.appendChild(document.createTextNode("You seem to be clicking at the same location on every image."));
			 } else {
				// p.appendChild(document.createTextNode("You can start boxing images now."));
			 }
			 
			 p.style.color = "#737373"; 
			 p.style.fontWeight = "900"; 
			
			 //if (boxed == 'closeclicks')
				 panl.appendChild(p);
			 
			 var pdh = document.createElement('p');
			 pdh.classList.add('lead');
			 pdh.setAttribute("id", "createuser-flake-text-header");
			 
			 if (boxed == 'minboxed') {
				 pdh.appendChild(document.createTextNode("You can continue boxing more images or start using the profile."));
			 } else if (boxed == 'closeclicks') {
				 pdh.appendChild(document.createTextNode(" This is similar to setting 'password' as your password. Please choose locations that are not nearly identical."));
			 } else {
				 pdh.appendChild(document.createTextNode("You need to box at least 6 images before you can begin using Newauth."));
			 }
			 
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
			 
			 if (boxed == 'minboxed') {
				 pd.appendChild(document.createTextNode("If you are done boxing images for now, Log out now. To log out, click On your Name in the top right of the screen in the header and then select Log Out. You will be taken to Welcome page. Once " +
						 "there, click on the Pending Setup tab. This will start your authentication process, the Newauth Way. You will need to click on the secret location on each image presented there. " ));
			 } else if (boxed == 'closeclicks') {
				 //alert('boxed == ' + boxed);
				 pd.appendChild(document.createTextNode("Please restart boxing your images and make sure that the locations you choose on the images " + 
			 			 " are not the same."));
			 } else {
				 
				 pd.appendChild(document.createTextNode("In order to box an image, you need to choose and click on a location on that image four times. " +
				 		" You will click on the same location during login. To help you track your progress, each click draws " +
				 		"one side of a box around the image.  If you click on a different location any time before" +
				 		" completing the box, you get a choice to reset your location."));
				 pd.appendChild(document.createElement('br'));
				 pd.appendChild(document.createElement('br'));
				 pd.appendChild(document.createTextNode("Try to choose a location on each image, which is not very obvious for someone to guess."));
				 pd.appendChild(document.createElement('br'));
				 pd.appendChild(document.createElement('br'));
				 pd.appendChild(document.createTextNode("Here is how the clicks draw the border, the border is visible at the top of the page."));
				 
			 }
			 
			 pd.style.color = "#878787"; 
			 pd.style.fontWeight = "600";
			
			 inputcolp.appendChild(pd);
			 inputrowp.appendChild(inputcolp);		 
			
			 panl.appendChild(inputrowp);
			 
			 if (!boxed) panl.appendChild(getvisualinstructions());;
				
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
									
				inputdiv.appendChild(inputrow);
								
				var sendbutton = document.createElement("input");
				sendbutton.setAttribute("id", "clr-box-instructions");
				sendbutton.classList.add('btn');
				sendbutton.classList.add('btn-primary');
				sendbutton.classList.add('btn-md');
				//sendbutton.classList.add('pull-right');
				sendbutton.conversationID = '';
				sendbutton.changestarttime = '';
				sendbutton.type = "button";
				sendbutton.value = "Got it";
				
				 if (boxed == 'minboxed') {
					 sendbutton.addEventListener('click', clearMinBoxingInstructions, false); // we do not destroy the element here because we do not want to see it again
				 } else if (boxed == 'closeclicks') {
					 sendbutton.addEventListener('click', clearCloseclickInstructions, false);
				 } else {
					 sendbutton.addEventListener('click', clearBoxingInstructions, false);  // we do not destroy the element here because we do not want to see it again
				 }
				
			
				var inputcol2 = document.createElement("div");
				inputcol2.classList.add('col-sm-2');
				inputrow.appendChild(inputcol2);
			
				inputcol2.appendChild(sendbutton);
				
				inputdiv.appendChild(inputrow);
			 
			 panl.appendChild(inputdiv);
			 
			 coldiv.appendChild(panl);
			 
			rowdiv.appendChild(coldiv);
			cntnr.appendChild(rowdiv);
			boxinsoverlay.appendChild(cntnr);
			
			setTimeout(function(){ 
				//boxinsoverlay.style.display = "block";
				if (boxed == 'closeclicks')
					$('#app-notifications-overlay').fadeIn('slow');
				else if (boxed == 'minboxed')
					$('#minbox-instruct-overlay').fadeIn('slow');
				else 
					$('#box-instruct-overlay').fadeIn('slow');
				
			}, 300);
	
			
		}
		
			
		
	}
	
	function getvisualinstructions() {
		//alert('generating getvisualinstructions');
		var outdiv = document.createElement("div");
		outdiv.classList.add("row");

		var col = document.createElement("div");
		col.classList.add("col-md-8");
		col.classList.add("col-md-offset-2");
		
		var outdivin = document.createElement("div");
		outdivin.classList.add("row");

		var col1 = document.createElement("div");
		col1.classList.add("col-md-3");
		col1.classList.add("text-center");

		var pelem = document.createElement("p");
		pelem.style.float = 'none';
		pelem.style.display = 'inline-block';
		pelem.style.verticalAlign = 'middle';
		pelem.style.width = 20;
		pelem.style.height = 20;
		pelem.style.borderLeft = 'solid #a2a2a2 2px';

		pelem.appendChild(document.createTextNode('1'));

		col1.appendChild(pelem);
		
		var col2 = document.createElement("div");
		col2.classList.add("col-md-3");
		col2.classList.add("text-center");

		var pelem2 = document.createElement("p");
		pelem2.style.float = 'none';
		pelem2.style.display = 'inline-block';
		pelem2.style.verticalAlign = 'middle';
		pelem2.style.width = 20;
		pelem2.style.height = 20;
		pelem2.style.borderLeft = 'solid #a2a2a2 2px';
		pelem2.style.borderBottom = 'solid #a2a2a2 2px';

		pelem2.appendChild(document.createTextNode('2'));

		col2.appendChild(pelem2);

		var col3 = document.createElement("div");
		col3.classList.add("col-md-3");
		col3.classList.add("text-center");

		var pelem3 = document.createElement("p");
		pelem3.style.float = 'none';
		pelem3.style.display = 'inline-block';
		pelem3.style.verticalAlign = 'middle';
		pelem3.style.width = 20;
		pelem3.style.height = 20;
		pelem3.style.borderLeft = 'solid #a2a2a2 2px';
		pelem3.style.borderBottom = 'solid #a2a2a2 2px';
		pelem3.style.borderRight = 'solid #a2a2a2 2px';

		pelem3.appendChild(document.createTextNode('3'));

		col3.appendChild(pelem3);

		var col4 = document.createElement("div");
		col4.classList.add("col-md-3");
		col4.classList.add("text-center");

		var pelem4 = document.createElement("p");
		pelem4.style.float = 'none';
		pelem4.style.display = 'inline-block';
		pelem4.style.verticalAlign = 'middle';
		pelem4.style.width = 20;
		pelem4.style.height = 20;
		pelem4.style.borderLeft = 'solid #a2a2a2 2px';
		pelem4.style.borderBottom = 'solid #a2a2a2 2px';
		pelem4.style.borderRight = 'solid #a2a2a2 2px';
		pelem4.style.borderTop = 'solid #a2a2a2 2px';

		pelem4.appendChild(document.createTextNode('4'));

		col4.appendChild(pelem4);

		outdivin.appendChild(col1);
		outdivin.appendChild(col2);
		outdivin.appendChild(col3);
		outdivin.appendChild(col4);
		
		col.appendChild(outdivin);
		outdiv.appendChild(col);
		
		return outdiv;
	}
	
	function showImageClickResetInstruction() {
		var boxinsoverlay = document.getElementById("image-reset-overlay"); // this id is setup as blocking overlay 
			
		if (boxinsoverlay == null) {
			//alert('in showImageClickResetInstruction .. creating new overlay');
			boxinsoverlay = document.createElement("div");
			boxinsoverlay.setAttribute("id", "image-reset-overlay");
			document.body.appendChild(boxinsoverlay);
			
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
			 
			p.appendChild(document.createTextNode("Do you want to select a new location?"));
			 p.style.color = "#737373"; 
			 p.style.fontWeight = "900"; 
			
			 panl.appendChild(p);
			 
			 var pdh = document.createElement('p');
			 pdh.classList.add('lead');
			 pdh.setAttribute("id", "createuser-flake-text-header");
			 
			 pdh.appendChild(document.createTextNode("Your last click location did not match your earlier clicks."));
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
			 
			 pd.appendChild(document.createTextNode(" Click 'No', if you want to keep the earlier location and try again." +
					 "Click 'Reset Location' if you want to use the new location."  )
				 		
			 );
			 pd.style.color = "#878787"; 
			 pd.style.fontWeight = "600";
			
			 inputcolp.appendChild(pd);
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
					
					
				inputdiv.appendChild(inputrow);
				
				
				var sendbutton = document.createElement("input");
				sendbutton.setAttribute("id", "clr-box-instructions");
				sendbutton.classList.add('btn');
				sendbutton.classList.add('btn-primary');
				sendbutton.classList.add('btn-md');
				//sendbutton.classList.add('pull-right');
				sendbutton.conversationID = '';
				sendbutton.changestarttime = '';
				sendbutton.type = "button";
				sendbutton.value = "No";
				sendbutton.addEventListener('click', clearImageClickResetInstruction, false);
				
				
				var inputcol2 = document.createElement("div");
				inputcol2.classList.add('col-sm-3');
				
				var inputcol3 = document.createElement("div");
				inputcol3.classList.add('col-sm-3');
				//inputcol3.classList.add('pull-right');
				
				var resetbutton = document.createElement("input");
				resetbutton.setAttribute("id", "reset-box-instructions");
				resetbutton.classList.add('btn');
				resetbutton.classList.add('btn-primary');
				resetbutton.classList.add('btn-md');
				
				resetbutton.type = "button";
				resetbutton.value = "Reset Location";
				resetbutton.addEventListener('click', resetImageClick, false);
				
				inputcol2.appendChild(sendbutton);
				inputcol3.appendChild(resetbutton);
				inputrow.appendChild(inputcol2);
				
				var inputcolfill = document.createElement("div");
				inputcolfill.classList.add('col-sm-6');
				
				//inputcolfill.appendChild(document.createTextNode("&nbsp;"));
				
				inputrow.appendChild(inputcolfill);	
				inputrow.appendChild(inputcol3);				
				
				inputdiv.appendChild(inputrow);
			 
			 panl.appendChild(inputdiv);
			 
			 coldiv.appendChild(panl);
			 
			rowdiv.appendChild(coldiv);
			cntnr.appendChild(rowdiv);
			boxinsoverlay.appendChild(cntnr);
			
			setTimeout(function(){ 
				//boxinsoverlay.style.display = "block";
				$('#image-reset-overlay').fadeIn('slow');
			}, 200);
	
			
		} else {
			//alert('overlay exists??');
		}
		
		
	}
	
	function showHotspotInstruction() {
		var boxinsoverlay = document.getElementById("image-hotspot-overlay"); // this id is setup as blocking overlay 
		
		if (boxinsoverlay == null) {
			//alert('in showImageClickResetInstruction .. creating new overlay');
			boxinsoverlay = document.createElement("div");
			boxinsoverlay.setAttribute("id", "image-hotspot-overlay");
			document.body.appendChild(boxinsoverlay);
			
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
			 
			p.appendChild(document.createTextNode("Could you select a different location?"));
			 p.style.color = "#737373"; 
			 p.style.fontWeight = "900"; 
			
			 panl.appendChild(p);
			 
			 var pdh = document.createElement('p');
			 pdh.classList.add('lead');
			 pdh.setAttribute("id", "createuser-flake-text-header");
			 
			 pdh.appendChild(document.createTextNode("The system suggests that you select a different location."));
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
			 
			 pd.appendChild(document.createTextNode(" Click 'No', if you want to keep your selected location. " +
					 "Click 'I will choose a different spot' if you want to choose a new location."  )
				 		
			 );
			 pd.style.color = "#878787"; 
			 pd.style.fontWeight = "600";
			
			 inputcolp.appendChild(pd);
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
					
					
				inputdiv.appendChild(inputrow);
				
				
				var sendbutton = document.createElement("input");
				sendbutton.setAttribute("id", "clr-box-instructions");
				sendbutton.classList.add('btn');
				sendbutton.classList.add('btn-primary');
				sendbutton.classList.add('btn-md');
				//sendbutton.classList.add('pull-right');
				sendbutton.conversationID = '';
				sendbutton.changestarttime = '';
				sendbutton.type = "button";
				sendbutton.value = "No";
				sendbutton.addEventListener('click', forcehotspotclick, false);
				
				
				var inputcol2 = document.createElement("div");
				inputcol2.classList.add('col-sm-3');
				
				var inputcol3 = document.createElement("div");
				inputcol3.classList.add('col-sm-3');
				//inputcol3.classList.add('pull-right');
				
				var resetbutton = document.createElement("input");
				resetbutton.setAttribute("id", "reset-box-instructions");
				resetbutton.classList.add('btn');
				resetbutton.classList.add('btn-primary');
				resetbutton.classList.add('btn-md');
				
				resetbutton.type = "button";
				resetbutton.value = "Sure I will choose a different spot.";
				resetbutton.addEventListener('click', clearImageHotspotClick, false);
				
				inputcol2.appendChild(sendbutton);
				//inputcol3.appendChild(resetbutton);
				inputrow.appendChild(inputcol2);
				
				var inputcolfill = document.createElement("div");
				inputcolfill.classList.add('col-sm-6');
				
				//inputcolfill.appendChild(document.createTextNode("&nbsp;"));
				inputcolfill.appendChild(resetbutton);
				inputrow.appendChild(inputcol3);	
				inputrow.appendChild(inputcolfill);	
				
				
				inputdiv.appendChild(inputrow);
			 
			 panl.appendChild(inputdiv);
			 
			 coldiv.appendChild(panl);
			 
			rowdiv.appendChild(coldiv);
			cntnr.appendChild(rowdiv);
			boxinsoverlay.appendChild(cntnr);
			
			setTimeout(function(){ 
				//boxinsoverlay.style.display = "block";
				$('#image-hotspot-overlay').fadeIn('slow');
			}, 200);
	
			
		} else {
			//alert('overlay exists??');
		}
		
		
	}
	
	function showPostMinBoxedInstruction() {
		var boxinsoverlay = document.getElementById("minbox-instruct-overlay"); // this id is setup as blocking overlay 
			
		if (boxinsoverlay == null) {
			//alert('in showImageClickResetInstruction .. creating new overlay');
			boxinsoverlay = document.createElement("div");
			boxinsoverlay.setAttribute("id", "minbox-instruct-overlay");
			document.body.appendChild(boxinsoverlay);
			
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
			 
			p.appendChild(document.createTextNode("You have boxed minimum required images."));
			 p.style.color = "#737373"; 
			 p.style.fontWeight = "900"; 
			
			 panl.appendChild(p);
			 
			 var pdh = document.createElement('p');
			 pdh.classList.add('lead');
			 pdh.setAttribute("id", "createuser-flake-text-header");
			 
			 pdh.appendChild(document.createTextNode("You can continue boxing more images or start using Newauth."));
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
			 
			 pd.appendChild(document.createTextNode(" Click 'Box some more', if you want to continue boxing more images. The more images you box," +
			 		" the more secure your profile."  )					 	
			 );
			 
			 pd.appendChild(document.createElement('br'));
			 pd.appendChild(document.createElement('br'));
			 pd.appendChild(document.createTextNode("Click 'Start using Newauth' if you are done boxing images for now and want to start using Newauth." +
			 		" You will be taken to Welcome page. Once " +
						 "there, click on the Pending Setup tab. This will start your authentication process, the Newauth Way. You will need to click" +
						 " on the secret location on each image presented there. You can come back to Setup tab any time and box more images." )					 	
			 );
			 pd.style.color = "#878787"; 
			 pd.style.fontWeight = "600";
			
			 inputcolp.appendChild(pd);
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
					
					
				inputdiv.appendChild(inputrow);
				
				
				var sendbutton = document.createElement("input");
				sendbutton.setAttribute("id", "clr-box-instructions");
				sendbutton.classList.add('btn');
				sendbutton.classList.add('btn-primary');
				sendbutton.classList.add('btn-md');
				//sendbutton.classList.add('pull-right');
				sendbutton.conversationID = '';
				sendbutton.changestarttime = '';
				sendbutton.type = "button";
				sendbutton.value = "Box some more";
				sendbutton.addEventListener('click', clearPostMinBoxedInstruction, false);
				
				
				var inputcol2 = document.createElement("div");
				inputcol2.classList.add('col-sm-3');
				
				var inputcol3 = document.createElement("div");
				inputcol3.classList.add('col-sm-3');
				//inputcol3.classList.add('pull-right');
				
				var resetbutton = document.createElement("input");
				resetbutton.setAttribute("id", "reset-box-instructions");
				resetbutton.classList.add('btn');
				resetbutton.classList.add('btn-primary');
				resetbutton.classList.add('btn-md');
				
				resetbutton.type = "button";
				resetbutton.value = "Start using Newauth";
				resetbutton.addEventListener('click', startUsingNewauth, false);
				
				inputcol2.appendChild(sendbutton);
				inputcol3.appendChild(resetbutton);
				inputrow.appendChild(inputcol2);
				
				var inputcolfill = document.createElement("div");
				inputcolfill.classList.add('col-sm-6');
				
				//inputcolfill.appendChild(document.createTextNode("&nbsp;"));
				
				inputrow.appendChild(inputcolfill);	
				inputrow.appendChild(inputcol3);				
				
				inputdiv.appendChild(inputrow);
			 
			 panl.appendChild(inputdiv);
			 
			 coldiv.appendChild(panl);
			 
			rowdiv.appendChild(coldiv);
			cntnr.appendChild(rowdiv);
			boxinsoverlay.appendChild(cntnr);
			
			setTimeout(function(){ 
				//boxinsoverlay.style.display = "block";
				$('#minbox-instruct-overlay').fadeIn('slow');
			}, 200);
	
			
		} else {
			//alert('overlay exists??');
		}
		
		
	}
	
	function clearBoxingInstructions() {
		//alert('will not destroy element');
		$('#box-instruct-overlay').fadeOut(300);
		//cleardiv(document.getElementById("box-instruct-overlay"));
		//document.getElementById("box-instruct-overlay").remove();
		//destroyBoxingInstructions();
	}
	
	function clearMinBoxingInstructions() {
		//alert('will not destroy element');
		$('#minbox-instruct-overlay').fadeOut(300);
		//cleardiv(document.getElementById("box-instruct-overlay"));
		//document.getElementById("box-instruct-overlay").remove();
		//destroyBoxingInstructions();
		if (document.getElementById("minbox-instruct-overlay") != null)
			document.getElementById("minbox-instruct-overlay").remove();
	}
	
	function clearCloseclickInstructions() {
		$('#app-notifications-overlay').fadeOut(300);
		//cleardiv(document.getElementById("box-instruct-overlay"));
		//document.getElementById("box-instruct-overlay").remove();
		destroyBoxingInstructions();
	}
	
	function destroyBoxingInstructions() {
		//$('#box-instruct-overlay').fadeOut(500);
		////cleardiv(document.getElementById("box-instruct-overlay"));
		//alert('clearing overlay');
		if (document.getElementById("app-notifications-overlay") != null)
			document.getElementById("app-notifications-overlay").remove();
	}
	
	function clearImageClickResetInstruction() {
		
		$('#image-reset-overlay').fadeOut(500);
		cleardiv(document.getElementById("image-reset-overlay"));
		document.getElementById("image-reset-overlay").remove();
	}
	
	function clearImageHotspotClick() {
		$('#image-hotspot-overlay').fadeOut(500);
		cleardiv(document.getElementById("image-hotspot-overlay"));
		document.getElementById("image-hotspot-overlay").remove();
		
		
	}
	
	function clearPostMinBoxedInstruction() {
		
		$('#minbox-instruct-overlay').fadeOut(500);
		cleardiv(document.getElementById("minbox-instruct-overlay"));
		//document.getElementById("image-reset-overlay").remove();
	}
	
	function startUsingNewauth() {
		clearPostMinBoxedInstruction();
		logOut();
	}
	
	function resetImageClick() {
		if (serversentclkdata == null) {
			console.log("Nothing to reset click to.");
			return false;
		}
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	      xhr.open('POST', '/newauth/postRegisterClickData', false);
	      xhr.setRequestHeader('Content-Type', 'application/json');
	      
	      xhr.onreadystatechange = function() {
	    	  
	          if (xhr.readyState == 4 ) {
				  if (xhr.status == 200) {
	        	  	clearImageHotspotClick();
	        	  	boxNextImage(nextimgid);
	        	  } else if (xhr.status == 500) {
					  showBoxNotificationDialog('Our servers seems temporarily busy. Please try again after some time.', 'ERROR');
					  setTimeout(function() {
					 		 clearBoxNotificationDialog();
				  		}, 5000);
				  		return false;
				  }
	          	
	          }
	          	
	       };
	     
	      xhr.send(JSON.stringify({
	   	   	imgID: serversentclkdata.imgID,
	   	   	delay: serversentclkdata.delay,
	   	   	reset: 'Y',
	   	   	clickX: serversentclkdata.clickX,
	   	    clickY: serversentclkdata.clickY,
	   	    imgWidth: serversentclkdata.imgWidth,
	   	    imgHeight: serversentclkdata.imgHeight
	   		}));
	      
	      
	}
	
	function forcehotspotclick() {
		if (serversentclkdata == null) {
			console.log("Nothing to reset click to.");
			return false;
		}
		
		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	      xhr.open('POST', '/newauth/postRegisterClickData', false);
	      xhr.setRequestHeader('Content-Type', 'application/json');
	      
	      xhr.onreadystatechange = function() {
	    	  
	          if (xhr.readyState == 4 ) {
				  if (xhr.status == 200) {
	        	  	clearImageHotspotClick();
	        	  	boxNextImage(nextimgid);
	        	  } else if (xhr.status == 500) {
					  showBoxNotificationDialog('Our servers seems temporarily busy. Please try again after some time.', 'ERROR');
					   setTimeout(function() {
					 		 clearBoxNotificationDialog();
				  		}, 5000);
				  		return false;
				  }
	          	
	          }
	          	
	       };
	     
	      xhr.send(JSON.stringify({
	   	   	imgID: serversentclkdata.imgID,
	   	   	delay: serversentclkdata.delay,
	   	   	forcehotspot: 'true',
	   	   	clickX: serversentclkdata.clickX,
	   	    clickY: serversentclkdata.clickY,
	   	    imgWidth: serversentclkdata.imgWidth,
	   	    imgHeight: serversentclkdata.imgHeight
	   		}));
	      
	      
	}
	
	