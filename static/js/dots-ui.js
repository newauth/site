var clickstarttime; /// used to distinguish between drag and click
var posts = [];
var topictype;
var topicdisplayname;
var topichits;
var closepopuptimeoutmap = {};
var crtimetoidxmap = {};
var loctoidxmap = {};
var topiceventsource;
var startsize = 10;
var maxdotsize = 48;
var playidx;
var playtimeoutids = [];
var searchtimeoutid;
var remaintime = 0;
var topiccurrentdepth = 0;
var topicjsonschema;
var sortfield;
var sortvalues;
var currentsubtopic = null;
var splitschemas;
const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
const screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
let sidecontainer;
let totalViews = 0;
let totalComments = 0;
let totalRecords = 0;
const sqrt2 = Math.sqrt(2);

let currentPage;
let maxPage;
let minPage = 0; // First available page
let scrollTimer;

var addpostfunction = function(evt) {
	return posttoflakemodal(event);
};

var reduceprivacyfunction = function(event) {
	displaybuttonbehavior(event, 'Reduce privacy - Available only to flake owner.')
};

var launchvltpopupfunction = function(idx, e) {
	return function(e) {
		if (typeof e !== 'undefined') e.stopPropagation();
		var dsc = document.getElementById('dot-desc-' + idx);

		if (dsc != null) {
			dsc.style.display = 'none';

		}

		var pop = document.getElementById('dot-popup-vlt-' + idx);

		if (pop != null) {
			pop.style.display = 'block';
		} else {
			if (posts != null && posts.length >= idx)
				createVaultPopup(posts[idx], idx);
		}
	}
};

var drageventinstance = 0;
var setofhashes = new Set();
var dotsizemap = new Map();
var thisdeviceid = '';
var fileattachments = [];
var isowner = false;
var iscloselooptopic = false;
var originaldata;
var rndsalt;
var rnditer;
var rndseq;
var rndcrdate;

var rnd = function getRandomIntInclusive(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
};



function attachtransitionstyles(div, duration) {

	if (typeof duration == 'undefined')
		duration = '0.6';

	//alert(duration);
	div.style.WebkitTransition = 'all ' + duration + 's';
	div.style.MozTransition = 'all ' + duration + 's';
	div.style.mozTransition = 'all ' + duration + 's';
	div.style.MsTransition = 'all ' + duration + 's';
	div.style.OTransition = 'all ' + duration + 's';

	div.style.transition = 'all ' + duration + 's';

	//alert(div.style.transition);
}


function clearprevioustransitionstyles(div) {
	div.style.WebkitTransition = 'none';
	div.style.MozTransition = 'none';
	div.style.mozTransition = 'none';
	div.style.MsTransition = 'none';
	div.style.OTransition = 'none';

	div.style.transition = 'none';
}

function toggletopicsearch(event) {


	event.stopPropagation();
	searchtimeoutid;
	if (document.getElementById('input-search-post').style.display == 'none') {
		document.getElementById('input-search-post').style.display = 'block';
		document.getElementById('input-search-post').style.zIndex = '1';
		//if (document.getElementById('topicnameheadline') != null)
		//	document.getElementById('topicnameheadline').style.display = 'none';

		var allopen = document.getElementsByClassName('dot-popup');

		for (var p = 0; p < allopen.length; p++) {

			allopen[p].classList.remove('expand-open');
			allopen[p].style.display = 'none';

		}
		document.getElementById('post-search-input').addEventListener('input', function(event) {
			stopDefaultBackspaceBehaviour(event);

			if (searchtimeoutid != null) {
				//console.log('clearing timeout ' + settimeoutid);
				clearTimeout(searchtimeoutid);
			}
			searchtimeoutid = setTimeout(function(evt) {
				//console.log('searching...');
				//evt.stopPropagation();
				displaypostsasdots(posts, false, document.getElementById('post-search-input').value);

			}, 200);
		});

		document.getElementById('post-search-input').addEventListener('click', function(evt) {
			evt.stopPropagation();
		});

	} else {
		document.getElementById('input-search-post').style.display = 'none';
		//if (document.getElementById('topicnameheadline') != null)
		//	document.getElementById('topicnameheadline').style.display = 'block';
	}


}

function cleanString(str) {
	if (typeof str != 'undefined')
		return str
			.replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable ASCII characters except newline
			.replace(/[?]/g, '') // Remove question marks
			.replace(/\\+/g, '\\') // Replace multiple backslashes with a single backslash
			.replace(/\.+/g, '.') // Replace multiple periods with a single period
			.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$|(?<=\s)[^a-zA-Z0-9]+(?=\s)/g, ''); // Clear text without letters or numbers
}

function topicdocumentclick(e) {
	//alert('clicked');
	//alert('dragged ' + e.target.dataset.dragged);
	//e.preventDefault();
	if (typeof e != 'undefined') {
		console.log('document click fired');

		e.stopPropagation();

		if (document.getElementById('input-search-post') != null && document.getElementById('input-search-post').style.display != 'none') {
			if (e.target.id != 'input-search-post')
				document.getElementById('input-search-post').style.display = 'none';
		}
	}
	var timediff = 100;
	if (clickstarttime != null) {
		var now = new Date();
		timediff = now - clickstarttime;

		// console.log('starttime ' + clickstarttime + ' ' + timediff);
	}
	if (timediff <= 100) { // 
		var elemstoremove = document.getElementsByClassName('dot-popup');

		if (elemstoremove != null) {
			var counter = elemstoremove.length;
			while (elemstoremove.length > 0 && counter > 0) {
				//console.log('removing popup ' + elemstoremove[0].id + ' counter ' + counter);
				elemstoremove[0].classList.remove('expand-open');

				setTimeout(function() {
					removediv(elemstoremove[0]);
				}, 400);

				counter--;
			}
		}

		var dscs = document.getElementsByClassName('dot-desc');

		if (dscs != null) {
			if (document.getElementById('showdescbtn') != null) {
				document.getElementById('showdescbtn').onclick = function(evt) {
					displayallpostdescription(event);
				};
			}
			var counter2 = dscs.length;
			while (dscs.length > 0 && counter2 > 0) {
				//console.log('removing description ' + dscs[0].id + ' counter ' + counter2);
				removediv(dscs[0]);

				counter2--;
			}

		}

		let alreadyexp = document.getElementsByClassName('expanded-dot');
		if (alreadyexp != null && alreadyexp.length > 0) {
			for (var i = 0; i < alreadyexp.length; i++) {
				let expandeddot = alreadyexp[i];
				shrinkdot(expandeddot);
			}
		}

	} else {
		setTimeout(function() {
			clickstarttime = null;
		}, 1000);
	}


}

function displayemptypostsmessage() {
	var div = document.createElement("div");
	div.id = "notification-div";
	div.style.position = "fixed";
	div.style.bottom = "25px";
	div.style.width = "80%";
	div.style.left = "10%";
	div.style.right = "10%";
	div.style.backgroundColor = "#fafafa";
	div.style.color = "#787878";
	div.style.textAlign = "center";
	div.style.fontSize = "18px";
	div.style.padding = "10px";
	div.style.border = "1px solid #ccc";
	div.style.borderRadius = "20px";
	div.innerHTML = "No data exists for this page. You can add content by clicking the + button on the menu.";
	document.body.appendChild(div);
	//alert('No data');

	setTimeout(function() {
		var opacity = 1;
		var timer = setInterval(function() {
			if (opacity <= 0.1) {
				clearInterval(timer);
				div.style.display = "none";
			}
			div.style.opacity = opacity;
			div.style.filter = "alpha(opacity=" + opacity * 100 + ")";
			opacity -= opacity * 0.1;
		}, 50);
	}, 5000);
}

function displaypostsasdots(inposts, justadded, filter, startingdot) { // 
	//console.log(inposts);

	//var colloc = new getcolorandlocationbasedondata("x");

	dotsizemap = new Map();
	if (typeof filter != 'undefined' && filter.length > 0) {
		var existingdots = document.getElementsByClassName('dot');


		for (var d = 0; d < existingdots.length; d++) {
			if (filter.indexOf(':::') > 0) {
				//console.log('filter has :::');
				if (filter.indexOf('PREVIEW::') >= 0) {
					//console.log('filter has PREVIEW');
					//console.log('existingdots data-sortfield ' + existingdots[d].dataset[sortfield.toLowerCase()] + ' filter value ' + filter.split(":::")[2]);
					if (filter.indexOf(sortfield + '::') >= 0 && typeof existingdots[d].dataset[sortfield.toLowerCase()] != 'undefined') {
						if (filter.split(":::")[2] == 'ALL') {
							existingdots[d].style.backgroundColor = existingdots[d].dataset["savedBgClr"];
							scaledotsize(existingdots[d], 2);
						} else if (existingdots[d].dataset[sortfield.toLowerCase()] != filter.split(":::")[2]) {

							existingdots[d].style.backgroundColor = '#f2f2f2';
							scaledotsize(existingdots[d], 1);
						}
					}
				} else { /// Click
					if (filter.split(":::")[1] == 'ALL') {
						existingdots[d].style.display = 'flex';
						existingdots[d].style.justifyContent = 'center';
						existingdots[d].style.alignItems = 'center';
						scaledotsize(existingdots[d], 2);

						if (document.getElementById('dot-sidepanel-' + d) != null) {
							document.getElementById('dot-sidepanel-' + d).style.display = 'block';
						}
					} else if (filter.indexOf(sortfield + '::') >= 0 && typeof existingdots[d].dataset[sortfield.toLowerCase()] != 'undefined') {
						if (existingdots[d].dataset[sortfield.toLowerCase()] != filter.split(":::")[1]) {
							existingdots[d].style.display = 'none';
							if (document.getElementById('dot-sidepanel-' + d) != null) {
								document.getElementById('dot-sidepanel-' + d).style.display = 'none';
							}
						} else {
							existingdots[d].style.display = 'flex';
							existingdots[d].style.justifyContent = 'center';
							existingdots[d].style.alignItems = 'center';
							scaledotsize(existingdots[d], 2);

							if (document.getElementById('dot-sidepanel-' + d) != null) {
								document.getElementById('dot-sidepanel-' + d).style.display = 'block';
							}
						}
					}

				}

				if (filter.indexOf('PREVIEW::') >= 0 && d == existingdots.length - 1) return; // if 
			} else {
				if (filter.length > 0)
					existingdots[d].style.display = 'none';
				else {
					existingdots[d].style.display = 'flex';
					existingdots[d].style.justifyContent = 'center';
					existingdots[d].style.alignItems = 'center';
				}
			}
		}
	}
	console.log(inposts.length + ' justadded: ' + justadded + ' startingdot: ' + startingdot);
	if (typeof justadded == 'undefined' || justadded == false)
		postlocationmap = [];
	else {
		if (inposts.length > 0 && inposts[0].location != null) {
			var indx = loctoidxmap[inposts[0].location];

			var dotforpost = document.getElementById("dot-" + indx);
			removediv(dotforpost);
		}
	}

	if (typeof topicjsonschema != 'undefined' && topicjsonschema.length > 0) {
		if (inposts.length == 1) {
			//alert('JSON schema setting create time to '+ inposts[0].crtime);
			document.getElementById('singlepost-crtime').value = inposts[0].crtime;
		}
	}

	var dottimeoutid;
	var getlog = function getBaseLog(x, y) {
		return Math.log(y) / Math.log(x);
	};
	var centerdotsize = 250;
	// Minimum radius
	var minRadius = (centerdotsize / 2) + centerdotsize * 0.2;

	var areaperdot = ((window.innerWidth * window.innerHeight) - (Math.pow(minRadius * 2, 2))) / inposts.length;
	maxdotsize = parseInt(Math.sqrt(areaperdot) / 4);
	console.log('max dot size [theoretical] ' + maxdotsize + ' postlen ' + inposts.length);
	//screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	//screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

	console.log('screenWidth screenHeight' + screenWidth + ' ' + screenHeight);


	if (maxdotsize > centerdotsize / 3) maxdotsize = centerdotsize / 3;


	//	alert(window.screen.availHeight + ' ' + window.screen.availWidth + ' ' + startsize + ' ' + maxdotsize);
	var cntnr = document.getElementById('topic-app');
	if (cntnr == null) {
		cntnr = document.getElementById('app-flk');
	}
	var filtermatches = 0;
	if (inposts != null) {

		var colorandpositions = displayRadialText(inposts, false);

		if (colorandpositions != null && colorandpositions.length > 0)
			maxdotsize = colorandpositions[0].dotmaxsize;

		let dotexpandtimeout = new Array(inposts.length); // USed to avoid un-intentional dot expands


		for (var i = 0; i < inposts.length; i++) {
			//var dotsize = rnd(startsize, maxdotsize);
			let circleToRect = null;
			let rect = null;

			//console.log('post ' + i + ': ' + JSON.stringify(inposts[i]));

			if (typeof filter != 'undefined' && filter.length > 0) {


				if (typeof inposts[i].tags != 'undefined' && inposts[i].tags != null && inposts[i].tags.length > 0) {
					console.log('Looking for ' + filter + ' in tags ' + i + 'th post');
					for (var t = 0; t < inposts[i].tags.length; t++) {
						//console.log(inposts[i].tags[t].toLowerCase() + ' ' +filter + ' ' + inposts[i].tags[t].toLowerCase().startsWith(filter));
						if (inposts[i].tags[t].toLowerCase().startsWith(filter.toLowerCase())) {

							document.getElementById('dot-' + i).style.display = 'flex';
							document.getElementById('dot-' + i).style.justifyContent = 'center';
							document.getElementById('dot-' + i).style.alignItems = 'center';
							//showpostdescription(null, i);
							filtermatches++;
							break;
						}

					}
				} else {
					var inftextpart = '';
					if (typeof inposts[i].text != 'undefined' && inposts[i].text != null) {

						inftextpart = inposts[i].text.toLowerCase();
					}

					var dattextpart = '';

					if (typeof inposts[i].data != 'undefined' && inposts[i].data != null && inposts[i].data.text != null) {

						dattextpart = inposts[i].data.text.toLowerCase();


					}
					//console.log('Looking for ' + filter + ' in dat and info');
					if (inftextpart.indexOf(filter.toLowerCase()) >= 0 || dattextpart.indexOf(filter.toLowerCase()) >= 0) {
						document.getElementById('dot-' + i).style.display = 'flex';
						document.getElementById('dot-' + i).style.justifyContent = 'center';
						document.getElementById('dot-' + i).style.alignItems = 'center';
						showpostdescription(null, i);
						filtermatches++;
						break;
					}
				}
			} else {

				var alreadyseen = checkifalreadyseen(inposts[i].crtime);

				var deleted = checkifdeleted(inposts[i].crtime);


				if (typeof inposts[i].data != 'undefined' && inposts[i].data != null && inposts[i].data.text != null) {

					dattextpart = inposts[i].data.text.toLowerCase();

				}

				var dot = document.createElement('div');

				if (typeof startingdot == undefined || startingdot == null)
					dot.setAttribute('id', 'dot-' + i);
				else
					dot.setAttribute('id', 'sub-' + startingdot + '-' + i);
				//dot.setAttribute('draggable', true);
				//dot.classList.add('dot');
				dot.classList.add('circle-to-rect');
				dot.classList.add('dot');
				//dot.style.padding = '20px';

				//dot.classList.add('pulsate');
				//dot.style.opacity = '0.1';
				//dot.style.transform = "scale(1.2)";
				attachtransitionstyles(dot, 1);

				let digest_sha256 = null;


				var randtop;
				var randleft;


				dot.style.top = colorandpositions[i].top;
				dot.style.left = colorandpositions[i].left;

				if (typeof justadded != 'undefined' && justadded == true) {

					var existing0dot = document.getElementById('dot-0');
					if (existing0dot != null) {
						//existing0dot.style.width = startsize;
						//existing0dot.style.height = startsize;
						//existing0dot.classList.remove('pulsate');
					}

					/*postlocationmap.unshift( {
							x: randleft+startsize,
							y: randtop+startsize
							});
					*/

					console.log('adding inposts to post');
					//posts.unshift(inposts);
					[inposts[0]].concat(posts);

					posts = inposts;

					shiftdotandpopupids();

					//console.log('new size of posts ' + posts.length + ' new postlocationmap ' + JSON.stringify(postlocationmap));
				} else {
					/*postlocationmap[i] =  {
							x: randleft+startsize,
							y: randtop+startsize
							};
							*/
				}



				if (i == 0 && !alreadyseen && !deleted) { // show the top post by default

					if (typeof justadded != 'undefined' && justadded == true) {
						//alert('removing existing ' + i)
						var elemtoremove = document.getElementById('dot-popup-' + i);

						if (elemtoremove != null) {

						}
					}


				} else {


				}

				dot.setAttribute('data-long-press-delay', 500);

				if (sortfield != null && sortvalues.length > 1 && typeof inposts[i].data[sortfield] != 'undefined') {
					dot.setAttribute('data-' + sortfield, inposts[i].data[sortfield]);
				}

				let dotexpandtimer; // used to prevent jitters
				let isentertriggered = false; // used to prevent jitters


				// Create the clickTarget Div 
				const clickTargetDiv = document.createElement('div');
				clickTargetDiv.className = 'concentric-square';

				// Calculate the size of the square that fits inside the circle
				// For a circle with diameter d, the largest square that fits inside has side length d/√2

				const squareSize = parseInt(colorandpositions[i].width, 10);

				//console.log('clicktarget div sq side ' + squareSize);
				// Style the square div
				clickTargetDiv.style.position = 'absolute';
				clickTargetDiv.style.top = '50%';
				clickTargetDiv.style.left = '50%';
				clickTargetDiv.style.width = `${squareSize}px`;
				clickTargetDiv.style.height = `${squareSize}px`;
				clickTargetDiv.style.transform = 'translate(-50%, -50%)';
				clickTargetDiv.style.backgroundColor = 'transparent';
				clickTargetDiv.style.zIndex = 6;
				//clickTargetDiv.style.cursor = 'pointer';
				//console.log('setting event listeners on dot ' + i);

				if (screenWidth > 600 && screenHeight > 600 && (typeof startingdot == undefined || startingdot == null)) { // for mobile screens no mouseenter
					//console.log('setting event mouseenter listener on dot ' + i);

					clickTargetDiv.addEventListener('mouseenter', function(e, idx) {
						return function(e) {
							//alert('passed in idx in mouseenter ' + idx);
							//alert('posts[idx] ' + JSON.stringify(posts[idx]));
							dotexpandtimer = Date.now();
							let doexpand = true;

							if (isentertriggered) {
								return; // If event is already triggered, do nothing
							}
							isentertriggered = true; // Set the flag to true	
							var isfolder = isdotafolder(inposts[idx].tags);

							doexpand = !isfolder;

							dotexpandtimeout[idx] = setTimeout(() => {

								if (circleToRect == null) circleToRect = document.getElementById('dot-' + idx);
								if (rect == null) rect = circleToRect.getBoundingClientRect();

								if (doexpand && posts[idx].data == null) {
									//console.log('No summary data found in post ' + idx + ' pulling from server dot ' + circleToRect.id);

									if (circleToRect.querySelector('#displayloadingcontainer') == null) {
										//console.log('Will insert loader in dot ' + circleToRect.id);
										circleToRect.insertBefore(createloadingdiv(), circleToRect.firstChild);
									}

									retrievepostsummaryandshowinpopup(posts[idx], idx, e);
								}
								//console.log('About to query url for ' + circleToRect.id);	
								var textContainer = circleToRect.querySelector('.text-container');
								if (textContainer != null && textContainer.innerText != null) { // if there is an external URL in the text, get the preview

									if (textContainer.querySelector('.url-preview') == null) {
										let exturl = extractURLFromText(textContainer.innerText);

										if (typeof exturl != 'undefined' && exturl.length > 0) {
											console.log('Extracted URL from text ' + exturl[0].text);

											if (exturl[0].text.indexOf(window.location.href) == 0) {
												//window.location.href = exturl[0].text;
												//console.log('YES contains');
												doexpand = false;
											} else {
												setTimeout(function() {

													if (doexpand) {
														if (circleToRect.querySelector('#displayloadingcontainer') == null) {
															//console.log('Will insert loader in dot ' + circleToRect.id);
															circleToRect.insertBefore(createloadingdiv(), circleToRect.firstChild);
														}
														console.log('querying url after mouseneter ' + exturl[0].text);
														queryURLforpreview(exturl[0].text, idx);
													}

												}, 150);
											}
										}
									}

								}

								//console.log('doexpand is ' +  doexpand);
								console.log('dotexpandtimeout ' + idx + ' ' + dotexpandtimeout[idx]);
								highlightAndScroll(idx);

								if (doexpand)
									expandDot(circleToRect, rect, true);
								else {
									if (isfolder) {
										let text = inposts[idx].text;

										if (inposts[idx].data) {
											try {
												console.log(`Raw data for post ${idx}:`, inposts[idx].data);
												//const parsedData = JSON.parse(inposts[idx].data);
												const parsedData = inposts[idx].data;
												if (parsedData && parsedData.text) {
													text = parsedData.text;
												}
											} catch (error) {
												console.error(`Error parsing data for post ${idx}:`, error);
												console.log(`Problematic data:`, inposts[idx].data);
											}
										}

										const folderPath = `${inposts[idx].topic}/${text}`;
										previewsubtopic(folderPath, `dot-${idx}`);
									}
									showpostdescription(e, idx);
								}


							}, 150);
						}
					}(event, i));
				}

				if (typeof startingdot == undefined || startingdot == null)
					clickTargetDiv.addEventListener('mousedown', function(e, idx) {

						return function(e) {
							e.stopPropagation();
							e.preventDefault();

							console.log('expandtimeout before clear ' + dotexpandtimeout[idx]);
							clearTimeout(dotexpandtimeout[idx]);
							console.log('expandtimeout cleared. now ' + dotexpandtimeout[idx]);
							return;
						}
					}(event, i));

				if (screenWidth < 600 || screenHeight < 600 && (typeof startingdot == undefined || startingdot == null)) { // No need for click handler on big screen
					clickTargetDiv.addEventListener('click', function(e, idx) {

						return function(e) {
							//alert('in click');
							e.stopPropagation();
							e.preventDefault();




							dotexpandtimer = Date.now();
							let doexpand = true;

							doexpand = !isdotafolder(posts[idx].tags);

							if (circleToRect == null) circleToRect = document.getElementById('dot-' + idx);
							if (rect == null) rect = circleToRect.getBoundingClientRect();

							if (doexpand && posts[idx].data == null) {
								//console.log('No summary data found in post ' + idx + ' pulling from server dot id ' + circleToRect.id);
								if (circleToRect.querySelector('#displayloadingcontainer') == null) {
									//console.log('Will insert loader in dot ' + circleToRect.id);
									circleToRect.insertBefore(createloadingdiv(), circleToRect.firstChild);
								}

								retrievepostsummaryandshowinpopup(posts[idx], idx, e);
							}


							var textContainer = circleToRect.querySelector('.text-container');
							if (textContainer != null && textContainer.innerText != null) { // if there is an external URL in the text, get the preview

								if (textContainer.querySelector('.url-preview') == null) {
									let exturl = extractURLFromText(textContainer.innerText);
									//alert('Extracted URL from text ' + exturl[0].text);
									if (typeof exturl != 'undefined' && exturl.length > 0) {
										if (exturl[0].text.indexOf(window.location.href) == 0) {
											//window.location.href = exturl[0].text;
											//console.log('YES contains');
											doexpand = false;
										} else {
											setTimeout(function() {
												if (circleToRect.querySelector('#displayloadingcontainer') == null) {
													//console.log('Will insert loader in dot ' + circleToRect.id);
													circleToRect.insertBefore(createloadingdiv(), circleToRect.firstChild);
												}
												console.log('querying url after mouseneter ' + exturl[0].text);
												queryURLforpreview(exturl[0].text, idx);

											}, 600);
										}
									}
								}

							}
							//alert('About to expand dot after click' + circleToRect.id);		
							if (doexpand)
								expandDot(circleToRect, rect, true);
							else
								showpostdescription(e, idx);

						}
					}(event, i));
				}


				if (screenWidth > 600 && screenHeight > 600 && (typeof startingdot == undefined || startingdot == null)) { // for mobile screens no muoseleave
					dot.addEventListener('mouseleave', function(e, idx) {
						return function(e) {

							let timesinceexpand = Date.now();

							if (dotexpandtimer != null && dotexpandtimer > 0) {

								if (timesinceexpand - dotexpandtimer < 200) {
									clearTimeout(dotexpandtimeout[idx]);
									dotexpandtimeout[idx] = null;
									isentertriggered = false;
									//dotexpandtimer = 0;
									//	console.log('clearing dotexpandtimeout ' + idx + ' time difference ' + timesinceexpand + ' ' + dotexpandtimer + ' -> ' + (timesinceexpand-dotexpandtimer));
									return false;
								}

								//	console.log('NOT clearing dotexpandtimeout ' + idx + ' time difference ' + timesinceexpand + ' ' + dotexpandtimer + ' -> ' + (timesinceexpand-dotexpandtimer));

							}


							let doexpand = true;
							doexpand = !isdotafolder(posts[idx].tags);

							isentertriggered = false;
							circleToRect = document.getElementById('dot-' + idx);
							//var rect = circleToRect.getBoundingClientRect();
							console.log('came in  mouseout event on dot ' + idx + ' left ' + circleToRect.left + ' top ' + circleToRect.top + ' doexpand ' + doexpand);
							if (doexpand) shrinkdot(circleToRect);
							else {
								showpostdescription(e, idx, true);
								removeDotConnections('dot-' + idx);	// remove any connections if exist
							}


						}
					}(event, i));
				}

				//dragElement(dot);
				if (!deleted) {
					clickTargetDiv.addEventListener('long-press', function(e, idx) {
						return function(e) {

							handlelongpress(e, idx);
						}
					}(event, i));
				}




				if (i == 0 && (typeof startingdot == undefined || startingdot == null)) { // add body onclick only once
					document.body.addEventListener('click', topicdocumentclick);

					var pg;
					if (document.getElementById('topic-page-id') != null) {
						pg = document.getElementById('topic-page-id');
					}

					if (document.getElementById('flake-page-id') != null) {
						//alert('flake page found');
						pg = document.getElementById('flake-page-id');
					}

					pg.addEventListener('unload', function(e) { //this is not being called.. doing this at the close button click
						//alert('unload fired');
						document.body.removeEventListener('click', topicdocumentclick);
					});

					//alert('unload handler added');
				}

				if (typeof inposts[i].hit != 'undefined' && inposts[i].hit.length > 0 && parseInt(inposts[i].hit) > 0) {

					//dot.style.width = getrandomdotsize(i, 5, startsize, maxdotsize );


				} else {

					//var pastel = '#' + hashasnum.toString().substring(0,6)

					if (typeof startingdot == 'undefined' || startingdot == null) {
						var pastel = colorandpositions[i].pcolor;
						dot.style.backgroundColor = pastel;//pastel; //b3b3b3';
						dot.savedpastel = pastel;
						dot.setAttribute("data-saved-bg-clr", pastel);
					} else {
						dot.style.backgroundColor = '#d2d2d2';
					}
					///dot.style.boxShadow = "0px 0px 1px " + pastel; 
					//dot.style.backgroundImage = 'linear-gradient(22deg,'+ pastel + ', #e7e7e7)';

					//dot.style.backgroundImage = 'linear-gradient(60deg, ' + pastel + ' 20%,' + pastel + ' 60%,' + pastel + ' 70%, #fafafa 100%)'; /* Add gradient */
					//dot.style.boxShadow ="0 2px 4px rgba(0, 0, 0, 0.3)";  /* Add box shadow for depth */

				}

				if (deleted) {
					dot.style.display = 'none';
				}

				//dot.style.height = dot.style.width;
				dot.style.position = 'absolute';
				dot.style.zIndex = '5';

				if (typeof startingdot != undefined && startingdot != null)
					dot.style.zIndex = '4';

				if (isdotafolder(inposts[i].tags)) {
					dot.style.borderRadius = '35%'; // giving folders a different shape
				}
				//dot.style.borderRadius= '50%';
				//dot.style.zIndex = '2';
				dot.style.width = colorandpositions[i].width;
				dot.style.height = colorandpositions[i].width;

				//console.log(inposts[i].hit + ' dot location size ' + dot.style.left + ' ' + dot.style.top + ' ' +  dot.style.width);		

				//cntnr.appendChild(dot);
				setTimeout(function(c, d, idx) {
					return function() {
						c.appendChild(d);
						d.appendChild(clickTargetDiv);
						// if this is a folder then avoid creating the popup and just register a handler
						var isfolder = isdotafolder(inposts[idx].tags);
						var dat = null;
						try {
							//dat = JSON.parse(inposts[idx].data);
							dat = inposts[idx].data;
						} catch (error) {
						}

						//alert('idx dat ' + idx + ' ' + dat);
						var tx = null;
						if (dat == null || dat.text == null || dat.text.length == 0)
							tx = inposts[idx].text;
						else
							tx = dat.text;

						let disptxdiv = document.createElement("div");
						disptxdiv.classList.add('dot-disp-text');
						disptxdiv.style.display = "flex";
						disptxdiv.style.justifyContent = "center";
						disptxdiv.style.alignItems = "center";
						disptxdiv.style.fontSize = "min(14px, 0.9vw)"; // Works in CSS but not directly in JS
						disptxdiv.style.width = "100%";
						disptxdiv.style.height = "100%";
						disptxdiv.style.whiteSpace = "nowrap";
						disptxdiv.style.overflow = "hidden";
						disptxdiv.style.textAlign = "center";
						disptxdiv.style.position = "absolute";
						disptxdiv.style.top = "0";
						disptxdiv.style.left = "0";
						
						//alert('Timer for idx:' + idx + ' isfolder:' + isfolder + "  tags: " + inposts[idx].tags);
						if (isfolder) {
							//console.log('Folder post for id ' + idx + ': ' + JSON.stringify(inposts[idx]));
							//console.log('post data for folder ' + inposts[idx].data);

							//alert('inposts[idx].summary tx ' + inposts[idx].summary+ ' ' + tx);
							var altdesc = null;

							if (typeof inposts[idx].summary != 'undefined' && inposts[idx].summary != null) {
								if (!isBase64JSON(inposts[idx].summary) && isValidBase64(inposts[idx].summary)) {
									altdesc = atob(inposts[idx].summary);
								} else {
									altdesc = inposts[idx].summary;
								}
							}

							if (typeof startingdot == undefined || startingdot == null) {
								clickTargetDiv.addEventListener('click', function() {
									//alert('clicked on folder ' + idx + ' ' + inposts[idx].topic + '/' + dat.text);
									showpostdescription(null, idx, true);
									removeDotConnections('dot-' + idx);	// remove any connections if exist
									loadsubtopic(inposts[idx].topic + '/' + tx, altdesc);
								});
							}

							//alert(inposts[idx].text + ' ' + tx);

							if (tx != null && (typeof startingdot == undefined || startingdot == null)) {
								var foldernameinitial = getDisplayLetters(tx);
								document.getElementById('dot-' + idx).style.color = '#f3f3f3';
								//document.getElementById('dot-' + idx).style.fontSize = document.getElementById('dot-' + idx).style.width/2;
								disptxdiv.innerText = foldernameinitial;
								document.getElementById('dot-' + idx).appendChild(disptxdiv);
								//document.getElementById('dot-' + idx).title = tx;
								document.getElementById('dot-' + idx).style.cursor = 'pointer';
							}
						} else {
							//alert('tx ' +  tx + '  startingdot ' + startingdot);
							if (tx != null && (typeof startingdot == undefined || startingdot == null)) {

								var foldernameinitial = getDisplayLetters(tx);

								if (dat != null && dat.abbr != null)
									foldernameinitial = dat.abbr;

								//alert('foldernameinitial ' +  foldernameinitial);
								document.getElementById('dot-' + idx).style.color = '#f3f3f3';
								disptxdiv.innerText = foldernameinitial;
								document.getElementById('dot-' + idx).appendChild(disptxdiv);
								//document.getElementById('dot-' + idx).title = tx;
								
							}
							createpopupdiv(inposts[idx], idx, null, false, randleft + startsize, randtop + startsize);

						}
						if (idx == inposts.length - 1) { /// if this is last dot, then fill and expand the first dot and connect dots if its a subtopic review

							if (typeof startingdot != 'undefined' && startingdot != null) {
								let subpostidarr = [];

								for (var x = 0; x < inposts.length; x++) {
									subpostidarr.push('sub-' + startingdot + '-' + x);
								}

								if (subpostidarr.length > 0) {
									connectDots(startingdot, subpostidarr);
									//adjustOpacityForConnections(startingdot, subpostidarr);
								}
							} else {

								var dotzero = document.getElementById('dot-' + 0);

								var doexpand = !isdotafolder(posts[0].tags);

								if (doexpand && inposts[0].data == null) {
									console.log('No summary data found in post ' + idx + ' pulling from server');
									dotzero.insertBefore(createloadingdiv(), dotzero.firstChild);
									retrievepostsummaryandshowinpopup(posts[0], 0, null);
								}

								var textContainer = dotzero.querySelector('.text-container');

								if (textContainer != null && textContainer.innerText != null) { // if there is an external URL in the text, get the preview

									if (textContainer.querySelector('.url-preview') == null) {
										let exturl = extractURLFromText(textContainer.innerText);
										//alert('Extracted URL from text ' + exturl[0].text);
										if (typeof exturl != 'undefined' && exturl.length > 0) {
											if (dotzero.querySelector('#displayloadingcontainer') == null) {
												console.log('Line 812 insert loader in dot ' + dotzero.id);
												dotzero.insertBefore(createloadingdiv(), dotzero.firstChild);
											}
											setTimeout(function() {
												if (exturl[0].text.startsWith('https://newauth.io/')) {
													//window.location.href = exturl[0].text;
												} else {
													//alert('querying url ' + exturl[0].text);	
													queryURLforpreview(exturl[0].text, 0);
												}
											}, 1200);
										}
									}

								}


								if (isfolder)
									showpostdescription(null, idx, true);
								else
									increasesizesoftopdots();

								function delay(ms) {
									return new Promise((resolve) => setTimeout(resolve, ms));
								}

								async function sequentialExecution() {
									//console.log('posts 0 before checking for folder ' + JSON.stringify(posts[0]));
									let isfolder = !isdotafolder(posts[0].tags);
									if (!isfolder) {
										await delay(400);
										expandDot(document.getElementById('dot-' + 0));

										await delay(2500);
										shrinkdot(document.getElementById('dot-' + 0));
										//console.log('dot-0 shrunk to ' + document.getElementById('dot-' + 0).style.width);
									}

									await delay(300);
									//increasesizesoftopdots();
								}

								sequentialExecution();
							}


						}
					}
				}(cntnr, dot, i), 50)

				dot.style.opacity = window.getComputedStyle(dot).getPropertyValue("opacity");
				dot.style.transform = window.getComputedStyle(dot).getPropertyValue("transform");

				//console.log('before weekdiff ' + i );
				var weekdiff = 0;
				if (typeof inposts[i].week != 'undefined' && inposts[i].week != null && inposts[i].week.length > 0)
					weekdiff = parseInt(moment().week()) - parseInt(inposts[i].week);
				//console.log('opacity ' + (1 - (0.1 * weekdiff)));
				if (inposts.length > 10 && weekdiff != 0) {
					if (weekdiff > 0) {
						dot.style.opacity = Math.max(0.04, 1 - (0.15 * weekdiff));
						console.log('setting lower opacity for weekdiff ' + weekdiff + ' ' + (1 - (0.15 * weekdiff)));
					} else {
						dot.style.opacity = Math.max(0.04, 1 - (0.1 * (52 + weekdiff)));
						console.log('setting lower opacity for weekdiff ' + weekdiff + ' ' + (1 - (0.15 * (52 + weekdiff))));
					}
				} else {
					dot.style.opacity = 1;


				}

				//console.log('after weekdiff ' + i );
				//dot.style.transform = "scale(1)";

			}
		}

		if (typeof filter != 'undefined' && filter.length > 0) {
			if (filtermatches == 0) displaybuttonbehavior(null, 'No match found');
		}
	}

	console.log('total unique values in hashset ' + setofhashes.size);
	console.log('dot sizes', dotsizemap);
}

function toggleFullScreenLoadingOverlay(show) {
    const overlayId = 'loading-overlay';
    const styleId = 'loading-overlay-style';
    const existingOverlay = document.getElementById(overlayId);
    const existingStyle = document.getElementById(styleId);

    if (show) {
        if (existingOverlay) return;

        // Base fade animation
        if (!existingStyle) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                @keyframes fadeInOutOnce {
                    0% { opacity: 0; }
                    50% { opacity: 1; }
                    100% { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement('div');
        overlay.id = overlayId;
        Object.assign(overlay.style, {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(255, 255, 255, 0.9)',
            zIndex: 9999,
            pointerEvents: 'none',
            overflow: 'hidden'
        });
        document.body.appendChild(overlay);

        const dotCount = Math.floor(Math.random() * 11) + 10;

        function spawnDot() {
            const dot = document.createElement('div');
            const animId = `move-${Math.random().toString(36).substr(2, 6)}`;

            // Random movement values
            const x1 = Math.floor(Math.random() * 40 - 20);
            const y1 = Math.floor(Math.random() * 40 - 20);
            const x2 = Math.floor(Math.random() * 40 - 20);
            const y2 = Math.floor(Math.random() * 40 - 20);
            const x3 = Math.floor(Math.random() * 40 - 20);
            const y3 = Math.floor(Math.random() * 40 - 20);

            // Create unique keyframes
            const animStyle = document.createElement('style');
            animStyle.textContent = `
                @keyframes ${animId} {
                    0% { transform: translate(0, 0); }
                    25% { transform: translate(${x1}px, ${y1}px); }
                    50% { transform: translate(${x2}px, ${y2}px); }
                    75% { transform: translate(${x3}px, ${y3}px); }
                    100% { transform: translate(0, 0); }
                }
            `;
            document.head.appendChild(animStyle);

            dot.className = 'loading-dot';
            Object.assign(dot.style, {
                position: 'absolute',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: '#888',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `fadeInOutOnce 3s ease-in-out forwards, ${animId} 2s ease-in-out infinite`
            });

            overlay.appendChild(dot);

            setTimeout(() => {
                dot.remove();
                animStyle.remove();
                spawnDot();
            }, 3000);
        }

        for (let i = 0; i < dotCount; i++) {
            setTimeout(spawnDot, Math.random() * 1000);
        }
    } else {
        if (existingOverlay) existingOverlay.remove();
        if (existingStyle) existingStyle.remove();
    }
}


function getDisplayLetters(input) {

	if (isJSON(input)) {
		//alert(' cleaned input at the start ' + cleanString(input));

		let inputobj = JSON.parse(JSON.parse(input));

		const keys = Object.keys(inputobj);

		//alert('  Keys in json \n ' + keys);
		input = inputobj[keys[0]];
		//alert('extracted input from json ' + input);
	}
	const words = input.split(" ");

	if (words.length == 1) {
		if (words[0].length < 5)
			return words[0].toUpperCase();
	}

	const firstLetters = words.map((word, index) => {
		if (index < 2) {
			return word.charAt(0).toUpperCase();
		}
		return "";
	});
	return firstLetters.join("");
}



function isBase64JSON(str) {
	//console.log('testing for b64 JSON ' + str);

	if (!isValidBase64(str)) return false; // not even a b64 string

	try {
		// Decode the base64 string
		const decodedString = atob(str);

		// Parse the decoded string as JSON
		const jsonObject = JSON.parse(decodedString);

		// Check if the parsed object is a valid JSON
		if (typeof jsonObject === 'object' && jsonObject !== null) {
			return true; // It's a valid base64-encoded JSON object
		}
	} catch (error) {
		// If decoding or parsing fails, it's not a valid base64-encoded JSON
		return false;
	}
	return false;
}


function isValidBase64(str) {
	try {
		return btoa(atob(str)) === str;
	} catch (err) {
		return false;
	}
}

function isdotafolder(tags) {
	//console.log('isdotafolder: tags input ' + tags );
	if (typeof tags != 'undefined' && tags != null) {
		for (var t = 0; t < tags.length; t++) {
			//alert(tags[t].toLowerCase() );
			if (tags[t].toLowerCase().startsWith('folder')) {
				//console.log('isdotafolder: folder tag found, returning true' );
				return true;
			}
		}
	}
	//console.log('isdotafolder: no folder tag found, returning false' );
	return false;
}

function loadcontentlocally(t) {
	if (typeof (Storage) !== "undefined") {
		if (localStorage.getItem("CONTENT::" + t) != null) {
			let tobj = JSON.parse(localStorage.getItem("CONTENT::" + t));
			if (typeof tobj.hits != 'undefined') {
				tobj.hits += 1;
			} else
				tobj.hits = 1;

			localStorage.setItem("CONTENT::" + t, JSON.stringify(tobj));
			return tobj.items;
		} else
			return [];
	} else {
		console.warn('Local storage not supported ');
	}
}

function loadsubtopic(subtopic, altdesc) {
	//clear current topics dots first
	//alert('in loadsubtopic altdesc ' + altdesc);
	posts = [];

	var dots = document.getElementsByClassName('dot');

	//alert('loadsubtopic - removing summary-text-container');
	removediv(document.getElementById('summary-text-container'));

	//console.log('dots ' + dots.length);  
	// Convert the HTMLCollection to an array for safe removal
	var elementsArray = Array.from(dots);

	// Remove each element from the DOM
	elementsArray.forEach(function(element) {
		element.parentNode.removeChild(element);
	});

	var tokens = subtopic.split('/');

	if (topicstorage != null && topicstorage.indexOf('client') >= 0) { // SAVE locally
		setheaderbasedonsubtopic(subtopic);

		posts = loadcontentlocally(subtopic);
		console.log('about to display ' + posts.length + ' in loadsubtopic');
		displaypostsasdots(posts);
		if (typeof altdesc != 'undefined' && altdesc != null) {
			document.getElementById('infomodalbodycontent').innerText = altdesc;
			displaysubtopicsummary(altdesc);
		}
		topiccurrentdepth = tokens.length - 1;
		return;
	}


	// now get the subtopic posts
	var xhr = new XMLHttpRequest();

	var url = '/newauth/api/getpostsbytopic/' + subtopic;
	xhr.open('GET', url, false);
	xhr.setRequestHeader('Content-Type', 'application/json');

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {
			setheaderbasedonsubtopic(subtopic);

			if (typeof altdesc != 'undefined' && altdesc != null) {
				document.getElementById('infomodalbodycontent').innerText = altdesc;
				displaysubtopicsummary(altdesc);
			}

			var res = xhr.responseText;
			if (res != null && res.length > 10) {
				//alert(res);
				// console.log('got data..' +  res);

				posts = JSON.parse(res);
				console.log('about to display ' + posts.length + ' in loadsubtopic 2');
				displaypostsasdots(posts);
			}

			topiccurrentdepth = tokens.length - 1;
		}
	}

	xhr.send(null);

}

function previewsubtopic(subtopic, startdot) {
	//clear current topics dots first
	//alert('in loadsubtopic altdesc ' + altdesc);

	if (topicstorage != null && topicstorage.indexOf('client') >= 0) { // SAVE locally

		let subposts = loadcontentlocally(subtopic);
		console.log('about to display ' + subposts.length + ' in previewsubtopic');
		displaypostsasdots(subposts, undefined, undefined, startdot);

		return;
	}


	// now get the subtopic posts if held at server
	var xhr = new XMLHttpRequest();

	var url = '/newauth/api/getpostsbytopic/' + subtopic;
	xhr.open('GET', url, false);
	xhr.setRequestHeader('Content-Type', 'application/json');

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {

			var res = xhr.responseText;
			if (res != null && res.length > 10) {
				//alert(res);
				// console.log('got data..' +  res);

				let subposts = JSON.parse(res);
				console.log('about to display ' + posts.length + ' in previewsubtopic 2');
				displaypostsasdots(subposts, undefined, undefined, startdot);

			}

		}
	}

	xhr.send(null);

}

function connectDots(startDotId, endDotIds) {
	const startDot = document.getElementById(startDotId);
	if (!startDot) return;

	const startRect = startDot.getBoundingClientRect();
	const startX = startRect.left + startRect.width / 2;
	const startY = startRect.top + startRect.height / 2;

	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.style.position = 'absolute';
	svg.style.top = '0';
	svg.style.left = '0';
	svg.style.width = '100%';
	svg.style.height = '100%';
	svg.style.pointerEvents = 'none';
	svg.class = 'connector-' + startDotId;
	document.body.appendChild(svg);

	endDotIds.forEach(endDotId => {
		const endDot = document.getElementById(endDotId);
		if (!endDot) return;

		const endRect = endDot.getBoundingClientRect();
		const endX = endRect.left + endRect.width / 2;
		const endY = endRect.top + endRect.height / 2;

		const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		line.setAttribute('x1', startX.toString());
		line.setAttribute('y1', startY.toString());
		line.setAttribute('x2', startX.toString());
		line.setAttribute('y2', startY.toString());
		line.setAttribute('stroke', 'rgba(200, 200, 200, 0.5)');
		line.setAttribute('stroke-width', '2');

		svg.appendChild(line);


		// Store the line in a Map for easy removal later
		if (!window.dotConnections) {
			window.dotConnections = new Map();
		}
		if (!window.dotConnections.has(startDotId)) {
			window.dotConnections.set(startDotId, []);
		}
		window.dotConnections.get(startDotId).push(line);

		// Animate the line
		const animationDuration = 200; // .6 second
		const startTime = performance.now();

		function animateLine(currentTime) {
			const elapsedTime = currentTime - startTime;
			const progress = Math.min(elapsedTime / animationDuration, 1);

			const currentX = startX + (endX - startX) * progress;
			const currentY = startY + (endY - startY) * progress;

			line.setAttribute('x2', currentX.toString());
			line.setAttribute('y2', currentY.toString());

			if (progress < 1) {
				requestAnimationFrame(animateLine);
			}
		}

		requestAnimationFrame(animateLine);
	});
}



function removeDotConnections(startDotId) {
	if (!window.dotConnections || !window.dotConnections.has(startDotId)) {
		return;
	}

	const selector = `div[id^="sub-${startDotId}-"]`;
	const matchingDivs = document.querySelectorAll(selector);
	Array.from(matchingDivs).forEach(div => div.remove());

	const lines = window.dotConnections.get(startDotId);
	const animationDuration = 300; // .3 second

	lines.forEach(line => {
		const startTime = performance.now();
		const startX = parseFloat(line.getAttribute('x1'));
		const startY = parseFloat(line.getAttribute('y1'));
		const endX = parseFloat(line.getAttribute('x2'));
		const endY = parseFloat(line.getAttribute('y2'));

		function animateLine(currentTime) {
			const elapsedTime = currentTime - startTime;
			const progress = Math.min(elapsedTime / animationDuration, 1);

			const currentX = endX + (startX - endX) * progress;
			const currentY = endY + (startY - endY) * progress;

			line.setAttribute('x2', currentX.toString());
			line.setAttribute('y2', currentY.toString());

			if (progress < 1) {
				requestAnimationFrame(animateLine);
			} else {
				if (line.parentNode) {
					line.parentNode.removeChild(line);
				}

				// Remove the SVG element if there are no more connections
				if (window.dotConnections.size === 0) {
					const svg = document.querySelector('svg');
					if (svg && svg.parentNode) {
						svg.parentNode.removeChild(svg);
					}
				}
			}
		}

		requestAnimationFrame(animateLine);
	});

	window.dotConnections.delete(startDotId);
}



function displaysubtopicsummary(text) {
	// Create the container div
	// alert('appending ' + text + ' to bottom');

	const container = document.createElement('div');
	container.id = 'summary-text-container';
	container.title = text;
	// Set the styling for the text container
	container.style.position = 'fixed';
	container.style.bottom = '0';
	container.style.right = '10';
	container.style.width = '40vw'; // 25% of the viewport width
	container.style.maxHeight = '20vh'; // 20% of the viewport width
	container.style.overflow = 'hidden';
	container.style.zIndex = 1;
	container.style.padding = '10px';
	container.style.boxSizing = 'border-box';
	//container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
	container.style.color = '#d9d9d9';

	// Split the text into words
	const lines = text.split(' ');



	let currentLine = '';
	let fontSize = 2; // Initial font size in vw

	lines.forEach(word => {

		//console.log('this sentence size ' + (currentLine.length + word.length) + ' allowed: ' + calculateCharactersFit(fontSize, 35));
		if ((currentLine.length + word.length) > calculateCharactersFit(fontSize, 35)) { // Adjust the number 20 based on your needs
			const lineElement = document.createElement('span');
			lineElement.style.display = 'block';
			lineElement.style.fontSize = fontSize + 'vw';
			lineElement.textContent = currentLine;
			container.appendChild(lineElement);
			currentLine = '';
			fontSize -= 0.2; // Decrease font size for the next line
		}
		currentLine += word + ' ';
	});

	if (currentLine) {
		const lineElement = document.createElement('span');
		lineElement.style.display = 'block';
		lineElement.style.fontSize = fontSize + 'vw';
		lineElement.textContent = currentLine;
		container.appendChild(lineElement);
	}


	// Append the container to the body
	document.body.appendChild(container);
}

function calculateCharactersFit(fontSizeVW, screenWidthPercentage) {
	// Create a temporary element to measure character width
	const tempElement = document.createElement('span');
	tempElement.style.fontSize = fontSizeVW + 'vw';
	tempElement.style.visibility = 'hidden';
	tempElement.textContent = 'v'; // Using 'W' as it is typically the widest character
	document.body.appendChild(tempElement);

	// Measure the width of the character
	const charWidth = tempElement.offsetWidth;

	// Remove the temporary element
	document.body.removeChild(tempElement);

	// Calculate the screen width in pixels
	const screenWidth = window.innerWidth * (screenWidthPercentage / 100);

	// console.log('calculateCharactersFit scr: char ' + screenWidth + ':' +  charWidth);
	// Calculate the number of characters that fit in the given screen width
	const numCharacters = Math.floor(screenWidth / charWidth);

	return numCharacters;
}

function setheaderbasedonsubtopic(sub) {
	const tokens = sub.split('/');
	var linksofar = tokens[0];
	var subtopiclinks = '';
	document.getElementById('topic-header-main').innerHTML = '';
	var index = 0;

	tokens.forEach(function(element) {
		//var elemue = encodeURIComponent(element);
		var elemue = element;
		if (index == 0) {
			subtopiclinks += "<a href=\"/t/" + elemue + "\" style='color:#858585; '>" + element + "</a>";
		} else {
			linksofar += "/" + elemue;

			if (index == tokens.length - 1)
				subtopiclinks += " | " +
					"<a href=\"javascript:loadsubtopic('" + linksofar + "');\" style='color:#656565; text-shadow:0px 1px 1px #858585'>" + element + "</a>";
			else
				subtopiclinks += " | " +
					"<a href=\"javascript:loadsubtopic('" + linksofar + "');\" style='color:#858585;'>" + element + "</a>";

		}
		index++;
	});
	topicname = linksofar;
	document.getElementById('topic-header-main').innerHTML = subtopiclinks;
}

function increasesizesoftopdots() {
	//console.log('increasing dots sizes ' + posts.length + ' sortfld ' + sortfield + ' sortvals ' + sortvalues + ' '  +typeof posts[0].data[sortfield]);
	if (sortfield != null && sortvalues.length > 2 && typeof posts[0].data[sortfield] != 'undefined') {
		for (var x = 0; x < posts.length; x++) {
			//console.log(posts[x].data[sortfield] + ' ' + sortvalues[0]);
			if (posts[x].data[sortfield] == sortvalues[0])
				scaledotsize('dot-' + parseInt(x), 2);

			if (posts[x].data[sortfield] == sortvalues[1])
				scaledotsize('dot-' + parseInt(x), 1.618);

		}

	} else {

		for (var x = 0; x < posts.length * 0.2; x++) {
			//let index = rnd(0, maxdots-1);;	 
			//  console.log('tripling size ' + x);  
			scaledotsize('dot-' + parseInt(x), 2);
		}

		for (var x = posts.length * 0.2; x < posts.length / 2; x++) {
			// console.log('doubling size ' + parseInt(x+1));
			scaledotsize('dot-' + parseInt(x), 1.618);
		}

		for (var x = posts.length / 2; x < posts.length; x++) {
			// console.log('doubling size ' + parseInt(x+1));
			scaledotsize('dot-' + parseInt(x), 0.5);
			let elem = document.getElementById('dot-' + parseInt(x));
			elem.style.opacity = 0.6;
		}
	}



}

function scaledotsize(p, factor) {
	let elem = document.getElementById(p);
	const maxresize = 2;
	if (!elem) return;

	if (elem.data && typeof elem.data['resize'] != 'undefined' && elem.data['resize'] != null) {
		let currresize = elem.data['resize'];

		if (currresize * factor > maxresize) {
			console.log('Already ' + currresize + ' times original. Cant expand to ' + currresize * factor);
			return;
		}
	}

	// Save the original size and position if not already saved
	if (typeof elem.savedRect === 'undefined') {
		elem.savedRect = elem.getBoundingClientRect();
	}

	if (factor === 1) {
		// Optional: remove class if it was added previously
		elem.classList.remove("resized");
		elem.setAttribute('data-resize', factor);
		elem.style.transition = "none"; // Avoid triggering animations
		elem.style.width = elem.savedRect.width + "px";
		elem.style.height = elem.savedRect.height + "px";
		elem.style.left = elem.savedRect.left + "px";
		elem.style.top = elem.savedRect.top + "px";
		return;
	}

	//if (!elem.classList.contains("increased-size")) {
	elem.classList.add("resized");
	if (elem.data && typeof elem.data['resize'] != undefined && elem.data['resize'] != null)
		elem.setAttribute('data-resize', elem.data['resize'] * factor);
	else
		elem.setAttribute('data-resize', factor);

	let currentWidth = parseFloat(getComputedStyle(elem).width);
	let newWidth = currentWidth * factor;

	let currentLeft = parseFloat(getComputedStyle(elem).left);
	let currentTop = parseFloat(getComputedStyle(elem).top);

	let newLeft = currentLeft - (newWidth - currentWidth) / 2;
	let newTop = currentTop - (newWidth - currentWidth) / 2;

	elem.style.transition = "all 0.6s";
	elem.style.width = newWidth + "px";
	elem.style.height = newWidth + "px"; // Maintain aspect ratio
	elem.style.left = newLeft + "px";
	elem.style.top = newTop + "px";
	// }
}



function expandDot(circleToRect, rect, autoplay) {

	if (circleToRect == null) return;
	//	console.log('in exppand 1');
	if (typeof circleToRect.savedRect == 'undefined') {
		if (rect != null) circleToRect.savedRect = rect;
		else return;
	}
	//console.log('in exppand 2');
	rect = circleToRect.savedRect;

	let alreadyexp = document.getElementsByClassName('expanded-dot');
	if (alreadyexp != null && alreadyexp.length > 0) {
		for (var i = 0; i < alreadyexp.length; i++) {
			let expandeddot = alreadyexp[i];
			shrinkdot(expandeddot);
		}
	}

	//console.log(' in mouseover/click event on dot ' + circleToRect.id + ' left ' + rect.left + ' top ' + rect.top);
	var textContainer = circleToRect.querySelector('.text-container');

	var embimg = null;

	if (circleToRect.getElementsByTagName('img') != null) {
		embimg = circleToRect.getElementsByTagName('img')[0];
	}
	var centerX = window.innerWidth / 2;
	var centerY = window.innerHeight / 2;

	var rectCenterX = rect.left + rect.width / 2;
	var rectCenterY = rect.top + rect.height / 2;

	var scaleFactor = Math.min(window.innerWidth, window.innerHeight) / (4 * rect.width);
	var ar = parseFloat((window.innerWidth / window.innerHeight).toFixed(4));

	circleToRect.style.transition = 'all 0.7s cubic-bezier(.42,.97,.52,1.29)';

	const evtreceiver = circleToRect.querySelector('.concentric-square')

	if (rectCenterX > centerX) {
		//evtreceiver.style.left = `${rect.left - rect.width*(scaleFactor-1)}px`;
		circleToRect.style.left = `${rect.left - rect.width * (scaleFactor - 1)}px`;
	}

	if (rectCenterY > centerY) {
		//evtreceiver.style.top = `${rect.top - rect.width*(scaleFactor-1)}px`;
		circleToRect.style.top = `${rect.top - rect.width * (scaleFactor - 1)}px`;
	}

	//console.log('rect.height ' + rect.height + ' scaleFactor ' + scaleFactor);
	evtreceiver.style.width = `${rect.width * scaleFactor * ar}px`;
	evtreceiver.style.height = `${rect.height * scaleFactor}px`;
	evtreceiver.style.borderRadius = '10px';
	//evtreceiver.style.zIndex = 4;

	circleToRect.style.width = `${rect.width * scaleFactor * ar}px`;
	circleToRect.style.height = `${rect.height * scaleFactor}px`;
	circleToRect.style.borderRadius = '10px';
	circleToRect.style.zIndex = 7;
	circleToRect.style.backgroundColor = '#DAA520';
	circleToRect.style.backgroundColor = '#008080';
	circleToRect.style.backgroundColor = '#FF6F61';
	circleToRect.style.backgroundColor = '#BB8610';
	circleToRect.style.backgroundImage = '';
	circleToRect.style.opacity = 1;
	circleToRect.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.3)";

	if (textContainer != null) {
		textContainer.style.opacity = 1;
		textContainer.style.font = '12px Lato, sans-serif; color: #d3d3d3';
		textContainer.style.display = 'flex';
		textContainer.style.flexDirection = 'column';;
		textContainer.style.visibility = 'visible';
		//textContainer.style.height = `${rect.height * scaleFactor/2}px`;
		textContainer.style.height = '100%';
		textContainer.style.width = '90%';
		textContainer.style.transition = 'opacity 0.3s cubic-bezier(.42,.97,.52,1.29)';
	}

	if (embimg != null) {
		embimg.style.opacity = 1;

		embimg.style.transitionDelay = '0.5s';
		embimg.style.zIndex = 3;

		//embimg.style.transform= 'translate(-50%, -50%)';
		if (embimg.src.indexOf('/static/icons/file.png') < 0) {
			embimg.style.minWidth = '100%';
			embimg.style.top = '0';
			embimg.style.left = '0';
			embimg.style.maxHeight = '50%';
		}
		//embimg.style.minHeight= '50%';
		//embimg.style.width= 'auto';
		//embimg.style.height= 'auto';
	}
	console.log('new expanded style applied to id ' + circleToRect.id);

	let disptexts = circleToRect.getElementsByClassName('dot-disp-text');

	if (disptexts != null && disptexts.length > 0 && disptexts[0]) {
		disptexts[0].style.display = 'none';
	}

	circleToRect.classList.add('expanded-dot');

	// display any play buttons for vid
	const playButton = circleToRect.querySelector('.play-button');
	//console.log('play button found '+ playButton);
	if (playButton) {
		playButton.style.display = 'flex';
		console.log('autoplay ' + autoplay);
		if (autoplay) {
			setTimeout(() => {
				playytvideo(circleToRect);
			}, 500);
		}
	} else {
		addPlayButtonAndVideo(circleToRect);
	}

	const openicon = circleToRect.querySelector('.open-icon');
	if (openicon) {
		circleToRect.querySelector(".dot-popup").style.zIndex = '7';
		openicon.style.display = 'flex';
	}

	const copyicon = circleToRect.querySelector(".copy-icon");
	if (copyicon) {
		circleToRect.querySelector(".dot-popup").style.zIndex = '7';
		copyicon.style.display = 'flex';
	}

}

// SCROLL HANDLER FUNCTIONS
function loadNextPage() {
	if (currentPage < maxPage) {
		currentPage++;
		fetchPage(currentPage - 1);
		//document.getElementById("displayloadingcontainer").style.display = 'block';
		toggleFullScreenLoadingOverlay(true);
	} else {
		document.getElementById('next-btn-id').style.backgroundColor = '#c2c2c2';
		//document.getElementById("displayloadingcontainer").style.display = 'none';
		toggleFullScreenLoadingOverlay(false);
		displayNoMoreDataMessage();
	}
}

function loadPreviousPage() {
	if (currentPage > minPage) {
		currentPage--;
		fetchPage(currentPage - 1);
		//document.getElementById("displayloadingcontainer").style.display = 'block';
		toggleFullScreenLoadingOverlay(true);
	} else {
		document.getElementById('prev-btn-id').style.backgroundColor = '#c2c2c2';
	}
}

function fetchPage(pageNumber) {
	if (pageNumber <= 2) {
		window.location.href = `/t/earnings/` + pageNumber;

	} else {
		displayNoMoreDataMessage(); // Display message when max page is reached
	}
	//document.getElementById("displayloadingcontainer").style.display = 'none';
	toggleFullScreenLoadingOverlay(false);
}

function displayPageAttributes(attribute1, attribute2) {
	// Create container span
	const infoBox = document.createElement("span");
	infoBox.id = "infoBox";

	// Apply CSS styles
	Object.assign(infoBox.style, {
		position: "absolute",
		top: "2px",
		right: "5px",
		padding: "4px",
		backgroundColor: "rgb(248, 249, 250)",
		border: "1px solid rgb(204, 204, 204)",
		borderRadius: "4px",
		boxShadow: "rgba(0, 0, 0, 0.1) 2px 2px 10px",
		display: "flex",
		alignItems: "center",
		zIndex: "9999",
		gap: "8px"
	});

	// Create attribute span
	const attributeSpan = document.createElement("span");
	attributeSpan.innerHTML = `<strong>${attribute1}</strong> | ${attribute2}`;
	infoBox.appendChild(attributeSpan);

	// Create navigation buttons
	const prevButton = createNavButton("‹", loadPreviousPage, 'prev-btn-id');
	const nextButton = createNavButton("›", loadNextPage, 'next-btn-id');

	prevButton.disabled = currentPage === 1;
	nextButton.disabled = currentPage === maxPage;

	if (prevButton.disabled)
		prevButton.style.backgroundColor = '#c2c2c2';

	if (nextButton.disabled)
		nextButton.style.backgroundColor = '#c2c2c2';

	infoBox.appendChild(prevButton);
	infoBox.appendChild(nextButton);

	// Append to the body
	document.body.appendChild(infoBox);
}

// Function to create styled buttons
function createNavButton(text, onClick, id) {
	const button = document.createElement("button");
	button.innerHTML = text;
	button.id = id;
	Object.assign(button.style, {
		padding: "3px 8px",
		border: "none",
		backgroundColor: "rgb(0, 123, 255)",
		color: "white",
		cursor: "pointer",
		borderRadius: "3px",
		fontSize: "16px",
		transition: "background-color 0.3s ease"
	});
	button.onclick = onClick;
	button.onmouseover = () => button.style.backgroundColor = "rgb(0, 100, 200)";
	button.onmouseleave = () => button.style.backgroundColor = "rgb(0, 123, 255)";
	return button;
}



function displayNoMoreDataMessage() {
	const contentDiv = document.getElementById("topic-app");
	const message = document.createElement("div");
	message.textContent = "No more data available";
	message.style.fontWeight = "bold";
	message.id = "noMoreDataMessage"; // Assign an ID for easy removal
	contentDiv.appendChild(message);

	setTimeout(() => {
		message.remove(); // Removes the div after 10 seconds
	}, 10000);
}

// END SCROLL HANDLING

function shrinkdot(circletorect) {

	var rect;

	if (typeof circletorect.savedRect != 'undefined')
		rect = circletorect.savedRect;
	else {
		rect = circletorect.getBoundingClientRect();
	}
	const textContainer = circletorect.querySelector('.text-container');
	var embimg = null;

	if (circletorect.getElementsByTagName('img') != null) {
		embimg = circletorect.getElementsByTagName('img')[0];
	}
	var elstyle1 = window.getComputedStyle(circletorect);
	var oldwidth = elstyle1.getPropertyValue('width').replace('px', '');

	var scaleFactor = oldwidth / maxdotsize;

	//console.log('in 2shrinkdot oldwidth ' + oldwidth + ' maxdotsize ' + maxdotsize + ' scale ' + scaleFactor);

	if (circletorect.querySelector('#displayloadingcontainer') != null) {
		//console.log('Will insert loader in dot ' + circleToRect.id);
		removediv(circletorect.querySelector('#displayloadingcontainer'));
	}

	const evtreceiver = circletorect.querySelector('.concentric-square')

	circletorect.style.transition = 'all 0.5s cubic-bezier(.42,.97,.52,1.29)';
	circletorect.style.top = `${rect.top}px`;
	circletorect.style.left = `${rect.left}px`;
	//console.log('new left after mouseout : ' + circleToRect.style.left);
	circletorect.style.bottom = '';
	circletorect.style.right = '';
	circletorect.style.width = maxdotsize + 'px';
	circletorect.style.opacity = '';
	circletorect.style.height = maxdotsize + 'px';

	evtreceiver.style.width = maxdotsize + 'px';
	evtreceiver.style.height = maxdotsize + 'px';
	evtreceiver.style.top = '50%';
	evtreceiver.style.left = '50%';
	evtreceiver.style.transform = 'translate(-50%, -50%)';
	evtreceiver.style.zIndex = 6;

	circletorect.style.backgroundColor = circletorect.savedpastel;
	circletorect.style.borderRadius = '50%';
	circletorect.style.zIndex = 5;

	//console.log('scalefactor ' + scaleFactor);
	// var newwidth = elstyle.getPropertyValue('width').replace('px','');

	// console.log('newwidth ' + newwidth);

	// console.log('setting new font size for id ' +circletorect.id +': ' + parseInt(oldwidth)/(scaleFactor*3) + ' new width is ' + circletorect.style.width);
	circletorect.style.fontSize = oldwidth / (scaleFactor * 3);

	if (textContainer != null) textContainer.style.opacity = '0';

	if (embimg != null) {
		if (embimg.src.indexOf('/static/icons/file.png') < 0) {
			embimg.style.maxHeight = '100%';
		}

	}

	//if (typeof circletorect.innerTextSafe != 'undefined')
	//	circletorect.innerText = circletorect.innerTextSafe;
	let disptexts = circletorect.getElementsByClassName('dot-disp-text');

	if (disptexts != null && disptexts.length > 0 && disptexts[0]) {
		disptexts[0].style.display = 'flex';
	}

	//console.log('circletorect.classList ' + circletorect.classList);
	circletorect.classList.remove('expanded-dot');
	//circletorect.classList.remove('increased-size');
	//console.log('circletorect.classList ' + circletorect.classList);

	console.log(' new width now ' + circletorect.style.width);
	//Stop any playing videos
	const iframe = circletorect.querySelector('iframe');
	const playButton = circletorect.querySelector('.play-button');
	const img = circletorect.querySelector('img');

	if (iframe) {
		iframe.src = 'about:blank';
		iframe.remove();
	}
	if (playButton) {
		playButton.style.display = 'none';
	}
	if (img) {
		img.style.display = 'block';
	}

	const openicon = circletorect.querySelector('.open-icon');
	if (openicon) {
		circletorect.querySelector(".dot-popup").style.zIndex = '4';
		openicon.style.display = 'none';
	}
	
	const copyicon = circletorect.querySelector(".copy-icon");
	if (copyicon) {
		circletorect.querySelector(".dot-popup").style.zIndex = '4';
		copyicon.style.display = 'none';
	}
	
}

function checkTopicContext(url) {
	console.error('input URL, checking topic: ' + url);
	try {
		const parsedUrl = new URL(url);
		return parsedUrl.pathname.startsWith('/t/');
	} catch (error) {
		console.error('Invalid URL:', error);
		return false;
	}
}

function handlelongpress(e, idx) {

	console.log('in longpress handler idx ' + idx);
	var lpevt = e;
	topicdocumentclick();  // clear open desc and popups
	var dragItem = document.getElementById('dot-' + idx);
	e.preventDefault();

	dragItem.style.cursor = 'move';
	var verts = document.getElementsByClassName('attention-word-vertical');

	if (verts != null) {
		for (var v = 0; v < verts.length; v++) {
			attachtransitionstyles(verts[v], 1);
			verts[v].style.opacity = '0.9';
		}
	}
	//console.log('dot-' + idx + ' click fired');
	// alert('long press called on ' + idx);

	// START drag logic
	var active = false;
	var currentX;
	var currentY;
	var initialX;
	var initialY;
	var xOffset = 0;
	var yOffset = 0;
	var savetimeoutid = 0;

	//alert('getting desc ' + idx);
	var desc = document.getElementById('dot-desc-' + idx);
	if (desc != null) {
		desc.style.opacity = 0;
		//alert('removing desc');
	}

	document.addEventListener("touchstart", dragStart, false);
	document.addEventListener("touchend", dragEnd, false);
	document.addEventListener("touchmove", drag, false);

	document.addEventListener("mousedown", dragStart, false);
	document.addEventListener("mouseup", dragEnd, false);
	document.addEventListener("mousemove", drag, false);

	//alert('original event type ' + e.detail.type);
	if (e.detail.type === "touchstart") {
		//initialX = e.touches[0].clientX - xOffset; // no longer coming because of long-press
		// initialY = e.touches[0].clientY - yOffset;

		initialX = e.detail.clientX - xOffset;
		initialY = e.detail.clientY - yOffset;

		dragItem.style.transform = 'scale(3)';
		//dragItem.style.width = '50px';
		//dragItem.style.height = '50px';
		//alert('dot width increased');
	} else {
		initialX = e.detail.clientX - xOffset;
		initialY = e.detail.clientY - yOffset;
	}

	active = true;

	function dragStart(e) {
		//	e.preventDefault();
		if (e.type === "touchstart") {
			initialX = e.touches[0].clientX - xOffset;
			initialY = e.touches[0].clientY - yOffset;
		} else {
			initialX = e.detail.clientX - xOffset;
			initialY = e.detail.clientY - yOffset;
		}

		if (e.target === dragItem) {
			active = true;
		}
	}

	function dragEnd(e) {

		if (active) {
			initialX = currentX;
			initialY = currentY;

			var verts = document.getElementsByClassName('attention-word-vertical');

			if (verts != null) {
				for (var v = 0; v < verts.length; v++) {
					verts[v].style.opacity = 0;
				}
			}

			dragItem.style.cursor = 'default';


			//alert('total drags fired ' +drageventinstance);
			drageventinstance = 0;
			active = false;

			document.removeEventListener("touchstart", dragStart, false);
			document.removeEventListener("touchend", dragEnd, false);
			document.removeEventListener("touchmove", drag, false);
			document.removeEventListener("mousedown", dragStart, false);
			document.removeEventListener("mouseup", dragEnd, false);
			document.removeEventListener("mousemove", drag, false);

			clearAllSelection();
			//console.log('long press event over');
		}

	}

	function drag(e) {

		if (active && drageventinstance % 5 == 0) {

			e.preventDefault();

			if (e.type === "touchmove") {
				currentX = e.touches[0].clientX - initialX;
				currentY = e.touches[0].clientY - initialY;

				console.log('currentx currenty ' + currentX + ' ' + currentY);
			} else {
				currentX = e.clientX - initialX;
				currentY = e.clientY - initialY;
			}

			xOffset = currentX;
			yOffset = currentY;

			if (currentX + initialX > 25 && currentX + initialX < window.innerWidth - 25) {
				setTranslate(currentX, currentY, dragItem);
			} else if (currentX + initialX < 25) {

				if (savetimeoutid != 0) clearTimeout(savetimeoutid);
				savetimeoutid = setTimeout(function() {
					addposttosaved(lpevt, dragItem, inposts[idx].crtime);

					if (e.type === "touchmove") {
						dragItem.style.transform = 'scale(1)';
					}

				}, 400);

			} else {

				if (savetimeoutid != 0) clearTimeout(savetimeoutid);

				savetimeoutid = setTimeout(function() {
					displaybuttonbehavior(lpevt, "Deleted");

					//alert('crTime crtime ' + posts[idx].crTime + ' ' + posts[idx].crtime);
					addposttodeleted(posts[idx].crtime);

					if (topicstorage != null && topicstorage.indexOf('client') >= 0) { // remove locally also	
						addposttodeleted(posts[idx].crTime);
					}
					removediv(dragItem);
				}, 400);

				//console.log('removed item currentX ' + (currentX+initialX));
			}
		}

		drageventinstance++;
	}

	function setTranslate(xPos, yPos, el) {
		el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
	}
	// END drag logic

}

function clearAllSelection() {
	if (window.getSelection) { window.getSelection().removeAllRanges(); }
	else if (document.selection) { document.selection.empty(); }
}

function makelementpulsate(elem, durationsec) {

	if (typeof duration != 'undefined') {
		var duration = durationsec * 1000;

		setTimeout(function() {
			elem.classList.remove('pulsate');
		}, duration);
	}
	elem.classList.add('pulsate');
}

function pulsatenext(currentid, durationsec) {
	var elem = document.getElementById('dot-' + currentid);
	elem.classList.remove('pulsate');

	if (currentid < posts.length - 1) {
		var runlength = posts.length - 1 - currentid;
		for (var r = currentid + 1; r < runlength; r++) {
			elem = document.getElementById('dot-' + r);
			if (!checkifalreadyseen(posts[r].crtime)) {

				if (typeof duration != 'undefined') {
					var duration = durationsec * 1000;

					setTimeout(function() {
						elem.classList.remove('pulsate');
					}, duration);
				}

				elem.classList.add('pulsate');
				console.log('Dot id ' + r + ' set to pulsate');
				break;
			}
		}
	}
}

function getrandomdotsize(index, buckets, startsize, maxdotsize) {
	//console.log('generating random dot size between ' + startsize  + ' ' + maxdotsize);

	if (index == 0) return maxdotsize;

	var fibnum = [1, 2, 3, 5, 8];
	var randomseed = rnd(0, 100);

	var numsteps = 0;
	for (var i = 0; i < buckets; i++) {
		numsteps += fibnum[i];
	}
	var sz = 0;
	var sizestep = parseInt((maxdotsize - startsize) / buckets);

	if (typeof posts[index].hit != 'undefined' && posts[index].hit.length > 0 && parseInt(posts[index].hit) > 0) {
		if (parseInt(posts[index].hit) >= topichits / posts.length) {
			randomseed = 1;
		} else {
			if (parseInt(posts[index].hit) >= topichits / (2 * posts.length)) {
				randomseed = (100 / numsteps) + 1;
			} else {

			}
		}
	}

	for (var i = 0; i < buckets; i++) {
		var begin = i * (100 / numsteps);
		var end = 100;

		if (i < buckets - 1)
			end = (i + 1) * (100 / numsteps);

		if (randomseed >= begin && randomseed <= end) {

			//sz= maxdotsize - sizestep*fibnum[i];
			sz = maxdotsize - sizestep * (i);

			break;
		}
	}

	//console.log('numsteps ' + numsteps + ' sizestep ' + sizestep  + ' seed ' + randomseed + ' size ' + parseIntsz));
	return parseInt(sz);
}

function shiftdotandpopupids() {
	var dots = document.getElementsByClassName('dot');

	for (var d = 0; d < dots.length; d++) {
		var currid = parseInt(dots[d].id.split('-')[dots[d].id.split('-').length - 1]);
		dots[d].id = 'dot-' + parseInt(currid + 1);
	}
	var popups = document.getElementsByClassName('dot-popup');

	for (var p = 0; p < popups.length; p++) {
		var currid = parseInt(popups[p].id.split('-')[popups[p].id.split('-').length - 1]);
		popups[p].id = 'dot-popup-' + parseInt(currid + 1);
	}

	var descs = document.getElementsByClassName('dot-desc');

	for (var p = 0; p < descs.length; p++) {
		var currid = parseInt(descs[p].id.split('-')[descs[p].id.split('-').length - 1]);
		descs[p].id = 'dot-desc-' + parseInt(currid + 1);
	}

	console.log('shifted all dot, popup and desc ids')
}

function splitschema(jsonString) {
	// Parse the JSON string into an object
	console.log('About to parse ' + jsonString);
	const jsonObject = JSON.parse(jsonString);

	// Find all separator keys
	const separatorKeys = Object.keys(jsonObject).filter(key => key.startsWith("---"));

	// Create an array to store separate objects
	const separateObjects = [];

	// Initialize the first object
	let currentObject = {};

	// Iterate through the keys
	for (const key of Object.keys(jsonObject)) {
		if (separatorKeys.includes(key)) {
			// Add the current object to the array and start a new object
			separateObjects.push(currentObject);
			currentObject = {};
		} else {
			// Add the key-value pair to the current object
			currentObject[key] = jsonObject[key];
		}
	}

	// Add the last object to the array
	separateObjects.push(currentObject);

	// Log the separate objects
	for (let i = 0; i < separateObjects.length; i++) {
		console.log(`Object ${i + 1}:`, separateObjects[i]);
	}

	return separateObjects;
}

function retrievepostsummaryandshowinpopup(info, idx, e, toggle, lft, tp, showall) {
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");

	xhr.onreadystatechange = function() {
		//alert('onchange for getpostsummarybytopicandtime');
		if (xhr.readyState == 4 && xhr.status == 200) {
			// clear loading div
			//alert('should clear loading div ' + document.getElementById('dot-'+idx).querySelector('#displayloadingcontainer'));
			if (document.getElementById('dot-' + idx) != null &&
				document.getElementById('dot-' + idx).querySelector('#displayloadingcontainer') != null) {

				var loaddiv = document.getElementById('dot-' + idx).querySelector('#displayloadingcontainer');
				removediv(loaddiv);
			}

			var obj = JSON.parse(xhr.responseText);
			//alert(obj.data);
			info.data = obj.data;
			showpostdatainpopup(info, idx, e, toggle, lft, tp, showall, true); // setting reload to true
		}
	}

	if (typeof info.crtime == 'undefined') {
		if (typeof info.crTime != 'undefined')
			info.crtime = info.crTime;
	}

	var url = '/newauth/api/getpostsummarybytopicandtime/' + btoa(info.topic) + '/' + info.crtime;
	console.log('calling uriencoded url ' + url);
	xhr.open('GET', url, false);
	xhr.withCredentials = true;
	xhr.setRequestHeader('Content-Type', 'application/json');

	xhr.send(null);

}

function showpostdatainpopup(info, idx, evt, toggle, lft, tp, showall, reload) {

	//if (document.getElementById('dot-'+idx) != null)
	//	document.getElementById('dot-'+idx).style.border ='1px solid gray';

	if (document.getElementById('dot-' + idx) != null)
		document.getElementById('dot-' + idx).style.backgroundColor = '#676767';

	if (typeof showall == 'undefined' || showall == false) {

		var allopen = document.getElementsByClassName('dot-popup');

		for (var p = 0; p < allopen.length; p++) {

			if (allopen[p].id != 'dot-popup-' + idx) {
				allopen[p].classList.remove('expand-open');
				allopen[p].style.display = 'none';
				//setTimeout(function() {removediv(allopen[p]);}, 400);
				//console.log('removing popup id ' + allopen[p].id + ' showing id ' + idx);
			}
		}
	}

	var existdiv = document.getElementById('dot-' + idx).querySelector('#dot-popup-' + idx);

	if (existdiv == null) {
		existdiv = createpopupdiv(info, idx, evt, toggle, lft, tp, showall);
		console.log('non existing div :created now ' + idx + ' ' + existdiv);


	} else {

		if (typeof reload != 'undefined' && reload == true) {
			//removediv(existdiv);
			existdiv = createpopupdiv(info, idx, evt, toggle, lft, tp, showall);
			console.log('existing div ' + idx + ' reloaded');
		}
		/*existdiv.style.display = 'block';
		existdiv.classList.add('expand-open');
		if (typeof toggle != 'undefined' && toggle) {
			
			setTimeout(function(){
				existdiv.classList.remove('expand-open');
				//pop.classList.add('expand-closed');
				
				removediv(existdiv);
				}, 2000);
		}*/
	}
	/*if (info.data != null || info.text != null) {
		existdiv.style.display = 'block';
		existdiv.classList.add('expand-open');
		//fadeinelement('dot-popup-'+idx);
	}*/
}

function createpopupdiv(info, idx, evt, toggle, lft, tp, showall) {

	//console.log('createpopupdiv id left top ' + idx + ' ' + lft + ' ' + tp);
	//console.log('createpopupdiv info ' + idx + ': ' + JSON.stringify(info));
	//console.log('INFO from createpopupdiv ' + JSON.stringify(info));
	//	var popupwidth = 160;
	//	var popumaxheight = 200;

	//	var popupdistance = 0;

	let newpop = false;
	let pop;
	let fileviewbutton = null;

	if (document.getElementById('dot-' + idx).querySelector('#dot-popup-' + idx) == null) {
		pop = document.createElement('div');
		pop.setAttribute('id', 'dot-popup-' + idx);
		pop.classList.add('text-container');
		pop.classList.add('dot-popup');
		pop.style.zIndex = 7;
		
		pop.style.position = 'relative';
		pop.style.display = 'flex';
		pop.style.flexDirection = 'column';
		pop.style.whiteSpace = 'pre-wrap';
		newpop = true;
	} else {
		pop = document.getElementById('dot-' + idx).querySelector('#dot-popup-' + idx)
	}

	let exturl;
	let crtimediff;

	if (typeof info.crtime != 'undefined' && info.crtime != null)
		crtimediff = converttimediffmstocalendar(gettimedifferenceinsec(info.crtime) * 1000);

	var inftextpart = null;
	if (typeof info.text != 'undefined' && info.text != null) {
		if (info.text.length > 20)
			inftextpart = info.text.substring(0, 20);
		else
			inftextpart = info.text;
	}

	var dattextpart = null;
	var dat = null;
	if (typeof info.data !== 'undefined' && info.data !== null) {
		
		if (isJSON(info.data)) {
			dat = JSON.parse(info.data);
			if (typeof dat.text === 'string') {
				dattextpart = dat.text.length > 50
					? dat.text.substring(0, 50)
					: dat.text;
			} else {
				dattextpart = ''; // or some fallback value
			}
		} else 
			dat = info.data;

		
	}


	//console.log('info.text ' + inftextpart + ' info.data.text ' + dattextpart + ' info.crtime ' + info.crtime + ' info.hit ' + info.hit);

	if (dat != null) {

		var imgdiv = extractimagefromfiles(dat.files);

		//console.log('imgdiv extracted ' + imgdiv);
		if (imgdiv != null && imgdiv.getElementsByTagName('img') != null && imgdiv.getElementsByTagName('img').length > 0) {
			//pop.appendChild(imgdiv);
			//alert(imgdiv.getElementsByTagName('img')[0].src);
			if (imgdiv.getElementsByTagName('img')[0].src.indexOf('/static/icons/file.png') < 0) {
				var parent = document.getElementById('dot-' + idx);

				if (parent != null && imgdiv.getElementsByTagName('img')[0] != null)
					parent.appendChild(imgdiv.getElementsByTagName('img')[0]);
			}
			//imgdiv.classList.add('expand-open');
			pop.style.top = '50%';
		}

		// handle objects in files
		if (imgdiv != null && imgdiv.querySelector('[id^="obj-filename"]') != null) {
			console.log('obj-heading extracted ' + imgdiv.querySelector('[id^="obj-heading"]'));
			console.log('obj-filename extracted ' + imgdiv.querySelector('[id^="obj-filename"]'));

			var holderdiv = document.createElement('div');
			holderdiv.style.width = "100%";
			holderdiv.style.minHeight = "40%";
			holderdiv.style.display = 'flex';
			holderdiv.style.flexDirection = 'column';
			holderdiv.style.alignItems = 'center';
			holderdiv.style.justifyContent = 'center';
			//holderdiv.style.marginBottom = '15px';
			//pop.appendChild(imgdiv.querySelector('[id^="obj-heading"]'));
			//holderdiv.appendChild(imgdiv.querySelector('[id^="obj-filename"]'));
			holderdiv.appendChild(imgdiv);


			fileviewbutton = document.createElement("input");
			fileviewbutton.setAttribute("id", "file-view-button");
			fileviewbutton.classList.add('btn');
			fileviewbutton.style.marginBottom = '20px';
			fileviewbutton.style.marginTop = '20px';
			fileviewbutton.classList.add('btn-primary');
			fileviewbutton.classList.add('btn-sm');
			//sendbutton.classList.add('pull-right');
			fileviewbutton.type = "button";
			fileviewbutton.value = "View";
			//sendbutton.style.display = 'none';
			fileviewbutton.addEventListener('click', function(evt) {
				//alert('file view button clicked');
				var txt = null;

				if (typeof dat != undefined && dat != null)
					txt = dat.text;
				//alert('info ' + JSON.stringify(info));
				getfullpost(topicname, info.crtime, info.lastseq, txt, info.ownerflake, info.convid);

			}, false);
			holderdiv.appendChild(fileviewbutton);

			pop.style.top = '5%';
			const footerDiv = pop.querySelector(".pop-footer");

			if (footerDiv)
				pop.insertBefore(holderdiv, footerDiv);
			else
				pop.appendChild(holderdiv);

		}

		//console.log('dat.thumbnailurl ' + dat.thumbnailurl);
		if (typeof dat.thumbnailurl != 'undefined' && dat.thumbnailurl != null && dat.thumbnailurl.length > 0) {
			imgdiv = document.createElement('img');

			imgdiv.position = 'absolute';
			imgdiv.top = '50%';
			imgdiv.left = '50%';
			imgdiv.transform = 'translate(-50%, -50%)';
			imgdiv.minWidth = '100%';
			imgdiv.minHeight = '100%';
			imgdiv.width = 'auto';
			imgdiv.height = 'auto';

			if (dat.thumbnailurl.includes('youtube') || dat.thumbnailurl.includes('ytimg')) { // its a youtube thumbnail use a higher res version
				dat.thumbnailurl = dat.thumbnailurl.replace('/default.jpg', '/maxresdefault.jpg');
				//console.log('replacing image to highres ' + dat.thumbnailurl);
			}

			imgdiv.src = dat.thumbnailurl;

			//alert('setting textcontainer top to 50');
			pop.style.top = '50%';
			var parent = document.getElementById('dot-' + idx);

			if (parent != null)
				parent.appendChild(imgdiv);
		}

		if (typeof dat.videourl != 'undefined' && dat.videourl != null && dat.videourl.length > 0) {
			var playimgdiv = document.createElement('img');

			playimgdiv.style.position = 'absolute';
			playimgdiv.style.top = '50%';
			playimgdiv.style.left = '50%';
			playimgdiv.style.transform = 'translate(-50%, -50%)';

			playimgdiv.width = '25%';
			playimgdiv.height = '25%';
			playimgdiv.src = '/static/icons/play-64.png';
			var parent = document.getElementById('dot-' + idx);

			if (parent != null)
				parent.appendChild(playimgdiv);
		}

		exturl = extractURLFromText(dat.text);

		//console.log('cleaned dat text ' +  cleanString(dat.text));
		if (exturl != null && exturl.length > 0 && dat.text.length / exturl.length > 4) {
			let dvtx = document.createElement('div');
			dvtx.style.marginTop = '5px';
			dvtx.appendChild(document.createTextNode(cleanString(dat.text)));
			
			const footerDiv = pop.querySelector(".pop-footer");

			if (footerDiv)
				pop.insertBefore(dvtx, footerDiv);
			else
				pop.appendChild(dvtx);
			

			if (idx == 0) { // if it is the first 
				setTimeout(function() { queryURLforpreview(exturl[0].text, idx); }, 600);
			}

		} else {
			//console.log('dat ' +JSON.stringify(dat));
			  
			let pbodydiv = document.createElement('div');
			pbodydiv.style.flexGrow = 1;
			pbodydiv.style.overflowY = 'auto';
			pbodydiv.style.padding = '8px';
			if (!dat.category) {
				let pelem = document.createElement('p');
				pelem.style.marginTop = '4px';
				pelem.appendChild(document.createTextNode(cleanString(dat.text)));
				pbodydiv.appendChild(pelem);
				
				const footerDiv = pop.querySelector(".pop-footer");

				if (footerDiv)
					pop.insertBefore(pbodydiv, footerDiv);
				else
					pop.appendChild(pbodydiv);
			} else {
				// display other data- attributes
				if (typeof dat.thumbnailurl == 'undefined' || dat.thumbnailurl == null) {
					const dataoutput = document.createElement("ul");
	
					Object.entries(dat).forEach(([key, value]) => {
						const excludedKeys = ["text", "abbr", "category"];
						if (!excludedKeys.includes(key)) {
							const listItem = document.createElement("li");
							listItem.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`;
							dataoutput.appendChild(listItem);
						}
					});
	
					pbodydiv.appendChild(dataoutput);
					const footerDiv = pop.querySelector(".pop-footer");

					if (footerDiv)
						pop.insertBefore(pbodydiv, footerDiv);
					else
						pop.appendChild(pbodydiv);
					
				}
				
				displaysidepanel({
							id: idx,
							text: cleanString(dat.text),
							sent: crtimediff,
							views: info.hit,
							comments: info.comments
						});
			}
		}

		
	} else {
		if (info.text != null && info.text.length > 0) {
			if (isJSON(info.text)) {
				//alert('info text is json ' + info.text);

				pop.appendChild(createStyledTextDiv(JSON.parse(JSON.parse(info.text))));



			} else {
				pop.appendChild(document.createTextNode(info.text));

				displaysidepanel({
					id: idx,
					text: cleanString(info.text),
					sent: crtimediff,
					views: info.hit,
					comments: info.comments
				});
			}
		}
	}

	//console.log('newpop 1' + newpop);
	if (newpop && typeof info.crtime != 'undefined' && info.crtime > 0) {

		var holddiv = document.createElement('div');
		holddiv.style.marginTop = 'auto';
		//holddiv.style.bottom = '-50%';
		//holddiv.style.maxHeight = '5px';
		holddiv.classList.add('pop-footer');
		holddiv.style.padding = '8px 12px';
		holddiv.style.width = '100%';

		var h = document.createElement('hr');
		//h.style.marginTop = '1px';
		h.style.marginBottom = '4px';
		holddiv.appendChild(h);
		//alert(info.crtime);

		var r = document.createElement('div');
		r.classList.add('row');
		r.style.display = 'flex';
		r.style.alignItems = 'center';

		var c1 = document.createElement('div');
		c1.classList.add('col-xs-8');
		c1.classList.add('text-left');
		var c2 = document.createElement('div');
		c2.classList.add('col-xs-4');
		c2.classList.add('text-right');

		r.appendChild(c1);
		r.appendChild(c2);

		if (info.giveout == null)
			info.giveout = "";

		if (info.comments != null) {
			info.giveout += ' ' + toApproximateWords(info.comments) + ' comments';
		}

		if (info.hit != null) {
			info.giveout += ' ' + toApproximateWords(info.hit) + ' views';
		}


		var p = document.createElement('p');
		//para.style.right = 0;
		//p.style.padding = '1px';
		p.style.margin = '0px';
		p.style.color = '#f4f4f4';
		//p.classList.add('text-muted');
		//para.classList.add('pull-right');
		p.style.fontSize = 12;

		if (screenWidth < 600 || screenHeight < 600)
			p.style.fontSize = 8;

		p.style.overflow = 'hidden';
		p.appendChild(document.createTextNode(info.giveout));
		c1.appendChild(p);

		var para = document.createElement('p');
		para.style.color = '#f4f4f4';
		//para.style.padding = '1px';
		para.style.margin = '0px';
		//para.classList.add('text-muted');
		para.style.fontSize = 11;

		if (screenWidth < 600 || screenHeight < 600)
			para.style.fontSize = 8;

		para.classList.add('pull-right');


		para.appendChild(document.createTextNode(crtimediff));

		c2.appendChild(para);
		holddiv.appendChild(r);

		pop.appendChild(holddiv);
	}

	if (exturl != null && exturl.length > 0 && !exturl[0].text.startsWith('https://newauth.io/')) {
		newpop = false; // so external sites can be loaded 
	}

	//console.log('state before attaching click handler for dot ' + idx + ' newpop fileviewbtn : ' + newpop + ' ' +  fileviewbutton);
	//console.log('newpop 2' + newpop);
	if (!newpop && fileviewbutton == null) {

		pop.addEventListener('click', function(e) {
			e.stopPropagation();
			console.log('popup click fired');


			var timediff = 100;
			if (clickstarttime != null) {
				var now = new Date();
				timediff = now - clickstarttime;
				console.log('starttime ' + clickstarttime + ' ' + timediff);
			}

			if (timediff <= 100) {
				//alert(JSON.stringify(info));
				if (document.getElementById('topic-app') != null) {
					fadeoutelement('topic-app');
				} else
					fadeoutelement('app-flk');

				//alert(JSON.stringify(info));
				//alert(topicname + ' ' +  info.crtime + ' ' +  info.lastseq + ' ' +  dat.text + ' ' +  info.ownerflake);
				if (document.getElementById('dot-' + idx) != null) {
					document.getElementById('dot-' + idx).style.backgroundColor = '#a7a7a7';
					//	document.getElementById('dot-'+idx).style.width = 5;
					//	document.getElementById('dot-'+idx).style.height = 5;						
				}

				//pulsatenext(idx);

				var txt = null;

				if (typeof dat != undefined && dat != null)
					txt = dat.text;

				if (exturl != null && exturl.length > 0) {

					if (exturl[0].text.startsWith('https://newauth.io/t') || canLoadInApp(exturl[0].text))
						getfullpost(topicname, info.crtime, info.lastseq, txt, info.ownerflake, info.convid, exturl[0].text);
					else {
						clearTimeout(appcalltimeoutid);
						appcalltimeoutid = null;

						var loading = document.querySelector('#displayloadingcontainer');
						console.log('loading div after url preview in createpopupdiv' + loading);
						if (loading != null) {
							removediv(loading);
						}
						window.open(exturl[0].text, '_blank', 'noopener,noreferrer');
						return;
					}
					addurlopenlinktopopup(dat.text, pop);

				} else {
					getfullpost(topicname, info.crtime, info.lastseq, txt, info.ownerflake, info.convid);
				}



				var convdiv = document.createElement('div');
				convdiv.setAttribute('id', 'post-comments');
				convdiv.classList.add('panel-body');
				convdiv.classList.add('panel-word-wrap');
				convdiv.classList.add('pre-scrollable');

				convdiv.style.position = 'absolute';
				convdiv.style.top = '50px';
				convdiv.style.right = '5px';
				convdiv.style.width = '200px';
				convdiv.style.maxHeight = '60%';
				convdiv.style.maxWidth = '20%';
				convdiv.style.overflowY = 'auto';
				convdiv.style.overflowX = 'hidden';
				//convdiv.style.border = '1px solid grey';
				//convdiv.style.paddingLeft = '3px';
				//convdiv.style.paddingRight = '3px';
				if (document.getElementById("full-post-display") != null) {
					if (window.innerWidth > 600 && window.innerHeight > 600)
						document.getElementById("full-post-display").appendChild(convdiv);
					//loadconversation(null, null, topicname, info.crtime, false); // convid is not passed to server because that will not work without valid session
					if (info.convid != null)
						loadpostcommmentsontopicpage(info.convid, null, 0, topicname);
				}

				//pop.setAttribute('data-dragged', false);
			} else {
				setTimeout(function() {
					clickstarttime = null;
				}, 1000);
			}

		});
		
		
	}

	if (exturl != null && exturl.length > 0) {
		//if ( exturl[0].text.startsWith('https://newauth.io/t') || canLoadInApp(exturl[0].text))
		newpop = true; // letting the following logic work as before
	}

	//console.log(idx + ' newpop 3 ' + newpop);
	if (newpop) {
		if (document.getElementById('dot-' + idx) != null) {
			//console.log('info ' + JSON.stringify(info));

			document.getElementById('dot-' + idx).appendChild(pop);
			
		} else if (document.getElementById('topic-app') != null)
			document.getElementById('topic-app').appendChild(pop);
		else
			document.getElementById('app-flk').appendChild(pop); t
	}

	addcopylinktopopup(pop);
	addPlayButtonAndVideo(document.getElementById('dot-' + idx));
	return pop;
}

function addcopylinktopopup(popupelem) {
  if (!popupelem) return;
  
  if (popupelem.querySelector(".copy-icon")) {
  		console.log('Copy Icon Already exists for dot ');
  		 return;
  	}

  // Create the copy icon element
  const copyIcon = document.createElement("span");
  copyIcon.className = "copy-icon";
  const existing = popupelem.querySelector(`.img-icon[src="/static/icons/copy-96.png"]`);
  		  if (!existing) {
  			const img = document.createElement("img");
  			  img.className = "img-icon";
  			  img.src = "/static/icons/copy-96.png";
  			  
  			  img.style.width = "18px";
  			  img.style.height = "18px";
  			  img.style.objectFit = "contain";
  			  img.style.display = "block";
  	
  			  copyIcon.appendChild(img);
  			
  			img.title = "Copy the dot";
  		}
  // Base styling (same as open-icon)
  Object.assign(copyIcon.style, {
	margin: "2px",
	    padding: "4px",
	    color: "rgb(221, 221, 221)",
	    cursor: "pointer",
	    position: "absolute",
	    width: "18px",
	    height: "18px",
	    fontSize: "18px",
	    zIndex: "7",
	    display: "none",
	    alignItems: "center",
	    justifyContent: "center",
	    top: "10px",
		right: "10px"
  });
  
  if (popupelem.querySelector(".open-icon")) {
     // Match the open-icon's top position and offset the copy icon slightly to its left
     const openRight = parseInt(popupelem.querySelector(".open-icon").style.right || "10", 10);
	 console.log('right value of open icon ' + openRight);
     copyIcon.style.right = `${openRight + 24}px`; // space between icons
   } else {
     // Fallback position if no open-icon found
     copyIcon.style.right = "10px";
   }

  // Add click handler for copying link text
  copyIcon.addEventListener("click", () => {
    alert('handle copy of dot.. ');
	});

    popupelem.appendChild(copyIcon);
}




function addurlopenlinktopopup(text, popupelem) {
	let iconlink = null;
	
	if (popupelem.querySelector(".open-icon")) {
		console.log('Open Icon Already exists for text ' + text);
		 return;
	}
	// Try to find an existing open-icon
	const copyIcon = popupelem.querySelector(".copy-icon");

	let exturl = extractURLFromText(text);
	
	if (exturl != null && exturl.length > 0
		//&& fieldValue.length/exturl.length > 4
	) {

		iconlink = document.createElement('span');
		iconlink.classList.add('open-icon'); // Add a CSS class for the icon 
		
		const existing = popupelem.querySelector(`.img-icon[src="/static/icons/open-window-128.png"]`);
		  if (!existing) {
			const img = document.createElement("img");
			  img.className = "img-icon";
			  img.src = "/static/icons/open-window-128.png";
			  //img.style.pointerEvents = "none";
			  img.style.width = "48";
			  img.style.height = "48";
			  img.style.objectFit = "contain";
			  img.style.display = "block";
	
			  iconlink.appendChild(img);
			//iconlink.innerHTML = '<img src= alt="Open" style="width:18px;height:18px;object-fit:contain;pointer-events:none;">';
			img.title = "Open in new window";
		}
		
		Object.assign(iconlink.style, {
		  margin: "2px",
		  padding: "4px",
		  color: "#ddd",
		  cursor: "pointer",
		  position: "absolute",
		  width: "36px",
		  height: "36px",
		  fontSize: "18px",
		  zIndex: "7",
		  pointerEvents: "auto",
		  display: "none",
		  alignItems: "center",
		  justifyContent: "center",
		  top: "7px",
		  right: "10px"
		});
		
	
	iconlink.addEventListener('click', function(evt, data) {
			return function(evt) {

				evt.target.style.opacity = 0.7;
				if (exturl[0].text.startsWith('https://newauth.io/t') || canLoadInApp(exturl[0].text)) {
					iconlink.title = 'Read full post';
					getfullpost(topicname, info.crtime, info.lastseq, txt, info.ownerflake, info.convid, exturl[0].text);
				} else {

					window.open(exturl[0].text, '_blank', 'noopener,noreferrer');
					return;
				}

				setTimeout(function() {
					//removeInfoFromClipboard(); -- wont work
					evt.target.style.opacity = 1;
				}, 5000);
			};
		}(event, exturl));
	}

	if (iconlink != null) {

		iconlink.style.top = '10px';
		iconlink.style.right = '10px';
		
		//console.log('icon offtop height ' + popupelem.offsetTop + ' ' + popupelem.height);
		
		if (copyIcon) {
		    popupelem.insertBefore(iconlink, copyIcon);
			// Match the open-icon's top position and offset the copy icon slightly to its left
	  	   const openRight = parseInt(copyIcon.style.right || "10", 10);
	  	   console.log('right value of copy icon ' + openRight);
	  	   iconlink.style.right = `${openRight + 24}px`; // space between icons
		  } else {
		    popupelem.appendChild(iconlink);
			iconlink.style.right = "10px";
		  }
		  
		 
		  		
	}
}

function addPlayButtonAndVideo(dotElement) {
	const img = dotElement.querySelector('img');

	if (img)
		var videoId = extractVideoId(img.src);

	if (!videoId) return;

	// Create play button
	const playButton = document.createElement('div');
	playButton.className = 'play-button';
	playButton.innerHTML = `
	        <svg height="100%" version="1.1" viewBox="0 0 68 48" width="100%">
	            <path class="ytp-large-play-button-bg" d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path>
	            <path d="M 45,24 27,14 27,34" fill="#fff"></path>
	        </svg>
	    `;
	playButton.style.cssText = `
	        position: absolute;
	        top: 25%;
	        left: 50%;
	        transform: translate(-50%, -50%);
			width: min(68px, 10vw);
		    height: min(48px, 7vw);
		    min-width: 40px;
		    min-height: 28px;
	        cursor: pointer;
			display: none;
	        z-index: 4;
	    `;

	dotElement.appendChild(playButton);

	// Handle click event
	playButton.addEventListener('click', (event) => playytvideo(dotElement, videoId, event));
}

function playytvideo(dotElement, videoId, event) {
	if (event) event.stopPropagation();
	const img = dotElement.querySelector('img');

	if (!videoId)
		videoId = extractVideoId(img.src);

	const iframe = document.createElement('iframe');
	iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1&mute=1&autohide=1&border=0&wmode=opaque&enablejsapi=1&modestbranding=1&showinfo=0&controls=1`;

	iframe.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 50%;
            border: none;
            z-index: 6;
        `;

	dotElement.appendChild(iframe);

	const playButton = dotElement.querySelector('.play-button');

	// Animate and remove play button
	playButton.style.transition = 'opacity 0.5s ease-out';
	playButton.style.opacity = '0';
	setTimeout(() => {
		playButton.remove();
	}, 500);

	img.style.display = 'none';
}

// Helper function to extract video ID from YouTube thumbnail URL
function extractVideoId(url) {
	const match = url.match(/\/vi\/([^\/]+)\//);
	return match ? match[1] : null;
}


function displaysidepanel(input) {
	// Convert single object to array if necessary
	//console.log('in displaysidepanel ');
	const objectList = Array.isArray(input) ? input : [input];

	if (!sidecontainer) {
		// Create a sidecontainer for the list if it doesn't exist
		sidecontainer = document.createElement('div');
		sidecontainer.id = 'object-list-sidecontainer';
		sidecontainer.style.cssText = `
            position: fixed;
            right: 20px;
            top: 50px;
            bottom: 20px;
            width: 250px;
			opacity: 0.9;
            overflow-y: auto;
            background-color: #f0f0f0;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            padding: 15px;
            font-family: Arial, sans-serif;
			z-index: 12;
        `;
		document.body.appendChild(sidecontainer);

		// Add custom scrollbar styles
		const style = document.createElement('style');
		style.textContent = `
            #object-list-sidecontainer::-webkit-scrollbar {
                width: 10px;
            }
            #object-list-sidecontainer::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 10px;
            }
            #object-list-sidecontainer::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 10px;
            }
            #object-list-sidecontainer::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
        `;
		document.head.appendChild(style);
	}

	let summaryPanel = document.getElementById('summary-panel');
	if (!summaryPanel) {
		summaryPanel = document.createElement('div');
		summaryPanel.id = 'summary-panel';
		summaryPanel.style.cssText = `
				background-color: #e0e0e0;
	            padding: 10px;
	            margin-bottom: 15px;
	            border-radius: 5px;
	            font-weight: bold;
	            position: fixed;
	            top: 0px;
				width: 220px;
	            z-index: 4;
	        `;
		sidecontainer.prepend(summaryPanel);
	}

	// Update summary panel

	objectList.forEach(obj => {
		totalViews += obj.views || 0;
		totalComments += obj.comments || 0;
		totalRecords += 1;
	});

	// Your existing data transformation
	let disptotalRecords = toApproximateWords(totalRecords);
	let disptotalViews = toApproximateWords(totalViews);
	let disptotalComments = toApproximateWords(totalComments);

	// Create summary panel HTML
	summaryPanel.innerHTML = `
		  <div id="record-header" style="display: flex; justify-content: space-between; cursor: pointer;">
		    <span>Records: ${disptotalRecords}</span>
		  </div>
		  <div style="display: flex; justify-content: space-between;">
		    <span>Views: ${disptotalViews}</span>
		    <span>Comments: ${disptotalComments}</span>
		  </div>
		`;


	let linkArray = sortvalues;

	// Create hidden panel
	let slidingPanel = document.createElement('div');
	slidingPanel.id = 'sliding-panel';
	slidingPanel.style.cssText = `
		  display: none;
		  margin-top: 10px;
		  padding: 10px;
		  border-top: 1px solid #ccc;
		  animation: slideDown 0.3s ease-out;
		  display: grid;
		  grid-template-columns: repeat(4, 1fr);
		  gap: 8px;
		`;

	if (linkArray != null && linkArray.length > 0) {
		// Populate with links
		linkArray.forEach(text => {
			const linkItem = document.createElement('a');
			linkItem.textContent = text;
			linkItem.classList.add("link-item");

			//linkItem.href = "#";

			linkItem.addEventListener("click", (event) => {
				
				event.stopPropagation(); 
				console.log("filtering " + sortfield + ":::" + text);
				const isActive = linkItem.classList.contains("active-filter");
				if (isActive) {
					linkItem.classList.remove("active-filter");
					displaypostsasdots(posts, false, sortfield + ":::ALL");
				} else {
					// Remove active class from all other items
					document.querySelectorAll(".link-item").forEach(item =>
						item.classList.remove("active-filter")
					);

					linkItem.classList.add("active-filter");
					displaypostsasdots(posts, false, sortfield + ":::" + text);
				}
			});

			linkItem.addEventListener("mouseenter", (event) => {
				event.stopPropagation(); 
				console.log("filtering " + "PREVIEW:::" + sortfield + ":::" + text);
				displaypostsasdots(posts, false, "PREVIEW:::" + sortfield + ":::" + text);

			});
			linkItem.addEventListener("mouseleave", (event) => {
				event.stopPropagation(); 
				console.log("removing filter " + "PREVIEW:::" + sortfield + ":::" + text);
				displaypostsasdots(posts, false, "PREVIEW:::" + sortfield + ":::ALL");
			});

			slidingPanel.appendChild(linkItem);
		});
	}

	const style = document.createElement('style');
	style.textContent = `
		  .link-item {
		    display: block;
		    padding: 4px;
		    background: #f0f0f0;
		    text-align: center;
		    text-decoration: none;
		    border-radius: 4px;
		    color: #333;
		    transition: background 0.2s ease, color 0.2s ease;
		  }

		  .link-item:hover {
		    background: #e0e0ff;
		    color: #00008b;
		  }

		  .link-item:active {
		    background: #c0c0ff;
		    color: #000066;
		  }
		  .link-item.active-filter {
		    background: #ffdcdc;
		    color: #8b0000;
		    font-weight: bold;
		  }
		`;
	document.head.appendChild(style);

	// Add the panel after the summary
	summaryPanel.appendChild(slidingPanel);

	// Handle click
	document.getElementById("record-header").addEventListener("click", () => {
		slidingPanel.style.display = slidingPanel.style.display === "none" ? "grid" : "none";
	});


	// Slide existing divs down
	const existingDivs = sidecontainer.children;
	for (let i = 0; i < existingDivs.length; i++) {
		const div = existingDivs[i];
		div.style.transition = 'transform 0.5s ease';
		div.style.transform = `translateY(${objectList.length * 60}px)`;
	}

	// Create and prepend new object divs with animation
	objectList.forEach((obj, index) => {
		const div = document.createElement('div');
		div.id = `dot-sidepanel-${obj.id}`;
		div.style.cssText = `
            background-color: #ffffff;
            margin-bottom: 10px;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            transition: transform 0.2s ease, opacity 0.5s ease;
            opacity: 0;
			z-index: 3;
            transform: translateY(-20px);
            position: relative;
        `;

		const textSpan = document.createElement('span');
		textSpan.textContent = obj.text;
		div.appendChild(textSpan);

		const sentSpan = document.createElement('span');
		sentSpan.textContent = obj.sent;
		sentSpan.style.cssText = `
            position: absolute;
            bottom: 5px;
            right: 5px;
            font-size: 0.8em;
            color: #888;
        `;
		div.appendChild(sentSpan);

		const createMouseOverHandler = (div, obj) => {
			return () => {
				div.style.transform = 'scale(1.02) translateY(0)';
				div.style.backgroundColor = '#ffffcc';

				const dotElement = document.getElementById('dot-' + obj.id);
				// console.log('about to expand dot-' + obj.id + ' ' + dotElement);

				if (dotElement) {
					expandDot(dotElement, dotElement.getBoundingClientRect());
				}
			};
		};

		const createMouseOutHandler = (div, obj) => {
			return () => {
				div.style.transform = 'scale(1) translateY(0)';
				div.style.backgroundColor = '#ffffff';

				const dotElement = document.getElementById('dot-' + obj.id);
				// console.log('about to shrink dot-' + obj.id + ' ' + dotElement);

				if (dotElement) {
					shrinkdot(dotElement);
				}
			};
		};

		div.addEventListener('mouseover', createMouseOverHandler(div, obj));
		div.addEventListener('mouseout', createMouseOutHandler(div, obj));

		sidecontainer.append(div);

		// Trigger animation after a short delay
		setTimeout(() => {
			div.style.opacity = 0.9;
			div.style.transform = 'translateY(0)';
		}, 100 * (index + 1));
	});

	// Reset the transform of existing divs after animation
	setTimeout(() => {
		for (let i = objectList.length; i < existingDivs.length; i++) {
			existingDivs[i].style.transition = 'none';
			existingDivs[i].style.transform = 'none';
		}
	}, 500);

	const firstDotPanel = sidecontainer.querySelector('[id^="dot-sidepanel-"]');
	if (firstDotPanel && summaryPanel) {
		const summaryHeight = summaryPanel.offsetHeight;
		firstDotPanel.style.marginTop = `${summaryHeight + 15}px`; // 15px for additional spacing
	}
	// add the collapse/expand control
	addSidePanelToggle();
	updateToggleButtonStyle();
}

function toggleSidePanel() {
	const sidePanel = document.getElementById('object-list-sidecontainer');
	const toggleButton = document.getElementById('side-panel-toggle');

	if (sidePanel && toggleButton) {
		if (sidePanel.style.width === '250px') {
			// Collapse the side panel
			sidePanel.style.width = '0';
			sidePanel.style.padding = '0';
			sidePanel.style.right = '-20px'; // Move it completely off-screen
			toggleButton.textContent = '<';
			toggleButton.style.right = '0';
		} else {
			// Expand the side panel
			sidePanel.style.width = '250px';
			sidePanel.style.padding = '15px';
			sidePanel.style.right = '20px';
			toggleButton.textContent = '>';
			// toggleButton.style.right = '270px'; // 250px (panel width) + 20px (right offset)
		}
	}
}

function addSidePanelToggle() {
	const sidePanel = document.getElementById('object-list-sidecontainer');
	const togglebutton = document.getElementById('side-panel-toggle');

	if (sidePanel && !togglebutton) {
		// Create toggle button
		const toggleButton = document.createElement('button');
		toggleButton.id = 'side-panel-toggle';
		toggleButton.textContent = '>';
		toggleButton.style.position = 'fixed';
		toggleButton.style.top = '50%';
		toggleButton.style.right = '0';
		toggleButton.style.transform = 'translateY(-50%)';
		toggleButton.style.zIndex = '1000';
		toggleButton.style.padding = '10px 5px';  // Increased padding for a bigger button
		toggleButton.style.fontSize = '18px';  // Increased font size for a bigger button
		toggleButton.style.backgroundColor = '#f0f0f0';
		toggleButton.style.border = 'none';
		toggleButton.style.borderLeft = '1px solid #ccc';
		toggleButton.style.cursor = 'pointer';
		toggleButton.addEventListener('click', toggleSidePanel);

		// Add transition for smooth animation
		sidePanel.style.transition = 'width 0.3s ease-in-out';
		sidePanel.style.overflow = 'hidden';

		// Append the button to the body
		document.body.appendChild(toggleButton);

		// Set initial state
		sidePanel.style.width = '250px';
		sidePanel.style.padding = '15px';
		sidePanel.style.right = '20px';

		// Ensure the scrollbar is visible when content overflows
		sidePanel.style.overflowY = 'auto';
	}
}

function updateToggleButtonStyle() {
	const toggleButton = document.getElementById('side-panel-toggle');
	if (toggleButton) {
		toggleButton.style.borderRadius = '20px 0 0 20px'; // Curved left side
		toggleButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)'; // Subtle shadow for depth
		toggleButton.style.background = 'linear-gradient(to right, #f0f0f0, #e0e0e0)'; // Gradient background
		toggleButton.style.color = '#333'; // Darker text color for better contrast
		toggleButton.style.transition = 'all 0.3s ease'; // Smooth transition for hover effects

		// Hover effect
		toggleButton.addEventListener('mouseover', () => {
			toggleButton.style.background = 'linear-gradient(to right, #e0e0e0, #d0d0d0)';
			toggleButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
		});

		toggleButton.addEventListener('mouseout', () => {
			toggleButton.style.background = 'linear-gradient(to right, #f0f0f0, #e0e0e0)';
			toggleButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
		});
	}
}

function highlightAndScroll(id) {
	const sidecontainer = document.getElementById('object-list-sidecontainer');
	const div = document.getElementById(`dot-sidepanel-${id}`);

	//console.log('scrolling id '+ id);
	if (!sidecontainer || !div) return;

	// Remove highlight from all divs
	Array.from(sidecontainer.children).forEach(child => {
		child.style.backgroundColor = '#ffffff';
	});

	// Highlight the selected div
	div.style.backgroundColor = '#ffffcc';

	// Check if the div is in the visible range
	const containerRect = sidecontainer.getBoundingClientRect();
	const divRect = div.getBoundingClientRect();

	if (divRect.top < containerRect.top || divRect.bottom > containerRect.bottom) {
		// If not in visible range, scroll to it
		div.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	// Remove highlight after 2 seconds
	setTimeout(() => {
		div.style.backgroundColor = '#ffffff';
	}, 6000);
}

function createStyledTextDiv(jsonData) {

	const keys = Object.keys(jsonData);

	//alert('keys ' + keys);
	const divElement = document.createElement('div');
	divElement.classList.add('dot-text-container'); // Add a CSS class for styling

	var index = 0;
	// Display all fields
	keys.forEach((fieldName) => {
		const fieldValue = jsonData[fieldName];

		if (fieldValue) {
			const paragraphContainer = document.createElement('div');
			paragraphContainer.style.display = 'flex';
			paragraphContainer.style.alignItems = 'center';

			const icon = document.createElement('span');
			let iconlink = null;
			icon.classList.add('copy-icon'); // Add a CSS class for the icon
			icon.innerHTML = '📋'; // Use a clipboard emoji as the icon
			//icon.innerHTML = '\u1F5D4'; // window icon
			icon.title = 'Copy to clipboard';
			icon.style.cursor = 'pointer';

			icon.addEventListener('click', function(evt, data) {
				return function(evt) {
					copytexttocbandhighlight(data, 'Data copied', evt);
					evt.target.style.opacity = 0.7;

					setTimeout(function() {
						//removeInfoFromClipboard(); -- wont work
						evt.target.style.opacity = 1;
					}, 5000);
				};
			}(event, fieldValue));



			const paragraph = document.createElement('p');
			paragraph.textContent = fieldValue;
			paragraph.title = fieldValue; // Set the tooltip text

			// Apply different styles based on the index
			switch (index) {
				case 0:
					paragraph.style.fontWeight = 'bold';
					paragraph.style.fontSize = '1.2em';
					paragraph.style.margin = 0;
					break;
				case 1:
					paragraph.style.fontStyle = 'italic';
					paragraph.style.fontSize = '1em';
					paragraph.style.margin = 0;
					break;
				case 2:
					paragraph.style.fontFamily = 'Arial, sans-serif';
					paragraph.style.fontSize = '0.9em';
					paragraph.style.margin = 0;
					break;
				default:
					// Apply a default style for other fields
					paragraph.style.fontSize = '1em';
					paragraph.style.margin = 0;
					break;
			}

			index++;
			paragraphContainer.appendChild(icon);

			paragraphContainer.appendChild(paragraph);
			divElement.appendChild(paragraphContainer);



		}
	});


	// Additional styling for the entire div
	divElement.style.border = '1px solid #ccc';
	divElement.style.padding = '5px';
	divElement.style.margin = '5px';
	//divElement.style.backgroundColor = '#f9f9f9';

	// Check if the style already exists before appending
	const existingStyle = document.querySelector('style.dot-text-container');
	if (!existingStyle) {
		const style = document.createElement('style');
		style.textContent = `
            .dot-text-container p {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 80%; /* Adjust the maximum width */
            }
            .dot-text-container p:hover {
                
            }
        `;
		style.classList.add('dot-text-container'); // Add a class to identify the style
		document.head.appendChild(style);
	}
	//alert('hello');
	return divElement;
}

function canLoadInApp(exturl) {
	try {
		// Attempt to fetch the URL
		fetch(exturl)
			.then(response => {
				// If the fetch was successful, open the URL in an overlay div
				return true;
			})
			.catch(error => {
				// If there's an error (like a cross-origin error), open the URL in a new tab
				return false;
			});
	} catch (error) {
		// If there's an error (like a cross-origin error), open the URL in a new tab
		return false;
	}
	return false;
}

function toApproximateWords(number) {
	const units = ["", "k", "m", "b", "t"];
	const step = 1000;
	let i = 0;

	while (number >= step && i < units.length - 1) {
		number = number / step;
		i++;
	}

	return Math.floor(number) + units[i];
}



function createloadingdiv() {

	var dv = document.createElement('div');
	dv.classList.add("row");

	var col = document.createElement('div');
	col.classList.add("col-xs-12");

	dv.setAttribute('id', 'displayloadingcontainer');

	var lder = document.createElement('div');
	lder.classList.add('loader');
	//lder.classList.add('center-with-flex');

	var txt = document.createElement('h5');
	txt.appendChild(document.createTextNode("Loading..."));
	lder.appendChild(txt);

	col.appendChild(lder);
	dv.appendChild(col);

	dv.style.display = "inline-block";
	dv.style.position = "absolute";
	dv.style.top = "10px";
	//dv.style.position = "relative";

	return dv;
}

function extractimagefromfiles(files) {
	var hasobjectfile = false;
	var hasobjectfilewithimage = false;
	var divforimg = null;
	var seq = 0;

	if (files == null) return divforimg;

	divforimg = document.createElement('div');

	files.forEach(function(item, index) {
		if (item.type.indexOf('image') < 0) hasobjectfile = true;
	});

	if (hasobjectfile) {
		files.forEach(function(item, index) {
			if (item.type.indexOf('image') >= 0 || item.type.indexOf('video') >= 0) hasobjectfilewithimage = true;
		});
	}

	//console.log('hasobjectfile hasobjectfilewithimage ' + hasobjectfile + ' ' + hasobjectfilewithimage);
	if (!hasobjectfile) {

		divforimg.style.padding = "0px";
		divforimg.style.position = "relative";

		files.forEach(function(file, index) {
			var img = document.createElement('img');
			img.style.top = "0";
			//img.style.height = "100%";
			img.style.width = "100%";
			//img.style.position = "absolute";			
			//img.style.max-height = '100%';
			img.style.objectFit = 'cover';

			img.src = file.thumbnail;

			if (document.getElementById('topic-main-image') != null)
				document.getElementById('topic-main-image').src = file.thumbnail;
			//console.log('adding image tn');
			/*img.addEventListener('mouseover', function(e) {
				incol.style.opacity = "0.8";
				highlightpostheader(seq);
			});*/

			//alert('index value ' + index);
			if (parseInt(index) > 0) {
				img.style.display = 'none';
			} else {
				img.classList.add("img-responsive");
				img.classList.add("center-block");
			}

			/*img.addEventListener('mouseout', function(e) {
				incol.style.opacity = "1";
				unhighlightpostheader(seq);
			});*/

			divforimg.appendChild(img);
		});

		/*divforimg.addEventListener('click', function(e) {	
			fadeoutelement('app');
			//alert(JSON.stringify(postdata));
			getfullfilefrompost(seq, postdata.text, flake, convid);
		});*/


	} else if (hasobjectfilewithimage) {
		var divforimg = document.createElement('div');
		//divforimg.style.padding = "0px";
		//divforimg.style.position = "relative";
		//divforimg.classList.add('col-xs-4');
		//divforimg.classList.add('col-md-3');
		divforimg.style.height = '100%';
		//alert('file type ' + files[0].type);

		files.forEach(function(file, index) {
			if (file.type.indexOf('image') >= 0 || file.type.indexOf('video') >= 0) {
				var img = document.createElement('img');
				//img.style.top = "0";
				//img.style.width = "100%";
				//img.style.position = "absolute";			
				img.style.maxHeight = '50%';
				//img.style.objectFit = 'cover';
				img.classList.add("img-responsive");
				img.classList.add("center-block");
				img.src = file.thumbnail;

				///alert('thumbnail ' + file.thumbnail);

				if (document.getElementById('topic-main-image') != null)
					document.getElementById('topic-main-image').src = file.thumbnail;
				/*img.addEventListener('mouseenter', function(e) {
					incol.style.opacity = "0.8";
					highlightpostheader(seq);
				});*/

				//if (index > 0) {
				//	img.style.display = 'none';
				//}

				/*img.addEventListener('mouseleave', function(e) {
					incol.style.opacity = "1";
					unhighlightpostheader(seq);
				});*/

				divforimg.appendChild(img);
			}

			if (file.type.indexOf('image') < 0) {
				//alert('File type ' + file.type + ' name ' + file.name);
				var heading = document.createElement('div');
				heading.setAttribute('id', 'obj-heading-' + seq);
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
				heading.style.display = 'block';
				heading.appendChild(document.createTextNode(file.type.replace("application/", "")));
				//divforimg.appendChild(heading);


				var obj = document.createElement('div');
				obj.setAttribute('id', 'obj-filename-' + seq);
				//alert('file alone type ' + postdata.files[0].type);
				//obj.src = postdata.files[0].thumbnail;
				//obj.type = postdata.files[0].type;
				//obj.style.width = '100px';
				//obj.style.height = '100px';
				obj.style.color = '#323232';
				//obj.style.margin = '40px 0px 0px 10px';
				//obj.style.position = 'relative';
				//alert(divforimg.height);
				//obj.style.top = parseInt(divforimg.height/2) + 'px';
				obj.style.marginRight = '5px';

				obj.style.backgroundColor = '#d2d2d2';
				obj.style.opacity = '1';
				obj.style.minWidth = '60%';
				obj.style.overflow = 'hidden';
				//obj.style.display='block';

				var fileicon = document.createElement('img');
				fileicon.src = '/static/icons/file.png';
				//obj.appendChild(fileicon); // a thumbnail already exists
				//alert('fileicon added');

				var filetypetext = document.createElement('div');

				var fileext = document.createTextNode(file.name.split(".")[1]);
				if (typeof fileext == 'undefined' || fileext == null || fileext.length == 0)
					fileext = document.createTextNode('unknown');

				filetypetext.appendChild(fileext);
				obj.appendChild(filetypetext);
				divforimg.appendChild(obj);

				/*divforimg.addEventListener('mouseover', function(e) {		
					
					$('#obj-heading-'+seq).show();
					$('#obj-filename-'+seq).show();
				});
				
				divforimg.addEventListener('mouseout', function(e) {					
					$('#obj-heading-'+seq).hide();
					$('#obj-filename-'+seq).hide();
				});*/

				seq++;
			}

		});

		//fixedsizecol.appendChild(divforimg);

		/*divforimg.addEventListener('click', function(e) {	
			fadeoutelement('app');
			//alert(JSON.stringify(postdata));
			getfullfilefrompost(seq, postdata.text, flake, convid);
		});*/

		/*if (parseInt(seq) < lastpostseq) {
			div.appendChild(incol);
		} else {
			var lastpost = document.querySelectorAll('div[id^="post-seq-' +lastpostseq + '"]')[0];
			div.insertBefore(incol, lastpost);
		}*/



	} else { // object alone
		//alert('file type ' + postdata.files[0].type);
		var divforobj = document.createElement('div');
		//divforobj.classList.add('col-xs-4');
		//divforobj.classList.add('col-md-3');
		//divforobj.style.padding = "0px";
		//divforobj.style.margin = "0px";
		//divforobj.style.width = "100%";
		//divforobj.style.top = "0px";
		divforobj.style.height = '100%';


		//divforobj.style.backgroundColor = '#c3c3c3';
		//divforobj.style.opacity = '0.8';

		var heading = document.createElement('div');
		heading.setAttribute('id', 'obj-heading-' + seq);
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
		heading.style.display = 'block';
		heading.appendChild(document.createTextNode(files[0].type.replace("application/", "")));
		//divforobj.appendChild(heading);


		var obj = document.createElement('div');
		obj.setAttribute('id', 'obj-filename-' + seq);
		//alert('file alone type ' + postdata.files[0].type);
		//obj.src = postdata.files[0].thumbnail;
		//obj.type = postdata.files[0].type;
		//obj.style.width = '100px';
		//obj.style.height = '100px';
		obj.style.color = '#323232';
		obj.style.display = 'flex';
		obj.style.flexDirection = 'column';
		obj.style.alignItems = 'center';
		obj.style.justifyContent = 'center';
		//obj.style.margin = '40px 0px 0px 10px';
		//obj.style.position = 'relative';
		//alert(divforimg.height);
		//obj.style.top = parseInt(divforimg.height/2) + 'px';
		//obj.style.marginRight = '5px';

		//obj.style.backgroundColor = '#d2d2d2';
		obj.style.opacity = '1';
		//obj.style.width = '50%';
		//obj.style.overflow = 'hidden';
		//obj.style.display='block';
		var fileicon = document.createElement('img');
		fileicon.style.width = '64px';
		fileicon.style.height = '64px';

		if (window.innerWidth < 500) {
			fileicon.style.width = '40px';
			fileicon.style.height = '40px';
		}
		fileicon.style.zIndex = '5';
		fileicon.src = '/static/icons/file.png';
		obj.appendChild(fileicon);
		//alert('fileicon added');

		var filetypetext = document.createElement('div');
		filetypetext.style.width = '100%';
		filetypetext.style.zIndex = '6';

		var pnode = document.createElement('p');
		pnode.style.fontSize = '25px';
		if (window.innerWidth < 500) {
			pnode.style.fontSize = '15px';
		}
		pnode.style.textTransform = 'uppercase';
		var fileext = document.createTextNode(files[0].name.split(".")[1]);
		if (typeof fileext == 'undefined' || fileext == null || fileext.length == 0)
			fileext = document.createTextNode('unknown');

		pnode.appendChild(fileext);
		filetypetext.appendChild(pnode);
		obj.appendChild(filetypetext);
		divforobj.appendChild(obj);




		/*divforobj.addEventListener('click', function(e) {	
			fadeoutelement('app');
			getfullfilefrompost(seq, postdata.text, flake);
		});*/
		//fixedsizecol.appendChild(divforobj);
		return divforobj;
	}
	return divforimg;
}

function extractURLFromText(textToCheck) {
	//	var expression = /(https?:\/\/)?(([\w\-~]+(\.[\w\-~]+)+)|localhost)(:\d+)?(\/[\w\-~@:%]*)*(#[\w\-]*)?(\?[^\s]*)?/gi;
	var expression = /\b(https?:\/\/)([\w\-~]+(\.[\w\-~]+)+|localhost)(:\d+)?(\/[\w\-~@:%]*)*(#[\w\-]*)?(\?[^\s]*)?\b/gi;
	var splitText = [];
	var regex = new RegExp(expression);
	var match;

	while ((match = regex.exec(textToCheck)) !== null) {
		var cleanedLink = match[0];
		splitText.push({ text: cleanedLink, type: 'link' });
	}

	return splitText;
}

function removeloader(idx) {
	var cntnr = document.getElementById('dot-' + idx);

	if (cntnr != null) {
		var loading = cntnr.querySelector("#displayloadingcontainer");
		//console.log('no response from urlpreview ' + ' loadingdiv found ' + loading);
		if (loading != null) {
			loading.querySelector("h5").innerHTML = "Preview Load failed...";
			if (loading.querySelector(".loader") != null)
				loading.querySelector(".loader").classList.remove('loader');
		}
	}
}

function queryURLforpreview(siteurl, idx) {
	var worker = new Worker('/static/js/siteload-worker.js');

	worker.onerror = function(e) {
		console.log('in error handler of worker ' + e.data);
		removeloader(idx);
	}

	worker.onmessage = function(e) {
		//alert('readystate status from urlpreview ' + xhr.readyState + ' '+ xhr.status);


		if (e.data.action == 'siteread') {

			if (e.data.error) {
				console.log('in error from data returned by worker ' + e.data);
				removeloader(idx);
				return;
			}

			var data = JSON.parse(e.data.response);
			let doc = new DOMParser().parseFromString(data.contents, 'text/html');

			const siteSelectors = {
				'finance.yahoo.com': 'div.caas-body',
				'www.bbc.com': 'article',
				'www.cnn.com': 'div.article__content',
				'www.nytimes.com': 'section[name="articleBody"]',
				'www.theguardian.com': 'div.article-body-viewer-selector',
				'www.reuters.com': 'div.article-body__content__17Yit',
				// Add more sites and their respective selectors as needed
			};
			// Get the hostname from the URL
			const hostname = new URL(siteurl).hostname;

			// Find the appropriate selector
			let selector = siteSelectors[hostname];

			if (!selector) {
				// If no specific selector is found, try some common selectors
				const commonSelectors = ['article', 'main', '.article-content', '.post-content'];
				for (const commonSelector of commonSelectors) {
					if (doc.querySelector(commonSelector)) {
						selector = commonSelector;
						break;
					}
				}
			}

			if (!selector) {

				if (doc.body) {
				        selector = 'body';
				    } else {
						var cntnr = document.getElementById('dot-' + idx);
		
						if (cntnr != null) {
							var loading = cntnr.querySelector("#displayloadingcontainer");
							//console.log('no response from urlpreview ' + ' loadingdiv found ' + loading);
							if (loading != null) {
								loading.querySelector("h5").innerHTML = "Site data can not be read...";
								if (loading.querySelector(".loader") != null)
									loading.querySelector(".loader").classList.remove('loader');
							}
						}
				}
				//throw new Error('Unable to determine appropriate selector for this site');
			}

			// Find the main content of the article
			//console.log('Looking for selector ' + selector);
			const articleContent = doc.querySelector(selector);

			if (!articleContent) {
				removeloader(idx);
				console.log('Article content not found. Selector: ' + selector);
				return;
			} else {

				// Extract text from paragraphs within the article content
				const paragraphs = articleContent.querySelectorAll('p');

				let textContent = "";
				if (paragraphs) {
					textContent = Array.from(paragraphs)
						.map(p => p.textContent.trim())
						.filter(text => text.length > 0)
						.join('\n\n');
				} 
				
				if (!textContent || textContent.length === 0) {
				    const divs = articleContent.querySelectorAll('div');
				    if (divs && divs.length > 0) {
				        textContent = Array.from(divs)
				            .map(div => div.textContent.trim())
				            .filter(text => text.length > 0)
				            .join('\n\n');
				    }
				}

				//console.log('text extracted from site ' + textContent);

				var sitedetails = {};
				sitedetails.desc = textContent;
				sitedetails.domain = hostname;
				createurlpreviewdiv(sitedetails, idx);
			}
		} else {
			console.log('id ' + idx + ' ' + siteurl + ' sitelad worker ' + JSON.stringify(data));
			if (data != null && data.length > 0) {

				var sitedetails = JSON.parse(data);
				createurlpreviewdiv(sitedetails, idx);
			} else { // no preview content returned

				removeloader(idx);
			}
		}

	}

	worker.postMessage({
		//action: 'sitepreview',
		action: 'siteread',
		url: siteurl
	});
}

function createurlpreviewdiv(sitedetails, idx) {
	//console.log('creating url preview for id ' + idx);
	var cntnr = document.getElementById('dot-popup-' + idx);
	if (sitedetails != null && cntnr != null && cntnr.querySelector('.url-preview') == null) {

		//console.log(' will create preview with ' + JSON.stringify(sitedetails));


		var dv = document.createElement('div');
		dv.classList.add('row');
		//dv.style.border = '1px solid #cecece';
		dv.style.margin = '2px';
		dv.classList.add('url-preview');
		dv.style.overflowY = 'scroll';
		dv.style.boxSizing =  'border-box';
		dv.style.flex = '1 1 auto';

		var c1 = document.createElement('div');
		c1.classList.add('col-xs-12');

		var innerrow = document.createElement('div');
		innerrow.classList.add('row');

		c1.appendChild(innerrow);

		var cinner = document.createElement('div');
		cinner.classList.add('col-xs-12');
		innerrow.appendChild(cinner);

		//var cntnr = document.getElementById('dot-popup-'+idx);
		if (typeof sitedetails.image != 'undefined' && sitedetails.image != null && sitedetails.image.length > 0) {
			var im = document.createElement('img');

			im.src = sitedetails.image;
			im.style.maxWidth = '100%';
			//im.width = 100%;

			//alert(cntnr);
			if (cntnr != null) {
				//alert('adding url prev to popup');
				cntnr.parentNode.appendChild(im, cntnr.firstChild);
			}
			//cinner.appendChild(im);
		} else {
			if (typeof sitedetails.title != 'undefined' && sitedetails.title != null && sitedetails.title.length > 0) {
				cinner.classList.add('first-line-bold');
				cinner.appendChild(document.createTextNode(sitedetails.title));
			} else {
								
				var faviconUrl = "https://www.google.com/s2/favicons?sz=64&domain=" + sitedetails.domain;

				fetch(faviconUrl, { method: 'HEAD' })
				    .then(response => {
				        if (response.status === 200) {
				            var im = document.createElement('img');
				            im.src = faviconUrl;
				            im.style.maxWidth = '100%';
				            im.style.maxHeight = '50%';

				            if (cntnr != null) {
				                cntnr.parentNode.appendChild(im, cntnr.firstChild);
				            }
				        } else {
				            console.log('Favicon not found or inaccessible: ' + response.status);
				        }
				    })
				    .catch(error => {
				        console.log('Error fetching favicon: ', error);
				    });


			}
		}
		//console.log('sitedetails.image.length ' + sitedetails.image);
		var innerrow2 = document.createElement('div');
		innerrow2.classList.add('row');

		var cinner2 = document.createElement('div');
		cinner2.classList.add('col-xs-12');
		innerrow2.appendChild(cinner2);

		c1.appendChild(innerrow2);
		if (sitedetails.desc.length > 0) {
			cinner2.style.overflowY = 'auto';
			cinner2.appendChild(document.createTextNode(sitedetails.desc));
		}

		dv.appendChild(c1);

		//add some spacing
		let br = document.createElement('br');

		dv.appendChild(br);

		//alert(cntnr);
		if (cntnr != null) {

			var loading = cntnr.parentNode.querySelector('#displayloadingcontainer');
			console.log('loading div after url preview in createurlpreviewdiv' + loading);
			if (loading != null) {
				removediv(loading);
			}
			//alert('adding url prev to popup');
			cntnr.insertBefore(dv, cntnr.firstChild);
		}
	}
}

function mindthegaps(top, left, dotsize) {

	//var gaps = document.getElementsByClassName('dot-ui-gap');
	var quad = "";

	if (top < window.innerHeight / 2)
		quad += "N";
	else
		quad += "S";

	if (left < window.innerWidth / 2)
		quad += "W";
	else
		quad += "E";

	var gaps = document.querySelectorAll(".dot-ui-gap, .quad-" + quad);

	for (var i = 0; i < gaps.length; i++) {

		var gap = gaps[i].getBoundingClientRect();

		var gaptop = gap.top;
		var gapleft = gap.left;
		var gapbottom = gap.bottom;
		var gapw = gapbottom - gaptop;

		//console.log(top + ' ' + left + ' ' + dotsize + ' ' +gaptop + ' ' + gapleft + ' ' + gapw);	

		if (left < gapleft + gapw &&
			left + dotsize > gapleft &&
			top < gaptop + gapw &&
			dotsize + top > gaptop) {
			console.log('Collision detected');
			return true;
		}

	}
	return false;
}



function playall(e) {
	e.stopPropagation();

	e.target.onclick = null;
	e.target.src = '/static/icons/pause-120.png';
	e.target.onclick = function(e) {

		return stopplay(e);
	};

	var popups = document.getElementsByClassName('dot-popup');

	for (var i = 0; i < posts.length; i++) {
		//alert(JSON.stringify(postlocationmap[i]) + ' y '  + ' ' + postlocationmap[i].y);

		playtimeoutids[i] = setTimeout(function(idx) {
			return function() {

				//var percentx = postlocationmap[idx].x * 100 / parseInt(window.innerWidth);
				//var percenty = postlocationmap[idx].y * 100 / parseInt(window.innerHeight);

				var percentx = postlocationmap[idx].x; /// not really percent
				var percenty = postlocationmap[idx].y;

				if (posts[idx].data != null)
					showpostdatainpopup(posts[idx], idx, null, false, percentx, percenty, false);
				else
					retrievepostsummaryandshowinpopup(posts[idx], idx, null, false, percentx, percenty, false);

				playidx = idx;

				if (idx == posts.length - 1) {
					e.target.src = '/static/icons/play-64.png';
				}

			};
		}(i), 2000 * i);
	}

	return false;
}

function stopplay(e) {
	e.stopPropagation();

	e.target.onclick = null;
	e.target.src = '/static/icons/play-64.png';
	e.target.onclick = function(e) {
		return playall(e);
	};

	for (var i = playidx; i < playtimeoutids.length; i++) {
		//console.log('clearing timeout id ' + playtimeoutids[i]);
		clearTimeout(playtimeoutids[i]);
	}

	playtimeoutids = [];
	playidx = 0;
	return false;
}


function dragElement(elmnt) {
	elmnt.style.cursor = 'move';
	var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

	elmnt.onmousedown = dragMouseDown;
	elmnt.ontouchstart = dragMouseDown;

	function dragMouseDown(e) {

		if (clickstarttime == null)
			clickstarttime = new Date();

		if (window.innerWidth < 500) {
			pos3 = e.clientX;
			pos4 = e.clientY;

			document.ontouchend = closeDragElement;
			document.ontouchmove = elementDrag;
		} else {
			e = e || window.event;
			e.preventDefault();
			e.stopPropagation();
			// get the mouse cursor position at startup:
			pos3 = e.clientX;
			pos4 = e.clientY;

			document.onmouseup = closeDragElement;

			// call a function whenever the cursor moves:
			document.onmousemove = elementDrag;
		}

		return false;
	}

	function elementDrag(e) {

		if (window.innerWidth < 500) {
			// grab the location of touch
			var touchLocation = e.targetTouches[0];

			if (touchLocation.pageX >= window.innerWidth - 25 || touchLocation.pageX <= 25) {
				elmnt.classList.remove('expand-open');
				//elmnt.classList.add('expand-closed');

				removediv(elmnt);
			} else {

				// assign box new coordinates based on the touch.
				elmnt.style.left = touchLocation.pageX + 'px';
				elmnt.style.top = touchLocation.pageY + 'px';
			}


		} else {
			e = e || window.event;
			e.preventDefault();
			// calculate the new cursor position:
			pos1 = pos3 - e.clientX;
			pos2 = pos4 - e.clientY;
			pos3 = e.clientX;
			pos4 = e.clientY;
			// set the element's new position:
			elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
			elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";

		}
	}

	function closeDragElement(e) {
		// stop moving when mouse button is released:
		e.stopPropagation();
		e.stopImmediatePropagation();
		document.onmouseup = null;
		document.onmousemove = null;

		document.ontouchend = null;
		document.ontouchmove = null;

		elmnt.setAttribute('data-dragged', true);

		if (typeof e.target.id != 'undefined') {
			var idx = e.target.id.split('-')[2];

			console.log('will stop the close of ' + idx + ' ' + closepopuptimeoutmap[idx]);
			if (closepopuptimeoutmap[idx] != null) {
				clearTimeout(closepopuptimeoutmap[idx]);
			}
		}

		return false;
		// alert('dragged attrib set on element ' + elmnt.dataset.dragged);
	}
}

function posttotopicmodal(event) {
	event.stopPropagation();

	//alert(topicmaxdepth +  ' ' + topiccurrentdepth);

	if (splitschemas != null && splitschemas.length > 0) { // means this is a JSON content topic
		document.getElementById('topic-post-data-input-holder').innerHTML = '';

		if (splitschemas.length > 1) {
			document.getElementById('create-sub-topic-select').style.visibility = 'hidden';

			let last = (topiccurrentdepth == splitschemas.length - 1);
			//console.log('is last  '+ last);
			document.getElementById('topic-post-data-input-holder').appendChild(generateformbasedonschema(
				splitschemas[topiccurrentdepth], last
			));
		} else
			document.getElementById('topic-post-data-input-holder').appendChild(generateformbasedonschema(splitschemas[0], true));
	} else {

		if (topiccurrentdepth >= topicmaxdepth) {
			document.getElementById('create-sub-topic-select').style.visibility = 'hidden';
		} else {
			document.getElementById('create-sub-topic-select').style.visibility = 'visible';
		}
	}
	$('#topic-post-modal').modal('show');
	return false;
}

function generateformbasedonschema(schemaobj, islast) {

	let container = document.createElement('div');
	container.className = "col-xs-12";

	let counter = 0;

	const inputtags = document.createElement("input");
	inputtags.type = "hidden";
	inputtags.id = 'post-tags-input';
	container.appendChild(inputtags);

	for (const key in schemaobj) {
		if (schemaobj.hasOwnProperty(key)) {
			// Create an input field for each key
			const rowDiv = document.createElement("div");
			rowDiv.className = "row"; // Add Bootstrap row class
			const colDiv = document.createElement("div");
			colDiv.className = "col-xs-12";

			const input = document.createElement("input");
			input.type = "text"; // You can adjust the input type based on your requirements
			input.name = key;

			if (counter > 0)
				input.id = 'post-json-data-' + key;
			else {
				input.id = 'post-text-input-2';
			}
			input.placeholder = key; // Use the key as the placeholder text

			if (schemaobj[key].type == 'numeric') {
				input.addEventListener('input', function(event, stype) {

					return function(event) {
						if (stype == 'numeric')
							var inputValue = event.target.value;

						// Check if the input is a valid number
						if (!isNaN(inputValue)) {
							// Valid number: Set normal border color
							event.target.style.borderColor = 'lightgray'; // or any other desired color
						} else {
							// Not a valid number: Set red border color
							event.target.style.borderColor = 'red';
						}
					}

				}(event, schemaobj[key].type));
			}
			// Append the input field to the form

			colDiv.appendChild(input);
			rowDiv.appendChild(colDiv);

			container.appendChild(rowDiv);

			container.appendChild(document.createElement("br"));
			//console.log('added field ' + key + ' ' + schemaobj[key].type);

			counter++;
		}
	}

	const createbtn = document.createElement("button");

	createbtn.id = 'subtopicbtn-2';
	createbtn.classList.add("btn");
	createbtn.classList.add("btn-primary");
	createbtn.classList.add("btn-sm");


	if (typeof islast == 'undefined' || islast == false) {
		//alert('creating button subtopic islast ' + islast);
		createbtn.addEventListener('click', function(evt) {
			let substopic = document.getElementById('post-text-input-2').value;
			//alert('substopic ' + substopic);	 
			createsubtopic(substopic);
		});
	} else {
		//alert('creating button topic islast ' + islast);
		createbtn.addEventListener('click', function(evt) {
			let posttext = collectjsoninput();
			//alert('substopic ' + substopic);	 
			postcontentdirecttotopic(JSON.stringify(posttext));
		});

	}
	createbtn.textContent = 'Create';
	container.appendChild(createbtn);

	return container;
}

function collectjsoninput() {
	const dataObject = {};

	// Get all input fields whose IDs match the pattern
	const inputFields = document.querySelectorAll('[id^="post-json-data-"]');

	//alert('inputFields ' + inputFields.length);

	let firsttextinput = document.getElementById('post-text-input-2');

	if (firsttextinput == null)
		firsttextinput = document.getElementById('post-text-input');

	//if (inputFields != null && inputFields.length > 0) {
	//	dataObject[inputField.id.replace('post-json-data-', '')] = firsttextinput.value;
	//	dataObject['text'] = firsttextinput.value;
	///} else {
	dataObject['text'] = firsttextinput.value;
	//}

	// Loop through each input field
	inputFields.forEach((inputField) => {
		// Extract the key from the input field's ID
		const key = inputField.id.replace('post-json-data-', '');

		// Store the value in the data object
		dataObject[key] = inputField.value;
	});

	// Convert the object to a JSON string
	const jsonData = JSON.stringify(dataObject);

	// Now you have a JSON string with text keys and corresponding values
	console.log('jsonData ' + jsonData);
	return jsonData;
}

function posttoflakemodal(event) {
	event.stopPropagation();
	$('#flake-post-modal').modal('show');
	return false;
}

function savecontentlocally(t, dataobj) {
	if (typeof Storage !== "undefined") {

		if (localStorage.getItem("CONTENT::" + t) === null)
			localStorage.setItem("CONTENT::" + t, JSON.stringify({ "items": [] }));

		if (dataobj != null) {
			const storedData = JSON.parse(localStorage.getItem("CONTENT::" + t));
			storedData.items.push(dataobj);
			localStorage.setItem("CONTENT::" + t, JSON.stringify(storedData));
		}

		console.log('Topic data updated for ' + t);
	} else {
		console.warn("Local storage not supported");
	}

}

function removecontentlocally(t, crtime) {

	if (typeof Storage !== "undefined") {

		if (localStorage.getItem("CONTENT::" + t) === null)
			return;
		else {
			if (typeof crtime != 'undefined' && crtime > 0) {
				var storeddata = JSON.parse(localStorage.getItem("CONTENT::" + t));
				var posts = storeddata.items;
				const index = posts.findIndex(item => item.crTime === crtime);
				if (index !== -1) {
					posts.splice(index, 1);
				}

				storeddata.items = posts;
				localStorage.setItem("CONTENT::" + t, JSON.stringify(storeddata));
			}

			console.log('Topic data removed for crtime ' + crtime);
		}
	} else {
		console.warn("Local storage not supported");
	}

}

function postcontentdirecttotopic(posttext, inputtags) {
	//alert(' in postcontentdirecttotopic ' + posttext);
	if (document.getElementById('topic-post-status') != null) document.getElementById('topic-post-status').innerHTML = '';

	if (document.getElementById('topic-post-button') != null) document.getElementById('topic-post-button').disabled = true;

	if (postcontenthome == null) {
		postcontenthome = {};
		postcontenthome.files = [];
	}

	var textcontent = '';
	if (document.getElementById('post-text-input') != null &&
		document.getElementById('post-text-input').value != null &&
		document.getElementById('post-text-input').value.length > 0)
		textcontent = document.getElementById('post-text-input').value;
	else
		textcontent = posttext;

	//console.log(' in postcontentdirecttotopic textcontent ' + document.getElementById('post-text-input').value);
	var tags = '';

	if (document.getElementById('post-tags-input') != null && document.getElementById('post-tags-input').value.length > 0)
		tags = document.getElementById('post-tags-input').value;
	else
		tags = inputtags;


	var summ = null;

	if (document.getElementById('sub-topic-desc-text-input') != null) {
		summ = document.getElementById('sub-topic-desc-text-input').value;
	}
	//alert('tags read  from post-tags-input ' + tags);

	if (tags == null || tags.length == 0)
		tags = '[]';

	//alert('tags ' + tags);
	//alert('content ' + textcontent);

	//return false;

	//alert(JSON.stringify(postcontenthome));
	//alert(postcontenthome.text.length + ' ' + postcontenthome.files.length);


	if (topicstorage != null && topicstorage.indexOf('client') >= 0) { // SAVE locally
		let topicdata = collectjsoninput();
		//alert('topicdata' + topicdata);


		let newpost = {
			"topic": topicname,
			"text": textcontent,
			"data": JSON.parse(topicdata),
			"tags": JSON.parse(tags),
			"summary": summ,
			"expires": document.getElementById("postexpirysettingsselect").value
		};

		var bitArray;

		//console.log('Generating hash for ' + JSON.stringify(newpost) + ' ' + JSON.stringify(newpost).length);

		if (newpost.length > 1000) {
			bitArray = sjcl.hash.sha256.hash(JSON.stringify(newpost).substring(0, 1000));
		} else {
			bitArray = sjcl.hash.sha256.hash(JSON.stringify(newpost));
		}
		var digest_sha256 = sjcl.codec.hex.fromBits(bitArray);

		//console.log('digest_sha256 ' + digest_sha256);

		var hashasnum = parseInt(digest_sha256.substring(digest_sha256.length - 12, digest_sha256.length), 16);

		var location = hashasnum.toString().substring(0, 4) + ',' + hashasnum.toString().substring(4, 8) + ',' + hashasnum.toString().substring(8, 12);

		newpost = {
			"topic": topicname,
			"text": textcontent,
			"crTime": Date.now(),
			"data": JSON.parse(topicdata),
			"tags": JSON.parse(tags),
			"datahash": digest_sha256,
			"summary": summ,
			"location": location,
			"expires": document.getElementById("postexpirysettingsselect").value
		};

		savecontentlocally(topicname, newpost);
		if (posts == null)
			posts = [];
		$('#topic-post-modal').modal('hide');
		if (document.getElementById('topic-post-button') != null) document.getElementById('topic-post-button').disabled = false;

		let asarr = JSON.parse('[' + JSON.stringify(newpost) + ']');
		//displaypostsasdots(asarr, true);   // justadded true
		loadsubtopic(topicname, null);

	} else {

		postcontenthome.text = textcontent;

		console.log('postcontenthome.text ' + postcontenthome.text);

		if (postcontenthome.text.length == 0 && (!postcontenthome.files || postcontenthome.files.length == 0)) {
			console.log('nothing to post');
			document.getElementById('topic-post-status').appendChild(document.createTextNode('Nothing to post.'));
			return false;
		}

		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");

		xhr.onreadystatechange = function() {
			console.log('xhr.readyState xhr.status' + xhr.readyState + ' ' + xhr.status);
			if (xhr.readyState == 4) {

				if (xhr.status == 200) {
					//alert('Post added ' + xhr.responseText);
					var newpost = JSON.parse('[' + xhr.responseText + ']');
					document.getElementById('topic-post-status').innerHTML = 'Post successful';

					setTimeout(function() {
						if (posts == null)
							posts = [];
						$('#topic-post-modal').modal('hide');
						if (document.getElementById('topic-post-button') != null) document.getElementById('topic-post-button').disabled = false;
						if (document.getElementById('post-tags-input') != null) document.getElementById('post-tags-input').value = '';
						if (document.getElementById('post-text-input') != null) document.getElementById('post-text-input').value = '';

						if (document.getElementById('sub-topic-text-input') != null)
							document.getElementById('sub-topic-text-input').value = '';
						if (document.getElementById('sub-topic-desc-text-input') != null)
							document.getElementById('sub-topic-desc-text-input').value = '';

						newpost[0].crtime = newpost[0].crTime; // naming mismatch

						console.log('crtime before displaying new post ' + newpost[0].crtime);
						displaypostsasdots(newpost, true);   // justadded true
					}, 400);
				} else {
					document.getElementById('topic-post-status').innerHTML = 'Post failed. Please try again later.';
				}
			}
		}

		xhr.open('POST', '/newauth/api/postcontenttotopic', false);
		xhr.withCredentials = true;
		// xhr.setRequestHeader('Content-Type', 'application/json');    we want to send contenttype undefined  

		var pkt = JSON.stringify({
			"text": postcontenthome.text,
			"files": postcontenthome.files,
			"closelooptopic": (topictype == 'closelooptopic')
		});

		var bitArray;

		if (pkt.length > 1000) {
			bitArray = sjcl.hash.sha256.hash(pkt.substring(0, 1000));
		} else {
			bitArray = sjcl.hash.sha256.hash(pkt);
		}
		var digest_sha256 = sjcl.codec.hex.fromBits(bitArray);

		var hashasnum = parseInt(digest_sha256.substring(digest_sha256.length - 12, digest_sha256.length), 16);

		var location = hashasnum.toString().substring(0, 4) + ',' + hashasnum.toString().substring(4, 8) + ',' + hashasnum.toString().substring(8, 12);

		var filestosend = [];
		var formData = new FormData();

		for (var f = 0; f < postcontenthome.files.length; f++) {
			//filestosend.push(document.getElementById('attachedfiles').files[f]);
			formData.append("attachments", fileattachments[f]);
			postcontenthome.files[f].content = null;
		}

		//alert('files being sent ' +  fileattachments.length);

		formData.append('postdata', new Blob([JSON.stringify({
			"topic": topicname,
			"text": postcontenthome.text,
			"files": postcontenthome.files,
			"crTime": Date.now(),
			"expires": document.getElementById("postexpirysettingsselect").value,
			"closelooptopic": (topictype == 'closelooptopic'),
			"datahash": digest_sha256,
			"location": location,
			"tags": JSON.parse(tags),
			"summary": summ,
			"giveout": ""
		})], {
			type: "application/json"
		}));

		//alert(tags);

		xhr.send(formData);
	}

}

function createsubtopic(inputsubtopic) {

	var subtopic = '';

	if (document.getElementById('sub-topic-text-input') != null && document.getElementById('sub-topic-text-input').value.length > 0)
		subtopic = document.getElementById('sub-topic-text-input').value;
	else
		subtopic = inputsubtopic;

	var subtopicdesc = '';

	if (document.getElementById('sub-topic-desc-text-input') != null && document.getElementById('sub-topic-desc-text-input').length > 0)
		subtopicdesc = document.getElementById('sub-topic-desc-text-input').value;

	//alert('subtopic desc ' + subtopic + ' ' + subtopicdesc);
	if (subtopic.length > 3) {

		var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");

		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4) {
				if (xhr.status == 200) {
					if (xhr.responseText) {
						var resp = xhr.responseText;

						if (resp != null && resp.length > 0) {
							$('#topic-post-modal').modal('hide');
							//document.getElementById('subtopicbtn').disabled = false;
							enabledisableelemswithid('subtopicbtn', false)
							//post this folder/subtopic as a dot also

							//document.getElementById('post-text-input').value = subtopic;
							//document.getElementById('post-tags-input').value = JSON.stringify(['folder']);

							postcontentdirecttotopic(subtopic, JSON.stringify(['folder']));
						}
					}
				} else {
					document.getElementById('sub-topic-status').innerText = xhr.responseText;
					//document.getElementById('subtopicbtn').disabled = false;
					enabledisableelemswithid('subtopicbtn', false);
					document.getElementById('post-text-input').value = '';
					document.getElementById('post-tags-input').value = '';
					document.getElementById('sub-topic-text-input').style.border = '1px solid red';
				}
			}
		}

		xhr.open('POST', '/newauth/api/createtopic', true);
		xhr.withCredentials = true;
		xhr.setRequestHeader('Content-Type', 'application/json');

		var reqpacket = JSON.stringify({
			topic: topicname + '/' + subtopic,
			crTime: Date.now(),
			display: subtopicdesc

		});

		//alert(reqpacket);
		if (topicstorage != null && topicstorage.indexOf('client') >= 0) { // SAVE locally
			let topicdata = collectjsoninput();
			savecontentlocally(topicname + '/' + subtopic, null);

			postcontentdirecttotopic(subtopic, JSON.stringify(['folder']));

			if (document.getElementById('sub-topic-text-input') != null)
				document.getElementById('sub-topic-text-input').value = '';
			if (document.getElementById('sub-topic-desc-text-input') != null)
				document.getElementById('sub-topic-desc-text-input').value = '';

		} else {
			xhr.send(reqpacket);
			enabledisableelemswithid('subtopicbtn', true);
		}
		//document.getElementById('subtopicbtn').disabled = true;


	} else {
		document.getElementById('sub-topic-text-input').style.border = '1px solid red';
		document.getElementById('sub-topic-text-input').value = '';

		setTimeout(function() {
			document.getElementById('sub-topic-text-input').style.border = 'none';
		}, 2000);
	}
}

function enabledisableelemswithid(idval, action) {
	const elements = document.querySelectorAll('[id^="' + idval + '"]');

	elements.forEach(element => {
		element.disabled = action;
	});
}

function postcontentdirecttoflake(flake) {

	document.getElementById('flake-post-status').innerHTML = '';
	if (postcontenthome == null) {
		postcontenthome = {};
		postcontenthome.files = [];
	}

	var textcontent = document.getElementById('post-text-input').value;
	postcontenthome.text = textcontent;

	if (postcontenthome.text.length == 0 && (!postcontenthome.files || postcontenthome.files.length == 0)) {
		console.log('nothing to post');
		document.getElementById('flake-post-status').appendChild(document.createTextNode('Nothing to post.'));
		return false;
	}

	//alert(JSON.stringify(postcontenthome));
	//alert(postcontenthome.text.length + ' ' + postcontenthome.files.length);

	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {
			//alert('Post added ' + xhr.responseText);
			var newpost = JSON.parse('[' + xhr.responseText + ']');

			$('#flake-post-modal').modal('hide');
			setTimeout(function() {
				if (posts == null)
					posts = [];
				displaypostsasdots(newpost, true);   // justadded true
			}, 400);
		}

		if (xhr.readyState == 4 && xhr.status == 400) {

		}
	}

	xhr.open('POST', '/newauth/api/postcontenttoflake', false);
	xhr.withCredentials = true;
	xhr.setRequestHeader('Content-Type', 'application/json');

	var pkt = JSON.stringify({
		"text": postcontenthome.text,
		"files": postcontenthome.files
	});

	var bitArray;

	if (pkt.length > 1000) {
		bitArray = sjcl.hash.sha256.hash(pkt.substring(0, 1000));
	} else {
		bitArray = sjcl.hash.sha256.hash(pkt);
	}
	var digest_sha256 = sjcl.codec.hex.fromBits(bitArray);

	var hashasnum = parseInt(digest_sha256.substring(digest_sha256.length - 12, digest_sha256.length), 16);

	var location = hashasnum.toString().substring(0, 4) + ',' + hashasnum.toString().substring(4, 8) + ',' + hashasnum.toString().substring(8, 12);

	//alert('sending flake ' + flake);
	xhr.send(JSON.stringify({
		"flake": flake,
		"text": postcontenthome.text,
		"files": postcontenthome.files,
		"datahash": digest_sha256,
		"location": location,
		"giveout": ""
	}));


}

function getfullpost(topic, crtime, seq, textdata, flake, convid, exturl) {
	//displayloadingicon();
	//alert('getfullpost called');
	//console.log('loading icon should be visible');
	var xhr = new XMLHttpRequest();

	var postdiv = document.getElementById('post-seq-' + seq);
	var tags = null;

	if (postdiv != null) {
		var tagsdiv = postdiv.querySelector('div[name="post-tags"]');

		if (tagsdiv != null) {
			tags = tagsdiv.innerText;

			//alert('tags found for posts ' + tags);
		}
	}

	seq = seq + "";
	if (seq.indexOf('-') >= 0)
		seq = seq.split('-')[0];

	var url = '';
	//alert('flake passed ' + flake);
	if (seq == 0 || flake == null) {
		url = '/newauth/api/getfullpostbytopicandtime/' + topic + '/' + crtime;
		seq = -1;
	} else {
		url = '/newauth/api/getpostfullimage/' + flake + '/' + seq;
	}

	if (typeof exturl != 'undefined' && exturl.length > 0)
		url = exturl;
	//alert('in getfullpost seq ' + seq + ' flake ' + flake);
	xhr.open('GET', url, false);
	xhr.setRequestHeader('Content-Type', 'application/json');

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {

			var res = xhr.responseText;
			if (res != null && res.length > 0) {
				//alert(res);
				// console.log('got data..' +  res);

				addposttoalreadyseen(crtime);
				loadfulluserpost(JSON.parse(res), textdata, tags, convid, flake, seq);

			}
		}
	}

	xhr.send(null);
}

function increasesiteusage(site) {
	if (site == null || site.length == 0)
		return;

	if (typeof (Storage) !== "undefined") {
		var existingviews = localStorage.getItem("SITEUSAGE");
		var existingviewsobj;
		//alert(existingviews);
		//alert('topicname ' + topicname);
		if (existingviews == 'undefined' || existingviews == null || existingviews == 'null' || existingviews.length == 0) {
			existingviewsobj = {};
			existingviewsobj[site] = 1;
		} else {
			existingviewsobj = JSON.parse(existingviews);

			if (!existingviewsobj[site]) {
				existingviewsobj[site] = 1;
			} else {
				existingviewsobj[site] += 1;
			}
		}

		console.log('site ' + site + ' added to usage');
		console.log('Setting SITEUSAGE in local storage');
		localStorage.setItem("SITEUSAGE", JSON.stringify(existingviewsobj));
	} else {
		// Sorry! No Web Storage support..
	}
}

function getsiteusage(site) {
	if (site == null || site.length == 0)
		return 0;

	if (typeof (Storage) !== "undefined") {
		var existingviews = localStorage.getItem("SITEUSAGE");
		var existingviewsobj;
		//alert(existingviews);
		//alert('topicname ' + topicname);
		if (existingviews == 'undefined' || existingviews == null || existingviews == 'null' || existingviews.length == 0) {

		} else {
			existingviewsobj = JSON.parse(existingviews);

			if (!existingviewsobj[site]) {

			} else {
				return existingviewsobj[site];
			}
		}

		//console.log('site ' + site + ' usage returned');

	} else {
		// Sorry! No Web Storage support..
	}
}

function addposttoalreadyseen(crtime) {
	if (crtime == null || crtime.length == 0)
		return;

	if (typeof (Storage) !== "undefined") {
		var existingviews = localStorage.getItem("TOPICVIEWS");
		var existingviewsobj;
		//alert(existingviews);
		//alert('topicname ' + topicname);
		if (existingviews == 'undefined' || existingviews == null || existingviews == 'null' || existingviews.length == 0) {
			existingviewsobj = {};
			existingviewsobj[topicname] = [];
			existingviewsobj[topicname].push(crtime);
		} else {
			existingviewsobj = JSON.parse(existingviews);

			if (!existingviewsobj[topicname]) {
				existingviewsobj[topicname] = [];
			}

			if (!existingviewsobj[topicname].includes(crtime)) {
				//alert(crtime +  ' added');

				existingviewsobj[topicname].push(crtime);
			} else {
				//alert(crtime + ' already exists');                			
			}
		}

		console.log('post ' + crtime + ' added to already seen');
		console.log('Setting TOPICVIEWS in local storage');
		localStorage.setItem("TOPICVIEWS", JSON.stringify(existingviewsobj));
	} else {
		// Sorry! No Web Storage support..
	}
}

function addposttodeleted(crtime) {

	if (crtime == null || crtime.length == 0)
		return;

	if (typeof (Storage) !== "undefined") {
		var existingviews = localStorage.getItem("TOPICDELETES");
		var existingviewsobj;
		//alert(existingviews);
		if (existingviews == 'undefined' || existingviews == null || existingviews == 'null' || existingviews.length == 0) {
			existingviewsobj = {};
			existingviewsobj[topicname] = [];
			existingviewsobj[topicname].push(crtime);
		} else {
			existingviewsobj = JSON.parse(existingviews);

			if (!existingviewsobj[topicname]) {
				existingviewsobj[topicname] = [];
			}

			if (!existingviewsobj[topicname].includes(crtime)) {
				//alert(crtime +  ' added');

				existingviewsobj[topicname].push(crtime);
			} else {
				//alert(crtime + ' already exists');                			
			}
		}

		console.log('post ' + crtime + ' added to deleted');
		console.log('Setting TOPICDELETES in local storage');
		localStorage.setItem("TOPICDELETES", JSON.stringify(existingviewsobj));

		if (isowner) {
			console.log('isowner ' + isowner + ' removing post from database also');
			removepostfromtopic(topicname, crtime);
		}

		if (topicstorage != null && topicstorage.indexOf('client') >= 0) {
			console.log('removing post locally');
			removecontentlocally(topicname, crtime);
		}
	} else {
		// Sorry! No Web Storage support..
	}
}

function addposttosaved(evt, dot, crtime) {
	if (crtime == null || crtime.length == 0)
		return;

	var xhr = new XMLHttpRequest();

	var url = '/newauth/api/savepost/' + topicname + '/' + crtime;

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {

			dot.style.transform = "translate3d(0px, 0px, 0)";

			displaybuttonbehavior(evt, "Saved");
		}

	}

	xhr.open('GET', url, true);
	xhr.withCredentials = true;
	xhr.setRequestHeader('Content-Type', 'application/json');

	xhr.send(null);
}

function removepostfromalreadyseen(crtime) {
	if (crtime == null || crtime.length == 0)
		return;

	if (typeof (Storage) !== "undefined") {
		var existingviews = localStorage.getItem("TOPICVIEWS");
		var existingviewsobj;

		if (existingviews != null && existingviews != 'null' && existingviews.length > 0) {
			existingviewsobj = JSON.parse(existingviews);

			if (existingviewsobj[topicname] && existingviewsobj.includes(crtime)) {

				existingviewsobj[topicname] = existingviewsobj[topicname].splice(existingviewsobj.indexOf(crtime), 1);
				//alert(inpostwcomment.crTime +  ' removed from localstorage');

				localStorage.setItem("TOPICVIEWS", JSON.stringify(existingviewsobj));
				console.log('post ' + crtime + ' removed from already seen');
			}

		}

	} else {
		// Sorry! No Web Storage support..
	}

}

function removepostfromtopic(topicname, crtime) {

	if (crtime == null || crtime.length == 0)
		return;

	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/newauth/api/removepostfromtopic', false);
	xhr.setRequestHeader('Content-Type', 'application/json');

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {
			// post has been removed
		}
	}

	var reqpacket = JSON.stringify({
		topic: topicname,
		crTime: crtime
	});


	xhr.send(reqpacket);

	alert('removing this post ' + reqpacket);
	if (topicstorage != null && topicstorage.indexOf('client') >= 0) { // remove locally also		
		removecontentlocally(topicname, crtime);
	}
}

function checkifalreadyseen(crtime) {
	var seen = false;

	if (crtime == null || crtime.length == 0)
		return seen;

	if (typeof (Storage) !== "undefined") {
		var existingviews = localStorage.getItem("TOPICVIEWS");
		var existingviewsobj;

		if (existingviews != "undefined" &&
			existingviews != null &&
			existingviews != 'null' &&
			existingviews.length > 0) {
			//alert(existingviews);
			existingviewsobj = JSON.parse(existingviews);

			if (existingviewsobj[topicname] && existingviewsobj[topicname].includes(crtime)) {
				seen = true;
			}
		}
	}
	return seen;
}

function checkifdeleted(crtime) {
	var seen = false;

	if (crtime == null || crtime.length == 0)
		return seen;

	if (typeof (Storage) !== "undefined") {
		var existingviews = localStorage.getItem("TOPICDELETES");
		var existingviewsobj;

		if (existingviews != "undefined" &&
			existingviews != null &&
			existingviews != 'null' &&
			existingviews.length > 0) {
			//alert(existingviews);
			existingviewsobj = JSON.parse(existingviews);

			if (existingviewsobj[topicname] && existingviewsobj[topicname].includes(crtime)) {
				seen = true;
			}
		}
	}
	return seen;
}

function attachedfilechangeeventhandlerfortopic() {

	var fileselem = 'attachedfiles';

	if (window.innerWidth < 500 || window.innerHeight < 500)
		fileselem = 'attachedfilesxs';

	var inputfiles = document.getElementById(fileselem);

	if (inputfiles != null) {
		//alert('files-input found');
		if (debugappui) console.log('attaching eventlistener for change on attachedfiles');
		inputfiles.addEventListener('change',
			function(event) {
				displaypreviewfortopic(event);
				if (debugappui) console.log('changed again');
			},

			false);
	}

}


function displaypreviewfortopic(evt, _callback) {
	var files = evt.target.files; // FileList object
	var progressid = 'fileprogress';

	if (window.innerWidth < 500 || window.innerHeight < 500)
		progressid = 'fileprogressxs';

	document.getElementById(progressid).style.display = 'block';
	if (postcontenthome == null) {
		postcontenthome = {};
		postcontenthome.files = [];
	}
	// files is a FileList of File objects. List some properties.
	if (!postcontenthome.files)
		postcontenthome.files = [];

	var imgcount = 0;
	if (debugappui) console.log('onchange event fired for attachedfiles');
	for (var i = 0; i < files.length; i++) {
		fileattachments.push(files[i]);
		var reader = new FileReader();

		reader.onloadstart = () => document.getElementById('contentpostbtn').disabled = true;
		reader.onloadend = () => {

			document.getElementById('contentpostbtn').disabled = false;
		}

		reader.onload = (function(file) {

			return function(evt) {
				document.getElementById(progressid).value = 100;
				processloadedattachedfilefortopic(evt, file);
			};

		})(files[i]);

		reader.onprogress = (function(file) {
			return function(evt) {
				// var fr = evt.target;
				var loadingPercentage = 100 * evt.loaded / evt.total;

				document.getElementById(progressid).value = loadingPercentage;
			};

		})(files[i]);

		reader.readAsDataURL(files[i]);

	}

	if (_callback)
		_callback(evt.target.imgcount, postcontenthome.files);

}

function displayallpostdescription(event, close) {


	event.stopPropagation();
	//event.preventDefault();
	//console.log(' close ' + close)
	for (var i = 0; i < posts.length; i++) {
		showpostdescription(event, i, close);
	}
	return false;
}

function showpostdescription(event, idx, close) {
	var cleardescfn = function(event) {
		displayallpostdescription(event, true);
	};

	var showdescfn = function(event) {
		displayallpostdescription(event);
	};
	//console.log(idx  + ' of ' + posts.length);
	var existingdesc = document.getElementById("dot-desc-" + idx);
	//console.log('existingdesc '+ existingdesc + ' close ' + close);
	if (existingdesc != null || (typeof close != 'undefined' && close == true)) {
		if (existingdesc != null) {
			existingdesc.style.opacity = "0.3";
			removediv(existingdesc);
			if (event != null) {
				event.target.onclick = null;
				event.target.onclick = showdescfn;
			}
		}
	} else {

		if ((typeof close == 'undefined' || close == false) || existingdesc == null) {
			var dotforpost = document.getElementById("dot-" + idx);
			//alert(dotforpost.style.top + ' ' + dotforpost.style.left);
			if (dotforpost != null) {
				if (event != null) {
					event.target.onclick = null;
					event.target.onclick = cleardescfn;
				}
				var desc = document.createElement('div');
				desc.style.textAlign = 'center';
				desc.style.borderRadius = '4px';
				desc.style.display = 'flex';
				desc.style.alignItems = 'center';
				desc.style.justifyContent = 'center';

				let tagstr = '';

				//console.log('description tags for post id ' + idx + ' ' + posts[idx].tags);
				//console.log('data for post id ' + idx + ' ' + JSON.stringify(posts[idx]));

				if (typeof posts[idx].tags != 'undefined' && posts[idx].tags != null) {

					//console.log(posts[idx].tags.length + ' tags are there for post id ' + idx );
					for (var t = 0; t < posts[idx].tags.length; t++) {
						//console.log(t + ' tag  for post id ' + idx  + ' ' + posts[idx].tags[t]);
						if (posts[idx].tags[t].indexOf('flake:') < 0 &&
							posts[idx].tags[t].indexOf('ip:') < 0 &&
							posts[idx].tags[t].indexOf('name:') < 0 &&
							posts[idx].tags[t].indexOf('folder') < 0 &&
							posts[idx].tags[t].indexOf('jwt:') < 0) {
							tagstr += posts[idx].tags[t];

							if (tagstr.length > 0 && t < posts[idx].tags.length - 1)
								tagstr += ' ';
						}

						//console.log('tagstr so far ' + t + ' ' + tagstr);				

					}
				} else {
					if (posts[idx].data != null)
						tagstr = posts[idx].data.text;
					else
						tagstr = posts[idx].text;
				}

				if (tagstr.length == 0 && typeof posts[idx].summary != 'undefined' && posts[idx].summary != null) {
					if (!isBase64JSON(posts[idx].summary)) {
						tagstr = posts[idx].summary;
					}
				}
				//desc.appendChild(document.createTextNode(idx + ":" + posts[idx].hit + ' ' + tagstr));
				//console.log('tagstr for post id ' + idx + ' ' + tagstr);

				var txt = document.createElement('p');
				txt.style.fontSize = '1.4em';
				txt.appendChild(document.createTextNode(tagstr));

				desc.appendChild(txt);
				desc.setAttribute('id', 'dot-desc-' + idx);
				desc.classList.add('dot-desc');

				desc.style.backgroundColor = '#989898'; //dotforpost.style.backgroundColor;
				desc.style.position = 'absolute';
				desc.style.pointerEvents = 'none';

				var clickx = parseFloat(dotforpost.style.left.split('%')[0]);

				if ((clickx * parseInt(window.innerWidth) / 100) < parseInt(window.innerWidth) - 100)
					desc.style.left = '5px';
				else
					desc.style.right = '5px';

				//if (idx<2) console.log(topinpx);
				//desc.style.top = parseInt(topinpx) + 4 + 'px' ;

				desc.style.top = window.scrollY + dotforpost.getBoundingClientRect().top + parseInt(dotforpost.style.height) + 'px';;
				desc.style.maxWidth = parseInt(dotforpost.style.width) * 3 + 'px';
				desc.style.lineHeight = '1.8em';
				desc.style.height = 'auto';
				desc.style.whiteSpace = 'normal';
				desc.style.maxHeight = '3.6em'; // Allows for up to 2 lines (2em line-height * 3)

				desc.style.overflow = 'hidden';
				desc.style.left = window.scrollX + dotforpost.getBoundingClientRect().left - 10 + 'px';
				//desc.style.opacity = '0.3';
				desc.style.color = 'white';
				desc.style.paddingLeft = '2px';
				desc.style.zIndex = 10;


				document.body.appendChild(desc);

				attachtransitionstyles(desc, 1);
				//desc.style.opacity = "0.9 !important";
				desc.style.setProperty("opacity", 0.9, "important");
			}
		}
	}

}

function showpostcomment(inpostwcomment, close) {

	//console.log('createt time of commented post ' + inpostwcomment.crTime);
	if (inpostwcomment.crTime != null &&
		inpostwcomment.crTime != 0 &&
		inpostwcomment.newcomment.length > 0) {

		removepostfromalreadyseen(inpostwcomment.crTime);

		if (document.getElementById('conv-data-' + inpostwcomment.convid) != null) {

			if (window.innerWidth < 600 || window.innerHeight < 600) {
				var dv = document.getElementById('conv-data-' + inpostwcomment.convid);

				document.getElementById('post-comments-mobile').appendChild(dv);
			}
			addconversationmessagetopanel(document.getElementById('conv-data-' + inpostwcomment.convid),
				inpostwcomment.newcomment,
				0,
				inpostwcomment.crTime,
				inpostwcomment.giveout,
				false);

			return;
		}

		var idx = -2;

		var existcomm = document.getElementsByClassName('dot-cmt');

		if (existcomm != null) {
			for (var c = 0; c < existcomm.length; c++) {
				removediv(existcomm[c]);
			}
		}

		if (inpostwcomment.crTime != null)
			idx = crtimetoidxmap[inpostwcomment.crTime];

		var dotforpost = document.getElementById("dot-" + idx);
		//alert(dotforpost.style.top + ' ' + dotforpost.style.left);		

		if (posts[idx].datahash != null) {
			var hashasnum = "000000000000000000000000000000000000000000000";
			hashasnum = parseInt(posts[idx].datahash.substring(posts[idx].datahash.length - 12, posts[idx].datahash.length), 16);
			dotforpost.style.backgroundColor = '#' + hashasnum.toString().substring(0, 6); //b3b3b3';
		}

		var cmtholder = document.createElement('div');
		cmtholder.classList.add('marquee');
		cmtholder.setAttribute('id', 'dot-cmt-' + idx);
		cmtholder.classList.add('dot-cmt');
		cmtholder.style.backgroundColor = '#efefef';
		cmtholder.style.position = 'absolute';
		cmtholder.style.boxShadow = '2px 3px 2px #afafaf';
		cmtholder.style.borderTop = '1px solid #afafaf';
		cmtholder.style.paddingTop = '2px';

		var dotelem = document.getElementById('dot-' + idx);
		var topinpx = dotelem.style.width;

		if (dotelem.style.opacity < 0.9) {
			dotelem.style.opacity = 0.9;
		}

		//if (idx<2) console.log(topinpx);
		//cmtholder.style.top = topinpx*0.5+ 'px';
		cmtholder.style.bottom = '2px';
		cmtholder.style.width = '240px';
		cmtholder.style.left = '50%';
		cmtholder.style.transform = 'translateX(-50%)';
		cmtholder.style.lineHeight = '1.2em';
		cmtholder.style.whiteSpace = 'nowrap';
		cmtholder.style.overflow = 'hidden';
		//desc.style.left = parseInt(dotforpost.style.left) + 20 + 'px' ;
		//cmtholder.style.opacity = 0.3;
		cmtholder.style.fontColor = '#121212';
		cmtholder.style.zIndex = 10;

		var authr = document.createElement('span');
		authr.appendChild(document.createTextNode(inpostwcomment.giveout));

		var desc = document.createElement('div');
		desc.classList.add('marquee-text-drop');

		//desc.appendChild(document.createTextNode(idx + ":" + posts[idx].hit + ' ' + tagstr));
		if (inpostwcomment.newcomment.length < 50) {
			desc.appendChild(document.createTextNode(inpostwcomment.newcomment));
		} else {
			desc.appendChild(document.createTextNode(inpostwcomment.newcomment.substring(0, 50)));

		}

		setTimeout(function() {
			desc.classList.remove('marquee-text');
			desc.innerHTML = '';
			desc.appendChild(document.createTextNode(inpostwcomment.newcomment));

		}, 7000);

		cmtholder.appendChild(authr);
		cmtholder.appendChild(desc);

		var cntnr = document.getElementById('topic-app');
		if (cntnr == null) {
			cntnr = document.getElementById('app-flk');
		}
		cntnr.appendChild(cmtholder);

		makelementpulsate(dotelem, 20);

		attachtransitionstyles(cmtholder, 2);
		cmtholder.style.opacity = 0.9;
	} else {
		console.log('No crtime in response, can not locate the post to attach comment to.');
	}

}

function processloadedattachedfilefortopic(e, file) {
	//alert('filereader result ' + e.target.result.substring(0,200));
	imageExists(e.target.result, function(exists) {
		//alert('image found');
		var prevdiv = document.getElementById("attached-file-preview");

		if (window.innerWidth < 500 || window.innerHeight < 500) {
			prevdiv = document.getElementById("attached-file-preview-xs");
		}
		if (exists) {
			//show preview
			//alert('is an image will show preview in ' + prevdiv);
			var img = document.createElement("img");
			//img.src = e.target.result;
			img.src = window.URL.createObjectURL(file);

			var maxwidth = window.screen.availWidth;
			var maxheight = window.screen.availHeight;

			if (maxwidth > 800) maxwidth = 800;
			if (maxheight > 600) maxheight = 600;

			var resizedimg = getresizedimage(img, file.type, maxwidth, maxheight);

			var previmg = document.createElement("IMG");
			previmg.classList.add('fade-in');
			previmg.style.objectFit = 'cover';
			previmg.style.top = '0px';
			previmg.style.left = '0px';

			if (window.innerWidth < 500 || window.innerHeight < 500) {
				previmg.width = '50';
				previmg.height = '50';

			} else {
				previmg.width = '64';
				previmg.height = '64';

				previmg.style.padding = '5px';
				prevdiv.innerHTML = '';
			}
			previmg.src = resizedimg; //e.target.result;

			prevdiv.style.backgroundColor = '#ffffff';
			prevdiv.appendChild(previmg);

			postcontenthome.files.push({
				"name": file.name,
				"size": file.size,
				"type": file.type,
				"content": e.target.result,
				"thumbnail": getresizedimage(img, file.type, 300, 300)
			});


		} else {
			//alert('not an image');
			//console.log('Not an image Checking for video');
			videoExists(e.target.result, function(videxists) {

				if (videxists) {
					document.getElementById('topic-post-status').innerHTML = '<div style="color:red">Video uploads not enabled</div>';
					return;
					//alert('yes, a video... show image preview');
					//console.log(document.querySelector("#post-video-preview-canvas").toDataURL());
					//var img = new Image(document.querySelector("#post-video-preview-canvas").width, document.querySelector("#post-video-preview-canvas").height);
					//img.src = document.querySelector("#post-video-preview-canvas").toDataURL('image/jpeg', 1.0);

					//console.log('input img sized ' + img.width + ' ' + img.height );

					var maxwidth = window.screen.availWidth;
					var maxheight = window.screen.availHeight;

					if (maxwidth > 800) maxwidth = 800;
					if (maxheight > 600) maxheight = 600;

					var resizedimg = getresizedimage(document.querySelector("#post-video-preview-canvas"), "image/jpeg", maxwidth, maxheight);

					///console.log('img resized to ' + resizedimg.width + ' ' + resizedimg.height );
					var previmg = document.createElement("IMG");
					previmg.classList.add('fade-in');
					previmg.style.objectFit = 'cover';
					previmg.style.top = '0px';
					previmg.style.left = '0px';

					if (window.innerWidth < 500 || window.innerHeight < 500) {
						previmg.width = '50';
						previmg.height = '50';

					} else {
						previmg.width = '64';
						previmg.height = '64';

						previmg.style.padding = '5px';
						prevdiv.innerHTML = '';
					}
					previmg.src = resizedimg; //e.target.result;

					prevdiv.style.backgroundColor = '#ffffff';
					//prevdiv.appendChild(previmg);

					var vidprev = document.createElement('video');

					vidprev.addEventListener("timeupdate", function() {
						if (this.currentTime >= 5) {
							this.pause();
						}
					});
					vidprev.width = previmg.width;
					vidprev.height = previmg.height;

					vidprev.src = e.target.result;
					vidprev.autoplay = true;

					prevdiv.appendChild(vidprev);
					vidprev.load();
					//alert(file.type);
					postcontenthome.files.push({
						"name": file.name,
						"size": file.size,
						"type": file.type,
						"content": e.target.result
					});


				} else {
					console.log('No image or video ');
					prevdiv.style.backgroundColor = "#989898";
					prevdiv.innerHTML = "<h5>" + file.type + " File</h5>";
					postcontenthome.files.push({
						"name": file.name,
						"size": file.size,
						"type": file.type,
						"content": e.target.result
					});
				}

			});


		}

		if (postcontenthome.files.length > 1) {
			var countdisp = document.createElement("div");
			countdisp.classList.add('fade-in');
			countdisp.style.width = '64';
			countdisp.style.height = '64';
			countdisp.style.opacity = '0.6';
			countdisp.style.overflow = 'none';
			var heading = document.createElement("h4");
			heading.style.background = '#515151';
			heading.classList.add('text-center');
			heading.style.width = '100%';

			heading.appendChild(document.createTextNode("+" + (postcontenthome.files.length - 1)));

			countdisp.appendChild(heading);
			prevdiv.appendChild(countdisp);

		}

	});



}


function closeSSEConnection() {
	if (topiceventsource != null) {
		topiceventsource.close();
		topiceventsource = null;
		console.log('SSE connection stopped -- was started in topic page.');
	}

}

function jointopic() {

	if (topiceventsource == null) {
		openSSEConnection();
		console.log('created new SSE connection from topic page ' + topiceventsource.url);
	} else {
		if (topiceventsource.url.endsWith(topicname)) {
			//alert('SSE connection for the conversation exists. readystate: ' + sseeventsource.readyState + ' url: ' + sseeventsource.url);
			console.log('SSE connection existed from topic page ' + topiceventsource.url);
		} else {
			//alert('SSE connection exists for a different URL ' + sseeventsource.url + ' .. Will close the old connection and create new.');
			closeSSEConnection();
			openSSEConnection();
			console.log('created new SSE connection from topic page ' + topiceventsource.url);
		}
	}

}


function openSSEConnection() {
	if (typeof (EventSource) !== "undefined") {
		topiceventsource = new EventSource("/newauth/api/monitorTopic/" + topicname);
		topiceventsource.addEventListener('message', function(event) {
			//console.log('new data arrived ' + event.data);
			var recdpost = JSON.parse('[' + event.data + ']');
			var currentposttime = new Date(posts[0].crtime);
			var recdposttime = new Date(recdpost[0].crTime)
			//console.log('post received created at time ' + recdpost[0].crTime + ' ' + posts[0].crtime)
			//console.log('post received created at time ' + recdposttime + ' ' + currentposttime)

			if (parseInt(recdpost[0].comments) > 0 && recdpost[0].summary == null) {// this is a new comment on a post
				showpostcomment(recdpost[0], true);
			} else {
				if (typeof posts[0].crtime == 'undefined' || recdposttime > currentposttime) {
					recdpost[0].crtime = recdpost[0].crTime; // naming mismatch			
					displaypostsasdots(recdpost, true);   // justadded true
				}
			}

		});


	} else {
		alert("This browser does not support the technology required to monitor the topic in realtime. You can refresh the page periodically to see the latest posts.");
	}
}

function displayflakeconfstartmodal(evt) {
	$('#flake-conf-start-modal').modal('show');
}


function increasePrivacy(event) {
	event.stopPropagation();
	var xhr = new XMLHttpRequest();

	var url = '/newauth/api/increaseprivacyforflake';

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {

			var res = xhr.responseText;

			document.getElementById('identity-display').innerText = res.split(':')[1];
			if (document.getElementById('header-identity-display') != null) document.getElementById('header-identity-display').innerText = res.split(':')[1];
			//alert(res.split(':')[0]);
			if (res.split(':')[0] == 'F') {
				document.getElementById('inc-privacy-button').src = '/static/icons/user-dark-gray.png';
				document.getElementById('inc-privacy-button').title = 'Already set at maximum privacy';
				document.getElementById('inc-privacy-button').onclick = function(event) {
					displaybuttonbehavior(event, "Already set at maximum privacy");
				};

			} else {
				document.getElementById('red-privacy-button').src = '/static/icons/user.png';
				document.getElementById('red-privacy-button').title = 'Less Privacy';
				document.getElementById('red-privacy-button').onclick = function(event) {
					reducePrivacy(event);
				};
			}

			if (res.split(':')[0] == 'A')
				displaybuttonbehavior(event, "Giving out Alias now");

			if (res.split(':')[0] == 'F')
				displaybuttonbehavior(event, "Giving out flake now");

		}

		if (xhr.readyState == 4 && xhr.status == 400) {
			displaybuttonbehavior(event, xhr.responseText);
		}
	}

	xhr.open('POST', url, true);
	xhr.withCredentials = true;
	xhr.setRequestHeader('Content-Type', 'application/json');


	xhr.send(null);
}

function reducePrivacy(event) {
	event.stopPropagation();
	var xhr = new XMLHttpRequest();

	var url = '/newauth/api/reduceprivacyforflake';

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {

			var res = xhr.responseText;

			document.getElementById('identity-display').innerText = res.split(':')[1];
			if (document.getElementById('header-identity-display') != null) document.getElementById('header-identity-display').innerText = res.split(':')[1];
			//alert(res.split(':')[0]);

			if (res.split(':')[0] == 'N') {
				document.getElementById('red-privacy-button').src = '/static/icons/user-gray.png';
				document.getElementById('red-privacy-button').title = 'Already giving out full name';
				document.getElementById('red-privacy-button').onclick = function(event) {
					displaybuttonbehavior(event, "Already giving out full name");
				};
			} else {
				document.getElementById('inc-privacy-button').src = '/static/icons/user-dark.png';
				document.getElementById('inc-privacy-button').title = 'More Privacy';
				document.getElementById('inc-privacy-button').onclick = function(event) {
					increasePrivacy(event);
				};
			}

			if (res.split(':')[0] == 'A')
				displaybuttonbehavior(event, "Giving out Alias now");

			if (res.split(':')[0] == 'N')
				displaybuttonbehavior(event, "Giving out full name now");

		}

		if (xhr.readyState == 4 && xhr.status == 400) {
			displaybuttonbehavior(event, xhr.responseText);
		}
	}

	xhr.open('POST', url, true);
	xhr.withCredentials = true;
	xhr.setRequestHeader('Content-Type', 'application/json');


	xhr.send(null);
}

function loadvaultinflakepage() {
	document.getElementById('flake-main-image-2').src = "/static/icons/vault-256.png";
	document.getElementById('flake-main-image-2').style.opacity = 0.2;

	document.getElementById("displayloadingcontainer").style.display = 'block';

	if (originaldata != null && originaldata.length > 0) {
		displayvaultdataasdots(originaldata);
	} else {
		let xhr = new XMLHttpRequest();
		let url = '/secure/getuserdata';

		xhr.open('POST', url, true); // needs to be synchronous false means synchronous
		xhr.withCredentials = true;
		xhr.setRequestHeader('Content-Type', 'application/json');

		xhr.onreadystatechange = function() {
			//alert('getuserdatafromdb returned status ' + xhr.status + ' ' + xhr.responseText);
			if (xhr.readyState == 4 && xhr.status == 200) {
				if (xhr.responseText != null && xhr.responseText.length > 0) {

					//alert('data in user vault for seq ' + sequence + ' ' + xhr.responseText);
					var udobj = JSON.parse(xhr.responseText);
					originaldata = 'ERROR';

					try {
						//alert('vaultkey ' + vaultkey);
						originaldata = sjcl.decrypt(vaultkey, udobj.data);
						//originaldata = JSON.stringify(udobj);
						displayvaultdataasdots(originaldata);
					} catch (e) {
						//alert('Could not decrypt payload based on vault key. Error > ' + e);
						//throw e;
						console.log('Exception while decrypt vault data ' + e);
						if (document.getElementById('newauth-notification') != null) {
							document.getElementById('newauth-notification').innerHTML = '';
							document.getElementById('newauth-notification').innerHTML = 'Invalid Vault key. Please try again';
						}
						setTimeout(function() {
							createVaultKeyInputOnForeGroundDiv(udobj.data);
						}, 1500);
					}

					rndsalt = udobj.salt;
					rnditer = udobj.iterations;
					rndseq = udobj.sequence;
					rndcrdate = udobj.createdate;
					//alert('decrypted content recd from db: ' + JSON.parse(originaldata));
					//alert('about to return originaldata ' + originaldata);

				} else {
					//alert('no data in sequence 0 .. will generate fresh keys');

					console.log('ERROR');
				}
			}
		}
		//		console.log('fetching credentials');
		xhr.send(JSON.stringify({
			sequence: 1

		}));
	}
}

function displayvaultdataasdots(data) {
	//alert(data);
	removediv(document.getElementById('vaultkeyinputholder'));

	var filter = document.getElementById('vault-search-input').value;

	var vltdata = JSON.parse(data);

	var creds = [];

	for (var i = 0; i < vltdata.length; i++) {

		let existing = creds.find(o => o.name === vltdata[i].siteUrl);

		if (existing != null) {
			existing.description.push(vltdata[i].siteuser + ':#:#:' + vltdata[i].sitepwd);
		} else {
			var pst = {
				"name": vltdata[i].siteUrl,
				"description": [vltdata[i].siteuser + ':#:#:' + vltdata[i].sitepwd],
				"text": vltdata[i].siteuser,
				//"tags": [vltdata[i].siteUrl, vltdata[i].siteuser],
				//"relevance": vltdata[i].hits
				"relevance": getsiteusage(vltdata[i].siteUrl)
			};

			if (filter != null && filter.length > 0) {
				//console.log(filter + ' ' + vltdata[i].siteUrl + ' ' + vltdata[i].siteuser + ' ' + vltdata[i].sitepwd + ' ' + vltdata[i].siteUrl.toLowerCase().indexOf(filter.toLowerCase()));
				if (vltdata[i].siteUrl.toLowerCase().indexOf(filter.toLowerCase()) >= 0
					|| vltdata[i].siteuser.toLowerCase().indexOf(filter.toLowerCase()) >= 0
					|| vltdata[i].sitepwd.toLowerCase().indexOf(filter.toLowerCase()) >= 0
				) {
					creds.push(pst);
					//console.log( vltdata[i].siteUrl + ' added');
					continue;

				} else {
					continue;
				}
			} else {

				creds.push(pst);
			}
		}

	}

	if (filter != null && filter.length > 0) { // remove all creds

		var existingvaultdots = document.getElementsByClassName('dot-vault');
		if (existingvaultdots != null && existingvaultdots.length > 0) {

			for (var i = 0; i < existingvaultdots.length; i++) {
				//console.log('existing dots ' + i);
				//existingvaultdots[i].style.display = "none";
				if (existingvaultdots.length >= creds.length)
					existingvaultdots[i].style.display = "none";
				else
					removediv(existingvaultdots[i]);

			}
		}

	}

	renderdataasdots(creds);
}

function renderdataasdots(indata, hoverfn, clickfn) {	// USed for displaying vault data only

	document.getElementById("displayloadingcontainer").style.display = 'none';

	if (indata == null || indata.length == 0)
		return;

	posts = indata;

	var suggesteddotsize = Math.sqrt(parseInt(window.innerWidth * window.innerHeight) / Math.max(20, posts.length));

	//alert('startsize ' + startsize + ' suggested ' + suggesteddotsize);

	startsize = parseInt(suggesteddotsize) / 9; //parseInt(suggesteddotsize)/9;
	maxdotsize = parseInt(suggesteddotsize) / 4;// parseInt(suggesteddotsize)/3;

	var cntnr = document.getElementById('topic-app');
	if (cntnr == null) {
		cntnr = document.getElementById('app-flk');
	}

	function relevance(item) {
		if (typeof item.relevance === 'undefined' || item.relevance == null || item.relevance == '')
			item.relevance = 1;

		return item.relevance;
	}

	function sum(prev, next) {
		return prev + next;
	}

	function percentile(arr, n) {
		var count, percent;
		count = 0;
		for (var j = 0; j < arr.length; j++) {
			if (arr[n] > arr[j]) {
				count++;
			}
		}
		percent = (count * 100) / (arr.length - 1);

		return parseInt(percent);
	}

	//	var totalrelevance = indata.map(relevance).reduce(sum);

	//document.getElementById('flake-page-header').innerText = 'Vault';

	for (var i = 0; i < indata.length; i++) {

		//var existdot = document.getElementById('dot-'+ i);
		var existdot = document.querySelector('[data-name="' + indata[i].name + '"]');

		if (existdot != null) {
			if (existdot.getAttribute('data-name') === indata[i].name) {
				existdot.style.display = 'block';
				existdot.style.opacity = 1;
				continue;
			}

		}
		var dot = document.createElement('div');

		dot.setAttribute('id', 'dot-' + i);
		dot.setAttribute('data-name', indata[i].name);
		//dot.setAttribute('draggable', true);
		dot.classList.add('dot-vault');

		dot.style.width = Math.min(2 * startsize, maxdotsize);

		var perc = percentile(indata.map(relevance), i);

		if (perc >= 80) {
			dot.style.width = maxdotsize;
		}

		if (perc <= 50) {
			dot.style.width = startsize;
		}

		//console.log(i + ' ' + indata[i].relevance + ' ' + perc);
		//dot.classList.add('pulsate');
		dot.style.opacity = '0.1';
		dot.style.transform = "scale(1.2)";
		attachtransitionstyles(dot, 1);

		var digest_sha256;
		var randtop;
		var randleft;

		var bitArray;

		if (indata[i].name.length > 1000) {
			bitArray = sjcl.hash.sha256.hash(indata[i].name.substring(0, 1000));
			//console.log(indata[i].name  + ' length more than 1000');
		} else {
			bitArray = sjcl.hash.sha256.hash(indata[i].name);
			//console.log(indata[i].name   );
		}

		digest_sha256 = sjcl.codec.hex.fromBits(bitArray);

		dot.style.backgroundColor = '#' + digest_sha256.substring(0, 6); //b3b3b3';
		dot.style.boxShadow = "0px 0px 2px " + "#" + digest_sha256.substring(0, 6);

		var hashasnum = "000000000000000000000000000000000000000000000";

		if (digest_sha256 != null)
			hashasnum = parseInt(digest_sha256.substring(digest_sha256.length - 15, digest_sha256.length), 16);
		//console.log(indata[i].name + ' ' + digest_sha256 + ' ' + hashasnum);

		var xpercent = parseFloat(hashasnum.toString().substring(0, 2) + '.' + hashasnum.toString().substring(2, 5));
		var ypercent = parseFloat(hashasnum.toString().substring(5, 7) + '.' + hashasnum.toString().substring(7, 10));

		randtop = parseInt(window.innerHeight * ypercent / 100);
		randleft = parseInt(window.innerWidth * xpercent / 100);


		var maxshifts = 0;

		while (mindthegaps(randtop, randleft, maxdotsize)) {

			if (maxshifts > 5) {
				console.log('Done shifting this dot ' + randtop + ':' + randleft + ' ' + indata[i].name);
				break;
			}

			if (randtop < window.innerHeight / 2 && randtop > 50 + startsize)
				randtop -= startsize;
			else
				randtop += startsize;

			if (randleft < window.innerWidth / 2 && randleft > 0)
				randleft -= startsize;
			else
				randleft += startsize;

			maxshifts++;
		}

		if (randleft < 10) randleft += 10;
		if (randleft > window.innerWidth - maxdotsize - 10) randleft -= (3 * maxdotsize);

		if (randtop < 60) randtop += 60;
		if (randtop > window.innerHeight - maxdotsize - 10) randtop -= (maxdotsize + 10);

		if (i <= 2) console.log('randleft ' + randleft + ' randtop ' + randtop);

		var quad = "";
		if (randtop < window.innerHeight / 2)
			quad += "N";
		else
			quad += "S";

		if (randleft < window.innerWidth / 2)
			quad += "W";
		else
			quad += "E";

		dot.classList.add('quad-' + quad);

		dot.style.top = randtop * 100 / parseInt(window.innerHeight) + '%';
		dot.style.left = randleft * 100 / parseInt(window.innerWidth) + '%';

		dot.style.height = dot.style.width;
		dot.style.position = 'absolute';
		dot.style.borderRadius = '50%';
		dot.style.zIndex = '2';
		//dot.style.display = 'none';	
		//dot.style.opacity = window.getComputedStyle(dot).getPropertyValue("opacity");
		dot.style.transform = window.getComputedStyle(dot).getPropertyValue("transform");

		dot.style.transform = "scale(1)";

		/// display name also

		var desc = document.createElement('div');

		var tagstr = '';

		if (typeof indata[i].tags != 'undefined' && indata[i].tags != null) {
			for (var t = 0; t < indata[i].tags.length; t++) {

				if (indata[i].tags[t].indexOf('flake:') < 0 &&
					indata[i].tags[t].indexOf('ip:') < 0 &&
					indata[i].tags[t].indexOf('name:') < 0 &&
					indata[i].tags[t].indexOf('jwt:') < 0) {
					tagstr += indata[i].tags[t];
				}

				if (t < indata[i].tags.length - 1)
					tagstr += ' ';
			}
		} else {
			try {
				var nm = indata[i].name;

				if (!nm.trim().startsWith("http"))
					nm = "http://" + nm.trim();

				//console.log("creating url from  " + nm);
				var url = new URL(nm);

				let parts = url.hostname.split('.');
				//console.log('parts ' + parts);
				for (var p = 0; p < parts.length; p++) {
					//console.log(p + ': ' + parts[p]);
					var topDomains = ["com", "de", "org", "net", "us", "co", "edu", "gov", "biz", "za", "info", "cc", "ca", "cn", "fr", "ch", "au", "in", "jp", "be", "it", "nl", "uk", "mx", "no", "ru", "br", "se", "es", "at", "dk", "eu", "il", "io"];

					if (!topDomains.includes(parts[p].toLowerCase())) {
						tagstr = parts[p] + ' ' + tagstr;
					}

					//console.log(tagstr);
				}
				//tagstr = url.hostname;

				dot.style.backgroundColor = '#fefefe';
				var imgelem = document.createElement("img");
				//imgelem.setAttribute("src", "https://www.google.com/s2/favicons?sz=64&domain=" + nm);
				imgelem.setAttribute("height", dot.style.height);
				imgelem.setAttribute("width", dot.style.width);
				imgelem.setAttribute("alt", tagstr);
				//imgelem.classList.add('center-block');	
				imgelem.style.objectFit = 'cover';
				imgelem.style.borderRadius = '50%';

				var faviconcheck = new Image();
				faviconcheck.onload = function(imgelement) {
					return function() {
						if (this.naturalHeight > 16)
							imgelement.src = this.src;
						else
							imgelement.src = '/static/icons/blankfavicon.ico';
					}
				}(imgelem);

				faviconcheck.src = 'https://www.google.com/s2/favicons?sz=64&domain=' + nm;

				dot.appendChild(imgelem);

			} catch (error) {
				console.log('error creating url from ' + indata[i].name + ' : ' + error);
				tagstr = indata[i].name;
			}



		}
		//desc.appendChild(document.createTextNode(idx + ":" + posts[idx].hit + ' ' + tagstr));
		desc.appendChild(document.createTextNode(tagstr));
		desc.setAttribute('id', 'dot-desc-' + i);
		desc.classList.add('dot-desc');
		//desc.style.backgroundColor = '#a2a2a2';
		desc.style.borderRadius = '3px';
		desc.style.position = 'absolute';
		desc.style.backgroundColor = '#eaeaea';
		desc.style.pointerEvents = 'none';

		var clickx = parseFloat(dot.style.left.split('%')[0]);
		var clicky = parseFloat(dot.style.top.split('%')[0]);

		if ((clickx * parseInt(window.innerWidth) / 100) > parseInt(window.innerWidth) / 2) {
			//	desc.style.left = '-35px';
			//else
			desc.style.right = '5px';
			desc.style.textAlign = 'right';
		}

		if ((clicky * parseInt(window.innerHeight) / 100) > parseInt(window.innerHeight) / 2)
			//	desc.style.top = dot.style.width;
			//else
			desc.style.bottom = '5px';

		//if (idx<2) console.log(topinpx);
		//desc.style.top = parseInt(topinpx) + 4 + 'px' ;

		//desc.style.left = '-40px';
		desc.style.width = '100px';
		desc.style.lineHeight = '1.8em';
		desc.style.whiteSpace = 'nowrap';
		desc.style.overflow = 'hidden';
		//desc.style.left = parseInt(dotforpost.style.left) + 20 + 'px' ;
		//desc.style.opacity = '0.3';
		desc.style.color = '#262626';
		desc.style.fontSize = '1.2em';
		desc.style.paddingLeft = '2px';
		desc.style.zIndex = 10;
		dot.appendChild(desc);

		attachtransitionstyles(desc, 1);
		//desc.style.opacity = "0.9 !important";
		desc.style.setProperty("opacity", 0.9, "important");

		cntnr.appendChild(dot);
		setTimeout(function(idx) {

			return function() {
				//flakeoverlay.style.display = "block";	
				let dt = document.getElementById('dot-' + idx);
				//$('#dot-' + idx).fadeIn('slow');
				if (dt != null)
					dt.style.opacity = 1;
			}
		}(i), 300);

		setTimeout(function(idx) {

			return function() {

				let dsc = document.getElementById('dot-desc-' + idx);
				if (dsc != null)
					dsc.style.display = 'none';
			}
		}(i), 3000);

		dot.addEventListener('mouseenter', function(e, idx) {
			return function(e) {

				var dsc = document.getElementById('dot-desc-' + idx);

				if (dsc != null) {
					dsc.style.display = 'block';
					dsc.style.opacity = 0.9;
				}
			}
		}(event, i), false);

		dot.addEventListener('mouseleave', function(e, idx) {
			return function(e) {

				var dsc = document.getElementById('dot-desc-' + idx);

				if (dsc != null) {
					dsc.style.display = 'none';

				}
			}
		}(event, i), false);

		dot.addEventListener('click', launchvltpopupfunction(i, event), false);
	}

	setvaultpagebehaviour();
	//console.log('remaintime ' + remaintime);

	if (parseInt(remaintime) < 0)
		remaintime = 60;

	setTimeout(function() {
		var pops = document.getElementsByClassName('dot-popup-vault');
		for (var c = 0; c < pops.length; c++) {
			removediv(pops[c]);

		}

		var clrpops = document.getElementsByClassName('dot-vault');
		for (var c = 0; c < clrpops.length; c++) {
			//clrpops[c].removeEventListener('click', launchvltpopupfunction, false);
			posts = null;
			clrpops[c].addEventListener('click', function(evt, idx) {
				return function(evt) {
					displaybuttonbehavior(evt, "Vault content expired, please login again.");
				};
			}(event, c), false);
		}
	}, parseInt(remaintime) * 1000);

}

function getcolorandlocationbasedondata(data1, data2) {
	var pastelcodes = [' F7F6CF ', ' B6D8F2 ', ' F4CFDF ', ' 5784BA ', ' 9AC8EB ', ' CCD4BF ', ' E7CBA9 ', ' EEBAB2 ', ' F5F3E7 ', ' F5E2E4 ', ' F5BFD2 ', ' E5DB9C ', ' D0BCAC ', ' BEB4C5 ', ' E6A57E ', ' 218B82 ', ' 9AD9DB ', ' E5DBD9 ', ' 98D4BB ', ' EB96AA ', ' C6C9D0 ', ' C54B6C ', ' E5B3BB ', ' C47482 ', ' D5E4C3 ', ' F9968B ', ' F27348 ', ' 26474E ', ' 76CDCD ', ' 2CCED2 ', ' B8E0F6 ', ' A4CCE3 ', ' 37667E ', ' DEC4D6 ', ' 7B92AA ', ' DDF2F4 ', ' 84A6D6 ', ' 4382BB ', ' E4CEE0 ', ' A15D98 ', ' DC828F ', ' F7CE76 ', ' E8D6CF ', ' 8C7386 ', ' 9C9359 ', ' F4C815 ', ' F9CAD7 ', ' A57283 ', ' C1D5DE ', ' DEEDE6 ', ' E9BBB5 ', ' E7CBA9 ', ' AAD9CD ', ' E8D595 ', ' 8DA47E ', ' CAE7E3 ', ' B2B2B2 ', ' EEB8C5 ', ' DCDBD9 ', ' FEC7BC ', ' FBECDB ', ' F3CBBD ', ' 90CDC3 ', ' AF8C72 ', ' 938F43 ', ' B8A390 ', ' E6D1D2 ', ' DAD5D6 ', ' B2B5B9 ', ' 8FA2A6 ', ' 8EA4C8 ', ' C3B8AA ', ' DEDCE4 ', ' DB93A5 ', ' C7CDC5 ', ' 698396 ', ' A9C8C0 ', ' DBBC8E ', ' AE8A8C ', ' 7C98AB ', ' C2D9E1 ', ' D29F8C ', ' D9D3D2 ', ' 81B1CC ', ' FFD9CF ', ' C6AC85 ', ' ', ' D9C2BD ', ' A2C4C6 ', ' 82B2B8 ', ' 874741 ', ' CA9C95 ', ' 40393E ', ' E5E4E5 ', ' 897C87 ', ' 46302B ', ' 76504E ', ' D3CCCA ', ' A37E7E ', ' 86736C ', ' ', ' AD192A ', ' E4B78F ', ' F1E8EA ', ' D88D96 ', ' EAB1B9 ', ' F38C10 ', ' A7763B ', ' CCD7D8 ', ' 4C482E ', ' D2B6BA ', ' BE3F12 ', ' 7DB0CD ', ' C0B5AB ', ' 79553F ', ' 91BA96 ', ' A65111 ', ' DDAA00 ', ' 7C5D3D ', ' 85AAAA ', ' 173F4E ', ' D82315 ', ' 2F1710 ', ' 425164 ', ' DABB96 ', ' 899FB6 ', ' DBB657 ', ' 86553F ', ' C8C2D0 ', ' E45C54 ', ' 90A375 ', ' F9BB9D ', ' FFDA43 ', ' 756382 ', ' E2C274 ', ' 9CA8B5 ', ' FFE75D ', ' D24970 ', ' 32657C ', ' 669BB7 ', ' CF8145 ', ' 753516 ', ' AF6F33 ', ' 9DB4BA ', ' 210E0D ', ' E2D2C1 ', ' CA8459 ', ' DDB396 ', ' DDDFE3 ', ' 422523 ', ' 954D34 ', ' 843619 ', ' B87730 ', ' 1B2625 ', ' DAD0CE ', ' 748991 ', ' 64A532 ', ' B09647 ', ' 450309 ', ' DEE2E3 ', ' 7B5536 ', ' 446C04 ', ' F8DF96 ', ' 977D77 ', ' 301F1A ', ' 5E301F ', ' 8E3229 ', ' AEBB35 ', ' 2F1D16 ', ' D0BDAA ', ' A37537 ', ' FF415B ', ' BC7F37 ', ' 352C20 ', ' EAE8E8 ', ' 64AA71 ', ' F64900 ', ' CB8A2D ', ' 262416 ', ' DDDDDE ', ' 90B274 ', ' B08D7E ', ' 6C74A4 ', ' BBB9BC ', ' 5E2424 ', ' 95BB9A ', ' 652F20 ', ' 74C85D ', ' 2D3538 ', ' 57818A ', ' D54C2E ', ' D09150 ', ' DEBD9B ', ' 3C2320 ', ' 955132 ', ' EBEBEF ', ' B08138 ', ' 784928 ', ' 382918 ', ' DDD4D3 ', ' AE8A75 ', ' F08E88 ', ' 422D09 ', ' 468F5E ', ' AC7C36 ', ' E3E2DF ', ' E1A624 ', ' 317AC1 ', ' 384454 ', ' D4D3DC ', ' AD956B ', ' F38C10 ', ' A7763B ', ' CCD7D8 ', ' 4C482E ', ' D2B6BA ', ' C5853D ', ' 99372E ', ' DAD4D9 ', ' 391C19 ', ' B27E83 ', ' 4F3B2B ', ' 7C6619 ', ' B8B5AD ', ' BE0309 ', ' 93C1D5 '];

	var rgbmap;

	function getpastelcolor(col) {
		if (rgbmap == null) {
			creatergbmapofpastels();
		}
		var pastel = findclosestrgbfrommap(col);

		//console.log('Pastel found ' + pastel );
		return pastel;
	};

	function creatergbmapofpastels() {
		rgbmap = {};

		for (var c = 0; c < pastelcodes.length; c++) {
			var rgbobj = hexToRgb1(pastelcodes[c].trim());
			if (rgbobj != null) {
				rgbmap[pastelcodes[c].trim()] = rgbobj;

			}
		}

		//console.log('RGBMAP created'  );
	}

	function findclosestrgbfrommap(col) {
		//document.getElementById('b64').style.backgroundColor = col; /// Remove this LINE
		col = col.replace('#', '');
		var rgbobjforcol = hexToRgb1(col);

		//console.log('Looking for the closest color for ' + col + ' ' + JSON.stringify(rgbobjforcol));

		var distance = -1;
		var closestcolor;
		const rgbkeys = Object.keys(rgbmap);
		rgbkeys.forEach((key, index) => {
			//console.log(`${key}: ${rgbmap[key]}`);
			var thisdist = calculatedistance(rgbobjforcol, rgbmap[key]);
			if (distance < 0 || thisdist < distance) {

				if (distance > 0) {
					//document.getElementById('json').style.backgroundColor = '#'+key; /// Remove this LINE
					closestcolor = '#' + key;
					//console.log('Idx ' + index + 'Closest  ' + closestcolor + ' distance ' + thisdist);
				}
				distance = thisdist;
			}
		});

		return closestcolor;
	}

	function calculatedistance(obj1, obj2) {

		return Math.pow(obj1.r - obj2.r, 2) + Math.pow(obj1.g - obj2.g, 2) + Math.pow(obj1.b - obj2.b, 2);
	}


	function hexToRgb1(hex) { // better version
		var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}

	var bitArray;
	var cross;
	var digest_sha256;

	if (data1.length > 1000) {
		bitArray = sjcl.hash.sha256.hash(data1.substring(0, 1000));
		//console.log(indata[i].name  + ' length more than 1000');
	} else {
		bitArray = sjcl.hash.sha256.hash(data1);
		//console.log(indata[i].name   );
	}

	digest_sha256 = sjcl.codec.hex.fromBits(bitArray);

	var hashasnum1 = "000000000000000000000000000000000000000000000";
	var hashasnum2 = "1";

	if (digest_sha256 != null)
		hashasnum1 = BigInt('0x' + digest_sha256);
	//console.log(indata[i].name + ' ' + digest_sha256 + ' ' + hashasnum);

	if (typeof data2 != 'undefined' && data2.length > 0) {
		if (data2.length > 1000) {
			bitArray = sjcl.hash.sha256.hash(data2.substring(0, 1000));
			//console.log(indata[i].name  + ' length more than 1000');
		} else {
			bitArray = sjcl.hash.sha256.hash(data2);
			//console.log(indata[i].name   );
		}

		digest_sha256 = sjcl.codec.hex.fromBits(bitArray);

		if (digest_sha256 != null)
			hashasnum2 = BigInt('0x' + digest_sha256);

		//console.log ('hash1 ' + hashasnum1);
		//console.log ('hash2 ' + hashasnum2);
		cross = hashasnum1 * hashasnum2;

		//	console.log ('cross of the two hashes ' + cross);
	} else {
		cross = hashasnum1;
	}

	var xpercent = parseFloat(cross.toString(10).substring(0, 2) + '.' + cross.toString(10).substring(2, 5));
	var ypercent = parseFloat(cross.toString(10).substring(5, 7) + '.' + cross.toString(10).substring(7, 10));
	var zpercent = "";
	if (cross.toString(10).length > 10) zpercent = parseFloat(cross.toString(10).substring(10, 12) + '.' + cross.toString(10).substring(12, 15));

	var col = '#' + cross.toString(16).substring(0, 6); //b3b3b3';

	var pstl = getpastelcolor(col);
	var shadow = "0px 0px 2px " + pstl;

	return {
		xpc: xpercent,
		ypc: ypercent,
		zpc: zpercent,
		origcol: col,
		col: pstl,
		boxShadow: shadow,
		getpastelcolor
	};


}

function createVaultPopup(creds, idx) {
	//console.log('site ' + creds.name);

	increasesiteusage(creds.name);
	var popupwidth = '25vw';
	var popumaxheight = 200;

	var popupdistance = 0;

	var pop = document.createElement('div');
	pop.setAttribute('id', 'dot-popup-vlt-' + idx);
	pop.classList.add('dot-popup-vault');
	pop.style.width = popupwidth;
	pop.style.backgroundColor = 'rgba(256, 256, 256, 0.8)';
	//pop.style.maxHeight = '0';
	//pop.style.height = '200px';
	//pop.style.overflow = 'hidden';
	pop.style.zIndex = 5;
	pop.style.display = 'none';
	pop.style.lineHeight = '';
	pop.style.position = 'absolute';
	pop.style.padding = '5px';
	pop.style.boxShadow = '3px 5px 4px #aeaeae';

	var dv = document.createElement('div');
	dv.classList.add('row');

	var cl = document.createElement('div');
	cl.classList.add('col-xs-12');

	dv.appendChild(cl);

	for (var c = 0; c < creds.description.length; c++) {
		let dvin = document.createElement('div');
		dvin.classList.add('row');

		let cl1 = document.createElement('div');
		cl1.classList.add('col-xs-6');

		let userpass = creds.description[c].split(':#:#:');

		cl1.innerHTML = JSON.stringify(userpass[0]);
		cl1.title = 'Click to launch site in separate Tab';

		cl1.addEventListener('click', function(evt, url) {
			return function(evt) {
				loadExtUrl(url);
			};
		}(event, creds.name));

		let cl2 = document.createElement('div');
		cl2.classList.add('col-xs-3');
		let lnk = document.createElement('IMG');
		lnk.src = '/static/icons/copy.png';
		lnk.height = '14';
		lnk.title = 'Copy Password';

		lnk.addEventListener('click', function(evt, pass) {
			return function(evt) {
				copytexttocbandhighlight(pass, 'Password copied', evt);
				evt.target.src = '/static/icons/copied.png';

				let dt = document.getElementById('dot-' + idx);
				if (dt != null && creds.description.length == 1) {
					dt.style.display = 'none';
				}
				setTimeout(function() {
					//removeInfoFromClipboard(); -- wont work
					evt.target.src = '/static/icons/copy.png';
				}, 60000);
			};
		}(event, userpass[1]));

		cl2.appendChild(lnk);

		let cl3 = document.createElement('div');
		cl3.classList.add('col-xs-3');
		let lnk2 = document.createElement('IMG');
		lnk2.src = '/static/icons/eye-close-up.png';
		lnk2.height = '14';
		lnk2.title = 'Show Password';

		lnk2.addEventListener('click', function(evt, pass) {
			return function(evt) {
				//console.log(pass);
				displaybuttonbehavior(evt, pass);

			};
		}(event, userpass[1]));

		cl3.appendChild(lnk2);

		dvin.appendChild(cl1);
		dvin.appendChild(cl2);
		dvin.appendChild(cl3);

		cl.appendChild(dvin);
	}

	pop.appendChild(dv);

	var dot = document.getElementById('dot-' + idx);

	if (dot != null) {

		//alert('dot.style.left ' + dot.style.left);
		var xloc = parseFloat(dot.style.left.split('%')[0]) * parseInt(window.innerWidth) / 100;
		var yloc = parseFloat(dot.style.top.split('%')[0]) * parseInt(window.innerHeight) / 100;

		if (xloc > window.innerWidth / 2) {
			pop.style.right = '5px';
		}

		if (yloc > window.innerHeight / 2) {
			pop.style.bottom = '5px';
		}

		pop.style.display = 'block';
		dot.appendChild(pop);
	}

	document.addEventListener('click', function(e) {
		//e.preventDefault();
		e.stopPropagation();
		var pops = document.getElementsByClassName('dot-popup-vault');

		for (var p = 0; p < pops.length; p++) {
			if (pops[p].style.display != 'none')
				pops[p].style.display = 'none';
		}
	});

}

function setvaultpagebehaviour() {

	document.getElementById('post-button').title = 'Add credential to vault';
	//document.getElementById('vault-button').style.opacity = '0.3';
	document.getElementById('vault-button').onclick = null;
	document.getElementById('vault-button').title = '';

	document.getElementById('red-privacy-button').src = '/static/icons/search-40.png';
	document.getElementById('red-privacy-button').onclick = null;
	document.getElementById('red-privacy-button').title = "Search vault";
	document.getElementById('red-privacy-button').addEventListener('click', function(evt) {
		evt.stopPropagation();
		document.getElementById('vault-search-input').style.zIndex = 10;
		document.getElementById('vault-search-input').style.visibility = 'visible';
		//alert('text box visible');

		var hidesearch = function() {
			document.getElementById('vault-search-input').style.visibility = 'hidden';
		};

		document.body.removeEventListener('click', hidesearch);
		document.body.addEventListener('click', hidesearch);
	});
	//alert('event listener set');	
	document.getElementById('vault-search-input').addEventListener('input', function(event) {
		stopDefaultBackspaceBehaviour(event);

		if (searchtimeoutid != null) {
			//	console.log('clearing timeout ' + searchtimeoutid);
			clearTimeout(searchtimeoutid);
		}
		searchtimeoutid = setTimeout(function(evt) {
			//console.log('searching...');
			//evt.stopPropagation();
			displayvaultdataasdots(originaldata);
			//displaypostsasdots(posts, false,document.getElementById('vault-search-input').value);

		}, 200);
	});

	document.getElementById('vault-search-input').addEventListener('click', function(evt) {
		evt.stopPropagation();
	});

	document.getElementById('post-button').onclick = null;
	document.getElementById('post-button').removeEventListener('click', addpostfunction);

	document.getElementById('post-button').addEventListener('click', function() {
		//alert('trying to add?');
		createAddInputOnForeGroundDiv();
	});
}

function createVaultKeyInputOnForeGroundDiv(data, fn) {
	console.log('will show vault key input. clearing splash timeout');
	//clearTimeout(newauthsplashtimeout);

	document.getElementById("displayloadingcontainer").style.display = 'none';

	var div = document.getElementById("app-flk");
	//div.innerHTML = "";

	var holderdiv = document.createElement('div');
	holderdiv.setAttribute('id', 'vaultkeyinputholder');
	holderdiv.style.position = "fixed";
	holderdiv.style.zIndex = '5000';
	holderdiv.style.left = "50%";
	holderdiv.style.top = "50%";
	holderdiv.style.width = "50%";
	holderdiv.style.height = "50%";
	holderdiv.style.backgroundColor = "#dbdbdb";
	holderdiv.style.boxShadow = '2px 3px 1px #cecece';
	holderdiv.style.opacity = 0.9;
	holderdiv.style.transform = "translate(-50%, -50%)";

	var inputspan = document.createElement('span');
	inputspan.style.position = "fixed";
	inputspan.style.left = "50%";
	inputspan.style.top = "50%";
	inputspan.style.width = "400px";
	inputspan.style.transform = "translate(-50%, -50%)";

	div.style.backgroundColor = "#c2c2c2";
	var input = document.createElement('input');
	input.type = 'password';
	input.id = 'newauthvaultkey';
	input.style.height = '35px';
	input.style.margin = '2px';
	input.style.border = '0px';
	input.style.width = "250px";
	if (window.innerWidth < 600) {
		input.style.width = "130px";
	}
	input.style.padding = "5px";
	input.style.fontSize = '16px';
	input.style.color = '#494949';

	input.style.position = "fixed";
	input.style.left = "50%";
	input.style.top = "50%";
	input.style.transform = "translate(-50%, -50%)";

	input.style.backgroundColor = '#ffffff';
	input.placeholder = 'Vault Key';
	input.autocomplete = "off";
	input.addEventListener('input', function() {
		document.getElementById('newauth-notification').innerHTML = '';
		if (document.getElementById('newauthvaultkey').value.length > 5) {
			//document.getElementById('newauthsubmitbtn').classList.add('fade-in') ;
			document.getElementById('newauthvksubmitbtn').style.visibility = 'visible';
		} else {
			document.getElementById('newauthvksubmitbtn').style.visibility = 'hidden';
		}
	});

	var btn = document.createElement('input');
	btn.type = 'button';
	btn.id = 'newauthvksubmitbtn';
	btn.value = 'Enter';
	//	btn.classList.add('fade-in');
	btn.style.visibility = 'hidden';
	//btn.style.position = 'absolute';
	btn.style.display = 'inline-block';
	btn.style.height = '35px';
	btn.style.margin = "2px";
	btn.style.float = 'right';
	btn.style.padding = "5px";

	//	btn.style.top = "0px";

	//	btn.style.left = parseInt(widthshift) + 'px';
	btn.style.color = '#efefef';
	btn.style.backgroundColor = '#3498db';
	//btn.style.transform =  "translate(120, 17)";


	//	div.appendChild(form);

	var sitenotification = document.createElement('div');

	sitenotification.style.position = "fixed";
	sitenotification.id = 'newauth-notification';
	sitenotification.style.left = "50%";
	sitenotification.style.top = "80%";
	sitenotification.style.transform = "translate(-50%)";

	sitenotification.innerHTML = 'Please enter your vault key.';

	if (document.getElementById('newauthvaultkey') == null) {

		btn.addEventListener('click', function() {
			vaultkey = document.getElementById('newauthvaultkey').value;
			try {
				//alert('vaultkey ' + vaultkey);
				originaldata = sjcl.decrypt(vaultkey, data);
				//originaldata = JSON.stringify(udobj);
				displayvaultdataasdots(originaldata);
			} catch (e) {
				//alert('Could not decrypt payload based on vault key. Error > ' + e);
				//throw e;
				if (document.getElementById('newauth-notification') != null) {
					document.getElementById('newauthvaultkey').value = '';
					document.getElementById('newauthvaultkey').borderColor = 'red';
					document.getElementById('newauth-notification').innerHTML = '';
					document.getElementById('newauth-notification').innerHTML = 'Invalid Vault key. Please try again';
				}

			}

		});

		input.addEventListener("keydown", function(event) {

			if (event.keyCode === 13 || event.keyCode === 9) { //  13  "Enter" 9 "Tab"
				vaultkey = document.getElementById('newauthvaultkey').value;
				try {
					//alert('vaultkey ' + vaultkey);
					originaldata = sjcl.decrypt(vaultkey, data);
					//originaldata = JSON.stringify(udobj);
					displayvaultdataasdots(originaldata);
				} catch (e) {
					//alert('Could not decrypt payload based on vault key. Error > ' + e);
					//throw e;
					if (document.getElementById('newauth-notification') != null) {
						document.getElementById('newauthvaultkey').value = '';
						document.getElementById('newauthvaultkey').borderColor = 'red';
						document.getElementById('newauth-notification').innerHTML = '';
						document.getElementById('newauth-notification').innerHTML = 'Invalid Vault key. Please try again';
					}

				}
			}
		});


		inputspan.appendChild(input);
		inputspan.appendChild(btn);
		holderdiv.appendChild(inputspan);
		holderdiv.appendChild(sitenotification);
		div.appendChild(holderdiv);
	}

}

function createAddInputOnForeGroundDiv() {
	//console.log('will show vault key input. clearing splash timeout');
	//clearTimeout(newauthsplashtimeout);
	var fields =
		[
			{ name: "siteUrl", description: "Site URL or name" },
			{ name: "siteuser", description: "User name or public key" },
			{ name: "sitepwd", description: "Password or private key", type: "password" },
			{ name: "sitedesc", description: "Details about this entry (optional)" },
			{ name: "sitename", description: "Name to use for this entry (optional)" }
		];

	var div = document.getElementById("app-flk");
	//div.innerHTML = "";

	var holderdiv = document.createElement('div');
	holderdiv.setAttribute('id', 'vaultaddinputholder');
	holderdiv.style.position = "fixed";
	holderdiv.style.zIndex = '5000';
	holderdiv.style.left = "50%";
	holderdiv.style.top = "50%";
	if (window.innerWidth < 600 || window.innerHeight < 600)
		holderdiv.style.width = "90%";

	holderdiv.style.width = "50%";
	holderdiv.style.height = "50%";
	holderdiv.style.backgroundColor = "#dbdbdb";
	holderdiv.style.boxShadow = '2px 3px 1px #cecece';
	//holderdiv.style.opacity = 0.9;
	holderdiv.style.transform = "translate(-50%, -50%)";

	var heading = document.createElement('h4');
	heading.style.position = "fixed";
	heading.style.left = "50%";
	heading.style.transform = "translate(-50%)";
	heading.appendChild(document.createTextNode('Add Credential to vault'));

	holderdiv.appendChild(heading);

	let closeanchor = document.createElement('span');
	//closeanchor.innerHTML = '&times;';
	closeanchor.innerHTML = '<img width="16" height="16" src="/static/icons/cross-sign.png"/>';
	closeanchor.style.float = 'right';
	closeanchor.style.padding = '8px';
	closeanchor.style.opacity = 0.5;
	// closeanchor.style.fontSize= '3em';
	closeanchor.style.top = '0px';
	closeanchor.style.display = 'inline-block';
	//closeanchor.style.color = '#535353';
	closeanchor.style.cursor = 'default';
	closeanchor.addEventListener('mouseover', function(e) {
		e.target.style.opacity = 0.8;
	});
	closeanchor.addEventListener('mouseout', function(e) {
		e.target.style.opacity = 0.5;
	});

	closeanchor.addEventListener('click', function(evt) {
		evt.stopPropagation();
		evt.preventDefault();
		//alert('Close clicked');
		$('#vaultaddinputholder').fadeOut(500);
		removediv(document.getElementById('vaultaddinputholder'));

	});
	holderdiv.appendChild(closeanchor);

	var sitenotification = document.createElement('div');

	sitenotification.style.position = "fixed";
	sitenotification.id = 'newauth-notification';
	sitenotification.style.display = 'none';
	sitenotification.style.left = "50%";
	sitenotification.style.top = "80%";
	sitenotification.style.transform = "translate(-50%)";

	sitenotification.innerHTML = 'Please check your input.';

	var cont = document.createElement('div');
	cont.classList.add('container');
	cont.style.position = "fixed";
	cont.style.left = "50%";
	cont.style.top = "50%";
	cont.style.width = "60%";

	if (window.innerWidth < 600 || window.innerHeight < 600)
		cont.style.width = "90%";

	cont.style.transform = "translate(-50%, -50%)";

	for (var i = 0; i < fields.length; i++) {
		var r = document.createElement('div');
		r.classList.add('row');
		var c = document.createElement('div');
		c.classList.add('col-xs-12');

		var inp = document.createElement('input');
		inp.classList.add("form-control");
		inp.classList.add("input-md");
		inp.setAttribute("type", (typeof fields[i].type === 'undefined' || fields[i].type == null) ? "text" : fields[i].type);
		inp.setAttribute('id', fields[i].name);
		inp.setAttribute('placeholder', fields[i].description);
		inp.setAttribute('width', '50%');
		c.appendChild(inp);

		r.appendChild(c);
		cont.appendChild(r);
	}

	var r = document.createElement('div');
	r.classList.add('row');
	var c = document.createElement('div');
	c.classList.add('col-xs-12');
	c.classList.add('text-center');

	var sendbutton = document.createElement("input");
	sendbutton.setAttribute("id", "vlt-add-button");
	sendbutton.classList.add('btn');
	sendbutton.style.marginTop = '15px';
	sendbutton.classList.add('btn-primary');
	sendbutton.classList.add('btn-md');
	//sendbutton.classList.add('pull-right');
	sendbutton.type = "button";
	sendbutton.value = "Submit";
	//sendbutton.style.display = 'none';
	sendbutton.addEventListener('click', function(evt) {
		addnewcredentialtovault(fields);
	}, false);

	c.appendChild(sendbutton);

	r.appendChild(c);
	cont.appendChild(r);

	holderdiv.appendChild(cont);
	holderdiv.appendChild(sitenotification);
	div.appendChild(holderdiv);

}

function addnewcredentialtovault(fielddescs) {

	var newcredstr = "{";

	for (var i = 0; i < fielddescs.length; i++) {
		var fldval = document.getElementById(fielddescs[i].name).value;

		if (fldval != null && fldval.length > 0) {
			newcredstr += '\"' + fielddescs[i].name + '\": \"' + fldval + '\"';

			newcredstr += ',';

		}
	}

	newcredstr += '}';

	newcredstr = newcredstr.replace(",}", "}");

	var updateddata = JSON.parse(originaldata);
	//console.log(newcredstr);
	updateddata.push(JSON.parse(newcredstr));

	var encupdateddata = encryptdatawithstretchedkey(JSON.stringify(updateddata), vaultkey, rndsalt, rnditer);

	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");

	xhr.open('POST', '/secure/adduserdata', false);
	xhr.withCredentials = true;
	xhr.setRequestHeader('Content-Type', 'application/json');

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {
			//alert('original data updated ' + JSON.stringify(updateddata));
			$('#vaultaddinputholder').fadeOut(500);
			removediv(document.getElementById('vaultaddinputholder'));

			var dotstoremove = document.getElementsByClassName('dot-vault');

			if (dotstoremove != null && dotstoremove.length > 0) {
				for (var d = 0; d < dotstoremove.length; d++) {
					removediv(dotstoremove[d]);
				}
			}
			displayvaultdataasdots(JSON.stringify(updateddata));
		}
	}

	xhr.send(JSON.stringify({
		group: 'sites',
		salt: rndsalt,
		iterations: rnditer,
		data: encupdateddata,
		sequence: rndseq,
		createdate: rndcrdate
	}));


}

function populatetopicowner(topicname) {
	var xhr = new XMLHttpRequest();

	var url = '/newauth/api/gettopicowner/' + topicname;

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {

			var res = xhr.responseText;

			document.getElementById('topic-admin').innerText = "This page created by: " + res;


		}

	}

	xhr.open('GET', url, true);
	xhr.withCredentials = true;
	xhr.setRequestHeader('Content-Type', 'application/json');


	xhr.send(null);
}

function rotatetopicdemoimage(obj) {
	var att = obj.getAttribute("data-img-index");
	//alert(att);

	if (att == '1') {
		//alert(document.getElementById("dot-img-spinner-label").innerText);
		obj.setAttribute("data-img-index", '100');
		var newHTML = document.getElementById("dot-img-spinner-label").innerHTML;

		newHTML = newHTML.replace("15", "100");
		document.getElementById("dot-img-spinner-label").innerHTML = newHTML;

		document.getElementById("dot-img-spinner").src = '/static/icons/d-ui-100-1.png';
	}

	if (att == '100') {
		obj.setAttribute("data-img-index", '500');
		var newHTML = document.getElementById("dot-img-spinner-label").innerHTML;

		newHTML = newHTML.replace("100", "500");
		document.getElementById("dot-img-spinner-label").innerHTML = newHTML;

		document.getElementById("dot-img-spinner").src = '/static/icons/d-ui-500-1.png';
	}

	if (att == '500') {
		obj.setAttribute("data-img-index", '1');
		var newHTML = document.getElementById("dot-img-spinner-label").innerHTML;

		newHTML = newHTML.replace("500", "15");
		document.getElementById("dot-img-spinner-label").innerHTML = newHTML;

		document.getElementById("dot-img-spinner").src = '/static/icons/d-ui-1.png';
	}

	return false;
}

function displaytopicnewmemberpopup() {
	//alert('will show new member popup');
	//	document.getElementById('jointimeleftdisplay').innerHTML = converttimediffmstocalendar(msleft) + ' left to join';

	//document.getElementById('jointimeleftdisplay').style.display = 'block';
	//alert('in displaytopicnewmemberpopup');

	var flakeoverlay = document.getElementById("topic-welcome-overlay"); // this id is setup as blocking overlay

	if (flakeoverlay == null) {
		//alert('in createUserFlakeOverlay .. creating new overlay');
		flakeoverlay = document.createElement("div");
		flakeoverlay.setAttribute("id", "topic-welcome-overlay");
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
		//panl.style.opacity = 0.9;
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
		//closeanchor.innerHTML = '&times;';
		closeanchor.innerHTML = '<img width="16" height="16" src="/static/icons/cross-sign.png"/>';
		closeanchor.style.float = 'right';
		closeanchor.style.padding = '8px';
		closeanchor.style.opacity = 0.5;
		// closeanchor.style.fontSize= '3em';
		closeanchor.style.top = '0px';
		closeanchor.style.display = 'inline-block';
		//closeanchor.style.color = '#535353';
		closeanchor.style.cursor = 'default';
		closeanchor.addEventListener('mouseover', function(e) {
			e.target.style.opacity = 0.8;
		});
		closeanchor.addEventListener('mouseout', function(e) {
			e.target.style.opacity = 0.5;
		});

		closeanchor.addEventListener('click', function(evt) {
			evt.stopPropagation();
			evt.preventDefault();
			//alert('Close clicked');
			$('#topic-welcome-overlay').fadeOut(500);
			removediv(document.getElementById('topic-welcome-overlay'));

		});
		coldiv.appendChild(closeanchor);

		var pdh = document.createElement('p');
		pdh.classList.add('lead');
		pdh.setAttribute("id", "createuser-flake-text-header");

		pdh.appendChild(document.createTextNode(topicname + ' page on Newauth'));
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

		pd.appendChild(document.createTextNode("Welcome to the " + topicname + " dots page. Dots UI is a unique way to interact with people and ideas. There is no need to install any app or create a Newauth account to use its basic features."));
		pd.style.color = "#878787";
		pd.style.paddingLeft = '8px';
		pd.style.paddingRight = '8px';
		pd.style.fontWeight = "600";

		var pd2 = document.createElement('p');
		pd2.classList.add('text-muted');
		pd2.setAttribute("id", "createuser-flake-text");

		pd2.appendChild(document.createTextNode("Enter your name or an alias to start."));
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

		//	inputrowc.appendChild(candiv);	

		panl.appendChild(inputrowc);

		var inputdiv = document.createElement("div");
		inputdiv.classList.add('panel-body');
		inputdiv.classList.add('panel-word-wrap');
		//inputdiv.style.backgroundColor = "#c2c2c2"; 

		var inputrow = document.createElement("div");
		inputrow.classList.add('row');

		var inputcol = document.createElement("div");
		inputcol.classList.add('col-md-8');
		inputcol.classList.add('col-xs-9');
		inputcol.classList.add('col-md-offset-2');
		inputcol.setAttribute('id', 'create-flk-input-holder');

		inputrow.appendChild(inputcol);

		inputdiv.appendChild(inputrow);
		var cuflkinput = document.createElement("input");
		cuflkinput.setAttribute("type", "text");
		cuflkinput.setAttribute("id", "topic-user-name-input");
		cuflkinput.setAttribute("placeholder", "Name or Alias");
		cuflkinput.setAttribute("autofocus", "true");
		cuflkinput.classList.add('form-control');
		cuflkinput.classList.add('input-md');
		//cuflkinput.addEventListener('input', prepareSendButton, false);

		cuflkinput.addEventListener('click', function(ev) {
			ev.stopPropagation();
		});

		cuflkinput.addEventListener('input', function(ev) {
			ev.stopPropagation();

			var flk = document.getElementById('topic-user-name-input').value;
			if (flk.length > 2) {

				if (document.getElementById('flk-send-button').style.display == 'none') {
					//alert('more than 2 chars');
					document.getElementById('flk-send-button').style.display = 'block';
					//$('#flk-send-button').fadeIn('slow');
				}
			} else {
				document.getElementById('flk-send-button').style.display = 'none';
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
		sendbutton.value = "Join";
		//sendbutton.style.display = 'none';
		sendbutton.addEventListener('click', function(evt) { addnametotopicmembers(evt); }, false);

		var inputcol2 = document.createElement("div");
		inputcol2.classList.add('col-sm-2');
		inputcol2.classList.add('col-xs-3');
		inputrow.appendChild(inputcol2);

		inputcol.appendChild(cuflkinput);
		inputcol2.appendChild(sendbutton);

		inputdiv.appendChild(inputrow);

		panl.appendChild(inputdiv);

		coldiv.appendChild(panl);

		rowdiv.appendChild(coldiv);
		cntnr.appendChild(rowdiv);
		flakeoverlay.appendChild(cntnr);

		$('#topic-user-name-input').focus();

	}

	settimeoutid = setTimeout(function() {
		//flakeoverlay.style.display = "block";
		$('#topic-welcome-overlay').fadeIn('slow');
	}, 300);
}

function displayjointimeclock(secleft) {
	var msleft = parseInt(secleft) * 1000;
	//alert('will show');
	document.getElementById('jointimeleftdisplay').innerHTML = converttimediffmstocalendar(msleft) + ' left to join';

	document.getElementById('jointimeleftdisplay').style.display = 'block';
}

function addnametotopicmembers(ev) {
	ev.stopPropagation();
	var name = document.getElementById('topic-user-name-input').value;

	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");

	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && xhr.status == 200) {
			$('#topic-welcome-overlay').fadeOut(500);
			removediv(document.getElementById('topic-welcome-overlay'));
			posts[0].text = name;
			posts[0].tags = [name, 'joined'];

			if (typeof posts[0].data != 'undefined') {
				var dobj = JSON.parse(posts[0].data);
				if (dobj != null && typeof dobj.text != 'undefined') {
					dobj.text = name + ' joined';
					dobj.tags[0] = name;

					posts[0].data = JSON.stringify(dobj);
				}
			}

			var existpopup = document.getElementById('dot-popup-0');

			if (existpopup != null) {
				document.getElementById('dot-popup-text-0').innerHTML = name + ' joined';

			} else {
				var dotelem = document.getElementById('dot-0');
				if (dotelem != null)
					showpostdatainpopup(posts[0], 0, null, false, dotelem.style.left, dotelem.style.top);
			}

		}

	}

	xhr.open('POST', '/newauth/api/addnameoftopicmember', false);
	xhr.withCredentials = true;
	xhr.setRequestHeader('Content-Type', 'application/json');

	xhr.send(JSON.stringify({
		"topic": topicname,
		"giveout": name,
		"crTime": posts[0].crtime
	}));


}


function displayRadialText(textList, draw) {
	// Get the center point of the screen
	var centerX = window.innerWidth / 2;
	var centerY = window.innerHeight / 2;

	var outputobj = [];
	var safelocationsmap = [];


	var highestz = textList.length * 2;
	// Keep track of the positionsdeg of the text elements
	var positionsdeg = new Set();
	var positionsrad = new Map();
	var centerdotsize = 180;

	centerdotsize = parseInt(Math.min(window.innerHeight, window.innerWidth) * (1.2 / 3.6));  // big center

	// Minimum radius
	var minRadius = (centerdotsize / 2) + centerdotsize * 0.06;

	console.log('Computed centerdot size ' + centerdotsize + ' minradiius ' + minRadius);

	var dotsperrad = {};
	var beginsafeloc = 0;

	var usedidx = new Set();

	var totalcountofdots = 0;

	if (textList.length < 20)
		totalcountofdots = 20;

	if (textList.length >= 20 && textList.length < 50)
		totalcountofdots = 50;

	if (textList.length >= 50)
		totalcountofdots = parseInt(textList.length + 50);

	var areaperdot = ((window.innerWidth * window.innerHeight) - (Math.pow(minRadius * 2, 2))) / totalcountofdots;
	var dotmaxsize = parseInt(Math.sqrt(areaperdot) / 3.2);
	console.log('max dot size [theoretical] ' + dotmaxsize);

	if (dotmaxsize > centerdotsize / 8) dotmaxsize = parseInt(centerdotsize / 8);

	console.log('max dot size [practical] ' + dotmaxsize);

	var maxdiagdeg = parseInt(Math.atan((centerY - (dotmaxsize * 2)) / (centerX - (dotmaxsize * 2))) * 180 / Math.PI);
	console.log('max diagonal at degree ' + maxdiagdeg);

	var maxDiagonal = parseInt((centerX - (dotmaxsize * 2)) / Math.cos(Math.atan((centerY - (dotmaxsize * 2)) / (centerX - (dotmaxsize * 2)))));

	console.log('max diagonal ' + maxDiagonal);

	var cendiv = document.createElement("div");
	cendiv.innerHTML = 'center';
	cendiv.style.color = 'white';
	cendiv.style.fontSize = '9px';

	cendiv.style.position = "absolute";
	cendiv.style.left = centerX - centerdotsize / 2 + "px";
	cendiv.style.top = centerY - centerdotsize / 2 + "px";

	cendiv.style.maxWidth = centerdotsize + "px";
	cendiv.style.width = centerdotsize + "px";

	cendiv.id = '100000';
	cendiv.style.backgroundColor = '#565656';
	cendiv.style.zIndex = highestz - i;
	cendiv.classList.add('dot');
	cendiv.classList.add('centerdot');

	if (draw) document.body.appendChild(cendiv);
	// Iterate through the list of text

	for (var i = 0; i < textList.length; i++) {
		// Get the first 3 letters of the text

		let datatohash;

		if (typeof textList[i].data != 'undefined' && textList[i].data != null && textList[i].data.length > 0) {
			try {
				//console.log('info.data: ' + textList[i].data);
				var dat = JSON.parse(textList[i].data);

				textList[i].data = dat;


			} catch (e) {
				console.error(' Exception caught while parsing JSON:', info.data);
				console.error(' Error details:', e);
			}
		}

		if (textList[i].category != null) {
			//console.log('info.category: ' + textList[i].category);
			datatohash = textList[i].category;
		} else if (textList[i].data != null) {

			if (textList[i].data.category != null)
				datatohash = textList[i].data.category;
			else
				datatohash = JSON.stringify(textList[i].data);
		} else if (textList[i].summary != null) {
			datatohash = textList[i].summary;
		} else if (textList[i].text != null) {
			datatohash = textList[i].text;
		}
		//console.log('input to get data for hash ' + JSON.stringify(textList[i]));
		//console.log('datatohash ' + datatohash);
		var text = datatohash;

		// Create a div element to hold the text
		var div = document.createElement("div");
		//  div.innerHTML = text;
		div.style.color = 'white';
		div.style.fontSize = '9px';
		//  div.style.width = "20px";
		//  div.style.height = "20px";

		// Use the hash value of the text to determine the placement of the text
		//  console.log('processing item ' + i + ' prehash ' + textList[i].datahash + ' datatohash ' + text + ' ticker ' + textList[i].data.Ticker);
		var hashobj;

		if (typeof textList[i].datahash != 'undefined' && textList[i].datahash != null && textList[i].datahash.length > 0) {
			//console.log('hascode from existing hash ' + textList[i].datahash);
			hashobj = hashCodeSHA(textList[i].datahash, true);
		} else if (typeof text != 'undefined') {
				//console.log('hashcode from ' + text);
				hashobj = hashCodeSHA(text);
		} else {
			hashobj = hashCodeSHA(Math.floor(Math.random() * 1e16).toString());
		}
		
		var hashval= hashobj.num;
		
		var angledeg = hashval % 360;
		var angle = angledeg * (Math.PI / 180);

		var halfdotmaxsize = dotmaxsize / 2;
		var maxRadius = Math.sqrt(Math.pow(centerX - halfdotmaxsize, 2) + Math.pow(centerY - halfdotmaxsize, 2));

		var locations = [];
		maxRadius = getMaxRadiusByAngle(angledeg);

		//if (i == 2) {

		if (Object.keys(safelocationsmap).length == 0) {
			populatesafelocationsmap(0);
			//console.log('safelocations  ' + JSON.stringify(safelocationsmap));
			console.log('safelocations size ' + Object.keys(safelocationsmap).length + ' dots per radius ' + JSON.stringify(dotsperrad));
		}

		beginsafeloc = parseInt(Object.keys(safelocationsmap).length / 2);
		//	alert(beginsafeloc);
		if (beginsafeloc % 2 > 0) beginsafeloc++;


		//var maxRadius = Math.min(Math.abs(centerX - window.innerWidth), Math.abs(centerY - window.innerHeight));
		var locidx = hashval % parseInt(Object.keys(safelocationsmap).length / 3);
		var loopcount = 0;
		var inconflict = false;

		// var dotstofling = textList.length*0.4; //dotsperrad[Object.keys(dotsperrad)[0]] + dotsperrad[Object.keys(dotsperrad)[1]];
		// if (i < dotstofling && i%2 > 0) locidx += parseInt(beginsafeloc/2);

		if (hashval % 10 > 6) locidx += parseInt(beginsafeloc / 2);   // 30% dots fling

		if (locidx >= Object.keys(safelocationsmap).length)
			locidx = Object.keys(safelocationsmap).length - 2;

		//	 console.log('locifdx for ' + i + ' ' + locidx + ' safelocations remaining ' + Object.keys(safelocationsmap).length + ' hash ' + hashval);

		while (usedidx.has(locidx)) {
			inconflict = true;
			console.log(i + ' conflict with locidx ');
			if (loopcount > 5) break;
			locidx = safelocationsmap.length - loopcount;

			loopcount++;
		}
		// if (i < textList.length /2) locidx = hashval % (textList.length);

		if (locidx < 0) locidx = safelocationsmap.length - 1;

		if (typeof safelocationsmap[locidx] != 'undefined') {
			//console.log(' a location ' + locidx + ' ' + safelocationsmap[locidx]);
			var angledegs = safelocationsmap[locidx].split('::')[0];
			var rads = safelocationsmap[locidx].split('::')[1];

			var endang = parseInt(angledegs.split(':')[1]);
			if (parseInt(angledegs.split(':')[1]) < parseInt(angledegs.split(':')[0])) {
				endang += 360;
			}
			angledeg = (parseInt(angledegs.split(':')[0]) + endang) / 2;

			if (angledeg > 360) angledeg -= 360;

			var raddiff = parseInt(rads.split(':')[1]) - parseInt(rads.split(':')[0]);

			radius = (parseInt(rads.split(':')[1]) + parseInt(rads.split(':')[0])) / 2;

			var jitter = Math.pow(10, locidx / safelocationsmap.length);

			// console.log(' location ' + locidx + ' jitter ' + jitter);

			if (locidx < dotsperrad[Object.keys(dotsperrad)[0]]) {
				angledeg -= jitter;
				radius -= jitter;
			}
			else {
				if (radius + jitter < getMaxRadiusByAngle(angledeg + jitter)) {
					angledeg += jitter;
					radius += jitter;
				} else if (radius + (jitter / 2) < getMaxRadiusByAngle(angledeg + (jitter))) {
					angledeg += jitter / 2;
					radius += jitter / 2;
				}
			}



		} else {
			console.log('locidx ' + locidx + ' is  undefined .. safelocations size ' + Object.keys(safelocationsmap).length);
			var randangledeg = (hashval % 360);

			if (randangledeg > 0 && randangledeg <= 90) angledeg = maxdiagdeg;

			if (randangledeg > 90 && randangledeg <= 180) angledeg = 180 - maxdiagdeg;

			if (randangledeg > 180 && randangledeg <= 270) angledeg = 180 + maxdiagdeg;

			if (randangledeg > 270 && randangledeg <= 360) angledeg = 360 - maxdiagdeg;

			maxRadius = getMaxRadiusByAngle(angledeg);

			radius = parseInt(Math.max(minRadius, (hashval) % maxRadius));

			if (radius < (minRadius * 1.3)) {
				if ((radius + (hashval) % (dotmaxsize * 3)) < maxRadius)
					radius += (hashval) % (dotmaxsize * 3);
				else if ((radius + (hashval) % (dotmaxsize * 2)) < maxRadius)
					radius += (hashval) % (dotmaxsize * 2);
				else if ((radius + (hashval) % (dotmaxsize)) < maxRadius)
					radius += (hashval) % (dotmaxsize);
			}
			console.log(i + ' hardcoded location angle ' + angledeg + ' rad ' + radius);

			inconflict = true;
		}

		angle = angledeg * (Math.PI / 180);

		const halfBeforeTheUnwantedElement = safelocationsmap.slice(0, locidx);

		const halfAfterTheUnwantedElement = safelocationsmap.slice(locidx + 1);

		safelocationsmap = halfBeforeTheUnwantedElement.concat(halfAfterTheUnwantedElement);

		//console.log(i + ' removed ' + locidx + ' remaining safe positions ' + safelocationsmap.length);

		var x = parseInt(centerX + (radius * Math.cos(angle)));
		var y = parseInt(centerY - (radius * Math.sin(angle)));

		//console.log(i + ' hash ' + hashval + ' angle ' + angledeg + ' maxradius ' + maxRadius + ' radius ' + radius + ' x:y ' + x + ':' + y);

		//	usedidx.add(locidx);
		//	if (locidx < safelocationsmap.length -1) usedidx.add(locidx+1);

		// Set the position of the div element
		div.style.position = "absolute";

		div.style.left = parseInt(x - (dotmaxsize / 2)) + "px";
		div.style.top = parseInt(y - (dotmaxsize / 2)) + "px";

		//	console.log( ' x:y ' + parseInt(x) + ':' + parseInt(y));

		div.id = i;
		//div.style.maxWidth = parseInt(Math.sqrt(areaperdot)/4) + 'px';
		div.style.maxWidth = dotmaxsize + 'px';

		div.style.backgroundColor = '#565656';
		div.style.zIndex = highestz - i;
		div.classList.add('dot');
		locations.push('locidx angle radius -- ' + locidx + ' ::' + parseInt(angledeg) + ':' + parseInt(radius));

		div.title = div.id + JSON.stringify(locations);


		var pastel = getpastelcolor('#' + hashobj.hex.substring(0, 6));

		//console.log('index ' + i + ' text ' + text + ' pastel ' + pastel);
		// Add the div element to the body of the document
		if (typeof draw != 'undefined' && draw) {
			document.body.appendChild(div);

			document.getElementById('elemcount').innerHTML = textList.length;

			if (i == textList.length - 1) {
				document.addEventListener("click", function() {

					var dots = document.getElementsByClassName('dot');
					//alert('hello');
					for (var x = 0; x < dots.length; x++) {
						if (!dots[x].classList.contains('centerdot')) {
							dots[x].classList.add('shake');

							removeshake(x);
						}
					}
				});
			}

			setpastelcolor(i, pastel);
		}

		//	if (inconflict) setpastelcolor(i, '#565656');

		outputobj.push({
			left: parseInt(x - (dotmaxsize / 2)) + "px",
			top: parseInt(y - (dotmaxsize / 2)) + "px",
			width: dotmaxsize + 'px',
			dotmaxsize: dotmaxsize,
			pcolor: pastel,
			color: '#' + hashobj.hex.substring(0, 6)

		});


	}

	//console.log('remaining safe positions ' + safelocationsmap.length);
	safelocationsmap = [];

	console.log('safe positions map cleared. new size ' + safelocationsmap.length);
	return outputobj;

	function cleardots() {
		document.querySelectorAll(".dot").forEach(el => el.remove());
	}

	function getMaxRadiusByAngle(deg) {

		if (deg > 360)
			deg = deg - 360;

		var maxRadius;
		var angle = deg * (Math.PI / 180);
		if (deg <= maxdiagdeg) {
			maxRadius = (centerX - (dotmaxsize)) / Math.cos(angle);
		}

		if (deg > maxdiagdeg && deg <= (180 - maxdiagdeg)) {
			//console.log('degree ' + angledeg + ' ' + (centerY - 50 )/Math.sin(angle) + ' ' + centerX + ' ' + Math.cos(angle) );
			maxRadius = Math.abs((centerY - 65) / Math.sin(angle));
		}

		if (deg > (180 - maxdiagdeg) && deg <= (180 + maxdiagdeg)) {
			maxRadius = Math.abs((centerX - (dotmaxsize)) / Math.cos(angle));
		}

		if (deg > (180 + maxdiagdeg) && deg <= (360 - maxdiagdeg)) {
			maxRadius = Math.abs((centerY - (dotmaxsize)) / Math.sin(angle));
		}

		if (deg > (360 - maxdiagdeg) && deg <= 360) {
			maxRadius = Math.abs((centerX - (dotmaxsize)) / Math.cos(angle));
		}

		return maxRadius;
	}

	function populatesafelocationsmap(deg) {
		var dotelems = document.getElementsByClassName('dot');
		var realdotsize = dotmaxsize;

		//	if (dotelems != null && dotelems.length > 1) realdotsize = dotelems[1].clientWidth;

		//if (realdotsize > 30) realdotsize = 30;

		console.log('realdotsz ' + realdotsize);
		var cellcount = 0;
		var skpd = 0;
		for (var rad = minRadius; rad <= maxDiagonal; rad += (realdotsize * 1.618)) { // going outwards
			var loggedmsg = [];
			loggedmsg.push('processing radius ' + rad);
			var safedistang = Math.atan((realdotsize * 1.8 / rad));
			var degdiff = Math.ceil(safedistang * (180 / Math.PI)) + 1;

			for (var startdeg = deg; startdeg < deg + 360; startdeg += degdiff * 1.1) {
				var enddeg = startdeg + (degdiff * 1.1);

				var endrad = rad + (realdotsize * 1.8);

				var stdeg = startdeg;
				var endeg = enddeg;

				if (stdeg > 360) stdeg -= 360;

				if (endeg > 360) break; //endeg -= 360;

				//console.log('processing startdeg enddeg ' + startdeg + ' ' + enddeg + ' converted ' + stdeg + ' ' + endeg);
				var maxradforrange = Math.min(getMaxRadiusByAngle(stdeg), getMaxRadiusByAngle(endeg));
				//	maxradforrange = Math.min(maxradforrange, maxDiagonal);

				maxradforrange = getMaxRadiusByAngle((stdeg + endeg) / 2);

				if ((rad + endrad) / 2 < maxradforrange) {

					safelocationsmap.push(parseInt(stdeg) + ':' + parseInt(endeg) + '::' + parseInt(rad) + ':' + parseInt(endrad));
					//	console.log('ADDED startdeg ' + startdeg + ' ENDDEG ' + enddeg + ' maxradforrange ' +  maxradforrange + ' endrad ' + endrad );
					//		drawindicator(stdeg,endeg,rad,endrad);
					addradiusentry(parseInt(rad));
					cellcount++;
				} else {
					skpd++;
					//	drawindicator(stdeg,endeg,rad,endrad, true);
					//	if (startdeg == 189 ) console.log('radii ' + getMaxRadiusByAngle(stdeg) + ' ' + getMaxRadiusByAngle(endeg) + ' --- ' + stdeg + ' ' + endeg);
					//	console.log('SKIPPED startdeg ' + startdeg + ' ENDDEG ' + enddeg + ' maxradforrange ' +  maxradforrange + ' endrad ' + endrad );
				}
			}

			loggedmsg.push('processed ');
			//console.log(...loggedmsg);
		}
		console.log('no of cells ' + cellcount + ' skipped ' + skpd);
	}

	function addradiusentry(radius) {

		if (typeof dotsperrad[radius] != 'undefined') {
			dotsperrad[radius] += 1;
		} else {
			dotsperrad[radius] = 1;
		}

	}

	function getsafeangleforradius(rad) {
		var dotelems = document.getElementsByClassName('dot');
		var realdotsize = dotmaxsize;

		if (dotelems != null && dotelems.length > 1) realdotsize = dotelems[1].clientWidth;

		var safedistang = Math.atan((realdotsize * 2 / rad));

		return Math.ceil(safedistang * (180 / Math.PI))

	}

	function drawindicator(stdeg, endeg, rad, endrad, skipped) {

		if (stdeg > endeg) endeg += 360;
		var radius = (parseInt(rad) + parseInt(endrad)) / 2;
		var angledeg = (parseInt(stdeg) + parseInt(endeg)) / 2;

		if (angledeg > 360) angledeg -= 360;

		var angle = angledeg * (Math.PI / 180);
		var x = parseInt(centerX + (radius * Math.cos(angle)));
		var y = parseInt(centerY - (radius * Math.sin(angle)));

		//console.log(i + ' hash ' + hashval + ' angle ' + angledeg + ' maxradius ' + maxRadius + ' radius ' + radius + ' x:y ' + x + ':' + y);
		var div = document.createElement('div');
		// Set the position of the div element
		div.style.position = "absolute";
		div.innerHTML = '+';
		div.style.left = parseInt(x) + "px";
		div.style.top = parseInt(y) + "px";

		//	console.log( ' x:y ' + parseInt(x) + ':' + parseInt(y));
		div.title = stdeg + '-' + endeg + ':' + radius + ' ::' + div.style.left + ' ' + div.style.top;
		//div.id = text.trim();
		div.style.maxWidth = '4px';

		if (typeof skipped != 'undefined' && skipped) {
			div.style.color = '#cbcbcb';
		} else {
			div.style.color = '#232323';
		}

		div.style.zIndex = highestz - i;
		//div.classList.add('dot');

		// Add the div element to the body of the document
		document.body.appendChild(div);
	}

	function setpastelcolor(x, pastel) {
		var dots = document.getElementsByClassName('dot');
		setTimeout(function() {
			if (!dots[x].classList.contains('centerdot')) {
				dots[x].style.backgroundColor = pastel;
				//dots[x].style.backgroundImage = 'linear-gradient(60deg, ' + pastel + ' 20%,' + pastel + ' 60%,' + pastel + ' 70%, #fafafa 100%)'; /* Add gradient */
				//dots[x].style.boxShadow ="0 2px 6px rgba(0, 0, 0, 0.1)";  /* Add box shadow for depth */
			}
		}, 500);
	}

	function removeshake(x) {
		var dots = document.getElementsByClassName('dot');
		setTimeout(function() { if (!dots[x].classList.contains('centerdot')) dots[x].classList.remove('shake'); }, 1000);
	}

	function addangletoradius(rad, ang) {
		if (positionsrad.has(rad)) {
			var angles = positionsrad.get(rad);
			angles.add(ang);
			positionsrad.set(rad, angles);
		} else {
			var angles = new Set();
			angles.add(ang);
			positionsrad.set(rad, angles);
		}
	}

	function getanglereservecount(angledeg) {
		var count = 10;
		if (angledeg <= maxdiagdeg / 2) {
			count = 15;
		}



		if (angledeg > (180 - (maxdiagdeg / 2)) && angledeg <= (180 + (maxdiagdeg / 2))) {
			count = 15;
		}


		if (angledeg > (360 - (maxdiagdeg / 2)) && angledeg <= 360) {
			count = 15;
		}
		return count;
	}

	function rotateinspace(deg, safeangle, pos) {
		//console.log('in rotateinspace deg ' + deg + ' safe ' + safeangle + ' pos ' + pos);
		var stretch = false;
		var shrink = false;

		if (deg <= maxdiagdeg / 2) {
			deg += safeangle * 2;
		}

		if (deg > maxdiagdeg / 2 && deg <= (180 - (maxdiagdeg / 2))) {
			if (pos <= 0.5)
				stretch = true;
			else {
				shrink = true;
			}

			if (deg < 90)
				deg += safeangle;
			else
				deg -= safeangle;
		}

		if (deg > (180 - (maxdiagdeg / 2)) && deg <= (180 + (maxdiagdeg / 2))) {
			deg += safeangle * 2;
		}

		if (deg > (180 + maxdiagdeg / 2) && deg <= (360 - (maxdiagdeg / 2))) {
			if (pos <= 0.5)
				stretch = true;
			else {
				shrink = true;
			}

			deg += safeangle;
		}

		if (deg > (360 - (maxdiagdeg / 2)) && deg <= 360) {
			deg += safeangle * 2;
			if (pos <= 0.5)
				stretch = true;
			else {
				shrink = true;
			}
		}

		return { "newangledeg": deg, "stretch": stretch };
	}

} // displayRadialText end

// Hash function
function hashCode(str) {
	var hash = 0;
	for (var i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash = hash & hash;
	}
	return hash;
}


function hashCodeSHA(str, ishash) {

	var hashasnum;
	var bitArray;
	var digest_sha256;

	if (typeof ishash == 'undefined' || ishash == false) {

		if (str.length > 1000) {
			bitArray = sjcl.hash.sha256.hash(str.substring(0, 1000));
		} else {
			bitArray = sjcl.hash.sha256.hash(str);
		}

		digest_sha256 = sjcl.codec.hex.fromBits(bitArray);
	} else {
		digest_sha256 = str;
	}

	if (digest_sha256 != null)
		hashasnum = parseInt(digest_sha256.substring(digest_sha256.length - 10, digest_sha256.length), 16);

	//console.log('returning hsh for ' + str + ':' + ishash + ' ' + hashasnum );
	return { 'hex': digest_sha256, 'num': hashasnum };
}


var rgbmap;

function getpastelcolor(col) {
	if (rgbmap == null) {
		creatergbmapofpastels();
	}
	var pastel = findclosestrgbfrommap(col);

	//console.log('Pastel found ' + pastel );
	return pastel;
};

function creatergbmapofpastels() {
	rgbmap = {};
	var pastelcodes = [' F7F6CF ', ' B6D8F2 ', ' F4CFDF ', ' 5784BA ', ' 9AC8EB ', ' CCD4BF ', ' E7CBA9 ', ' EEBAB2 ', ' F5F3E7 ', ' F5E2E4 ', ' F5BFD2 ', ' E5DB9C ', ' D0BCAC ', ' BEB4C5 ', ' E6A57E ', ' 218B82 ',
		' 9AD9DB ', ' E5DBD9 ', ' 98D4BB ', ' EB96AA ', ' C6C9D0 ', ' C54B6C ', ' E5B3BB ', ' C47482 ', ' D5E4C3 ', ' F9968B ', ' F27348 ', ' 26474E ', ' 76CDCD ', ' 2CCED2 ', ' B8E0F6 ', ' A4CCE3 ', ' 37667E ',
		' DEC4D6 ', ' 7B92AA ', ' DDF2F4 ', ' 84A6D6 ', ' 4382BB ', ' E4CEE0 ', ' A15D98 ', ' DC828F ', ' F7CE76 ', ' E8D6CF ', ' 8C7386 ', ' 9C9359 ', ' F4C815 ', ' F9CAD7 ', ' A57283 ', ' C1D5DE ', ' DEEDE6 ',
		' E9BBB5 ', ' E7CBA9 ', ' AAD9CD ', ' E8D595 ', ' 8DA47E ', ' CAE7E3 ', ' B2B2B2 ', ' EEB8C5 ', ' DCDBD9 ', ' FEC7BC ', ' FBECDB ', ' F3CBBD ', ' 90CDC3 ', ' AF8C72 ', ' 938F43 ', ' B8A390 ', ' E6D1D2 ',
		' DAD5D6 ', ' B2B5B9 ', ' 8FA2A6 ', ' 8EA4C8 ', ' C3B8AA ', ' DEDCE4 ', ' DB93A5 ', ' C7CDC5 ', ' 698396 ', ' A9C8C0 ', ' DBBC8E ', ' AE8A8C ', ' 7C98AB ', ' C2D9E1 ', ' D29F8C ', ' D9D3D2 ', ' 81B1CC ',
		' FFD9CF ', ' C6AC85 ', ' D9C2BD ', ' A2C4C6 ', ' 82B2B8 ', ' 874741 ', ' CA9C95 ', ' 40393E ', ' E5E4E5 ', ' 897C87 ', ' 46302B ', ' 76504E ', ' D3CCCA ', ' A37E7E ', ' 86736C ',
		' AD192A ', ' E4B78F ', ' F1E8EA ', ' D88D96 ', ' EAB1B9 ', ' F38C10 ', ' A7763B ', ' CCD7D8 ', ' 4C482E ', ' D2B6BA ', ' BE3F12 ', ' 7DB0CD ', ' C0B5AB ', ' 79553F ', ' 91BA96 ', ' A65111 ',
		' DDAA00 ', ' 7C5D3D ', ' 85AAAA ', ' 173F4E ', ' D82315 ', ' 2F1710 ', ' 425164 ', ' DABB96 ', ' 899FB6 ', ' DBB657 ', ' 86553F ', ' C8C2D0 ', ' E45C54 ', ' 90A375 ', ' F9BB9D ', ' FFDA43 ', ' 756382 ',
		' E2C274 ', ' 9CA8B5 ', ' FFE75D ', ' D24970 ', ' 32657C ', ' 669BB7 ', ' CF8145 ', ' 753516 ', ' AF6F33 ', ' 9DB4BA ', ' 210E0D ', ' E2D2C1 ', ' CA8459 ', ' DDB396 ', ' DDDFE3 ', ' 422523 ', ' 954D34 ',
		' 843619 ', ' B87730 ', ' 1B2625 ', ' DAD0CE ', ' 748991 ', ' 64A532 ', ' B09647 ', ' 450309 ', ' DEE2E3 ', ' 7B5536 ', ' 446C04 ', ' F8DF96 ', ' 977D77 ', ' 301F1A ', ' 5E301F ', ' 8E3229 ', ' AEBB35 ',
		' 2F1D16 ', ' D0BDAA ', ' A37537 ', ' FF415B ', ' BC7F37 ', ' 352C20 ', ' EAE8E8 ', ' 64AA71 ', ' F64900 ', ' CB8A2D ', ' 262416 ', ' DDDDDE ', ' 90B274 ', ' B08D7E ', ' 6C74A4 ', ' BBB9BC ', ' 5E2424 ',
		' 95BB9A ', ' 652F20 ', ' 74C85D ', ' 2D3538 ', ' 57818A ', ' D54C2E ', ' D09150 ', ' DEBD9B ', ' 3C2320 ', ' 955132 ', ' EBEBEF ', ' B08138 ', ' 784928 ', ' 382918 ', ' DDD4D3 ', ' AE8A75 ', ' F08E88 ',
		' 422D09 ', ' 468F5E ', ' AC7C36 ', ' E3E2DF ', ' E1A624 ', ' 317AC1 ', ' 384454 ', ' D4D3DC ', ' AD956B ', ' F38C10 ', ' A7763B ', ' CCD7D8 ', ' 4C482E ', ' D2B6BA ', ' C5853D ', ' 99372E ', ' DAD4D9 ',
		' 391C19 ', ' B27E83 ', ' 4F3B2B ', ' 7C6619 ', ' B8B5AD ', ' BE0309 ', ' 93C1D5 '];

	for (var c = 0; c < pastelcodes.length; c++) {
		var rgbobj = hexToRgb1(pastelcodes[c].trim());
		if (rgbobj != null) {
			rgbmap[pastelcodes[c].trim()] = rgbobj;

		}
	}

	//console.log('RGBMAP created'  );
}

function findclosestrgbfrommap(col) {
	//document.getElementById('b64').style.backgroundColor = col; /// Remove this LINE
	col = col.replace('#', '');
	var rgbobjforcol = hexToRgb1(col);

	//console.log('Looking for the closest color for ' + col + ' ' + JSON.stringify(rgbobjforcol));

	var distance = -1;
	var closestcolor;
	const rgbkeys = Object.keys(rgbmap);
	rgbkeys.forEach((key, index) => {
		//console.log(`${key}: ${rgbmap[key]}`);
		var thisdist = calculatedistance(rgbobjforcol, rgbmap[key]);
		if (distance < 0 || thisdist < distance) {

			if (distance > 0) {
				//document.getElementById('json').style.backgroundColor = '#'+key; /// Remove this LINE
				closestcolor = '#' + key;
				//console.log('Idx ' + index + 'Closest  ' + closestcolor + ' distance ' + thisdist);
			}
			distance = thisdist;
		}
	});

	return closestcolor;
}

function calculatedistance(obj1, obj2) {

	return Math.pow(obj1.r - obj2.r, 2) + Math.pow(obj1.g - obj2.g, 2) + Math.pow(obj1.b - obj2.b, 2);
}


function hexToRgb1(hex) { // better version
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}


