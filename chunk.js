/**
 * {
 *      isLoaded:bool
 *      column:int
 *      row:int
 * }
 */

var CHUNK_SIZE = 0;     //pixel width of a square chunk
let IMAGE_HEIGHT;   //height of image in pixels
let IMAGE_WIDTH;    //width of image in pixels
let columns;        //number of chunks needed to encompass image width
let rows;           //number of chunks needed to encompass image height
let chunks = [];    //Array of chunks

function initChunks(height, width, size) {
    //Ceil in case image width is not a factor of the chunk size
    columns = Math.ceil(width / size);
    rows = Math.ceil(height / size);
    CHUNK_SIZE = size;
    IMAGE_HEIGHT = height;
    IMAGE_WIDTH = width;

    //Generate array of empty chunks
    for (var i = 0; i < rows; i++) {
        chunks.push([]); //start a new row
        for (var j = 0; j < rows; j++) {
            chunks[i].push({ column: j, row: i, isLoaded: false });
        }
    }

    return { rows: rows, columns: columns }; //For debug
}

/**
 * @description Given the specified bounding box of image space find unloaded chunks
 * @param {number} x Top left of canvas in image space
 * @param {number} y Top left of canvas in image space
 * @param {number} a Bottom right of canvas in image space
 * @param {number} b Bottom right of canvas in image space
 */
function findUnloadedChunks(x, y, a, b, display = false) {

    //I am 90% certain I forgot to account for the negative y space
    //but it somehow worked out. @todo verify this

    //Convert image space coordinates to the chunk space
    var left = Math.floor(x / CHUNK_SIZE);
    var top = Math.floor(y / CHUNK_SIZE);
    var right = Math.floor(a / CHUNK_SIZE) + 1;
    var bottom = Math.floor(b / CHUNK_SIZE) + 1;

    //console.log({left: left, top: top, right: right, bottom: bottom});

    //Clamp the boundaries to the image in chunk space
    left = left < 0 ? 0 : left;
    top = top < 0 ? 0 : top;
    right = right > columns ? columns : right;
    bottom = bottom > rows ? rows : bottom;

    //console.log({left: left, top: top, right: right, bottom: bottom});

    //Search chunks for unloaded members
    var out = [];
    for (var i = top; i < bottom; i++) {
        for (var j = left; j < right; j++) {
            if ((chunks[i][j]).isLoaded == false) out.push(chunks[i][j]);
        }
    }
    if (display) console.log("Found " + out.length + " unloaded chunks.");
    return out;
}

/**
 * @description Determines if the chunk is loaded at the given image space coords
 * @param {number} hor 
 * @param {number} ver 
 */
function isChunkLoaded(hor, ver) {
    var x = Math.floor(hor / CHUNK_SIZE);
    var y = Math.floor(ver / CHUNK_SIZE);

    try {
        if ((chunks[y][x]).isLoaded == false) return false;
        else return true;
    } catch (e) {
        console.log("isChunkLoaded failure:");
        console.log(e);
    }
}

/**
 * @description Sort an array of chunks by distance from a point in image space
 * @param {Array} unsorted Array of image chunks
 * @param {number} x 
 * @param {number} y 
 */
function sortUnloadedChunks(unsorted, x, y) {

    //Convert image space coordinates to the chunk space
    //Adjust for zero indexing
    x = Math.floor(x / CHUNK_SIZE) - 1;
    y = Math.floor(y / CHUNK_SIZE) - 1;

    unsorted.sort((a, b)=>{
        var distA = Math.sqrt((a.column-x)*(a.column-x) + (a.row-y)*(a.row-y));
        var distB = Math.sqrt((b.column-x)*(b.column-x) + (b.row-y)*(b.row-y));
        return distA - distB;
    });
    return unsorted; //for debug
}

/**
 * @Description recursively loads all chunks in the list one at a time
 * @param {Array} list  Sorted array of chunks
 * @param {CanvasRenderingContext2D} context Should be ictx
 */
function loadChunks(list, context, callback) {
    if (list.length == 0) {
        callback(true);
        return;
    }
    var chunk = list.shift(); //When sorted the list is ascending.
    loadChunk(chunk.column, chunk.row, context, (res, time)=>{
        console.log("Chunk (" + chunk.column + ", " + chunk.row + ") loaded: " + res + " in " + time);
        loadChunks(list, context, callback);
    });
}

/**
 * @description Loads the chunk at the specified coordinates in the given canvas context
 * @param {number} column 
 * @param {number} row 
 * @param {CanvasRenderingContext2D} context Should be ictx
 * @param {function} callback Will return the time to load the chunk
 */
function loadChunk(column, row, context, callback) {
    if (chunks[row][column] == true) { console.log("Chunk already loaded!"); return; }
    var start = Date.now();
    socket.emit('get_chunk', { x: column, y: row }, (data)=>{
        var startx = row * CHUNK_SIZE;
        var starty = column * CHUNK_SIZE;

        try{
            var missing = 0;
            for (var i = 0; i < data.length; i++) {
                for (var x = 0; x < data[i].length; x++) {
                    var color = data[i][x]; //Uint8Array [r, g, b]
                    if (!color) { error("Data coordinate missing color data!"); continue; }
                    context.fillStyle = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
                    context.fillRect(startx + x, starty + i, 1, 1);
                }
            }
        } catch (e) {
            console.log("Chunk position: " + row + ", " + column);
            console.log("Failed to load chunk: " + e.message);
            console.log(data);
            if (callback) callback(false, (Date.now() - start) + "ms");
        }
        chunks[row][column].isLoaded = true;
        updateCanvas();
        if (callback) callback(true, (Date.now() - start) + "ms");
    });
}
