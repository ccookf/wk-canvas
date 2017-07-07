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
            chunks[i].push({ column: i, row: j, isLoaded: false });
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
function findUnloadedChunks(x, y, a, b) {

console.log({x: x, y: y, a: a, b: b});

    //Convert image space coordinates to the chunk space
    var left = Math.floor(x / CHUNK_SIZE);
    var top = Math.floor(y / CHUNK_SIZE);
    var right = Math.floor(a / CHUNK_SIZE);
    var bottom = Math.floor(b / CHUNK_SIZE);

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
    return out;
}

/**
 * @description Sort an array of chunks by distance from a point in image space
 * @param {Array} unsorted 
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

function loadChunk(row, column, context, callback) {
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
            callback(false);
        }
        updateCanvas();
    });
}