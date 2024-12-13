"use strict";
(() => {

    if(globalThis.hasRun_35pokes_main) return;
    globalThis.hasRun_35pokes_main = true;

    // tierSet is created from tiers - see battle-dex-search.ts 1003. Force create tierSet
    if(BattleTeambuilderTable.gen9natdex.tiers && !BattleTeambuilderTable.gen9natdex.tierSet) {
        const TEMP_BPS = new BattlePokemonSearch();
        TEMP_BPS.format = "gen9nationaldexag";
        TEMP_BPS.formatType = "natdex";
        TEMP_BPS.getBaseResults();
        console.log("35Pokes Main: Successful init.");
    }
    else console.log("35Pokes Main: Unexpected init.");

    const DEFAULT_NDAG = structuredClone(BattleTeambuilderTable.gen9natdex);
    const DEFAULT_LEARNSETS = structuredClone(BattleTeambuilderTable.learnsets);
    const DEFAULT_POKEDEX = structuredClone(BattlePokedex);
    const DEFAULT_MOVEDEX = structuredClone(BattleMovedex);

    // THIS IS NOT A SECURE CHANNEL
    // Pokemon Showdown isn't a hostile website, but other extensions
    // can and do listen for messages using this method.
    document.addEventListener("35Pokes", (event) => {
        const data = JSON.parse(event.detail);

        if(typeof data !== "object") {
            console.log("35Pokes Main: Received unknown message.");
            return;
        }

        restoreDefaults();

        // alternative: !_.isEmpty(data)
        if($.isEmptyObject(data)) {
            if(app.rooms.teambuilder?.curChartType) app.rooms.teambuilder.updateChart(true);
            return;
        }

        BattleTeambuilderTable.gen9natdex.thirtyfivePokes = {};

        // Global pokemon settings.
        if(data[0].gen) overrideMoveData(data[0].gen);
        if(data[0].mods?.includes("flipped")) modFlipped(data);

        // Individual pokemon settings.
        data.forEach((mon) => {
            const name = toID(mon.value);
            if(mon.abilities) overrideAbilities(name, ...mon.abilities);
            if(mon.moves) overrideLearnset(name, mon.moves);

            // Allowed pokemon and extra headers are added to the bottom of the natdex, after lc.
            // For pokemon, using a non-lowercase name allows us to avoid displaying duplicates without modifying NDAG layout.
            const inj = [];
            let esc;
            if(mon.header) {
                esc = BattleLog.escapeHTML(mon.value);
                inj[0] = "header";
            }
            else {
                esc = toID(mon.value).toUpperCase();
                inj[0] = "pokemon";
            }
            BattleTeambuilderTable.gen9natdex.thirtyfivePokes[esc] = 1;
            inj[1] = esc;
            BattleTeambuilderTable.gen9natdex.tierSet.push(inj);
        });

        // research: TeambuilderRoom.prototype.updateChart accepts a 2nd parameter that seems to have no effect.
        if(app.rooms.teambuilder?.curChartType) app.rooms.teambuilder.updateChart(true);

    });

    function restoreDefaults() {
        BattleTeambuilderTable.gen9natdex = structuredClone(DEFAULT_NDAG);
        BattleTeambuilderTable.learnsets = structuredClone(DEFAULT_LEARNSETS);
        BattlePokedex = structuredClone(DEFAULT_POKEDEX);
        BattleMovedex = structuredClone(DEFAULT_MOVEDEX);
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

    // research: effects of the values of learnset entries.
    // "123456789pqga"

    // TODO: check for existing properties of each learnset entry; try to preserve them.
    function overrideLearnset(mon, moves) {
        if(!BattleTeambuilderTable.learnsets[mon]) BattleTeambuilderTable.learnsets[mon] = {};

        const banAllRegex = /^all$/i;
        const banAll = moves.ban.some((m) => banAllRegex.test(m));
        if(banAll) BattleTeambuilderTable.learnsets[mon] = {};

        const learnset = BattleTeambuilderTable.learnsets[mon];
        
        if(!banAll) for(const move of moves.ban) delete learnset[toID(move)];

        for(const move of moves.add) learnset[toID(move)] = "9g";

        // Evo inherits moves from prevo, so we have to delete prevo's moves too, but we don't have to add the evo's new moves.
        const prevo = BattlePokedex[mon].prevo;
        if(prevo) {
            moves.add = [];
            overrideLearnset(toID(prevo), moves);
        }
    }

    // NOTE: Moves (and most other things) changed between generations are calculated backwards in Showdown.
    // target: number (target generation to mimic)
    function overrideMoveData(target) {
        const gens = [];
        const filter = /^gen(\d+)$/;
        const markedMoves = new Set();
        for(const gen in BattleTeambuilderTable) {
            const result = filter.exec(gen);
            if(result && Number(result[1]) >= Number(target))
                gens.push(gen);
        }
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
        //markedMoves.forEach((move) => BattleMovedex[move].shortDesc = BattleMovedex[move].shortDesc ? "!!! " + BattleMovedex[move].shortDesc : "!!!" );
        markedMoves.forEach((move) => { if(BattleMovedex[move].shortDesc) BattleMovedex[move].shortDesc = "!!! " + BattleMovedex[move].shortDesc });

        if(target <= 3) {
            const oldgenSpecialMoves = new Set(["Dark", "Dragon", "Electric", "Fire", "Grass", "Ice", "Psychic", "Water"]);
            for(const move in BattleMovedex) {
                if(BattleMovedex[move].category === "Status") continue;

                if(oldgenSpecialMoves.has(BattleMovedex[move].type)) BattleMovedex[move].category = "Special";
                else BattleMovedex[move].category = "Physical";
            }
        }
    }

    function modFlipped(meta) {
        meta.filter((mon) => !mon.header).map((mon) => toID(mon.value)).forEach((mon) => {
            let tempStat;
            tempStat = BattlePokedex[mon].baseStats.hp;
            BattlePokedex[mon].baseStats.hp = BattlePokedex[mon].baseStats.spe;
            BattlePokedex[mon].baseStats.spe = tempStat;
            tempStat = BattlePokedex[mon].baseStats.atk;
            BattlePokedex[mon].baseStats.atk = BattlePokedex[mon].baseStats.spd;
            BattlePokedex[mon].baseStats.spd = tempStat;
            tempStat = BattlePokedex[mon].baseStats.def;
            BattlePokedex[mon].baseStats.def = BattlePokedex[mon].baseStats.spa;
            BattlePokedex[mon].baseStats.spa = tempStat;
        });
    }

})();
