// Polyfill for browser compatibility
if (typeof browser === "undefined") globalThis.browser = chrome;

const MSG_REFRESH = "refresh";
const KEY_METAGAMES = "metagames";
const KEY_CURRENT = "current";

browser.storage.onChanged.addListener(async (changes) => {
    console.log("35Pokes Isolated: Storage event:");
    console.log(changes);

    // KEY_CURRENT, KEY_METAGAMES, KEY_POWER are never together
    if(changes[KEY_CURRENT]) {
        const stored = await browser.storage.local.get(KEY_METAGAMES);
        sendMeta(stored[KEY_METAGAMES][changes[KEY_CURRENT].newValue[0]][changes[KEY_CURRENT].newValue[1]]);
    }
    else if(changes[KEY_METAGAMES]) {
        const stored = await browser.storage.local.get(KEY_CURRENT);
        sendMeta(changes[KEY_METAGAMES].newValue[stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]]);
    }
    // add power handling here
    else {
        console.log("35Pokes Isolated: Unknown item changed in storage (wtf?)");
    }
});

browser.storage.local.get([KEY_METAGAMES, KEY_CURRENT]).then((stored) => {
    if(stored[KEY_METAGAMES] && stored[KEY_CURRENT]) {
        console.log(stored);
        sendMeta(stored[KEY_METAGAMES][stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]]);
    }

    browser.runtime.sendMessage(MSG_REFRESH);
});

console.log("35Pokes Isolated: Successful init.");

async function sendMeta(meta) {
    document.dispatchEvent(new CustomEvent("35Pokes", {
        detail: JSON.stringify({
            action: "setMeta",
            meta: meta
        })
    }));
}
