const express = require("express");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));
app.use(express.json());



function loadQuests() {
    return JSON.parse(fs.readFileSync("./quests.json"));
}

function saveQuests(quests) {
    fs.writeFileSync("./quests.json", JSON.stringify(quests, null, 2));
}

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

function saveItems(items) {
    fs.writeFileSync("./items.json", JSON.stringify(items, null, 2));
}

function loadJoinRequests() {
    return JSON.parse(
        fs.readFileSync("./joinRequests.json")
    );
}

function saveJoinRequests(requests) {
    fs.writeFileSync("./joinRequests.json", JSON.stringify(requests, null, 2));
}

function loadCampaigns() {
    return JSON.parse(
        fs.readFileSync("./campaigns.json")
    );
}

function saveCampaigns(campaigns) {
    fs.writeFileSync(
        "./campaigns.json",
        JSON.stringify(campaigns, null, 2)
    );
}

app.get("/", (req, res) => {
    res.send("Questbound server is running.");
});

app.get("/players", (req, res) => {
    const players = JSON.parse(
        fs.readFileSync("./players.json")
    );
    
    res.json(players);
});      

app.post("/requestjoin", (req, res) => {
    const requests = loadJoinRequests();

    const newRequest = {
        id: `REQ-${Date.now()}`,
        name: req.body.name,
        class: req.body.class,
        campaignId: req.body.campaignId,
        status: "pending"
    };

    requests.push(newRequest);
    saveJoinRequests(requests);
    io.emit("joinRequestsUpdated", requests);

    res.json({
        message: `${newRequest.name} requested to join.`,
        request: newRequest
    });
});

app.post("/approvejoin/", (req, res) => {
    const requestId = req.body.requestId;
    const requests = loadJoinRequests();
    const players = loadPlayers();
    const request = requests.find(r => r.id === requestId);
    if (!request) {
        return res.status(404).json({ error: "Join request not found" });
    }

    const newPlayer = {
        id: players.length + 1,
        name: request.name,
        class: request.class,
        hp: 100,
        level: 1,
        inventory: [],
        campaignId: request.campaignId,
        "activeQuests": [],
        "completedQuests": []
    };

    players.push(newPlayer);

    const updatedRequests = requests.filter(r => r.id !== requestId);

    savePlayers(players);
    saveJoinRequests(updatedRequests);

    io.emit("playersUpdated", players);
    io.emit("joinRequestsUpdated", updatedRequests);

    res.json({
        message: `${newPlayer.name} approved and added to campaign.`,
        player: newPlayer,
        requests: updatedRequests
    });
});

app.post("/denyjoin/", (req, res) => {
    const requestId = req.body.requestId;
    const requests = loadJoinRequests();
    const request = requests.find(r => r.id === requestId);
  
    if (!request) {
        return res.status(404).json({ error: "Join request not found" });
    }
    const updatedRequests = requests.filter(r => r.id !== requestId);
    saveJoinRequests(updatedRequests);
    io.emit("joinRequestsUpdated", updatedRequests);
    res.json({
        message: `${request.name}'s request was denied.`,
        requests: updatedRequests
    });
});

app.post("/removeplayer/", (req, res) => {
    const playerId = Number(req.body.playerId);

    const players = loadPlayers();
    const Player = players.find(p => p.id === playerId);
    if (!Player) {
        return res.status(404).json({ error: "Player not found" });
    }
    const updatedPlayers = players.filter(p => p.id !== playerId);
    savePlayers(updatedPlayers);
    io.emit("playersUpdated", updatedPlayers);
    res.json({
        message: `${Player.name} was removed from the campaign.`,
        players: updatedPlayers
    });
});

app.get("/quests", (req, res) => {
    const quests = loadQuests();
    res.json(quests);
});

app.post("/createquest", (req, res) => {
    const quests = loadQuests();

    const newQuest = {
        id: `QUEST-${String(quests.length + 1).padStart(3, "0")}`,
        campaignId: req.body.campaignId,
        title: req.body.title,
        description: req.body.description,
        reward: req.body.reward,
        status: "active"
    };

    quests.push(newQuest);

    saveQuests(quests);

    io.emit("questsUpdated", quests);

    res.json({
        message: `${newQuest.title} created.`,
        quest: newQuest
    });
});

app.post("/joinquest", (req, res) => {
    const playerId = Number(req.body.playerId);
    const questId = req.body.questId;

    const players = loadPlayers();
    const quests = loadQuests();

    const player = players.find(p => p.id === playerId);
    const quest = quests.find(q => q.id === questId);

    if (!player) return res.status(404).json({ error: "Player not found" });
    if (!quest) return res.status(404).json({ error: "Quest not found" });

    if (!quest.joinable) {
        return res.status(403).json({ error: "This quest is not joinable by players." });
    }

    if (!player.activeQuests) player.activeQuests = [];

    if (!player.activeQuests.includes(quest.id)) {
        player.activeQuests.push(quest.id);
    }

    savePlayers(players);
    io.emit("playersUpdated", players);

    res.json({
        message: `${player.name} joined quest: ${quest.title}`,
        player
    });
});

app.post("/assignquest", (req, res) => {
    const playerId = Number(req.body.playerId);
    const questId = req.body.questId;

    const players = loadPlayers();
    const quests = loadQuests();

    const player = players.find(p => p.id === playerId);
    const quest = quests.find(q => q.id === questId);

    if (!player) return res.status(404).json({ error: "Player not found" });
    if (!quest) return res.status(404).json({ error: "Quest not found" });

    if (!player.activeQuests) player.activeQuests = [];

    if (!player.activeQuests.includes(quest.id)) {
        player.activeQuests.push(quest.id);
    }

    savePlayers(players);
    io.emit("playersUpdated", players);

    res.json({
        message: `${quest.title} assigned to ${player.name}.`,
        player
    });
});

app.get("/joinrequests", (req, res) => {
    const requests = loadJoinRequests();
    res.json(requests);
});

app.get("/items", (req, res) => {
    const items = loadItems();
    res.json(items);
});

app.post("/createitem", (req, res) => {
    const items = loadItems();
    const newItem = {
        id: `ITEM-${String(items.length + 1).padStart(3, "0")}`,
        name: req.body.name,
        description: req.body.description,
        type: req.body.type,
        damage: Number(req.body.damage) || 0,
        heal: Number(req.body.heal) || 0
    };
    items.push(newItem);
    saveItems(items);
    io.emit("itemsUpdated", items);
    res.json({
        message: `${newItem.name} created.`,
        item: newItem
    });
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

app.get("/campaigns", (req, res) => {
    const campaigns = loadCampaigns();
    res.json(campaigns);
});

io.on("connection", (socket) => {
    console.log("A Questbound device connected: ");
});

app.post("/createcampaign", (req, res) => {
    const campaigns = loadCampaigns();

    const newCampaign = {
        id: `CAMP-${String(campaigns.length + 1).padStart(3, "0")}`,
        name: req.body.name,
        dm: req.body.dm,
        description: req.body.description || ""
    };

    campaigns.push(newCampaign);

    saveCampaigns(campaigns);

    io.emit("campaignsUpdated", campaigns);

    res.json({
        message: `${newCampaign.name} created.`,
        campaign: newCampaign
    });
});

server.listen(port, () => {
    console.log(`Questbound server running at http://localhost:${port}`);
});