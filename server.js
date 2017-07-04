var fs = require('fs');
var PNG = require('node-png').PNG;
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = 4242;

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Load the image into memory //////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var CANVAS_WIDTH = 128;
var CANVAS_HEIGHT = 128;
var canvas = [];
var filename = 'test.png';

fs.createReadStream(filename).pipe(new PNG({}))
    .on('error', function(err) {
        console.log("Failed to load png: " + err);
    })
    .on('parsed', function() {
        console.log("Loaded png @" + this.width + "x" + this.height);
        CANVAS_HEIGHT = this.height;
        CANVAS_WIDTH = this.width;

        for (var y = 0; y < this.height; y++) {
            canvas[y] = [];
            for (var x = 0; x < this.width; x++) {
                //No, I don't actually know how the png format is setup
                //I love how much easier the image manip would have been in C++
                var idx = (this.width * y + x) << 2;
                //Javascript is a pain in the butt and Uint8Array([r,g,b]) is probably as efficient
                //as I'm going to get on storage size for colors without doing something annoying
                //so I might as well enjoy MILLIONS OF COLORS LOLOLOLOLOLOL
                //Then someone makes a bot to copy images into the system
                //and it's all like WHOOP WHOOP DATS DA SOUND OF DA POLICE
                //... why am I doing this again?
                canvas[y].push(new Uint8Array([this.data[idx], this.data[idx+1], this.data[idx+2]]));
            }
        }
    });

const BACKUP_THRESHOLD = 25;
var changes = 0;

//Update the canvas and run a backup after BACKUP_THRESHOLD changes occur
function pushPaint(data) {
    //Make sure data is in boundaries
    if (data.pos.x < 0 || data.pos.y < 0 || 
        data.pos.x >= CANVAS_WIDTH || data.pos.y >= CANVAS_HEIGHT) {
            
            return;
    }
    
    changes++;
    canvas[data.pos.y][data.pos.x] = data.color;

    if (changes >= BACKUP_THRESHOLD) {
        //At some point I may want to lock data. Need to look into 
        //possible concurrency issues later
        saveBackup((res)=>{
            if (true) return;
        });
        changes = 0;
    }
}

//This just saves to a file, but at some point I should shove it out to S3
//And setup numbered output so we can get server history and time lapse
function saveBackup(callback) {
    var out = new PNG({width: CANVAS_WIDTH, height: CANVAS_HEIGHT});
    for (var y = 0; y < out.height; y++) {
        for (var x = 0; x < out.width; x++) {
            var idx = (out.width * y + x) << 2;
            out.data[idx] = canvas[y][x][0];
            out.data[idx+1] = canvas[y][x][1];
            out.data[idx+2] = canvas[y][x][2];
            out.data[idx+3] = 255;
        }
    }
    out.pack().pipe(fs.createWriteStream(filename));
    callback(true);
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Server paths ////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/', (req, res)=>{
    res.send('working');
});

app.get('/canvas', (req, res)=>{
    res.sendFile();
});

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Socket events ///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
io.on('connection', (socket)=>{
    console.log('connection');

    socket.on('getcanvas', (callback)=>{
        callback(canvas);
    });

    socket.on('paint', (data)=>{
        pushPaint(data);
        io.emit('paint', data);
    });
});

http.listen(port, ()=>{
    console.log('IO listening on port ' + port);
});