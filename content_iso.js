// Polyfill for browser compatibility
if (typeof browser === "undefined") globalThis.browser = chrome;

if(globalThis.hasRun_35pokes_iso) return;
globalThis.hasRun_35pokes_iso = true;

const MSG_REFRESH = "refresh";
const MSG_META = "setMeta";
const KEY_METAGAMES = "metagames";
const KEY_CURRENT = "current";
const KEY_POWER = "power";

// KEY_CURRENT, KEY_METAGAMES, KEY_POWER are never together
browser.storage.onChanged.addListener(async (changes) => {
    // User selected another meta.
    if(changes[KEY_CURRENT]) {
        const stored = await browser.storage.local.get([KEY_METAGAMES, KEY_POWER]);
        if(stored[KEY_POWER] === false) return;
        const meta = stored[KEY_METAGAMES][changes[KEY_CURRENT].newValue[0]][changes[KEY_CURRENT].newValue[1]];
        meta.group = changes[KEY_CURRENT].newValue[0];
        document.dispatchEvent(new CustomEvent("35Pokes", { detail: JSON.stringify(meta) }));
    }

    // Metagame index was updated.
    else if(changes[KEY_METAGAMES]) {
        const stored = await browser.storage.local.get([KEY_CURRENT, KEY_POWER]);
        if(stored[KEY_POWER] === false) return;
        const meta = changes[KEY_METAGAMES].newValue[stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]];
        meta.group = stored[KEY_CURRENT][0];
        document.dispatchEvent(new CustomEvent("35Pokes", { detail: JSON.stringify(meta) }));
    }

    // User toggled the power state.
    else if(changes[KEY_POWER]){
        if(changes[KEY_POWER].newValue === true) {
            const stored = await browser.storage.local.get([KEY_METAGAMES, KEY_CURRENT]);
            const meta = stored[KEY_METAGAMES][stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]];
            meta.group = stored[KEY_CURRENT][0];
            document.dispatchEvent(new CustomEvent("35Pokes", { detail: JSON.stringify(meta) }));
        }
        else if(changes[KEY_POWER].newValue === false)
            document.dispatchEvent(new CustomEvent("35Pokes", { detail: "null" }));
    }
});

browser.storage.local.get([KEY_METAGAMES, KEY_CURRENT, KEY_POWER]).then((stored) => {
    if(stored[KEY_POWER] === true && stored[KEY_METAGAMES] && stored[KEY_CURRENT]) {
        const meta = stored[KEY_METAGAMES][stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]];
        meta.group = stored[KEY_CURRENT][0];
        document.dispatchEvent(new CustomEvent("35Pokes", { detail: JSON.stringify(meta) }));
    }
    browser.runtime.sendMessage(MSG_REFRESH);
});

console.log("35Pokes Isolated: Successful init.");
