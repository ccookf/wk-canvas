console.log("canvas script loading...");
if (window.jQuery) console.log("jQuery loaded.");
else error("jQuery has not loaded");

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Initiation //////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var server = "http://ccookf.com:4242";

var debug_mode = false;
var scale = [1, 2, 4, 8, 16, 32, 64];

var offset = { x: 0, y: 0 };
var scale_level = 2;

var pos = { x: 0, y: 0 };
var isMouseDown = false;
var isDragMode = false;
var isGuideMode = false;
var dragThreshold = 25; //Number of pixels before mousedown is treated as a drag
var downCoords = { x: 0, y: 0 }; //Coordinates of mousedown event
var mouseOverPixel = { x: 0, y: 0 }; //Current "pixel" under the mouse

var paintColor = { r: 128, g: 255, b: 255 };

// Canvas and image data
var canvas = document.getElementById("paint");

var ctx = canvas.getContext("2d");

//Set initial dimensions of the canvas to match the window
function resizeDisplay() {
	canvas.width = $(window).width();
	canvas.height = $(window).height();

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

//Set the window to be unselectable
window.onload = ()=>{
	//If needed this can be applied per element instead of doc
	document.onselectstart = ()=>{ return false; };
	document.onmousedown = ()=>{ return false; };
}

var image = document.getElementById("image");
var ictx = image.getContext("2d");

//load the base image onto the image canvas
var img = new Image();

// IO Server
var socket = io(server);
socket.on('connect', ()=>{
	console.log("Connected to server successfully");

	socket.emit('getcanvas', (data)=>{

		if (!data) { error("Failed to retreive canvas data."); return; }

		//Set the size of the canvas hosting the image to match the data
		image.height = data.length;
		image.width = data[0].length;

		for (var y = 0; y < data.length; y++) {
			for (var x = 0; x < data[y].length; x++) {
				color = data[y][x]; //Uint8Array [r, g, b]
				if (!color) { error("Data coordinate missing color data!"); continue; }
				ictx.fillStyle = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
				ictx.fillRect(x, y, 1, 1);
			}
		}
		resetView();
		autoLogin();
	});
});

socket.on('disconnect', ()=>{
	error('Disconnected from server.');
});

var isValidUser = false; 

// User data
var apiKey = localStorage.getItem("wk-api-key");

function autoLogin() {
	if (apiKey == null) {
		$("#login").removeClass("hidden");
	} else {
		socket.emit("verify", apiKey, (res, err)=>{
			if (res == true) {
				isValidUser = true;
				$("#login").addClass("hidden");
				alert('Welcome back!');
			} else {
				if (confirm("Login failed. Keep API key in storage?") == false) {
					localStorage.removeItem("wk-api-key");
				}
			}
		});
	}
}

$("#login").click(()=>{
	var apiKey = prompt("Please enter your WaniKani API Key");

	if (apiKey == null || apiKey == "") return;
	else {
		socket.emit("verify", apiKey, (res, err)=>{
			if (res == true) {
				localStorage.setItem("wk-api-key", apiKey);
				isValidUser = true;
				alert('Welcome!');
				$("#login").addClass("hidden");
			} else {
				alert("Failed to validate user: " + err);
			}
		});
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
	console.log(paintColor);
});
$("#color-picker").change(()=>{
	var hex = $("#color-picker").val();
	paintColor.r = parseInt(hex.slice(1, 3), 16);
	paintColor.g = parseInt(hex.slice(3, 5), 16);
	paintColor.b = parseInt(hex.slice(5, 7), 16);
	console.log(paintColor);
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

// Mouse state
canvas.addEventListener("mousedown", (e)=>{
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
		isDragMode = false;
		downCoords.x = e.layerX;
		downCoords.y = e.layerY;
	}
});
canvas.addEventListener("mouseleave", ()=>{
	isMouseDown = false;
	updateCanvas(); //Remove the pixel preview, even across windows
});
canvas.addEventListener("mouseup", ()=>{
	if (!isDragMode) paint();

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
		case " ":
			isGuideMode = !isGuideMode;
			console.log("Guide Mode: " + isGuideMode);
			updateCanvas();
			break;
		default:
			if (debug_mode) console.log("Unexpected keyboard event: " + e.key);
			return;
	}
});
window.addEventListener("keydown", (e)=>{
	switch (e.key) {
		case "Alt":
			updateCanvas(); //clears out temp drawings for pick mode
			break;
		default:
			//do nothing
	}
})

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

function paint() {
	if (isValidUser == false) return;
	if (debug_mode) console.log('Paint applied to coordinate: ('+ downCoords.x + ', ' + downCoords.y + ')');
	//Convert canvas point to image space
	localCoord = canvasToImageCoordinate(downCoords.x, downCoords.y);

	if (debug_mode) console.log('Image coordinate: ('+ localCoord.x + ', ' + localCoord.y + ')');
	var color = new Uint8Array([paintColor.r, paintColor.g, paintColor.b]);
	var out = { color: color, pos: { x: localCoord.x, y: localCoord.y }};
	
	//Don't paint the pixel until the server verifies its fine and announces it
	socket.emit('paint', out);
}

//Server announcing the paint from above function
socket.on('paint', (data)=>{
	console.log(data);
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
	
	if (isMouseDown) {
		//Check to see if it's in drag mode
		if (isDragMode == false) {
			//Enable drag mode if distance dragged is greater than the drag threshold
			//This allows a slight mouse twitch while painting, but a low enough threshold feels responsive on drag
			if (Math.abs(x - downCoords.x) > dragThreshold || Math.abs(y - downCoords.y) >= dragThreshold) {
				isDragMode = true;
			}
		} else {
			offset.x += x - downCoords.x;
			offset.y += y - downCoords.y;

			downCoords.y = y;
			downCoords.x = x;

			updateCanvas();
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

function error(message) {
	console.log(message);
}
