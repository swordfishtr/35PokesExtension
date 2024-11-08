(() => {

    // tierSet is created from tiers - see battle-dex-search.ts 1003. Force create tierSet
    if(BattleTeambuilderTable.gen9natdex.tiers && !BattleTeambuilderTable.gen9natdex.tierSet) {
        const TEMP_BPS = new BattlePokemonSearch();
        TEMP_BPS.format = "gen9nationaldexag";
        TEMP_BPS.formatType = "natdex";
        TEMP_BPS.getBaseResults();
        console.log("35Pokes Main: Successful init.");
    }
    else console.log("35Pokes Main: Unexpected init.");

    const DEFAULT_BPS = BattleTeambuilderTable.gen9natdex.tierSet;

    // THIS IS NOT A SECURE CHANNEL
    // Pokemon Showdown isn't a hostile website, but other extensions
    // can and do listen for messages using this method.
    document.addEventListener("35Pokes", (event) => {

        let data;
        try { data = JSON.parse(event.detail); }
        catch {
            console.log("35Pokes Main: Failed to parse message.");
            return;
        }

        if(data.action === "setMeta") {

            restoreDefaults();

            if(data.meta.rules?.generation < 9) overrideMoveData(data.meta.rules.generation);

            const allowedMons = [];

            for(const mon in data.meta.meta) {

                allowedMons.push(mon);

                if(data.meta.meta[mon].abilities) overrideAbilities(mon, ...data.meta.meta[mon].abilities);

                // might turn mon.addMoves, etc. -> mon.moves {add: [], ban: [], set: []} to allow an if here
                overrideLearnset(mon, data.meta.meta[mon].addMoves, data.meta.meta[mon].banMoves, data.meta.meta[mon].setMoves);

            }

            overridePokemonPool(data.meta.name, allowedMons);

            // research: TeambuilderRoom.prototype.updateChart accepts a 2nd parameter that seems to have no effect.
            if(app.rooms.teambuilder?.curChartType === "pokemon") app.rooms.teambuilder.updateChart(true);

        }
        else if(data.action === "setPower" && typeof data.value === "boolean") {

        }
        else {
            console.log("35Pokes Main: Received unknown message.");
            return;
        }

    });

    function restoreDefaults() {
        BattleTeambuilderTable.gen9natdex.tierSet = DEFAULT_BPS;
        BattleTeambuilderTable.gen9natdex.tiers = null;
    }

    function overrideAbilities(mon, abil1, abil2, abil3, abil4) {
        const abilities = BattlePokedex[mon].abilities;
        if(abil1 === false) delete abilities[0];
        else if(abil1 !== true) abilities[0] = abil1;
        if(abil2 === false) delete abilities[1];
        else if(abil2 !== true) abilities[1] = abil2;
        if(abil3 === false) delete abilities["H"];
        else if(abil3 !== true) abilities["H"] = abil3;
        if(abil4 === false) delete abilities["S"];
        else if(abil4 !== true) abilities["S"] = abil4;
    }

    function overrideLearnset(mon, addMoves, banMoves, setMoves) {
        const learnset = BattleTeambuilderTable.learnsets[mon];
        if(setMoves) {
            for(const move of learnset) delete learnset[move];
            for(const move of setMoves) learnset[move] = "9a";
            return;
        }
        if(addMoves) {
            for(const move of addMoves) learnset[move] = "9a";
        }
        if(banMoves) {
            for(const move of banMoves) delete learnset[move];
            const prevo = BattlePokedex[mon].prevo;
            if(prevo) overrideLearnset(toID(prevo), addMoves, banMoves, setMoves);
        }
    }

    function overridePokemonPool(name, meta) {

        const TEMPARR = meta.map((mon) => ["pokemon", mon]);
        TEMPARR.unshift(["header", "35 Pokes: " + name]);
        //TEMPARR.unshift(["header", '<button class="button" style="height: 24px; margin-right: 12px;">Challenge Code</button> 35 Pokes']);

        BattleTeambuilderTable.gen9natdex.tierSet = TEMPARR;
        BattleTeambuilderTable.gen9natdex.formatSlices.AG = 0;
    }

    // NOTE: Moves (and most other things) changed between generations are calculated backwards in Showdown.
    // target: number (target generation to mimic)
    function overrideMoveData(target) {
        const gens = [];
        const targetRegex = new RegExp("^gen[" + target + "-9]+$");
        const markedMoves = new Set();
        for(const gen in BattleTeambuilderTable) if(targetRegex.test(gen)) gens.push(gen);
        gens.sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
        while(gens.length) {
            const gen = gens.pop();
            for(const move in BattleTeambuilderTable[gen].overrideMoveData) {
                for(const prop in BattleTeambuilderTable[gen].overrideMoveData[move]) {
                    switch(prop) {
                        // ignore useless props in large numbers
                        case "desc":
                        case "isNonstandard":
                        case "zMove":
                        case "maxMove":
                            break;

                        // handle object props
                        case "secondary":
                            markedMoves.add(move);
                        case "flags":
                            for(const flag in BattleTeambuilderTable[gen].overrideMoveData[move][prop])
                                BattleMovedex[move][prop][flag] = BattleTeambuilderTable[gen].overrideMoveData[move][prop][flag];
                            break;

                        // mark move if these changed
                        case "accuracy":
                        case "basePower":
                            markedMoves.add(move);

                        default:
                            BattleMovedex[move][prop] = BattleTeambuilderTable[gen].overrideMoveData[move][prop];
                    }
                }
            }
        }
        
        // things break from unexpected values, the best indication we can do is add "!!!" to shortDesc
        markedMoves.forEach((move) => BattleMovedex[move].shortDesc = BattleMovedex[move].shortDesc ? "!!! " + BattleMovedex[move].shortDesc : "!!!" );

        if(target <= 3) {
            const oldgenSpecialMoves = new Set(["Dark", "Dragon", "Electric", "Fire", "Grass", "Ice", "Psychic", "Water"]);
            for(const move in BattleMovedex) {
                if(BattleMovedex[move].category === "Status") continue;

                if(oldgenSpecialMoves.has(BattleMovedex[move].type)) BattleMovedex[move].category = "Special";
                else BattleMovedex[move].category = "Physical";
            }
        }
    }

})();
