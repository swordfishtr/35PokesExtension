'use strict';
(() => {

	if (globalThis.hasRun_35pokes_main) return;
	globalThis.hasRun_35pokes_main = true;

	// Preact beta client support
	const app = globalThis.app ?? globalThis.PS;
	if (!app) throw new Error('35Pokes Main: Failed init.');

	// For the purpose of reducing download size, BattleTeambuilderTable entries initially have
	// `tiers` populated as an array of mostly pokemon IDs. This is later moved to `tierSet`
	// and changed to a proper list, discarding `tiers`. Here we trigger this change manually.
	if (BattleTeambuilderTable.gen9natdex.tiers) {
		new DexSearch('pokemon', 'gen9nationaldex').typedSearch.getBaseResults();
	}
	console.log('35Pokes Main: Successful init.');

	const DEFAULT_TIERSET = structuredClone(BattleTeambuilderTable.gen9natdex.tierSet);
	const DEFAULT_BANLIST = structuredClone(BattleTeambuilderTable.gen9natdex.metagameBans.nationaldex35pokes);
	const DEFAULT_OVERRIDETIER = structuredClone(BattleTeambuilderTable.gen9natdex.overrideTier);
	const DEFAULT_LEARNSETS = structuredClone(BattleTeambuilderTable.learnsets);
	const DEFAULT_POKEDEX = structuredClone(BattlePokedex);
	const DEFAULT_MOVEDEX = structuredClone(BattleMovedex);

	// THIS IS NOT A SECURE CHANNEL
	// Pokemon Showdown isn't a hostile website, but other extensions
	// can and do listen for messages using this method.
	document.addEventListener('35Pokes', (event) => {
		const data = JSON.parse(event.detail);

		if (typeof data !== 'object') {
			console.log('35Pokes Main: Received unknown message.');
			return;
		}

		restoreDefaults();

		let earlyReturn = false;

		// Just refresh the view.
		if ($.isEmptyObject(data)) {
			earlyReturn = true;
		}

		// Global pokemon settings.
		if (!earlyReturn) {
			if (data[0].generation) {
				downgradeMoveData(Number(data[0].generation));
			}
			else if (data[0].oldgen) {
				downgradeLearnsets(Number(data[0].oldgen));
			}
			if (Array.isArray(data[0].mods)) {
				if (data[0].mods.includes('flipped')) {
					modFlipped(data);
				}
				if (data[0].mods.includes('scalemons')) {
					modScalemons(data);
				}
				if (data[0].mods.includes('moves')) {
					earlyReturn = true;
					modMoves(data);
				}
			}
		}

		// Individual pokemon settings.
		if (!earlyReturn) {
			const banlist = BattleTeambuilderTable.gen9natdex.metagameBans.nationaldex35pokes = {};
			for (const mon of data) {
				const name = toID(mon.value);
				if (mon.abilities) {
					overrideAbilities(name, ...mon.abilities);
				}
				if (mon.moves) {
					overrideLearnset(name, mon.moves);
				}

				// Allowed pokemon and extra headers are added to the bottom of the natdex, after lc.
				// For pokemon, using a non-lowercase name allows us to avoid displaying duplicates
				// without rearranging `tierSet`.
				const entry = mon.header
					? ['header', BattleLog.escapeHTML(mon.value)]
					: ['pokemon', toID(mon.value).toUpperCase()];
				banlist[entry[1]] = 1;
				BattleTeambuilderTable.gen9natdex.tierSet.push(entry);
			}
		}

		if (app.rooms.teambuilder?.curChartType) {
			app.rooms.teambuilder.updateChart(true);
		}
	});

	function restoreDefaults() {
		BattleTeambuilderTable.gen9natdex.tierSet = structuredClone(DEFAULT_TIERSET);
		BattleTeambuilderTable.gen9natdex.metagameBans.nationaldex35pokes = structuredClone(DEFAULT_BANLIST);
		BattleTeambuilderTable.gen9natdex.overrideTier = structuredClone(DEFAULT_OVERRIDETIER);
		BattleTeambuilderTable.learnsets = structuredClone(DEFAULT_LEARNSETS);
		BattlePokedex = structuredClone(DEFAULT_POKEDEX);
		BattleMovedex = structuredClone(DEFAULT_MOVEDEX);
	}

	function overrideAbilities(mon, abil1, abil2, abil3, abil4) {
		const abilities = BattlePokedex[mon].abilities;
		if (abil1 === false) delete abilities[0];
		else if (abil1 !== true) abilities[0] = abil1;
		if (abil2 === false) delete abilities[1];
		else if (abil2 !== true) abilities[1] = abil2;
		if (abil3 === false) delete abilities['H'];
		else if (abil3 !== true) abilities['H'] = abil3;
		if (abil4 === false) delete abilities['S'];
		else if (abil4 !== true) abilities['S'] = abil4;
	}

	// TODO: check for existing properties of each learnset entry; try to preserve them.
	function overrideLearnset(mon, moves) {
		BattleTeambuilderTable.learnsets[mon] ??= {};
		if (moves.ban.some((m) => m.toLowerCase() === 'all')) {
			BattleTeambuilderTable.learnsets[mon] = {};
		}

		const learnset = BattleTeambuilderTable.learnsets[mon];
		for (const move of moves.ban) {
			delete learnset[toID(move)];
		}
		for (const move of moves.add) {
			learnset[toID(move)] = '9a';
		}

		// Evo inherits moves from prevo, so we have to delete prevo's moves too, but we don't have to add the evo's new moves.
		const prevo = BattlePokedex[mon].prevo;
		if (prevo) {
			moves.add = [];
			overrideLearnset(toID(prevo), moves);
		}
	}

	// NOTE: Moves (and most other things) changed between generations are calculated backwards in Showdown.
	// target: number (target generation to mimic)
	function downgradeMoveData(target) {
		const gens = [];
		const filter = /^gen(\d+)$/;
		const markedMoves = new Set();
		for (const gen in BattleTeambuilderTable) {
			const result = filter.exec(gen);
			if (result && Number(result[1]) >= Number(target))
				gens.push(gen);
		}
		gens.sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
		while (gens.length) {
			const gen = gens.pop();
			for (const move in BattleTeambuilderTable[gen].overrideMoveData) {
				for (const prop in BattleTeambuilderTable[gen].overrideMoveData[move]) {
					switch (prop) {
						// ignore useless props in large numbers
						case 'desc':
						case 'isNonstandard':
						case 'zMove':
						case 'maxMove':
							break;

						// handle object props
						case 'secondary':
							markedMoves.add(move);
						case 'flags':
							for (const flag in BattleTeambuilderTable[gen].overrideMoveData[move][prop]) {
								BattleMovedex[move][prop][flag] = BattleTeambuilderTable[gen].overrideMoveData[move][prop][flag];
							}
							break;

						// mark move if these changed
						case 'accuracy':
						case 'basePower':
							markedMoves.add(move);

						default:
							BattleMovedex[move][prop] = BattleTeambuilderTable[gen].overrideMoveData[move][prop];
					}
				}
			}
		}
		
		// things break from unexpected values, the best indication we can do is add '!!!' to shortDesc
		markedMoves.forEach((move) => {
			if (BattleMovedex[move].shortDesc) {
				BattleMovedex[move].shortDesc = '!!! ' + BattleMovedex[move].shortDesc;
			}
		});

		if (target <= 3) {
			const oldgenSpecialMoves = ['Dark', 'Dragon', 'Electric', 'Fire', 'Grass', 'Ice', 'Psychic', 'Water'];
			for (const move in BattleMovedex) {
				if (BattleMovedex[move].category === 'Status') {
					continue;
				}
				if (oldgenSpecialMoves.includes(BattleMovedex[move].type)) {
					BattleMovedex[move].category = 'Special';
				}
				else {
					BattleMovedex[move].category = 'Physical';
				}
			}
		}
	}

	// NOTE: HM moves aren't transferrable.
	// target: number (target generation to mimic)
	function downgradeLearnsets(target) {
		downgradeMoveData(target);
		const curGen = 9;
		const laterGens = [];
		for (let i = target + 1; i <= curGen; i++) {
			laterGens.push(`${i}`);
		}
		for (const mon in BattleTeambuilderTable.learnsets) {
			for (const move in BattleTeambuilderTable.learnsets[mon]) {
				if (
					!BattleTeambuilderTable.learnsets[mon][move].includes(`${target}`) &&
					laterGens.some((x) => BattleTeambuilderTable.learnsets[mon][move].includes(x))
				) {
					delete BattleTeambuilderTable.learnsets[mon][move];
				}
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

	function modScalemons(meta) {
		meta.filter((mon) => !mon.header).map((mon) => toID(mon.value)).forEach((mon) => {
			const bstNoHP = BattlePokedex[mon].baseStats.atk +
			BattlePokedex[mon].baseStats.def +
			BattlePokedex[mon].baseStats.spa +
			BattlePokedex[mon].baseStats.spd +
			BattlePokedex[mon].baseStats.spe;
			const scale = 600 - BattlePokedex[mon].baseStats.hp;
			for (const stat in BattlePokedex[mon].baseStats) {
				if (stat === 'hp') continue;
				let newStat = Math.floor(BattlePokedex[mon].baseStats[stat] * scale / bstNoHP);
				if (newStat < 1) newStat = 1;
				else if (newStat > 255) newStat = 255;
				BattlePokedex[mon].baseStats[stat] = newStat;
			}
		});
	}

	function modMoves(meta) {
		const moves = meta.map((move) => toID(move.value));
		for (const mon in BattleTeambuilderTable.learnsets) {
			for (const move in BattleTeambuilderTable.learnsets[mon]) {
				if (!moves.includes(move)) {
					delete BattleTeambuilderTable.learnsets[mon][move];
				}
			}
			const moveNum = Object.keys(BattleTeambuilderTable.learnsets[mon]).length;
			BattleTeambuilderTable.gen9natdex.overrideTier[mon] = `${moveNum}`;
			if (BattlePokedex[mon]?.otherFormes) {
				for (const forme of BattlePokedex[mon].otherFormes.map(toID)) {
					BattleTeambuilderTable.gen9natdex.overrideTier[forme] = `${moveNum}`;
				}
			}
		}
	}

})();
