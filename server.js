var fs = require('fs');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = 4242;

app.get('/', (req, res)=>{
    res.send('working');
});

io.on('connection', (socket)=>{
    console.log('connection');
});

io.on('getcanvas', (socket)=>{
    socket.emit('data');
});

http.listen(port, ()=>{
    console.log('IO listening on port ' + port);
});