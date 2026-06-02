const express = require("express");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const port = 3000;
app.use(express.static("public"));
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
    res.send("Questbound server is running.");
});

app.get("/players", (req, res) => {
    const players = JSON.parse(
        fs.readFileSync("./players.json")
    );
    
    res.json(players);
});      

function loadPlayers() {
    return JSON.parse(fs.readFileSync("./players.json"));
}

function savePlayers(players) {
    fs.writeFileSync("./players.json", JSON.stringify(players, null, 2));
}

function loadItems() {
    return JSON.parse(
        fs.readFileSync("./items.json")
    );
}

app.get("/items", (req, res) => {
    const items = loadItems();
    res.json(items);
});

app.get("/damage/:id/:amount", (req, res) =>
{
    const playerID = Number (req. params.id);
    const damage = Number (req.params.amount);
    
    const players = JSON.parse(
        fs.readFileSync("./players.json")
    );

    const player = players.find(p => p.id === playerID);

    if (!player) {
        return res.status(404).json({ error: "Player not found" 
        });
    }    
        player.hp -= damage;
        fs.writeFileSync("./players.json", JSON.stringify(players, null, 2)
        );
        
        savePlayers(players);

        io.emit("playersUpdated", players);


        res.json(player);
    
});    

app.get("/heal/:id/:amount", (req, res) => {
    const playerId = Number(req.params.id);
    const heal = Number(req.params.amount);

    const players = loadPlayers();
    const player = players.find(p => p.id === playerId);

    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    player.hp += heal;

    savePlayers(players);

    io.emit("playersUpdated", players);

    res.json(player);
});

   
    app.get("/giveitem/:playerId/:itemId", (req, res) => {

    const playerId = Number(req.params.playerId);
    const itemId = req.params.itemId;

    const players = loadPlayers();
    const items = loadItems();

    const player = players.find(p => p.id === playerId);
    const item = items.find(i => i.id === itemId);

    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    if (!item) {
        return res.status(404).json({ error: "Item not found" });
    }

    if (!player.inventory) {
        player.inventory = [];
    }

    player.inventory.push(item.id);

    savePlayers(players);

    io.emit("playersUpdated", players);

    res.json({
        message: `${item.name} added to ${player.name}'s inventory.`,
        player: player
    });

});
app.get("/removeitem/:playerId/:itemId", (req, res) => {
    const playerId = Number(req.params.playerId);
    const itemId = req.params.itemId;

    const players = loadPlayers();
    const player = players.find(p => p.id === playerId);

    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    if (!player.inventory) {
        player.inventory = [];
    }

    const itemIndex = player.inventory.indexOf(itemId);

    if (itemIndex === -1) {
        return res.status(404).json({ error: "Item not in inventory" });
    }

    player.inventory.splice(itemIndex, 1);

    savePlayers(players);

    io.emit("playersUpdated", players);

    res.json({
        message: `${itemId} removed from ${player.name}'s inventory.`,
        player: player
    });
});



io.on("connection", (socket) => {
    console.log("A Questbound device connected: ");
});

server.listen(port, () => {
    console.log(`Questbound server running at http://localhost:${port}`);
});