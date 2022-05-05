const fs = require("fs"); 
const http = require("http"); //protocol
const https = require("https"); //with encryption because working with APIs
const crypto = require("crypto"); //saves data from previous logged in sessions
const url = require("url"); //to format data into url and run search params
const port = 3000; //by default, it listens to 80 but I want it to be 3000

const server = http.createServer();
server.on("request", request_handler);
function request_handler(req, res){
    console.log(`New request from ${req.socket.remoteAddress} for ${req.url}`);

    //root
    if(req.url === "/"){
        const form = fs.createReadStream("index.html");
        res.writeHead(200, {"Content-Type":"text\html"});
        form.pipe(res);
    }

    //permission-request
    else if(req.url.startsWith("/search")){ //using startsWith because data is embedded into URL than within message, so startsWith better searches for 'search'

    }
}
//seatgeek: state url endpoint 'https://api.seatgeek.com/2/venues?state=il'
//kroger

server.on("listening", listen_handler);
function listen_handler(){
    console.log(`Server is listening on port ${port}`);
}
server.listen(port);

