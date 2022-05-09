const fs = require("fs"); 
const http = require("http"); //protocol
const https = require("https"); //with encryption because working with APIs
const crypto = require("crypto"); //saves data from previous logged in sessions
const url = require("url"); //to format data into url and run search params
const port = 3000; //by default, it listens to 80 but I want it to be 3000

const seatGeekCredentials = require("./auth/credentialsSeatGeek.json"); //credentials for first API SeatGeek
const weatherStackCredentials = require("./auth/credentialsWeatherStack.json"); //credentials for second API WeatherStack

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
        const user_input = new URL(req.url, `https://${req.headers.host}`).searchParams;
        //searchParams is a hashmap of all inputs that person has filled out
        //searchParams has get and set functions
        console.log(user_input);
        const stateInput = user_input.get('state'); //only get 'state' user field from URL
        if(stateInput === null || stateInput === ""){
            res.writeHead(401, {"Content-Type" : "text/html"});
            res.end("<h1>Invalid state input</h1><a href='/'>Try again</a>"); //allow user to return to root page
        }

        else{
            const seatGeekEndpoint = `https://api.seatgeek.com/2/venues?state=${stateInput}`; //endpoint that specifically searches for venues on SeatGeek API
            const seatGeekRequest = https.get(seatGeekEndpoint, {method:"GET", headers:seatGeekCredentials}); //setup request
            seatGeekRequest.on("response", (venueResponse) => processStream(venueResponse, parseResults, res)); //convert stream into variable and pass that variable into callback func parseResults
            seatGeekRequest.end();
        }
    }

    else{
        res.writeHead(404, {"Content-Type": "text/html"});
        res.end("<h1>Error</h1><a href='/'>Return</a>");
    }
}
//const weatherStackEndpoint = `http://api.weatherstack.com/current?access_key={weatherStackCredentials}&query={zipInput}`;

function processStream(stream, func, ...args){
    let body = "";
    stream.on("data", chunk => body += chunk); //every time we get data event form stream, we attach that chunk with body
    stream.on("end", () => func(body, ...args)); //when there's no more data, use callback function
}

function parseResults(data, res){
    const results = JSON.stringify(data); //represents state object data that was received
    //by default, we assume there's no results from stateInput
    let content = "<h1>No venues found in this state</h1>";
    if(Array.isArray(results)){
        //venue name (name_v2), venue address (address), and number of events happening at that venue (stats?.event_count)
        content = `<h2>Name: ${results[0].name_v2}</h2><p>Address: ${results[0].address}</p><p>Number of events happening: ${results[0].stats?.event_count}</p>`;
    }
    res.writeHead(200, {"Content-Type":"text/html"}); ////was forwarded from request_handler and processStream- same variable in all those functions
    res.end(results);
}

server.on("listening", listen_handler);
function listen_handler(){
    console.log(`Server is listening on port ${port}`);
}
server.listen(port);

