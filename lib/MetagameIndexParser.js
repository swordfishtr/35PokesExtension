/**
 * @param {string} txt  - metagame to be interpreted.
 * @param {string} group  - group to desplay before name in the top header. (there's no pretty way to handle this)
 * @param {{}[]} [parent] - reference to interpreted parent metagame.
 * @returns {{}[]} - interpreted metagame.
 */
function parseMeta(txt, group, parent) {
	const metagame = structuredClone(parent) ?? [{}];

	// Capture the next line that has content.
	const lines = /^(.+)$/gm;

	// Match if first non-whitespace character is #
	const isComment = /^\s*#/;

	// Expect the mandatory data at the top - currently only the display name.
	while(true) {
		const line = lines.exec(txt)?.[1];

		// We've reached the end already. This means the file was a nothing burger.
		if(!line) return metagame;

		if(isComment.test(line)) continue;

		// For popup.
		metagame[0].name = line;

		// The first element of a metagame doubles up as a rules container and the top header.
		// Avoid displaying something like "2024 Nov 2024"
		metagame[0].value = `35 Pokes: ${line.includes(group)?"":group+" "} ${line}`;
		metagame[0].header = true;

		break;
	}

	// Everything else is optional and can be in any order.

	const isCode = /^\s*code:\s*(.*?)\s*$/i;
	const isRules = /^\s*rules;/i;
	const modGen = /;\s*generation:\s*(.+?)(?:$|[;\s])/i;
	const modOldGen = /;\s*oldgen:\s*(.+?)(?:$|[;\s])/i;
	const modFlipped = /;\s*flipped(?:$|[;\s])/i;
	const modScalemons = /;\s*scalemons(?:$|[;\s])/i;
	const modMoves = /;\s*moves(?:$|[;\s])/i;
	const isHeader = /;\s*header\s*(?:;|$)/i;
	const isParent = /^\s*parent:/i;
	const dataValueBase = /^\s*(.*?)\s*(?:;|$)/;
	const dataValueChild = /^\s*([+-])\s*(.*?)\s*(?:;|$)/;
	const pkmnMoves = /;\s*moves:(.+?);/i;
	const pkmnMoveLoop = /([+-])\s*(.+?)\s*(?:,|$)/g;

	// split into a loop, like moves?
	const pkmnAbils = /;\s*abilities:(?:\s*1\s*:\s*(.*?)\s*(?:$|[,;]))?(?:(?<!;\s*)\s*2\s*:\s*(.*?)\s*(?:$|[,;]))?(?:(?<!;\s*)\s*3\s*:\s*(.*?)\s*(?:$|[,;]))?(?:(?<!;\s*)\s*4\s*:\s*(.*?)\s*(?:$|[,;]))?/i;

	while(true) {
		const line = lines.exec(txt)?.[1];

		// End of file
		if(!line) break;

		if(isComment.test(line)) continue;
		
		const code = isCode.exec(line)?.[1];
		if(code) {
			metagame[0].code = code;
			continue;
		}

		if(isRules.test(line)) {
			if(!metagame[0].mods) metagame[0].mods = [];

			const generation = modGen.exec(line)?.[1];
			if(generation) metagame[0].generation = generation;

			const oldgen = modOldGen.exec(line)?.[1];
			if(oldgen) metagame[0].oldgen = oldgen;

			if(modFlipped.test(line)) metagame[0].mods.push("flipped");
			if(modScalemons.test(line)) metagame[0].mods.push("scalemons");
			if(modMoves.test(line)) metagame[0].mods.push("moves");

			continue;
		}

		if(isHeader.test(line)) {
			// Always defined, but can be empty string.
			// We'll accept it for headers, reject it for pokemon names below.
			const value = dataValueBase.exec(line)[1];
			metagame.push({ value: value, header: true });
			continue;
		}

		const mon = {};

		if(parent) {
			const value = dataValueChild.exec(line);
			if(!value) {
				if(isParent.test(line)) continue;
				console.warn("35Pokes Background: Parsing child meta: Ignoring invalid line:", line);
				continue;
			}
			if(value[1] === "-") {
				const i = metagame.findLastIndex((mon) => mon.value === value[2]);
				if(i >= 0) metagame.splice(i, 1);
				else console.warn("35Pokes Background: Parsing child meta: Could not remove nonexistent pokemon:", line);
				continue;
			}
			mon.value = value[2];
		}
		else {
			const value = dataValueBase.exec(line)[1];
			if(value === "") {
				console.warn("35Pokes Background: Parsing base meta: Ignoring line with missing value:", line);
				continue;
			}
			mon.value = value;
		}

		const abilities = pkmnAbils.exec(line);
		if(abilities) {
			// Keep as is by default.
			// To delete ability slots, use "abilities:1:,2:,3:,4:;"
			// (whitespace between any of these is ok for this purpose.)
			mon.abilities = [true, true, true, true];
			if(typeof abilities[1] === "string") mon.abilities[0] = abilities[1];
			if(typeof abilities[2] === "string") mon.abilities[1] = abilities[2];
			if(typeof abilities[3] === "string") mon.abilities[2] = abilities[3];
			if(typeof abilities[4] === "string") mon.abilities[3] = abilities[4];
		}

		const moves = pkmnMoves.exec(line)?.[1];
		if(moves) {
			mon.moves = { add: [], ban: [] };
			while(true) {
				const move = pkmnMoveLoop.exec(moves);
				if(!move) break;
				// Use "-all, +move" to set learnset. This is handled in content_main.js
				if(move[1] === "+") mon.moves.add.push(move[2]);
				else mon.moves.ban.push(move[2]);
			}
		}

		metagame.push(mon);
	}

	return metagame;
}

/**
 * Title is bold; author is italic and preceded by a ~
 * @param {string} txt - Expect title and author first, news right after.
 */
function parseNews(txt) {
	const news = {
		title: "",
		author: "",
		news: "",
	};
	const lines = /^(.+)$/gm;

	const regexTitle = /^\s*title\s*:\s*(.+?)\s*$/i;
	const regexAuthor = /^\s*author\s*:\s*(.+?)\s*$/i;

	while(true) {
		if(news.title && news.author) {
			news.news = txt.slice(lines.lastIndex + 1);
			break;
		}

		const line = lines.exec(txt)?.[1];
		if(!line) break;

		const title = regexTitle.exec(line)?.[1];
		if(title) {
			news.title = title;
			continue;
		}

		const author = regexAuthor.exec(line)?.[1];
		if(author) {
			news.author = author;
			continue;
		}
	}

	return news;
}

export { parseMeta, parseNews };
