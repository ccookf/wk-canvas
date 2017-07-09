let isInitiated = false;
let chatSocket;

function initChat(io) {
    if (isInitiated) return;
    
    chatSocket = io;
    
    chatSocket.on('message', (data)=>{
        var box = $("#chat-history");
        var st = box.scrollTop();
        var sh = box.prop('scrollHeight');
        var ch = box.prop('clientHeight');
        var isBottomed = (st + ch === sh);
        box.append(formatMessage(data));
        //Autoscroll if the user was at the bottom of chat
        if (isBottomed) {
            box.scrollTop(box.prop('clientHeight'));
        }
    });

    isInitiated = true;
}

function sendMessage() {
    if (isInitiated == false) { console.error("Cannot send message, chat is not initiated!"); return; }
    
    var message = $('#message-box').val();
    chatSocket.emit('send-message', message, ()=>{
        //clear on server receipt
        $('#message-box').val("");
    });

    console.log("Sending: " + message);
}

//Wipes the existing chat (disconnects, ect) and gets the history
function getChatHistory() {
    chatSocket.emit('get-history', (data)=>{
        if (data == null || data.length == 0) return;
        
        var out = "";
        data.reverse();
        data.forEach((element)=>{
            out = formatMessage(element) + out;
        });

        var box = $("#chat-history");
        box.html(out);

        //Scroll to the bottom of the chat
        box.scrollTop(box.prop('clientHeight'));
    });
}

function formatMessage(data) {
    /**
     * {
     *      username:string,
     *      time:number,
     *      message:string
     * }
     */

    //Simple sanatize of input data
    data.username = data.username.replace("<","&lt;");
    data.message = data.message.replace("<","&lt;");

    //Format the time to HH:MM:SS
    var date = new Date(data.time);
    var time =  "" + padTime((date.getHours()%12)) + ":" 
                + padTime(date.getMinutes()) + ":" 
                + padTime(date.getSeconds());

    var out =   '<div class="chat-message">'
                + '<div class="message-meta">'
                + '<div class="message-user">' + data.username + '</div>'
                + '<div class="message-time">' + time + '</div>'
                + '</div>'
                + '<p class="message-body">' + data.message + '</p></div>';
    return out;
}

function padTime(time) {
    time = time.toString();
    return (time.length < 2) ? '0' + time : time;
}
