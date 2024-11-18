// Polyfill for browser compatibility
if (typeof browser === "undefined") globalThis.browser = chrome;

const MSG_REFRESH = "refresh";
const KEY_METAGAMES = "metagames";
const KEY_CURRENT = "current";
const KEY_TIMESTAMP = "timestamp";

var STATE_DOWNLOADING = false;

// Check whether storage is wiped.
browser.storage.local.get(null).then((stored) => {
    for(const x in stored) if(x) return;
    checkUpdates();
});

browser.runtime.onMessage.addListener((msg) => {
    if(msg === MSG_REFRESH) checkUpdates();
});

// We always fetch all metagame files on update because:
// 1. It's more efficient than checking individual file update times.
// 2. Typos happen, so we can't keep the already stored data.
async function checkUpdates() {
    if(STATE_DOWNLOADING) return;
    STATE_DOWNLOADING = true;

    const data_repo_res = await fetch("https://api.github.com/repos/swordfishtr/35PokesIndex");
    if(!data_repo_res.ok) {
        console.log("35Pokes Background: Failed to fetch repository metadata.");
        return;
    }
    const data_repo = await data_repo_res.json();

    const stored = await browser.storage.local.get(KEY_TIMESTAMP);
    if(stored[KEY_TIMESTAMP] === data_repo.pushed_at) return;

    const data_index_res = await fetch("https://api.github.com/repos/swordfishtr/35PokesIndex/git/trees/main?recursive=1");
    if(!data_index_res.ok) {
        console.log("35Pokes Background: Failed to fetch repository index.");
        return;
    }
    const data_index = await data_index_res.json();

    const metagames = await interpretIndex(data_index.tree);

    await browser.storage.local.set({
        [KEY_METAGAMES]: metagames,
        [KEY_TIMESTAMP]: data_repo.pushed_at,
        [KEY_CURRENT]: ["Perfect", "B1"] // EDITME: testing w no ui, remove before release
    });

    STATE_DOWNLOADING = false;
}


async function interpretIndex(index) {
    const metagames = {};
    const metagamesRelative = {};

    // Download and process base metagames in parallel
    await Promise.all(index.map(async (meta) => {
        if(meta.type !== "blob") return;
        if(meta.path === "LICENSE") return;

        const id = interpretPath(meta.path);
        if(!id) {
            console.log("35Pokes Background: Invalid metagame data path: " + meta.path);
            return;
        }

        const buffer = {}
        
        buffer.group = id[1];
        buffer.name = interpretName(id[2]);

        if(!metagames[id[1]]) metagames[id[1]] = {};

        const data_meta_res = await fetch("https://raw.githubusercontent.com/swordfishtr/35PokesIndex/main/" + meta.path);
        if(!data_meta_res.ok) {
            console.log("35Pokes Background: Failed to fetch " + meta.path);
            return;
        }
        const data_meta = await data_meta_res.json();

        buffer.rules = data_meta.rules;

        // Relative formats can't be interpreted in parallel. We'll do that next.
        if(data_meta.rules?.parent) {
            buffer.add = data_meta.add;
            buffer.ban = data_meta.ban;
            buffer.id = id;
            // Store in a single object to make sorting reasonable.
            metagamesRelative[meta.path] = buffer;
            return;
        }

        interpretPokemon(buffer, data_meta);

        metagames[id[1]][id[2]] = buffer;
    }));

    // Interpret relative metas in the order of lowest to greatest height.
    Object.values(metagamesRelative).forEach((meta) => {
        traverseMetagames(metagames, metagamesRelative, meta);
    });
    Object.values(metagamesRelative).sort((a, b) => a.rules.height - b.rules.height).forEach((meta) => {
        // Should trigger format type 1 or 2. Additions first because this sets the meta property.
        interpretPokemon(meta, meta.add);

        const parent = interpretPath(meta.rules.parent);

        // Pull the common pokemon from parent meta.
        for(const mon in metagames[parent[1]][parent[2]].meta) {
            if(!meta.meta[mon] && !meta.ban.includes(mon))
                meta.meta[mon] = metagames[parent[1]][parent[2]].meta[mon];
        }

        // The current format of stored metas does not support multiples of the same pokemon, though the teambuilder
        // does have limited support for it - a pokemon can't have a different set of abilities or moves for each of its entries.

        metagames[meta.id[1]][meta.id[2]] = meta;
        delete meta.add;
        delete meta.ban;
        delete meta.id;
        delete meta.rules.height;
        delete meta.rules.parent;

    });

    console.log(metagames);

    return metagames;
}


// Capture "group/name.json" as [1]=group, [2]=name. We support at most 1 subdir.
function interpretPath(path) {
    const result = /^(?:([^\/]+)\/)?([^\/]+)?\.json$/.exec(path);
    // Ensure that the group property is defined even for metagames in the root dir.
    if(result && !result[1]) result[1] = result[2].slice(0, path.indexOf("_"));
    return result;
}


// Handles custom naming schemes.
function interpretName(name) {
    const months = ["Error", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const vanilla = /^([0-9]+)_([0-9]+)(?:_([^_]+))?$/.exec(name);
    if(vanilla) {
        return months[Number(vanilla[2])] + " " + Number(vanilla[1]) + ( vanilla[3] ? " " + vanilla[3] : "" );
    }

    const perfect = /^([A-Z]+)([0-9]+)$/.exec(name);
    if(perfect) {
        return "Vision " + perfect[1] + ", Version " + perfect[2];
    }

    throw new Error("35Pokes Background: Failed to interpret meta name " + name);
}


function interpretPokemon(buffer, mons) {
    // We support 4 kinds of formatting: (props = learnsets, abilities)
    // 1. Default rules + default props: [mons]
    // 2. Default rules + modified props: {mons}
    // 3. Modified rules + default props: {rules:{}, meta:[mons]}
    // 4. Modified rules + modified props: {rules:{}, meta:{mons}}

    // Format type 1
    if(Array.isArray(mons)) {
        buffer.meta = {};
        for(const mon of mons) { //of mons.sort()
            buffer.meta[mon] = {};
        }
    }
    // Format type 2
    else if(!mons.meta) {
        buffer.meta = mons;
    }
    // Format type 3
    else if(Array.isArray(mons.meta)) {
        buffer.meta = {};
        for(const mon of mons.meta) {
            buffer.meta[mon] = {};
        }
    }
    // Format type 4 (preferred)
    else {
        buffer.meta = mons.meta;
    }
}


// Sets height for a given meta and its parent chain.
function traverseMetagames(metagames, metagamesRelative, self) {
    if(self.rules.height === 0) {
        throw new Error("35Pokes Background: Circular metagame hierarchy: " + self.name);
    }
    if(self.rules.height) {
        // We have already traversed this part of the branch up to the root. No need to repeat.
        return self.rules.height;
    }
    const parent = interpretPath(self.rules.parent);
    if(metagames[parent[1]][parent[2]]) {
        return self.rules.height = 1;
    }
    if(metagamesRelative[self.rules.parent]) {
        // This order is important for detecting circular dependencies.
        self.rules.height = 0;
        self.rules.height += traverseMetagames(metagames, metagamesRelative, metagamesRelative[self.rules.parent]);
        self.rules.height++;
        return self.rules.height;
    }
    throw new Error("35Pokes Background: Could not find parent metagame of " + self.name);
}
