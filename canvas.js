console.log("canvas script loading...");
if (window.jQuery) console.log("jQuery loaded.");
else error("jQuery has not loaded");

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Initiation //////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var server = "https://ccookf.com:4242";
//var server = "https://localhost:4242";
var version = "0.2.2";
var isValidUser = false; 

var debug_mode = false;
var scale = [1, 2, 4, 8, 16, 32, 64];

var offset = { x: 0, y: 0 };
var scale_level = 4;

var pos = { x: null, y: null }; //Mouse position in image space as stroke coord
var isMouseDown = false;
var isDragMode = false;
var isGuideMode = false;
var isAltHeld = false;
var isSpaceHeld = false;
var downCoords = { x: 0, y: 0 }; //Coordinates of mousedown event
var mouseOverPixel = { x: 0, y: 0 }; //Current "pixel" under the mouse

var paintColor = { r: 128, g: 255, b: 255 };

// Canvas and image data
var canvas = document.getElementById("paint");
var ctx = canvas.getContext("2d");

//Set initial dimensions of the canvas to match the window
function resizeDisplay() {
	canvas.width = $('.canvas-wrap').width();
	canvas.height = $('.canvas-wrap').height();

	//These seem to reset when the canvas dimensions are adjusted
	//Need to look into why later
	ctx.mozImageSmoothingEnabled = false;
	ctx.webkitImageSmoothingEnabled = false;
	ctx.msImageSmoothingEnabled = false;
	ctx.imageSmoothingEnabled = false;
}
//Listen and resize automatically
$(window).resize(resizeDisplay);
resizeDisplay(); //first time

//Set the window to be unselectable (no highlighting)
window.onload = ()=>{
	//If needed this can be applied per element instead of doc
	document.onselectstart = ()=>{ return false; };
	//document.onmousedown = ()=>{ return false; };
}

var image = document.getElementById("image");
var ictx = image.getContext("2d");

//load the base image onto the image canvas
var img = new Image();

// IO Server
var socket = io(server);
initChat(socket);
socket.on('connect', ()=>{
	console.log("Connected to server successfully");
	getChatHistory();
	socket.emit('get_canvas', (data)=>{

		if (!data) { error("Failed to retreive canvas data."); return; }

		console.log(data);
		if (data.version != version) {
			alert("Client version mismatch. Clear your cache and reload the page. Contact the developer if the problem persists.");
			socket.disconnect();
		}

		//Set the size of the canvas hosting the image to match the data
		image.height = data.height;
		image.width = data.width;
		resetView(); //Sets the canvas offets
		initImage();

		initChunks(data.height, data.width, data.CHUNK_SIZE);
		
		checkUnloadedChunks();
	});

	autoLogin();
});

socket.on('disconnect', ()=>{
	$("#notification").html("Disconnected!");
});

socket.on('user-count', (number)=>{
	if (number == 1) $("#notification").html(number + " user online");
	else $("#notification").html(number + " users online");
});

// User data
var apiKey = localStorage.getItem("wk-api-key");

function autoLogin() {
	if (apiKey == null) {
		$("#login").removeClass("hidden");
	} else {
		socket.emit("verify", apiKey, (res, err)=>{
			if (res == true) {
				isValidUser = true;
				$("#login").html("Logout");
			} else {
				if (confirm("Login failed. Keep API key in storage?") == false) {
					localStorage.removeItem("wk-api-key");
				}
			}
		});
	}
}

$("#login").click(()=>{
	if (!isValidUser) {
		var apiKey = prompt("Please enter your WaniKani API Key");
		if (apiKey == null || apiKey == "") return;
		else {
			socket.emit("verify", apiKey, (res, err)=>{
				if (res == true) {
					localStorage.setItem("wk-api-key", apiKey);
					isValidUser = true;
					$("#login").html("Logout");
				} else {
					alert("Failed to validate user: " + err);
				}
			});
		}
	} else {
		console.log("Logging out");
		socket.emit('logout', (res)=>{
			if (!res) console.error("Problem with logout.");
		});
		localStorage.removeItem("wk-api-key");
		isValidUser = false;
		$("#login").html("Login");
	}
});

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Input Processing ////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

// Zoom Events - mousewheel up/down
canvas.addEventListener("DOMMouseScroll", wheelHandler, false); //firefox
canvas.addEventListener("mousewheel", wheelHandler, false); //everyone else
function wheelHandler(e) {
	var up = e.deltaY > 0 ? false : true;
	if (debug_mode) console.log("Wheel event fired:\t" + e.deltaY + "\t(" + up + ")");
	if (up) zoomIn();
	else zoomOut();
}

// UI events
$("#zoomout").click(zoomOut);
$("#zoomin").click(zoomIn);
$("#reset").click(resetView);
$("#save").click(()=>{
	var link = document.getElementById('save-link');
	link.setAttribute('href', image.toDataURL());
	link.click();
});

var picker = document.getElementById("color-picker");
$("#color-picker").click(()=>{
	var hex = $("#color-picker").val();
	paintColor.r = parseInt(hex.slice(1, 3), 16);
	paintColor.g = parseInt(hex.slice(3, 5), 16);
	paintColor.b = parseInt(hex.slice(5, 7), 16);
});
$("#color-picker").change(()=>{
	var hex = $("#color-picker").val();
	paintColor.r = parseInt(hex.slice(1, 3), 16);
	paintColor.g = parseInt(hex.slice(3, 5), 16);
	paintColor.b = parseInt(hex.slice(5, 7), 16);
});

//Default colors
$("#white").click(()=>{ 	paintColor = { r: 255, 	g: 255, 	b: 255 	};	updateColorPicker();});
$("#red").click(()=>{ 		paintColor = { r: 255, 	g: 0, 		b: 0 	};	updateColorPicker();});
$("#orange").click(()=>{ 	paintColor = { r: 255, 	g: 165, 	b: 0 	};	updateColorPicker();});
$("#peach").click(()=>{ 	paintColor = { r: 255, 	g: 218, 	b: 185 	};	updateColorPicker();});
$("#yellow").click(()=>{ 	paintColor = { r: 255, 	g: 255, 	b: 0 	};	updateColorPicker();});
$("#green").click(()=>{ 	paintColor = { r: 0, 	g: 128, 	b: 0 	};	updateColorPicker();});
$("#blue").click(()=>{ 		paintColor = { r: 0, 	g: 0, 		b: 255 	};	updateColorPicker();});
$("#purple").click(()=>{ 	paintColor = { r: 128, 	g: 0, 		b: 128 	};	updateColorPicker();});
$("#brown").click(()=>{ 	paintColor = { r: 139, 	g: 69, 		b: 19 	};	updateColorPicker();});
$("#black").click(()=>{ 	paintColor = { r: 0, 	g: 0, 		b: 0 	};	updateColorPicker();});

// Chat toggle
$("#toggle-chat").click(()=>{
	var box = $(".main-ui");
	if (box.css("width") == "0px") {
		box.css("width", "30%");
		box.css("min-width", "15em");
	} else {
		box.css("width", "0");
		box.css("min-width", "0");
	}
	resizeDisplay();
});

// Mouse state
canvas.addEventListener("mousedown", (e)=>{
	pos = canvasToImageCoordinate(e.layerX, e.layerY) //update current mouse pos
	if (e.altKey) {
		try {
			var pick = (ctx.getImageData(e.layerX, e.layerY, 1, 1)).data;
			paintColor.r = pick[0];
			paintColor.g = pick[1];
			paintColor.b = pick[2];
			updateColorPicker();
		} catch (e) { error("Failed to pick color: " + e.message); }
	} else {
		isMouseDown = true;
		downCoords.x = e.layerX;
		downCoords.y = e.layerY;

		if (!isDragMode && !isAltHeld) {
			var localCoord = pos;
			//Boundary checking before attempting paint
			if (localCoord.x < 0 || localCoord.y < 0) return;
			if (localCoord.x > image.width || Math.abs(localCoord.y) > image.height) return;
			if (isChunkLoaded(localCoord.x, localCoord.y) == false) return;
			paint(localCoord.x, localCoord.y, ()=>{
				//Do nothing
			});
		}
	}
});
canvas.addEventListener("mouseleave", ()=>{
	isMouseDown = false;
	isDragMode = false;
	updateCanvas(); //Remove the pixel preview, even across windows
});

canvas.addEventListener("mouseup", ()=>{
	isMouseDown = false;
});

canvas.addEventListener("mousemove", mouseMove);

// Keyboard events
window.addEventListener("keyup", (e)=>{
	switch (e.key) {
		case "-":
			zoomOut();
			break;
		case "=":
			zoomIn();
			break;
		case "0":
			resetView();
			break;
		case "g":
			isGuideMode = !isGuideMode;
			console.log("Guide Mode: " + isGuideMode);
			updateCanvas();
			break;
		case " ":
			isDragMode = false;
			break;
		default:
			if (debug_mode) console.log("Unexpected keyboard event: " + e.key);
			return;
	}
});
window.addEventListener("keydown", (e)=>{
	switch (e.key) {
		case " ":
			isDragMode = true;
			break;
		case "Alt":
			updateCanvas(); //clears out temp drawings for pick mode
			isAltHeld = true;
			break;
		default:
			//do nothing
	}
});
window.addEventListener("keyup", (e)=>{
	switch (e.key) {
		case "Alt":
			isAltHeld = false;
			break;
		default:
			//do nothing
	}
});

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Functions ///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

function updateCanvas(callback) {
	clearCanvas();
	ctx.drawImage(	image, offset.x, offset.y, 
					image.width * scale[scale_level], image.height * scale[scale_level]);

	if (isGuideMode && scale_level >= 3) {
		//determine the total steps on screen
		var zoom = scale[scale_level];
		var steps = { x: canvas.width / zoom, y: canvas.height / zoom };

		//Align the grid the pixels of the image
		var start = {};
		start.x = 0 + Math.floor(offset.x % zoom);
		start.y = 0 + Math.floor(offset.y % zoom);

		//Vertical lines
		ctx.beginPath();
		ctx.strokeStyle = 'rgba(32, 32, 32, 0.2)';
		for (i = 0; i <= steps.x + 1; i++) {
			ctx.moveTo(start.x + zoom * i, start.y);
			ctx.lineTo(start.x + zoom * i, canvas.height);
		}

		//Horizontal lines
		for (i = 0; i <= steps.y + 1; i++) {
			ctx.moveTo(start.x, start.y + zoom * i);
			ctx.lineTo(canvas.width, start.y + zoom * i);
		}
		ctx.closePath();
		ctx.stroke();
	}

	if (callback) { callback(true); }
}

function clearCanvas() {
	ctx.fillStyle = "grey";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function initImage() {
	ictx.fillStyle = "black";
	ictx.fillRect(0, 0, image.width, image.height);
}

function resetView() {
	//Reset the zoom
	scale_level = 0;
	//Get the offsets for the top left corner of the image that would center on canvas
	offset.x = (canvas.width - image.width) / 2;
	offset.y = (canvas.height - image.height) / 2;
	updateCanvas();
}

function zoomIn() {
	if (scale_level < scale.length - 1) {
		
		//Convert the center of the screen to a coordinate in image space
		localCoord = canvasToImageCoordinate(canvas.width/2, canvas.height/2);
		
		//Change the scale
		++scale_level;
		var zoom = scale[scale_level];

		//Revert back from image space coordinates to the center of screen
		offset.x = canvas.width/2 - localCoord.x * zoom;
		offset.y = canvas.height/2 - localCoord.y * zoom;
	}
	updateCanvas();
	checkUnloadedChunks();
}

function zoomOut() {
	if (scale_level > 0) {
		
		localCoord = canvasToImageCoordinate(canvas.width/2, canvas.height/2);
		
		--scale_level;
		var zoom = scale[scale_level];
		offset.x = canvas.width/2 - localCoord.x * zoom;
		offset.y = canvas.height/2 - localCoord.y * zoom;
	}
	updateCanvas();
	checkUnloadedChunks();
}

function canvasToImageCoordinate(x, y) {
	var zoom = scale[scale_level];
	localCoord = { x: 0, y: 0 };
	localCoord.x = Math.floor((x - offset.x) / zoom);
	localCoord.y = Math.floor((y - offset.y) / zoom);

	return localCoord;
}

function imageToCanvasCoordinate(x, y) {
	var zoom = scale[scale_level];
	canvasCoord = { x: 0, y: 0 };
	canvasCoord.x = x * zoom + offset.x;
	canvasCoord.y = y * zoom + offset.y;

	return canvasCoord;
}

function paint(x, y, callback) {
	if (isValidUser == false) return;
	var color = new Uint8Array([paintColor.r, paintColor.g, paintColor.b]);

	var start = { x: pos.x, y: pos.y };

	//Get the difference from the current coordinate and last paint coordinate
	var diff = { x: x - start.x, y: y - start.y };

	//Use the distance as the number of steps when interpolating a stroke
	var steps = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
	steps = steps < 1 ? 1 : steps; //min 1

	for (var i = 0; i < steps; i++) {
		var delta = i / steps;
		var stepx = Math.floor(start.x + diff.x * delta);
		var stepy = Math.floor(start.y + diff.y * delta);

		var out = { color: color, pos: { x: stepx, y: stepy }};
		
		//Don't paint the pixel until the server verifies its fine and announces it
		socket.emit('paint', out);
	}
	callback();
}

//Server announcing the paint from above function
socket.on('paint', (data)=>{
	//console.log(data);
	ictx.fillStyle = 'rgb(' + data.color[0] + ',' + data.color[1] + ',' + data.color[2] + ')';
	ictx.fillRect(data.pos.x, data.pos.y, 1, 1);
	updateCanvas();
});

function mouseMove(e) {
	var x = e.layerX;
	var y = e.layerY;

	//Preview pixel placement. Do not display when using color pick (alt key)
	localCoord = canvasToImageCoordinate(x, y);
	if (!e.altKey && (localCoord.x != mouseOverPixel.x || localCoord.y != mouseOverPixel.y)) {
		//Convert local coordinates to canvas space
		canvasCoord = imageToCanvasCoordinate(localCoord.x, localCoord.y);
		//Draw the image state back onto the canvas, clearing out temp items
		updateCanvas((finished)=>{
			//Draw directly to the main canvas, not the image
			ctx.fillStyle = 'rgb(' + paintColor.r + ',' + paintColor.g + ',' + paintColor.b + ')';
			ctx.fillRect(canvasCoord.x, canvasCoord.y, 1 * scale[scale_level], 1 * scale[scale_level]);
		});
	}

	//Display the mouse coordinates
	centeredCoord = { x: localCoord.x - image.width / 2, y: -1 * (localCoord.y - image.height / 2) };
	$("#coordinates").html("( " + centeredCoord.x + ", " + centeredCoord.y + ")");
	
	if (isMouseDown && isDragMode) {
		offset.x += x - downCoords.x;
		offset.y += y - downCoords.y;

		downCoords.y = y;
		downCoords.x = x;

		updateCanvas();
		checkUnloadedChunks();
	}

	//Paint with strokes
	if (isMouseDown && !isDragMode && !isAltHeld) {
		if (localCoord.x != pos.x || localCoord.y != pos.y) {
			
			//Boundary checking
			if (localCoord.x < 0 || localCoord.y < 0) return;
			if (localCoord.x > image.width || Math.abs(localCoord.y) > image.height) return;
			if (isChunkLoaded(localCoord.x, localCoord.y) == false) return;

			paint(localCoord.x, localCoord.y, ()=>{
				pos = localCoord; //update the last stroke coordinate
			});
		}
	}
}

function colorToHex(color) {
	var out = "#";
	out += decToHexPadded(color.r);
	out += decToHexPadded(color.g);
	out += decToHexPadded(color.b);
	return out;
}

function decToHexPadded(number) {
	number = number.toString(16);
	number = number.length == 1 ? "0" + number : number;
	return number;
}

function updateColorPicker() {
	$("#color-picker").val(colorToHex(paintColor));
}

var isLoadingChunks = false;
function checkUnloadedChunks() {
	var topLeft = canvasToImageCoordinate(0,0);
	var bottomRight = canvasToImageCoordinate(canvas.width, canvas.height);
	var ul = findUnloadedChunks(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y);
	
	if ((ul.length != 0) && (isLoadingChunks == false)) {
		var center = canvasToImageCoordinate(canvas.width/2, canvas.height/2);
		sortUnloadedChunks(ul, center.x, center.y);
		isLoadingChunks = true;
		loadChunks(ul, ictx, (res)=>{
			isLoadingChunks = false;
			console.log("Finished loading chunks.");
		});
	}
}

function error(message) {
	console.log(message);
}
