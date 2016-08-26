var express = require('express');
var request = require("request");
var util = require("util");
var fs = require("fs");

const CONFIG_FILE = "config.json";

var FOODS;
var slack_token;
var incoming_webhook_url;

var foods;

var place_properties = [ "stars", "distance", "address", "menu", "review", "the-move" ];
var food_properties  = [ "stars", "price", "review", "notes" ];

var help_text = "Help:\n"
                + "/yelp help - show this message\n\n"

                + "/yelp rest [restaurant name] [" + place_properties.join("|") +  "] [text]\n"
                + "\t\t\tSet (restaurant name)'s (" + place_properties.join("|") + ") to (text)\n\n"

                + "/yelp delete [restaurant name] - remove (restaurant name)\n\n"

                + "/yelp food [restaurant name] [dish name] [" + food_properties.join("|") + "] [text]\n"
                + "\t\t\tSet (restaurant name)'s (dish name)'s (" + food_properties.join("|") + ") to (text)\n\n"

                + "/yelp delete [restaurant name] [food name] - remove (restaurant name)'s (food name)\n\n"

                + "/yelp show - list all restaurants\n\n"

                + "/yelp show [restaurant name] - show info about the given restaurant\n\n"

                + "/yelp show [restaurant name] [food name] - show info about the given restaurant's given dish\n\n"

                + "Note: everything except for *[text]* must be *one-word*\n\n"

                + "Note: if *[text]* is the word 'blank', that field is set to nothing";

var handle_request = function (param_text, sender) {
    var reply = { "text" : "I didn't understand that." };
    param_text = param_text.toLowerCase();
    param_text = param_text.split(" ");
    param_text = param_text.filter( function (word) { return word !== ""; });
    console.log("Parsed command: " + util.inspect(param_text));

    if (!param_text.length) return reply

    if (param_text[0] === "help") return { "text" : help_text };

    if (param_text[0] === "rest") {
        if (param_text.length < 4) return reply;
        var place = param_text[1];
        var property = param_text[2];
        var text = param_text.slice(3).join(" ");
    
        if (place_properties.indexOf(property) === -1) return reply;

        if (text === "blank") {
            delete foods[place][property];
            reply.text = "Deleted " + place + "'s " + property + " property";
            return reply;
        }

        if (!foods.hasOwnProperty(place)) foods[place] = { items : [] };
        foods[place][property] = text;
        reply.text = "You set " + place + "'s " + property + " to " + (text === "" ? "nothing" : text);
        if (property === "stars" && (text === "5" || text === "*****")) {
            reply.publish = true;
            reply.public_text = { "text" : "WOW! " + sender + " loves " + place + "!" };
        }
        reply.text = "Set " + place + "'s " + property + " to " + text;
    }

    if (param_text[0] === "food") {
        if (param_text.length < 5) return reply;
        var place = param_text[1];
        var food = param_text[2];
        var property = param_text[3];
        var text = param_text.slice(4).join(" ");

        if (food_properties.indexOf(property) === -1) return reply;

        if (text === "blank") {
            delete foods[place]["items"][food][property];
            reply.text = "Deleted " + place + "'s " + property + " property";
            return reply;
        }

        if (!foods.hasOwnProperty(place)) foods[place] = { items : [] };
        if (!foods[place]["items"].hasOwnProperty(food)) foods[place]["items"][food] = {};
        foods[place]["items"][food][property] = text;
        if (property === "stars" && (text === "5" || text === "*****")) {
            reply.publish = true;
            reply.public_text = { "text" : "WOW! " + sender + " loves " + place + "'s " + food + "!" };
        }
        reply.text = "Set " + place + "'s " + food + "'s " + property + " to " + text;
    }

    if (param_text[0] === "delete") {
        if (param_text.length === 2) {
            var place = param_text[1];
            delete foods[place];
            reply.text = "Deleted " + place;
        } else if (param_text.length === 3) {
            var place = param_text[1];
            var food = param_text[2];
            if (!foods.hasOwnProperty(place)) {
                reply.text = "I didn't find that restaurant";
                return reply;
            }
            delete foods[place]["items"][food];
            reply.text = "Deleted " + place + "'s " + food + " dish";
        }
    }

    if (param_text[0] === "show") {
        if (param_text.length === 1) {
            reply.text = util.inspect(foods, false, 0);
        } else if (param_text.length === 2) {
            var place = param_text[1];
            if (!foods.hasOwnProperty(place)) {
                reply.text = "Nothing to show";
                return reply;
            }
            reply.text = util.inspect(foods[place], false, 1);
        } else if (param_text.length === 3) {
            var place = param_text[1];
            var food = param_text[2];
            if (!foods.hasOwnProperty(place) || !foods[place]["items"].hasOwnProperty(food)) {
                reply.text = "Nothing to show";
                return reply;
            }
            reply.text = util.inspect(foods[place]["items"][food], false, 0);
        }
    }

    return reply;
};

var publish_message = function (payload) {
    request( {
        url : incoming_webhook_url,
        method : "POST",
        headers : { "Content-Type" : "application/json" },
        body : JSON.stringify(payload)
    }, function (err, res, body) {
        if (err) {
            console.log(err);
            throw err;
        }
    });
};

var app = express();

app.get("/", function (req, res) { 
    console.log(util.inspect(req.query));
    if (!req.query.token || req.query.token.valueOf() != slack_token.valueOf()) {
        console.log("Bad request!");
        return res.status(403).send("Bad request!");
    }

    var param_text = req.query.text;

    try {
        var reply = handle_request(param_text, req.query.user_name);
        if (reply.publish) publish_message(reply.public_text);
        save_foods();
        return res.send(reply);
    } catch (err) {
        console.log(util.inspect(err));
        if (err) return res.send({ "text" : "I am a broken bot :(" });
    }
});

app.listen(13111);

var read_foods = function () {
    fs.readFile(FOODS, 'utf8', function (err, data) {
        if (err) throw err;

        console.log("Read from " + FOODS);
        foods = JSON.parse(data);
        console.log("Foods:\n" + util.inspect(foods));
    });
};


var save_foods = function () {
    var body = JSON.stringify(foods);
    console.log(body);
    fs.writeFile(FOODS, body, function (err) {
        if (err) console.log(err);
    });
};

fs.readFile(CONFIG_FILE, function (err, data) {
    if (err) throw err;

    var config = JSON.parse(data);

    console.log(util.inspect(config));

    FOODS = config.food_file;
    read_foods();
    slack_token = config.slack_token;
    incoming_webhook_url = config.incoming_webhook_url;
});
