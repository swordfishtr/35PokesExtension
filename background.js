import { parseTar } from "./lib/nanotar.js";

// Polyfill for browser compatibility
if (typeof browser === "undefined") globalThis.browser = chrome;

const MSG_REFRESH = "refresh";
const KEY_METAGAMES = "metagames";
const KEY_CURRENT = "current";
const KEY_TIMESTAMP = "timestamp";

var STATE_DOWNLOADING = false;

browser.runtime.onInstalled.addListener((details) => {
    if(details.reason === "browser_update" || details.reason === "chrome_update") return;
    if(details.reason === "install") {
        // Ensure that Showdown receives a meta, even if the user hasn't set one yet.
        browser.storage.local.set({ [KEY_CURRENT]: ["2024", "2024_11.txt"] });
        checkUpdates(MSG_REFRESH);
        return;
    }
    if(details.reason === "update") {
        // Makes changing the metagame data format smoother.
        browser.storage.local.set({ [KEY_TIMESTAMP]: 0 }).then(() => checkUpdates(MSG_REFRESH));
    }
});

// Check whether storage is wiped.
browser.storage.local.get(null).then((stored) => {
    for(const x in stored) if(x) return;
    checkUpdates(MSG_REFRESH);
});

browser.runtime.onMessage.addListener(checkUpdates);

function checkUpdates(msg) {
    if(msg !== MSG_REFRESH || STATE_DOWNLOADING === true) return;
    STATE_DOWNLOADING = true;

    const REPO_INFO = "https://api.github.com/repos/swordfishtr/35PokesIndex";
    const REPO_TARGZ = "https://api.github.com/repos/swordfishtr/35PokesIndex/tarball/main";
    //const REPO_TARGZ = "https://api.github.com/repos/swordfishtr/35PokesIndex/tarball/next";
    let timestamp;

    // The metagame repository will get increasingly larger as months pass and the community grows.
    // We now download a compressed archive of the repo and process it in a Promise chain for memory efficiency.

    fetch(REPO_INFO)
    .then((info) => {
        if(!info.ok) throw new Error("35Pokes Background: Failed to fetch repository metadata.");
        return info.json();
    })
    .then((json) => {
        timestamp = json.pushed_at;
        return browser.storage.local.get(KEY_TIMESTAMP);
    })
    .then((stored) => {
        // We're up to date.
        if(stored[KEY_TIMESTAMP] === timestamp) throw 0;
        return fetch(REPO_TARGZ);
    })
    .then((repo) => {
        if(!repo.ok) throw new Error("35Pokes Background: Failed to fetch repository metadata.");
        return repo.body.pipeThrough(new DecompressionStream("gzip"));
    })
    .then((stream) => new Response(stream).arrayBuffer())
    .then((data) => parseTar(data))
    .then((tar) => {
        // nanotar provides the entire archive unpacked as an array of objects.
        // TODO: move to a streaming unpacker like https://github.com/mafintosh/tar-stream

        const metagames = {};
        const td = new TextDecoder("utf-8");

        const nameDir = /^[^/]+\/([^/]+)\/$/;

        // Capture [, "group/name.ext"] in "garbage/group/name.ext"
        // Doesn't match if the file is in the root dir, or deeper than 1 dir.
        const nameFile = /^[^/]+\/([^/]+\/[^/]+?)\s*$/;

        // Not working with "pax_global_header" and repo root dir.
        delete tar[0];
        delete tar[1];

        // Prepare the metagames to be parsed.
        tar.forEach((file, i) => {
            if(file.type === "file") {
                file.name = nameFile.exec(file.name)?.[1];
                if(!file.name) {
                    delete tar[i];
                    return;
                }
                file.data = td.decode(file.data);
            }
            else if(file.type === "directory") {
                const name = nameDir.exec(file.name)?.[1];
                if(name) metagames[name] = {};
                delete tar[i];
            }
            else {
                console.warn("35Pokes Background: Unknown file type:", file.type);
                delete tar[i];
            }
        });

        const parentFind = /parent:\s*(.+?)\s*(?:;|$)/m;

        // Parse the metagames.
        tar.forEach((file) => {
            const parentName = parentFind.exec(file.data)?.[1];
            const [sGroup, sName] = file.name.split("/");

            // This metagame has no parent; parse right away.
            if(!parentName) {
                console.info("35Pokes Background: Depth 1:", file.name);
                metagames[sGroup][sName] = parseMeta(file.data, sGroup);
                if(file.dependants) file.dependants.forEach((f) => f(metagames[sGroup][sName]));
                return;
            }

            // This metagame has a parent, check that it exists.
            const parentRef = tar.find((f) => f?.name === parentName);
            if(!parentRef) {
                console.warn("35Pokes Background: Missing parent:", parentName);
                return;
            }
            const [pGroup, pName] = parentName.split("/");

            // This metagame's parent has already been parsed; parse right away.
            if(metagames[pGroup]?.[pName]) {
                console.info("35Pokes Background: Depth 2:", file.name);
                metagames[sGroup][sName] = parseMeta(file.data, sGroup, metagames[pGroup][pName]);
                if(file.dependants) file.dependants.forEach((f) => f(metagames[sGroup][sName]));
                return;
            }

            // This metagame's parent has not been parsed yet. Give the parent a callback to parse this metagame when that is done.
            if(!parentRef.dependants) parentRef.dependants = [];
            console.info("35Pokes Background: Depth 3:", file.name);
            parentRef.dependants.push((ref) => {
                metagames[sGroup][sName] = parseMeta(file.data, sGroup, ref);
                if(file.dependants) file.dependants.forEach((f) => f(metagames[sGroup][sName]));
            });
        });

        console.log(metagames);

        return browser.storage.local.set({
            [KEY_METAGAMES]: metagames,
            [KEY_TIMESTAMP]: timestamp
        });
    })
    .catch((err) => {
        if(err !== 0) throw err;
    })
    .finally(() => {
        STATE_DOWNLOADING = false;
    });
}

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
    const modPastGen = /;\s*generation:\s*(.+?)(?:$|[;\s])/i;
    const modFlipped = /;\s*flipped(?:$|[;\s])/i;
    const modScalemons = /;\s*scalemons(?:$|[;\s])/i;
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

            const gen = modPastGen.exec(line)?.[1];
            if(gen) metagame[0].gen = gen;

            if(modFlipped.test(line)) metagame[0].mods.push("flipped");
            if(modScalemons.test(line)) metagame[0].mods.push("scalemons");

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
