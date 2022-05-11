const fs = require("fs"); 
const http = require("http"); //protocol
const https = require("https"); //with encryption because working with APIs
const url = require("url"); //to format data into url and run search params
const port = 3000; //by default, it listens to 80 but I want it to be 3000

//const id = "MjY4MzgzOTN8MTY1MTcyNDkzMy42Mzg0NTY";
//const secret= "e5078eb411d753b498b4ce43d851af4fd6835431f8fd466d6f9d94dd39e0f2f8";
const seatGeekCreds = require("./auth/credentialsSeatGeek.json"); //credentials for first API SeatGeek
const id = seatGeekCreds.client_id;
const secret =seatGeekCreds.client_secret;

const weatherStackCreds = require("./auth/credentialsWeatherStack.json"); //credentials for second API WeatherStack
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

    //permission-request
    else if(req.url.startsWith("/search")){ //using startsWith because data is embedded into URL than within message, so startsWith better searches for 'search'
        const user_input = new URL(req.url, `https://${req.headers.host}`).searchParams;
        //searchParams is a hashmap of all inputs that person has filled out
        //searchParams has get and set functions
        const stateInput = user_input.get('state'); //only get 'state' user field from URL
        console.log(stateInput);

        //If dropdown menu option is invalid
        if(stateInput === null || stateInput === ""){
            res.writeHead(401, {"Content-Type" : "text/html"});
            res.end("<h1>Invalid state input</h1><a href='/'>Try again</a>"); //allow user to return to root page
        }

        //otherwise, send request to SeatGeek API
        else{
            res.writeHead(200, {"Content-Type": "text/html"});
            getInformation(stateInput, res);
        }
        
    }

    //all other possible pages lead to Error
    else{
        res.writeHead(404, {"Content-Type": "text/html"});
        res.end("<h1>Error</h1><a href='/'>Return</a>");
    }
}
//const weatherStackEndpoint = `http://api.weatherstack.com/current?access_key={weatherStackCredentials}&query={zipInput}`;

function getInformation(state, res){
    const seatGeekEndpoint = `https://api.seatgeek.com/2/venues?client_id=${id}&client_secret=${secret}&state=${state}`; //endpoint that specifically searches for venues on SeatGeek API
    const seatGeekRequest = https.get(seatGeekEndpoint, {method: "GET"});

    seatGeekRequest.once("response", stream => processStream(stream, parseVenues, res));
    seatGeekRequest.end();

}

function processStream(stream, func, ...args){
    let body = "";
    stream.on("data", chunk => body += chunk); //every time we get data event from stream, we attach that chunk with body
    stream.on("end", () => func(body, ...args)); //when there's no more data, use callback function
}

function parseVenues(data, res){
    const parsedVenues = JSON.parse(data); //represents state object data that was received
    parsedVenues.venues.map(formatVenues).join(''); //grab the "venues" field of json and run formatVenues foreach

    //grab name, address, event count of each venue
    function formatVenues(venue){
        let venueTitle = venue.name_v2;
        let venueAddress = venue.address;
        let venueEventCount = venue.stats?.event_count;
        
        //if there's issues with collecting information, throw error
        if(venueTitle === "undefined" || 
        venueAddress === "undefined" ||
        venueEventCount === "undefined"){
            return "<h2>Venue information unavailable</h2><a href='/'>Try again</a>";
        }

        //otherwise, synchronously call getWeather
        else{
            let zip = venue.postal_code;
            console.log(`QUERIED ZIP ` + zip);
            getWeather(zip, venueTitle, venueAddress, venueEventCount, res);
        }
    }

    //results = `<div style="width:49%; float:left;">${results}</div>`
    //res.writeHead(200, {"Content-Type":"text/html"}); ////was forwarded from request_handler and processStream- same variable in all those functions
    //res.write(results);
}


function getWeather(zip, title, address, events, res){
    const weatherStackEndpoint = `http://api.weatherstack.com/current?access_key=${weatherStackKey}&query=${zip}`; //endpoint that specifically searches for venues on SeatGeek API
    const weatherStackRequest = http.get(weatherStackEndpoint, {method: "GET"});
    weatherStackRequest.on("response", (weatherResponse) => processStream(weatherResponse, parseWeatherResults, res, zip)); //convert stream into variable and pass that variable into callback func parseVenues
    weatherStackRequest.end();

    function parseWeatherResults(data, res, postalcode){
        let results = JSON.parse(data); //represents state object data that was received
        let weatherInfo = formatWeather(results);

        console.log(`Zipcode: ` + results.request.query);
        console.log(`Time: ` + results.current.observation_time);
        console.log(`Temperature: ` + results.current.temperature);
        console.log(`Weather: ` + results.current.weather_descriptions);
        console.log(`Picture: ` + results.current.weather_icons[0]);
    
        function formatWeather(zip){
            let currentTime = zip.current.observation_time;
            let tempInFah = zip.current.temperature * 9/5 + 32; //zip.current.temperature returns value in celsius, so convert from celsius to fahrenheit
            let weatherDescription = zip.current.weather_descriptions;
            let weatherPic = zip.current.weather_icons[0];

            //if there's issues with collecting information, throw error
            if(currentTime === "undefined" || 
            tempInFah === "undefined" ||
            weatherDescription === "undefined" ||
            weatherPic === "undefined"){
                return "<h2>Weather information unavailable</h2><a href='/'>Try again</a>";
            }
            
            //otherwise, pass in formatted HTML of this info
            else{
                return `<p>Zip code: ${postalcode}</p><p>Current UTC Time: ${currentTime}</p><p>Temperature: ${tempInFah}</p><p>Weather description: ${weatherDescription}</p><img src="${weatherPic}">`;
            }
        }
    
        results = `<h2>${title}</h2><p>Address: ${address}</p><p>Number of events happening: ${events}</p><h2>${weatherInfo}</h2></div>`;
        res.writeHead(200, {"Content-Type":"text/html"});
        res.write(results);
        res.end();
    }
}

server.on("listening", listen_handler);
function listen_handler(){
    console.log(`Server is listening on port ${port}`);
}
server.listen(port);