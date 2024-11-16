// Polyfill for browser compatibility
if (typeof browser === "undefined") globalThis.browser = chrome;

const MSG_REFRESH = "refresh";
const KEY_METAGAMES = "metagames";
const KEY_CURRENT = "current";
const KEY_TIMESTAMP = "timestamp";

var STATE_DOWNLOADING = false;

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
        [KEY_CURRENT]: "ADV/2024_9.json" // EDITME: testing w no ui, remove before release
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

        //// Group and Name

        // Assuming at most 1 subdir
        const id = /^(?:([^\/]+)\/)?([^\/]+)?\.json$/.exec(meta.path);
        if(!id) {
            console.log("35Pokes Background: Invalid metagame data path: " + meta.path);
            return;
        }

        const buffer = {};

        // Group can be manipulated like name before assignment
        buffer.group = id[1];
        buffer.name = interpretName(id[2]);

        //// Pokemon, Moves, Abilities, Rules

        const data_meta_res = await fetch("https://raw.githubusercontent.com/swordfishtr/35PokesIndex/main/" + meta.path);
        if(!data_meta_res.ok) {
            console.log("35Pokes Background: Failed to fetch " + meta.path);
            return;
        }
        const data_meta = await data_meta_res.json();

        buffer.rules = data_meta.rules;

        // This format is relative, thus can't be interpreted in parallel. TODO: change `relative` to `parent`
        if(data_meta.rules?.parent) {
            buffer.add = data_meta.add;
            buffer.ban = data_meta.ban;
            metagamesRelative[meta.path] = buffer;
            return;
        }

        interpretPokemon(buffer, data_meta);
        
        metagames[meta.path] = buffer;
    }));

    // Determine height of each relative meta.
    Object.values(metagamesRelative).forEach((meta) => {
        traverseMetagames(metagames, metagamesRelative, meta);
    });

    // Interpret relative metas in the order of lowest to greatest height.
    // This ensures that every meta's parent is already interpreted by the time it's its turn.
    Object.entries(metagamesRelative).sort((a, b) => a[1].rules.height - b[1].rules.height).forEach((meta) => {
        // should trigger format type 1 or 2
        interpretPokemon(meta[1], meta[1].add);

        // current format of stored metas does not support multiples of the same pokemon, though the teambuilder
        // does have limited support for it - a pokemon can't have a different set of abilities or moves for each of its entries.
        for(const mon in metagames[meta[1].rules.parent].meta) {
            if(!meta[1].meta[mon] && !meta[1].ban.includes(mon))
                meta[1].meta[mon] = metagames[meta[1].rules.parent].meta[mon];
        }

        delete meta[1].add;
        delete meta[1].ban;
        delete meta[1].rules.height;
        metagames[meta[0]] = meta[1];
    });

    return metagames;
}


function interpretName(name) {
    const months = ["Error", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const vanilla = /^([0-9]+)_([0-9]+)(?:_([^_]+))?$/.exec(name);
    if(vanilla) {
        return months[vanilla[2]] + " " + vanilla[1] + ( vanilla[3] ? " " + vanilla[3] : "" );
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
    // We store metagame data in format type 4.

    // Format type 1
    if(Array.isArray(mons)) {
        buffer.meta = {};
        for(const mon of mons) {
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

    // Format type 4
    else {
        buffer.meta = mons.meta;
    }

}

function traverseMetagames(metagames, metagamesRelative, self) {
    if(self.rules.height === 0) {
        throw new Error("35Pokes Background: Circular metagame hierarchy: " + self.name);
    }
    if(self.rules.height) {
        // We have already traversed this part of the branch up to the root. No need to repeat.
        return self.rules.height;
    }
    if(metagames[self.rules.parent]) {
        self.rules.height = 1;
        return 1;
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
