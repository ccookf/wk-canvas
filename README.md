# WaniKani Canvas

The other canvas services had unpleasant limitations so I made this as an experiment. Anyone may view the canvas, but only users with a WaniKani account at level 4 or higher may paint the canvas.

I currently have a server running on AWS with the client on S3.
[Check out the client here!](http://s3.amazonaws.com/ccookfstuff/wkcanvas/index.html)

Also, do not force https. It's just going to throw errors all day.

## Server

node, express, socket.io, node-png

## Client

socket.io, jQuery       

### Todo list - 0.1.0

##### Client:

* ~~Set the canvas initial dimensions~~

* ~~Handle window resize event~~

* ~~Show potential pixel on mouseover~~

##### Client UI:

* ~~Color selector~~

* ~~Zoom in/out buttons~~

* ~~Display coordinates~~

* ~~Reset position/zoom~~

* ~~API key dialogues~~

* Connection status dialogues

* ~~Save button~~

* ~~Display pixel guidelines~~


##### Server:

* ~~API key verification~~

* ~~Paint verification~~

##### Deployment:

* Push to AWS
* Add to DNS
* Change the URIs to match

##### Other:

* ~~Remember to recycle my API key...~~

### Todo list - 0.1.1

* ~~Chunking the canvas~~
* Pretend I'm a CSS wizard
