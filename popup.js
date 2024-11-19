// Polyfill for browser compatibility
if (typeof browser === "undefined") globalThis.browser = chrome;

const KEY_METAGAMES = "metagames";
const KEY_CURRENT = "current";
const KEY_GROUPS = "opengroups";
const KEY_POWER = "power";

const btn_chal = document.getElementById("btn-chalcode");
const btn_pow = document.getElementById("btn-power");
const menu_l = document.getElementById("menu-l");
const menu_r = document.getElementById("menu-r");

const metagames_l = [];
const metagames_r = [];

const semiOfficials = ["Babies", "Seniors", "Doubles", "Tours"];

browser.storage.local.get({
    [KEY_METAGAMES]: {},
    [KEY_CURRENT]: ["2024", "2024_11"],
    [KEY_GROUPS]: ["2024"],
    [KEY_POWER]: false
}).then((stored) => {
    btn_pow.checked = stored[KEY_POWER];

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
            button.classList.add("option");
            if(stored[KEY_CURRENT][0] === group && stored[KEY_CURRENT][1] === meta[0]) button.classList.add("cur");
            button.innerText = meta[1].name;
            button.onclick = (e) => selectMeta([group, meta[0]]);
            details.appendChild(li);
            li.appendChild(button);

        });

    }

    menu_l.append(...metagames_l);
    menu_r.append(...metagames_r);
});

btn_chal.addEventListener("click", chalCode);
btn_pow.addEventListener("change", togglePower);

function render(search) {
    const filter = search ? new RegExp(search, "i") : null;
}

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

function togglePower(e) {
    const state = e.target.checked;
    browser.storage.local.get(KEY_POWER).then((stored) => {
        if((state && !stored[KEY_POWER]) || (!state && stored[KEY_POWER]))
            browser.storage.local.set({ [KEY_POWER]: state });
        else console.log("35Pokes Popup: Weird power state change detected: " + state);
    });
}

function toggleGroup(e) {
    browser.storage.local.get({ [KEY_GROUPS]: [] }).then((stored) => {
        const prev = stored[KEY_GROUPS].indexOf(e.target.section);
        if(e.newState === "open" && prev < 0) stored[KEY_GROUPS].push(e.target.section);
        else if(e.newState === "closed" && prev >= 0) stored[KEY_GROUPS].splice(prev, 1);
        // This seems to fire for stored open groups on popup load on Chromium.
        else console.log("35Pokes Popup: Weird toggle state change detected: " + e.target.section);
        browser.storage.local.set({ [KEY_GROUPS]: stored[KEY_GROUPS] });
    });
}

function chalCode() {
    browser.storage.local.get([KEY_METAGAMES, KEY_CURRENT]).then((stored) => {
        if(!stored[KEY_METAGAMES] || !stored[KEY_CURRENT]) return;
        const prefix = stored[KEY_METAGAMES][stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]].rules?.codePrefix ||
        '/challenge gen9nationaldexag @@@ Z-Move Clause, -Mega, Terastal Clause, Sleep Clause Mod, Forme Clause, -Hidden Power, -Last Respects, -Kings Rock, -Shadow Tag, -Acupressure, -Battle Bond, -Quick Claw, -Razor Fang, Evasion Clause, OHKO Clause, baton pass stat trap clause, -All Pokemon, +';
        const code = prefix + Object.keys(stored[KEY_METAGAMES][stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]].meta).join(", +");
        copyTextToClipboard(code);
    });
}

// Thanks Sam!

function fallbackCopyTextToClipboard(text) {
	var textArea = document.createElement("textarea");
	textArea.value = text;
	
	textArea.style.top = "0";
	textArea.style.left = "0";
	textArea.style.position = "fixed";
  
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();
  
	try {
	  var successful = document.execCommand('copy');
	  var msg = successful ? 'successful' : 'unsuccessful';
	  console.log('Fallback: Copying text command was ' + msg);
	} catch (err) {
	  console.error('Fallback: Oops, unable to copy', err);
	}
	
	document.body.removeChild(textArea);
}

function copyTextToClipboard(text) {
	if (!navigator.clipboard) {
	  fallbackCopyTextToClipboard(text);
	  return;
	}
	navigator.clipboard.writeText(text).then(function() {
	  console.log('Async: Copying to clipboard was successful!');
	}, function(err) {
	  console.error('Async: Could not copy text: ', err);
	});
}
