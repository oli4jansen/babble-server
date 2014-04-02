# Babble Backend #

Dit is de backend voor Babble. Volledig geschreven in Javascript, draait op NodeJS.

## Server starten ##

1. Installeer CouchDB, MySQL en NodeJS. Hoe dit te installeren is, verschilt per OS.
2. Clone deze repository.
3. Installeer alle dependencies uit package.json met `npm install`
4. `sudo node server.js`

## API responses ##

Een typische response van de Babble API bestaat uit 2 bestanddelen:
 - Status
 - Data

### Status ###

Dit veld is een numerieke waarde die de status van een API request aangeeft. Hiervoor worden de HTTP status codes gebruikt. Dit houdt dus in dat status code `200` betekent dat de request gelukt is, `404` dat er geen resultaten gevonden zijn en `500` dat er iets fout gegaan is (met de opgegeven data of met de server). Alle HTTP codes kunnen in principe voorkomen (zo wordt ook `206` gebruikt, om aan te geven dat de opgegeven data incompleet is).

### Data ###

Dit is het belangrijkste veld. Het bevat de data die opgevraagd is, in de vorm van een JSON object of JSON array, afhankelijk van het type request.

## Overzicht API endpoints ##

### User API ###

#### GET `/user/:userId/check` ####

#### GET `/user/:userId` ####

#### GET `/user/:userId/matches` ####

#### GET `/user/:userId/match/:matchId` ####

#### POST `/user/authenticate` ####

#### POST `/user/:action` ####

#### PUT `/user/:userId` ####

#### DELETE `/user/:userId` ####

### Feed API ###

### Chat API ###
