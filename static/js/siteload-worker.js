self.addEventListener('message', function (e) {
	console.log('calling siteload worker  ' + JSON.stringify(e.data));
	
	if (typeof e.data.action == 'undefined' || e.data.action == 'loadsite') {
		var url = e.data.url; // The URL of the third-party data
		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, false);
	   // xhr.setRequestHeader('Content-Type', 'application/json');  	  
	    
	    xhr.onreadystatechange = function() {
	        if (xhr.readyState == 4 && xhr.status == 200) {
	        	//alert('got response from loadremoteusers');
	           self.postMessage({action: e.data.action, 
	        	   				response: xhr.responseText});
	           //retrieveanddisplaytopicimages();
	        }
	    }		    

	    //console.log('getting popular topics through worker' + reqpacket);
	    xhr.send(null);
	}
	
	
	if (e.data.action == 'sitepreview') {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/newauth/api/urlpreview', false);
	    xhr.setRequestHeader('Content-Type', 'application/json');  	  
	      
	    var url = e.data.url; // The URL of the third-party data
	    xhr.onreadystatechange = function() {
			//alert('readystate status from urlpreview ' + xhr.readyState + ' '+ xhr.status);
	        if (xhr.readyState == 4 && xhr.status == 200) {
				
				//alert('got response from loadremoteusers');
	           self.postMessage({action: e.data.action, 
	        	   				response: xhr.responseText});
	        	   				
				
	        }
	    }		    
	   
	    var reqpacket = JSON.stringify({
	    		url: url
	    	});
	    
	    xhr.send(reqpacket);
	}
	
	if (e.data.action === 'siteread') {
		getArticleText(e.data.url)
			.then(text => {
				//console.log(text);
				self.postMessage({
					action: e.data.action,
					response: text
				});
			})
			.catch(error => { 
				self.postMessage({ action: e.data.action, error: error.message }); 
				throw error; // Ensure the error is thrown to be caught by the worker's onerror
			 });
	}
	
	
}
);

const fetchWithTimeout = async (url, timeout = 5000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal
        });

        // Clear the fetch timeout
        clearTimeout(timeoutId);

        // Setup a timeout for response.text()
        const responseTextTimeoutId = setTimeout(() => {
            controller.abort();
            throw new Error('Response processing timed out after 5 seconds.');
        }, timeout);

        const html = await response.text();

        // Clear the response.text() timeout
        clearTimeout(responseTextTimeoutId);

        return html;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out after 5 seconds.');
        }
        throw error;
    }
};




async function getArticleText(url) {
	if (!url || typeof url !== 'string') {
		throw new Error('Invalid URL provided');
	}

	try {
		// Use a CORS proxy to fetch the HTML content of the page
		//const corsProxyUrl = 'https://cors-anywhere.herokuapp.com/';
		const corsProxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
		const response = await fetchWithTimeout(corsProxyUrl);

		
		return response;
		
	} catch (error) {
		console.error('Error fetching article:', error);
		throw error; // Propagate the error to be handled in the event listener
	}
}
