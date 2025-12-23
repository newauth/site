self.addEventListener('message', function loadpopulartopics(e) {
	// console.log('getting popular topics through worker ' + e.data);
	if (e.data.action == 'loadtopics') {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/newauth/getpopulartopics', false);
	    xhr.setRequestHeader('Content-Type', 'application/json');  	  
	    
	    xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	        	//alert('got response from populartocics');
	           self.postMessage({action: e.data.action, 
	        	   				response: xhr.responseText});
	           //retrieveanddisplaytopicimages();
	        }
	    }		    
	   
	    var reqpacket = JSON.stringify({	    	
		    	screenwidth: e.data.screenwidth,
		    	screenheight: e.data.screenheight,
		    	windowwidth: e.data.windowwidth,
		    	windowheight: e.data.windowheight,
		    	useragent: e.data.useragent
	    	});
	    
	    //console.log('getting popular topics through worker' + reqpacket);
	    xhr.send(reqpacket);
	}
	
	if (e.data.action == 'gettopicimages') {
		if (e.data.topicname.length > 0) {
			var xhr = new XMLHttpRequest();
			xhr.open('GET', '/newauth/api/gettopicimages/' + e.data.topicname, false);
		   // xhr.setRequestHeader('Content-Type', 'application/json');  	  
		    
		    xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4 && xhr.status == 200) {
		        	//alert(xhr.responseText);
		        	//alert('image for topicname returned ');
		        	
		        	self.postMessage({action: e.data.action,
		        		topicname: e.data.topicname,
    	   				response: xhr.responseText});
		        	
		        	
		        }
		    }		    
		   
		    //alert('getting popular topics ' + reqpacket);
		    xhr.send();
		}
	}
	
	if (e.data.action == 'loadremoteusers') {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/newauth/api/getremoteusers', false);
	    xhr.setRequestHeader('Content-Type', 'application/json');  	  
	    
	    xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	        	//alert('got response from loadremoteusers');
	           self.postMessage({action: e.data.action, 
	        	   				response: xhr.responseText});
	           //retrieveanddisplaytopicimages();
	        }
	    }		    
	   
	    var reqpacket = JSON.stringify({	    	
		    	screenwidth: e.data.screenwidth,
		    	screenheight: e.data.screenheight,
		    	windowwidth: e.data.windowwidth,
		    	windowheight: e.data.windowheight,
		    	useragent: e.data.useragent
	    	});
	    
	    //console.log('getting popular topics through worker' + reqpacket);
	    xhr.send(null);
	}
}
);


 
