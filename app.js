var express = require('express');
var app = express();
var serv = require('http').Server(app);

// partie express
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client')); // acces uniquement a /client

serv.listen(8080);
console.log('server started.');

/*************************************/
// VARIABLES GLOBALES
var SOCKET_LIST = {};
var PLAYER_LIST = {};


// PLATEAU DE JEU
var PLATEAU = {};
PLATEAU.side = 600; // TODO changer automatiquement le canvas

// territoires des joueurs
// pour chaque nouveau joueur on rajoute une entrée dans la variable avec son id, comme TERRITOIRES[socket.id]
// et dans chaque entrée on liste ses possessions : TERRITOIRES[socket.id][blabla]
var TERRITOIRES = {};

// CLASS PLAYER
var Player = function(id) {
    var self = {
        x: PLATEAU.side / 2, // horizontal
        y: PLATEAU.side, // vertical
        id: id,
        color: "#"+((1<<24)*Math.random()|0).toString(16),
        hitbox: 6,
        pressingRight: false,
        pressingLeft: false,
        pressingUp: false,
        pressingDown: false,
        maxSpeed: 10,
        lastPressedKey: 'up', // pour pouvoir mettre la vitesse à 0 si on presse la direction opposée
        touchingBorder: true, // pas besoin de ramener la vitesse a 0 si on touche un bord et qu'on veut repartir en direction opposee
        is_outside: false // si = true on est en train de tisser une toile, sinon on est sur un bord

    }
    self.updatePosition = function() {
        // DROITE
        if (self.pressingRight) {
            if (self.lastPressedKey == 'left' && self.touchingBorder == false) {  // vitesse à 0 si on presse 1 fois la direction opposée
                self.x += 0;
                self.pressingRight = false;
            } else {
                self.x += self.maxSpeed;
            }
            self.lastPressedKey = 'right'; // actualisation de la dernière touche activée
        }
        // GAUCHE
        if (self.pressingLeft) {
            if (self.lastPressedKey == 'right' && self.touchingBorder == false) {
                self.x += 0;
                self.pressingLeft = false;
            } else {
                self.x -= self.maxSpeed;
            }
            self.lastPressedKey = 'left';
        }
        // HAUT
        if (self.pressingUp) {
            if (this.lastPressedKey == 'down' && self.touchingBorder == false) {
                self.y += 0;
                self.pressingUp = false;
            } else {
                self.y -= self.maxSpeed;
            }
            self.lastPressedKey = 'up';
        }
        // BAS
        if (self.pressingDown) {
            if (self.lastPressedKey == 'up' && self.touchingBorder == false) {
                self.y += 0;
                self.pressingDown = false;
            } else {
                self.y += self.maxSpeed;
            }
            self.lastPressedKey = 'down';
        }

        // COLLISIONS
        if (self.x >= PLATEAU.side - self.hitbox)
            self.x = PLATEAU.side - self.hitbox;
        if (self.x <= 0)
            self.x = 0;
        if (self.y >= PLATEAU.side - self.hitbox)
            self.y = PLATEAU.side - self.hitbox;
        if (self.y <= 0)
            self.y = 0;

         // TODO améliorer ce truc de collisions
        // si on touche un bord, pas besoin d'appuyer 2 fois pour repartir en sens inverse
        if (self.x >= PLATEAU.side - self.hitbox || self.x <= 0 || self.y >= PLATEAU.side - self.hitbox || self.y <= 0) {
            self.touchingBorder = true;
        } else {
            self.touchingBorder = false;
        }
        // valeur générale pour déterminer si on se trouve sur un bord ou pas (et si on n'est pas sur un bord on peut tisser une toile)
        if ((self.pressingRight === true || self.pressingLeft === true || self.pressingUp === true || self.pressingDown === true) && self.touchingBorder === false)
            self.is_outside = true;
        else
            self.is_outside = false;

    } // fin function self.updatePosition
    return self;
}

// SOCKET IO
var io = require('socket.io')(serv, {});

io.sockets.on('connection', function(socket) {
    // lorsqu'un joueur se connecte, on l'ajoute dans les tableaux
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;
    var player = new Player(socket.id);
    PLAYER_LIST[socket.id] = player;
    TERRITOIRES[socket.id] = [];
    // déconnection d'un joueur, on le supprime des tableaux
    socket.on('disconnect', function() {
        delete SOCKET_LIST[socket.id];
        delete PLAYER_LIST[socket.id];
        // on ne supprime pas les territoires car ca ferait des trous dans le plateau
    });


// MOUVEMENTS
    socket.on('keyPress', function(data) {

        /*
        on ne peut aller que dans une seule direction à la fois
        c'est pourquoi on doit mettre les autres directions en false, pour éviter de se déplacer en diagonale
        */
        if (data.inputId === 'right') {
            player.pressingRight = data.state;
            player.pressingLeft = false;
            player.pressingUp = false;
            player.pressingDown = false;
        }
        if (data.inputId === 'left') {
            player.pressingLeft = data.state;
            player.pressingRight = false;
            player.pressingUp = false;
            player.pressingDown = false;
        }
        if (data.inputId === 'up') {
            player.pressingUp = data.state;
            player.pressingLeft = false;
            player.pressingRight = false;
            player.pressingDown = false;
        }
        if (data.inputId === 'down') {
            player.pressingDown = data.state;
            player.pressingLeft = false;
            player.pressingUp = false;
            player.pressingRight = false;
        }
    }); // fin on keypress
}); // fin io.socket on connection




// CANVAS
setInterval(function() {
    var pack = [];
    for (var i in PLAYER_LIST) {
        var player = PLAYER_LIST[i];
        player.updatePosition();
        // remettre ici tout ce qu'on veut passer a la vue
        pack.push({
            x: player.x,
            y: player.y,
            hitbox: player.hitbox,
            color: player.color
        });
    }

    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.emit('new_positions', pack);
    }


}, 1000/15);