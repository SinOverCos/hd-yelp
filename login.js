'use strict';

var PokemonGO = require('./node_modules/pokemon-go-node-api/poke.io.js');
// using var so you can login with multiple users
var a = new PokemonGO.Pokeio();

//Set environment variables or replace placeholder text
/*
var location = {
    type: 'name',
    name: process.env.PGO_LOCATION || 'Times Square'
};
*/


var longitude = 43.6976384;
var latitude = -79.3954492;
var altitude = 0;
var location = { type: 'coords', coords : { latitude : latitude, longitude : longitude, altitude : altitude }};
location = { type: 'name', name: 'Eiffel Tower' };

var username = process.env.PGO_USERNAME || 'hubdoc';
var password = process.env.PGO_PASSWORD || 'HDHD$2011';
var provider = process.env.PGO_PROVIDER || 'ptc';

a.init(username, password, location, provider, function(err) {
    if (err) throw err;

    console.log('1[i] Current location: ' + a.playerInfo.locationName);
    console.log('1[i] lat/long/alt: : ' + a.playerInfo.latitude + ' ' + a.playerInfo.longitude + ' ' + a.playerInfo.altitude);

    a.GetProfile(function(err, profile) {
        if (err) throw err;

        console.log('1[i] Username: ' + profile.username);
        console.log('1[i] Poke Storage: ' + profile.poke_storage);
        console.log('1[i] Item Storage: ' + profile.item_storage);

        var poke = 0;
        if (profile.currency[0].amount) {
            poke = profile.currency[0].amount;
        }

        console.log('1[i] Pokecoin: ' + poke);
        console.log('1[i] Stardust: ' + profile.currency[1].amount);

        setInterval(function(){
            a.Heartbeat(function(err,hb) {
                if(err) {
                    console.log(err);
                }

                for (var i = hb.cells.length - 1; i >= 0; i--) {
                    if(hb.cells[i].NearbyPokemon[0]) {
                        //console.log(a.pokemonlist[0])
                        var pokemon = a.pokemonlist[parseInt(hb.cells[i].NearbyPokemon[0].PokedexNumber)-1];
                        console.log('1[+] There is a ' + pokemon.name + ' at ' + hb.cells[i].NearbyPokemon[0].DistanceMeters.toString() + ' meters');
                    }
                }

            });
        }, 1000);

    });
});

