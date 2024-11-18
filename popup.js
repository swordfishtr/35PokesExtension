// Polyfill for browser compatibility
if (typeof browser === "undefined") globalThis.browser = chrome;

const KEY_METAGAMES = "metagames";
const KEY_CURRENT = "current";
const KEY_GROUPS = "opengroups";

const menu_l = document.getElementById("menu-l");
const menu_r = document.getElementById("menu-r");

const metagames_l = [];
const metagames_r = [];

const semiOfficials = ["Babies", "Seniors", "Doubles", "Tours"];

browser.storage.local.get({
    [KEY_METAGAMES]: {},
    [KEY_CURRENT]: ["2024", "2024_11"],
    [KEY_GROUPS]: ["2024"]
}).then((stored) => {
    for(const group in stored[KEY_METAGAMES]) {

        const col = getColumn(group);
        const details = document.createElement("details");
        details.section = group;
        if(stored[KEY_GROUPS].includes(group)) details.open = true;
        details.ontoggle = (e) => toggleGroup(e);
        const summary = document.createElement("summary");
        const strong = document.createElement("strong");
        strong.style.color = "#579";
        strong.innerText = group;
        details.appendChild(summary);
        summary.appendChild(strong);
        col.push(details);

        Object.entries(stored[KEY_METAGAMES][group]).sort((a, b) => a[0].localeCompare(b[0])).forEach((meta) => {

            const li = document.createElement("li");
            const button = document.createElement("button");
            button.name = "selectFormat";
            button.value = meta[0];
            button.className = "option";
            button.innerText = meta[1].name;
            button.onclick = (e) => selectMeta([group, meta[0]]);
            details.appendChild(li);
            li.appendChild(button);

        });

    }

    menu_l.append(...metagames_l);
    menu_r.append(...metagames_r);
});

function getColumn(group) {
    if(Number(group)) {
        return metagames_l;
    }
    /* if(semiOfficials.includes(group)) {
        return metagames_r; // metagames_m
    } */
    return metagames_r;
}

function displayError(msg) {
    menu_r.style.display = "none";
    menu_l.append(msg);
}

function selectMeta(meta) {
    console.log(meta);
    browser.storage.local.set({
        [KEY_CURRENT]: meta
    });
}

function toggleGroup(e) {
    browser.storage.local.get({ [KEY_GROUPS]: [] }).then((stored) => {
        const asd = stored[KEY_GROUPS].indexOf(e.target.section);
        if(e.newState === "open" && asd < 0) stored[KEY_GROUPS].push(e.target.section);
        else if(e.newState === "closed" && asd >= 0) stored[KEY_GROUPS].splice(asd, 1);
        // This seems to fire for stored open groups on popup load on Chromium.
        else console.log("35Pokes Popup: Weird toggle state change detected: " + e.target.section);
        browser.storage.local.set({ [KEY_GROUPS]: stored[KEY_GROUPS] });
    });
}
