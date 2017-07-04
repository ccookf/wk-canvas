console.log("canvas script loading...");
if (window.jQuery) console.log("jQuery loaded.");
else console.error("jQuery has not loaded");

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Initiation //////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var server = "http://localhost:4242";

// User data
var user_wk_api_key = "e76ae77aa086d5b9896ea32f37d6d14e";
var isValidUser = false;
var user;
/*$.get("https://www.wanikani.com/api/user/" + user_wk_api_key + "/user-information", (res)=>{
	if (res) {
		user = res.user_information;
		if (user.level >= 4) isValidUser = true;
		else console.warn("User is not level 4 or higher.");
		//Note to self, remember to blacklist the public test key
		//when I do the server validation
	}
	else console.warn("Failed to get WK user data.");
});*/

var debug_mode = false;
var scale = [1, 2, 4, 8, 16, 32, 64];

var offset = { x: 0, y: 0 };
var scale_level = 0;

var pos = { x: 0, y: 0 };
var isMouseDown = false;
var isDragMode = false;
var dragThreshold = 25; //Number of pixels before mousedown is treated as a drag
var downCoords = { x: 0, y: 0 }; //Coordinates of mousedown event
var mouseOverPixel = { x: 0, y: 0 }; //Current "pixel" under the mouse

var paintColor = { r: 0, g: 255, b: 0 };

// Source data, specifications
var BOUNDARY_WIDTH = 128;
var BOUNDARY_HEIGHT = 128;

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

var image = document.getElementById("image");
var ictx = image.getContext("2d");

//load the base image onto the image canvas
var img = new Image();
/*img.src = "suika.png";
img.addEventListener('load', ()=> {
	ictx.drawImage(img, 0, 0);
	updateCanvas();
}); */

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
		updateCanvas();
	});
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

// Mouse state
canvas.addEventListener("mousedown", (e)=>{
	isMouseDown = true;
	isDragMode = false;
	downCoords.x = e.layerX;
	downCoords.y = e.layerY;
});
canvas.addEventListener("mouseleave", ()=>{
	isMouseDown = false;
});
canvas.addEventListener("mouseup", ()=>{
	if (!isDragMode) paint();

	isMouseDown = false;
});
canvas.addEventListener("mousemove", mouseMove);

// Keyboard events
window.addEventListener("keydown", (e)=>{
	switch (e.key) {
		case "-":
			zoomOut();
			break;
		case "=":
			zoomIn();
			break;
		default:
			if (debug_mode) console.log("Unexpected keyboard event: " + e.key);
			return;
	}
});

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Functions ///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

function updateCanvas() {
	clearCanvas();
	ctx.drawImage(	image, offset.x, offset.y, 
					BOUNDARY_WIDTH * scale[scale_level], BOUNDARY_HEIGHT * scale[scale_level]);
}

function clearCanvas() {
	ctx.fillStyle = "grey";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
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
	ictx.fillStyle = 'rgb(' + data.color[0] + ',' + data.color[1] + ',' + data.color[2] + ')';
	ictx.fillRect(data.pos.x, data.pos.y, 1, 1);
	updateCanvas();
});

function mouseMove(e) {
	var x = e.layerX;
	var y = e.layerY;

	localCoord = canvasToImageCoordinate(x, y);
	if (localCoord.x != mouseOverPixel.x || localCoord.y != mouseOverPixel.y) {
		//Draw the image state back onto the canvas, clearing out temp items
		updateCanvas();
		//Convert local coordinates to canvas space
		canvasCoord = imageToCanvasCoordinate(localCoord.x, localCoord.y);
		//Draw directly to the main canvas, not the image
		ctx.fillStyle = 'rgb(' + paintColor.r + ',' + paintColor.g + ',' + paintColor.b + ')';
		ctx.fillRect(canvasCoord.x, canvasCoord.y, 1 * scale[scale_level], 1 * scale[scale_level]);
}
	
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

function error(message) {
	console.error(message);
}
