# WaniKani Canvas

The other canvas services had unpleasant limitations so I made this as an experiment. Anyone may view the canvas, but only users with a WaniKani account at level 4 or higher may paint the canvas.

I currently have a server running on AWS with the client on S3.
[Check out the client here!](http://s3.amazonaws.com/ccookfstuff/wkcanvas/index.html)

Also, do not force https. It's just going to throw errors all day.

## Server

node, express, socket.io, node-png

## Client

socket.io, jQuery       

### Todo list - 0.1.1

* ~~Chunking the canvas~~
* Pretend I'm a CSS wizard
