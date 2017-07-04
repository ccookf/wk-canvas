# WaniKani Canvas

The other canvas services had unpleasant limitations so I made this as an experiment. No restrictions at the moment. However, I'm planning on making
it require a WK API user key above level 3 later.

## Server

node, express, socket.io, node-png

## Client

socket.io, jQuery

### Todo list - 0.1.0

Client:

~~Set the canvas initial dimensions~~
~~Handle window resize event~~
~~Show potential pixel on mouseover~~

Client UI:

Color selector
Zoom in/out buttons
Display coordinates
Reset position/zoom
API key dialogues
Connection status dialogues
Save button
Display pixel guidelines

Server:

API key verification
Paint verification

Deployment:

Push to AWS
Add to DNS
Change the URIs to match

Other:
Remember to recycle my API key...

### Todo list - 0.1.1

Chunking the canvas
Pretend I'm a CSS wizard
