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
const checkTypes = {
  strength: "Strength",
  dexterity: "Dexterity",
  intelligence: "Intelligence",
  wisdom: "Wisdom",
  charisma: "Charisma",
  constitution: "Constitution",
  stealth: "Stealth"
};

function runCheck(player, checkType, difficulty) {
    if (!checkTypes[checkType]) {
        return {
            error: `Invalid check type: ${checkType}`,
            success: false
        };
    }

    const stats = player.stats || {};
    const modifier = stats[checkType] || 0;

    const roll = rollD20();
    const total = roll + modifier;

    return {
        checkType,
        checkName: checkTypes[checkType],
        difficulty,
        roll,
        modifier,
        total,
        success: total >= difficulty
    };
}

function rollStat() {
  const result = rollDice(3, 6);
  return result.total;
}

function generateStats() {
  return {
    strength: rollStat(),
    dexterity: rollStat(),
    intelligence: rollStat(),
    wisdom: rollStat(),
    charisma: rollStat(),
    constitution: rollStat(),
    stealth: rollStat()
  };
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollDice(amount, sides) {
  const rolls = [];

  for (let i = 0; i < amount; i++) {
    rolls.push(rollDie(sides));
  }

  const total = rolls.reduce((sum, roll) => sum + roll, 0);

  return {
    amount,
    sides,
    rolls,
    total
  };
}

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

function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}

function runCheck(player, checkType, difficulty) {
    const stats = player.stats || {};

   const baseModifier = stats[checkType] || 0;
const equipmentBonus = getEquipmentBonus(player, checkType);
const modifier = baseModifier + equipmentBonus;

    const roll = rollD20();
    const total = roll + modifier;

    return {
        checkType,
        difficulty,
        roll,
        baseModifier,
        equipmentBonus,
        modifier,
        total,
        success: total >= difficulty
    };
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

function getEquipmentBonus(player, stat) {
  const items = loadItems();

  if (!player.inventory) {
    return 0;
  }

  let bonus = 0;

  player.inventory.forEach(itemId => {
    const item = items.find(i => i.id === itemId);

    if (item && item.bonuses && item.bonuses[stat]) {
      bonus += Number(item.bonuses[stat]);
    }
  });

  return bonus;
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

app.post("/rollcheck", (req, res) => {
  const playerId = Number(req.body.playerId);
  const checkType = req.body.checkType;
  const difficulty = Number(req.body.difficulty) || 10;

  const players = loadPlayers();
  const player = players.find(p => p.id === playerId);

  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }

  const check = runCheck(player, checkType, difficulty);

  res.json({
    player: player.name,
    check: check
  });
});

app.post("/rolldice", (req, res) => {
  const amount = Number(req.body.amount) || 1;
  const sides = Number(req.body.sides) || 20;

  const allowedSides = [4, 6, 8, 10, 12, 20, 100];

  if (!allowedSides.includes(sides)) {
    return res.status(400).json({
      error: "Invalid die type."
    });
  }

  const result = rollDice(amount, sides);

  res.json(result);
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

    const existingPlayer = players.find(
  p =>
    p.campaignId === request.campaignId &&
    p.name.toLowerCase() === request.name.toLowerCase()
);

if (existingPlayer) {
  return res.status(400).json({
    error: "A player with that name already exists in this campaign."
  });
}

    const newPlayer = {
    id: players.length + 1,
    name: request.name,
    class: request.class,
    hp: 100,
    level: 1,
    xp: 0,
    statPoints: 0,

    statsLocked: false,
    statRerollsRemaining: 1,

    inventory: [],
    campaignId: request.campaignId,
    activeQuests: [],
    completedQuests: []
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

app.post("/generatestats", (req, res) => {
    const playerId = Number(req.body.playerId);

    const players = loadPlayers();

    const player =
        players.find(p => p.id === playerId);

    if (!player) {
        return res.status(404).json({
            error: "Player not found"
        });
    }

    if (player.statsLocked) {
        return res.status(400).json({
            error: "Stats already accepted."
        });
    }

    player.stats = generateStats();

    savePlayers(players);

    io.emit("playersUpdated", players);

    res.json(player);
});

app.post("/rerollstats", (req, res) => {
    const playerId = Number(req.body.playerId);

    const players = loadPlayers();

    const player =
        players.find(p => p.id === playerId);

    if (!player) {
        return res.status(404).json({
            error: "Player not found"
        });
    }

    if (player.statsLocked) {
        return res.status(400).json({
            error: "Stats already accepted."
        });
    }

    if (player.statRerollsRemaining <= 0) {
        return res.status(400).json({
            error: "No rerolls remaining."
        });
    }

    player.stats = generateStats();

    player.statRerollsRemaining -= 1;

    savePlayers(players);

    io.emit("playersUpdated", players);

    res.json(player);
});

app.post("/acceptstats", (req, res) => {
    const playerId = Number(req.body.playerId);

    const players = loadPlayers();

    const player =
        players.find(p => p.id === playerId);

    if (!player) {
        return res.status(404).json({
            error: "Player not found"
        });
    }

    player.statsLocked = true;

    savePlayers(players);

    io.emit("playersUpdated", players);

    res.json({
        message: "Stats accepted.",
        player
    });
});

app.post("/upgradestat", (req, res) => {
  const playerId = Number(req.body.playerId);
  const stat = req.body.stat;

  const players = loadPlayers();

  const player =
    players.find(p => p.id === playerId);

  if (!player) {
    return res.status(404).json({
      error: "Player not found"
    });
  }

  if ((player.statPoints || 0) <= 0) {
    return res.status(400).json({
      error: "No stat points available"
    });
  }

  if (!player.stats) {
    return res.status(400).json({
      error: "Player has no stats"
    });
  }

  player.stats[stat] =
    (player.stats[stat] || 0) + 1;

  player.statPoints -= 1;

  savePlayers(players);

  io.emit("playersUpdated", players);

  res.json({
    message: `${stat} increased.`,
    player
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

    const existingQuest = quests.find(
  q =>
    q.campaignId === req.body.campaignId &&
    q.title.toLowerCase() === req.body.title.toLowerCase()
);

if (existingQuest) {
  return res.status(400).json({
    error: "A quest with that title already exists in this campaign."
  });
}

    const newQuest = {
  id: `QUEST-${String(quests.length + 1).padStart(3, "0")}`,
  campaignId: req.body.campaignId,
  title: req.body.title,
  description: req.body.description,
  reward: req.body.reward,
  xpReward: Number(req.body.xpReward) || 0,
  joinable: req.body.joinable === true,
  status: "active",
  objectives: req.body.objectives || []
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
    
    if (!player.activeQuestSteps) player.activeQuestSteps = {};

    if (quest.startStepId && !player.activeQuestSteps[quest.id]) {
    player.activeQuestSteps[quest.id] = quest.startStepId;
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

app.post("/choosequeststep", (req, res) => {
    const playerId = Number(req.body.playerId);
    const questId = req.body.questId;
    const choiceId = req.body.choiceId;

    const players = loadPlayers();
    const quests = loadQuests();

    const player = players.find(p => p.id === playerId);
    const quest = quests.find(q => q.id === questId);

    if (!player) return res.status(404).json({ error: "Player not found" });
    if (!quest) return res.status(404).json({ error: "Quest not found" });

    if (!quest.steps || !quest.startStepId) {
        return res.status(400).json({ error: "Quest has no step system yet" });
    }

    if (!player.activeQuestSteps) player.activeQuestSteps = {};

    const currentStepId =
        player.activeQuestSteps[quest.id] || quest.startStepId;

    const currentStep = quest.steps.find(step => step.id === currentStepId);

    if (!currentStep) {
        return res.status(404).json({ error: "Current step not found" });
    }

    const choice = currentStep.choices.find(c => c.id === choiceId);

    if (!choice) {
        return res.status(404).json({ error: "Choice not found" });
    }

    const check = runCheck(player, choice.checkType, choice.difficulty);
    
    if (check.error) {
    return res.status(400).json(check);
}

    const nextStepId = check.success
        ? choice.successStepId
        : choice.failStepId;

    player.activeQuestSteps[quest.id] = nextStepId;

    savePlayers(players);
    io.emit("playersUpdated", players);

    res.json({
        message: check.success ? "Check succeeded!" : "Check failed!",
        check,
        nextStepId,
        player
    });
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
        heal: Number(req.body.heal) || 0,
        bonuses: req.body.bonuses || {}
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

app.post("/completequest", (req, res) => {
  const playerId = Number(req.body.playerId);
  const questId = req.body.questId;

  const players = loadPlayers();
  const quests = loadQuests();

  const player = players.find(p => p.id === playerId);
  const quest = quests.find(q => q.id === questId);

  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }

  if (!quest) {
    return res.status(404).json({ error: "Quest not found" });
  }

  if (!player.activeQuests) {
    player.activeQuests = [];
  }

  if (!player.completedQuests) {
    player.completedQuests = [];
  }

  if (!player.activeQuests.includes(questId)) {
    return res.status(400).json({
      error: "Player does not have this quest active."
    });
  }

  player.activeQuests = player.activeQuests.filter(
    id => id !== questId
  );

  if (!player.completedQuests.includes(questId)) {
    player.completedQuests.push(questId);
  }

  player.xp = (player.xp || 0) + (quest.xpReward || 0);

  while (player.xp >= 100) {
  player.level += 1;
  player.xp -= 100;
  player.statPoints = (player.statPoints || 0) + 1;
}

  savePlayers(players);

  io.emit("playersUpdated", players);

  res.json({
    message: `${player.name} completed quest: ${quest.title}`,
    reward: quest.reward,
    xpReward: quest.xpReward,
    player: player
  });
});


io.on("connection", (socket) => {
    console.log("A Questbound device connected: ");
});

app.post("/completeobjective", (req, res) => {
  const questId = req.body.questId;
  const objectiveId = req.body.objectiveId;

  const quests = loadQuests();

  const quest = quests.find(q => q.id === questId);

  if (!quest) {
    return res.status(404).json({ error: "Quest not found" });
  }

  if (!quest.objectives) {
    return res.status(400).json({ error: "Quest has no objectives" });
  }

  const objective = quest.objectives.find(
    obj => obj.id === objectiveId
  );

  if (!objective) {
    return res.status(404).json({ error: "Objective not found" });
  }

  objective.completed = true;

  saveQuests(quests);

  io.emit("questsUpdated", quests);

  res.json({
    message: `Objective completed: ${objective.text}`,
    quest: quest
  });
});

app.post("/createcampaign", (req, res) => {
  const campaigns = loadCampaigns();

  const existingCampaign = campaigns.find(
  c => c.name.toLowerCase() === req.body.name.toLowerCase()
);

if (existingCampaign) {
  return res.status(400).json({
    error: "A campaign with that name already exists."
  });
}

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

app.post("/deletequest", (req, res) => {
  const questId = req.body.questId;

  const quests = loadQuests();
  const players = loadPlayers();

  const quest = quests.find(q => q.id === questId);

  if (!quest) {
    return res.status(404).json({ error: "Quest not found" });
  }

  const updatedQuests = quests.filter(q => q.id !== questId);

  players.forEach(player => {
    if (player.activeQuests) {
      player.activeQuests = player.activeQuests.filter(id => id !== questId);
    }

    if (player.completedQuests) {
      player.completedQuests = player.completedQuests.filter(id => id !== questId);
    }
  });

  saveQuests(updatedQuests);
  savePlayers(players);

  io.emit("questsUpdated", updatedQuests);
  io.emit("playersUpdated", players);

  res.json({
    message: `${quest.title} deleted.`,
    quests: updatedQuests
  });
});

server.listen(port, () => {
    console.log(`Questbound server running at http://localhost:${port}`);
});