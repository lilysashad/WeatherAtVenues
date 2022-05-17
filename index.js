const fs = require("fs"); 
const http = require("http");
const https = require("https");
const port = 3000; //by default, it listens to 80 but I want it to be 3000

const states = ['al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'dc', 'fl', 'ga', 'gu', 'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'pr', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'vi', 'va', 'wa', 'wv', 'wi', 'wy', 'ab', 'bc', 'mb', 'nb', 'nl', 'nt', 'ns', 'nu', 'on', 'pe', 'qc', 'sk', 'yt'];

//credentials for first API SeatGeek
const seatGeekCreds = require("./auth/credentialsSeatGeek.json");
const id = seatGeekCreds.client_id;
const secret =seatGeekCreds.client_secret;

//credentials for second API WeatherStack
const weatherStackCreds = require("./auth/credentialsWeatherStack.json");
const weatherStackKey = weatherStackCreds.key;

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

    else if(req.url.startsWith("/search")){ //using startsWith because data is embedded into URL than within message, so startsWith better searches for 'search'
        
        const user_input = new URL(req.url, `https://${req.headers.host}`).searchParams;
        //searchParams is a hashmap of all inputs that person has filled out
        //searchParams has get and set functions
        const stateInput = user_input.get('state').toLowerCase(); //only get 'state' user field from URL

        //If dropdown menu option is invalid
        if(!states.includes(stateInput) || stateInput === null || stateInput === ""){
            handleError("invalidState", res);
        }

        //otherwise, send request to SeatGeek API
        else{
            
            const seatGeekEndpoint = `https://api.seatgeek.com/2/venues?client_id=${id}&client_secret=${secret}&state=${stateInput}`; //endpoint that specifically searches for venues on SeatGeek API
            const seatGeekRequest = https.request(seatGeekEndpoint, {method: "GET"});

            res.writeHead(200, {"Content-Type": "text/html"});

            //on or once makes no difference because it only sends one response
            seatGeekRequest.once("response", stream => processStream(stream, parseVenues, res));
            seatGeekRequest.end();
        }
        
    }

    else if(req.url === '/favicon.ico'){
        const icon = fs.createReadStream('images/favicon.ico');
        res.writeHead(200, {'Content-Type': 'image/x-icon'});
        icon.pipe(res);
  }

    //all other possible pages lead to Error
    else{
        res.writeHead(404, {"Content-Type": "text/html"});
        res.end("<h1>Error</h1><a href='/'><button>Try again</button></a>");
    }
}

function processStream(stream, func, ...args){
    let body = "";
    stream.on("data", chunk => body += chunk); //every time we get data event from stream, we attach that chunk with body
    stream.on("end", () => func(body, ...args)); //when there's no more data, use callback function
}

function parseVenues(data, res){
    const parsedVenues = JSON.parse(data); //represents state object data that was received
    const firstResult = parsedVenues.venues[0]; //take the very first index result of "venues" object

    //collect relevant information about venue
    const venueTitle = firstResult.name;
    const venueAddress = firstResult.address;
    const venueCity = firstResult.extended_address;
    const venueEventCount = firstResult.num_upcoming_events;

    //if there's issues with collecting information, throw error
    if(venueTitle === null || 
    venueAddress === null ||
    venueEventCount === null ||
    venueCity === null){
        handleError("invalidVenue", res);
    }

    //otherwise, synchronously call getWeather
    else{
        const formattedVenues = formatVenueHTML(venueTitle, venueAddress, venueEventCount, venueCity);
        const zip = firstResult.postal_code;
        //synchronously call second api
        getWeather(zip, formattedVenues, res);
    }

}

//after venue info is successfully requested, call getweather for weatherStack
function getWeather(zip, venueFormat, res){
    const weatherStackEndpoint = `http://api.weatherstack.com/current?access_key=${weatherStackKey}&query=${zip}`; //endpoint that specifically searches for venues on SeatGeek API
    const weatherStackRequest = http.request(weatherStackEndpoint, {method: "GET"});
    
    res.writeHead(200, {"Content-Type": "text/html"});
    
    //on or once makes no difference because it only sends one response
    weatherStackRequest.on("response", (weatherResponse) => processStream(weatherResponse, parseWeatherResults, res, zip, venueFormat)); //convert stream into variable and pass that variable into callback func parseVenues
    weatherStackRequest.end();

}

//parse weather results to collect information about local weather
function parseWeatherResults(data, res, postalcode, venueFormat){
    const results = JSON.parse(data); //represents state object data that was received

    const currentTime = results.current.observation_time;
    const tempInFah = results.current.temperature * 9/5 + 32; //result.current.temperature returns value in celsius, so convert from to fahrenheit
    const weatherDescription = results.current.weather_descriptions;
    const weatherPic = results.current.weather_icons[0];

    //if there's issues with collecting information, throw error
    if(currentTime === "undefined" || 
    tempInFah === "undefined" ||
    weatherDescription === "undefined" ||
    weatherPic === "undefined"){
        handleError("invalidWeather", res);
    }
    
    //otherwise, pass in formatted HTML of this info
    else{
        const formattedWeather = formatWeatherHTML(postalcode, currentTime, tempInFah, weatherDescription, weatherPic);
        const displayResults = `${venueFormat}${formattedWeather}`;
        
        res.writeHead(200, {"Content-Type":"text/html"});
        res.write(displayResults);
        res.end(); //only weather can end res because website depends on completion of second api call
    }
}

//organize HTML display of venue
function formatVenueHTML(title, address, events, city){
    return `<div style="width:49%; float:left;">
    <h2>${title}</h2>
    <p><strong>Address:</strong> ${address}, ${city}</p>
    <p><strong>Number of events happening:</strong> ${events}</p>
    <a href='/'><button>Try again</button></a>
    </div>`;
}

//organize HTML display of weather
function formatWeatherHTML(postalCode, time, temperature, weatherDescription, weatherPic){
    return `<div style="width:49%; float:right;">
    <p><strong>Zip code:</strong> ${postalCode}</p>
    <p><strong>Current UTC Time:</strong> ${time}</p>
    <p><strong>Temperature:</strong> ${temperature}</p>
    <p><strong>Weather description:</strong> ${weatherDescription}</p>
    <img src="${weatherPic}"></div>`;
}

function handleError(errorType, res){
    res.writeHead(404, {"Content-Type": "text/html"});
    let error = "";
    switch(errorType){
        case "invalidState":
            error = "Invalid state input";
            break;
        case "invalidVenue":
            error = "Venue information unavailable";
            break;
        case "invalidWeather":
            error = "Weather information unavailable";
            break;
    }
    res.end(`<h2>${error}</h2><a href='/'><button>Try again</button></a>`);
}

server.on("listening", listen_handler);
function listen_handler(){
    console.log(`Server is listening on port ${port}`);
}

server.listen(port);