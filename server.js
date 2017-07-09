var fs = require('fs');
var PNG = require('node-png').PNG;
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = 4242;

var version = "0.2.0";

var https = require('https');
var verified = [];
var sockets = [];
var users = 0;

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Canvas management ///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var CANVAS_WIDTH = 128;
var CANVAS_HEIGHT = 128;
var CHUNK_SIZE = 128;
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

    console.log(data);

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
///// Chat ////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

var MAX_HISTORY_STORED = 10;
var chatHistory = [{username:"WK CANVAS", time:Date.now(),message:"Server was reset."}];

function updateChat(message, apiKey) {
    
    var out = {};
    console.log("Message from " + apiKey);
    out.username = verified[apiKey].username;
    out.time = Date.now();
    out.message = message;

    chatHistory.push(out);
    if (chatHistory.length > MAX_HISTORY_STORED) chatHistory.shift();
    
    io.emit('message', out);
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Server paths ////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/', (req, res)=>{
    res.send('working');
});

// app.get('/canvas', (req, res)=>{
//     res.sendFile();
// });

///////////////////////////////////////////////////////////////////////////////////////////////////
///// Socket events ///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

io.on('connection', (socket)=>{
    console.log('connection');

    // socket.on('getcanvas', (callback)=>{
    //     callback(canvas);
    // });

    socket.on('get_canvas', (callback)=>{
        var out = { 
            height: canvas.length, 
            width: canvas[0].length, 
            CHUNK_SIZE: CHUNK_SIZE,
            version: version 
        };
        callback(out);
    });

    socket.on('get_chunk', (data, callback)=>{
        //Convert from chunk space to image space
        var x = data.x * CHUNK_SIZE; //row
        var y = data.y * CHUNK_SIZE; //column

        var out = [];

        for (var i = 0; i < CHUNK_SIZE; i++) { //for each row
            out[i] = [];
            for (var j = 0; j < CHUNK_SIZE; j++) { //for each column
                out[i].push(canvas[i + x][j + y]);
            }
        }
        console.log("Served chunk request (" + data.x + ", " + data.y +")");
        callback(out);
    });

    socket.on('paint', (data)=>{
        if (verified[sockets[socket.id]] != null) {
            pushPaint(data);
            io.emit('paint', data);
        }
    });

    socket.on('verify', (apiKey, callback)=>{
        console.log('Received verification request for ' + apiKey);
        if (verified[apiKey] && verified[apiKey].level > 3) {
            console.log('Returning user verified');
            sockets[socket.id] = apiKey;
            users++;
            callback(true, "You should never see this.");
            return;
        } else {
            console.log(apiKey + ' has not been verified. Pulling WK data.');
            var path = 'https://www.wanikani.com/api/user/'+ apiKey + '/user-information'
            https.get(path, (res)=>{
                var body = '';
                res.on('data', (d)=>{
                    body += d;
                });
                res.on('end', ()=>{
                    console.log("Finished loading WK data for user " + apiKey);
                    try {
                        var user = JSON.parse(body).user_information;
                        verified[apiKey] = user;
                        console.log("Registering user.");
                        if (user == null) {
                            console.log('User data was null.');
                            callback(false, "Failed to get user data.");
                            return;
                        } else if (user.level > 3) {
                            console.log('User is valid.');
                            callback(true, "You should never see this.");
                            sockets[socket.id] = apiKey;
                            users++;
                            return;
                        } else if (user.level < 4) {
                            console.log('User is low level.');
                            callback(false, "Users must be at least level 4.");
                            return;
                        }
                    } catch (e) {
                        console.log(e);
                        callback(false, "Unexpected error.");
                        return;
                    }
                });
            }).on('error', (e)=>{
                console.error(e);
                callback(false, "Something really bad happened.");
                return;
            });
        }
    });

    socket.on('send-message', (data, callback)=>{
        callback(); //Informs client of receipt
        if (!sockets[socket.id]) { console.log("Reject message: not logged in."); return; }
        updateChat(data, sockets[socket.id]);
    });

    socket.on('get-history', (callback)=>{
        callback(chatHistory);
    });

    socket.on('disconnect', ()=>{
        if (sockets[socket.id]) users--;
        console.log(sockets[socket.id] + " disconnected.");
        delete sockets[socket.id];
    });

    socket.on('logout', (callback)=>{
        if (sockets[socket.id]) users--;
        console.log(sockets[socket.id] + " disconnected.");
        delete sockets[socket.id];
        callback(true);
    });
});

//Broadcast the number of logged in users periodically
setInterval(()=>{
    io.emit('user-count', users);
}, 2500);

http.listen(port, ()=>{
    console.log('IO listening on port ' + port);
});
