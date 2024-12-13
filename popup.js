"use strict";

// Polyfill for browser compatibility
if (typeof browser === "undefined") globalThis.browser = chrome;

const KEY_METAGAMES = "metagames";
const KEY_CURRENT = "current";
const KEY_GROUPS = "opengroups";
const KEY_POWER = "power";

const input_search = document.getElementById("input-search");
const btn_chal = document.getElementById("btn-chalcode");
const btn_help = document.getElementById("btn-help");
const btn_pow = document.getElementById("btn-power");
const menu_l = document.getElementById("menu-l");
const menu_m = document.getElementById("menu-m");
const menu_r = document.getElementById("menu-r");
const menu_help = document.getElementById("help");

const metagames_l = [];
const metagames_m = [];
const metagames_r = [];

const semiOfficials = ["Babies", "Seniors", "Doubles", "Collabs"];

var searching = false;

browser.storage.local.get({
    [KEY_METAGAMES]: {},
    [KEY_CURRENT]: ["2024", "2024_11.txt"],
    [KEY_GROUPS]: ["2024"],
    [KEY_POWER]: false
}).then((stored) => {
    if(stored[KEY_POWER]) btn_pow.classList.add("active");

    for(const group in stored[KEY_METAGAMES]) {

        const col = getColumn(group);
        const details = document.createElement("details");
        details.section = group;
        if(stored[KEY_GROUPS].includes(group)) details.open = true;
        details.ontoggle = (e) => toggleGroup(e);
        const summary = document.createElement("summary");
        const strong = document.createElement("strong");
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
            button.innerText = meta[1][0].name;
            button.onclick = selectMeta;
            details.appendChild(li);
            li.appendChild(button);

        });

    }

    metagames_l.reverse();

    menu_l.append(...metagames_l);
    menu_m.append(...metagames_m);
    menu_r.append(...metagames_r);
});

input_search.addEventListener("input", filterMetas);
btn_chal.addEventListener("click", chalCode);
btn_pow.addEventListener("click", togglePower);
btn_help.addEventListener("click", toggleHelp);

function filterMetas(search) {
    if(search.target.value) {
        searching = true;
        const filter = new RegExp(search.target.value, "i");
        menu_l.childNodes.forEach((details) => {
            details.open = true;
            details.childNodes.forEach((li, key) => {
                if(key === 0) return;
                if(filter.test(li.lastChild.innerText)) li.lastChild.style.display = "inline-block";
                else li.lastChild.style.display = "none";
            });
        });
        menu_m.childNodes.forEach((details) => {
            details.open = true;
            details.childNodes.forEach((li, key) => {
                if(key === 0) return;
                if(filter.test(li.lastChild.innerText)) li.lastChild.style.display = "inline-block";
                else li.lastChild.style.display = "none";
            });
        });
        menu_r.childNodes.forEach((details) => {
            details.open = true;
            details.childNodes.forEach((li, key) => {
                if(key === 0) return;
                if(filter.test(li.lastChild.innerText)) li.lastChild.style.display = "inline-block";
                else li.lastChild.style.display = "none";
            });
        });
    }
    else {
        browser.storage.local.get(KEY_GROUPS).then((stored) => {
            menu_l.childNodes.forEach((details) => {
                if(stored[KEY_GROUPS].includes(details.firstChild.lastChild.innerText)) details.open = true;
                else details.open = false;
                details.childNodes.forEach((li, key) => {
                    if(key === 0) return;
                    li.lastChild.style.display = "inline-block";
                });
            });
            menu_m.childNodes.forEach((details) => {
                if(stored[KEY_GROUPS].includes(details.firstChild.lastChild.innerText)) details.open = true;
                else details.open = false;
                details.childNodes.forEach((li, key) => {
                    if(key === 0) return;
                    li.lastChild.style.display = "inline-block";
                });
            });
            menu_r.childNodes.forEach((details) => {
                if(stored[KEY_GROUPS].includes(details.firstChild.lastChild.innerText)) details.open = true;
                else details.open = false;
                details.childNodes.forEach((li, key) => {
                    if(key === 0) return;
                    li.lastChild.style.display = "inline-block";
                });
            });
            searching = false
        });
    }
    
}

function getColumn(group) {
    if(Number(group)) {
        return metagames_l;
    }
    if(semiOfficials.includes(group)) {
        return metagames_m;
    }
    return metagames_r;
}

function selectMeta(e) {
    menu_l.childNodes.forEach((details) => {
        details.childNodes.forEach((li, key) => {
            if(key === 0) return;
            li.lastChild.classList.remove("cur");
        });
    });
    menu_m.childNodes.forEach((details) => {
        details.childNodes.forEach((li, key) => {
            if(key === 0) return;
            li.lastChild.classList.remove("cur");
        });
    });
    menu_r.childNodes.forEach((details) => {
        details.childNodes.forEach((li, key) => {
            if(key === 0) return;
            li.lastChild.classList.remove("cur");
        });
    });
    e.target.classList.add("cur");
    const meta = [e.target.parentElement.parentElement.section, e.target.value];
    browser.storage.local.set({
        [KEY_CURRENT]: meta
    });
}

function togglePower() {
    if(btn_pow.classList.contains("active")) {
        btn_pow.classList.remove("active");
        browser.storage.local.set({ [KEY_POWER]: false });
    }
    else {
        btn_pow.classList.add("active");
        browser.storage.local.set({ [KEY_POWER]: true });
    }
}

function toggleHelp() {
    if(btn_help.classList.contains("active")) {
        menu_l.style.display = "block";
        menu_m.style.display = "block";
        menu_r.style.display = "block";
        menu_help.style.display = "none";
        btn_help.classList.remove("active");
    }
    else {
        menu_l.style.display = "none";
        menu_m.style.display = "none";
        menu_r.style.display = "none";
        menu_help.style.display = "inline-block";
        btn_help.classList.add("active");
    }
}

function toggleGroup(e) {
    if(searching) return;
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
        const prefix = stored[KEY_METAGAMES][stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]][0].code ?? '/challenge gen9nationaldex35pokes @@@ -All Pokemon, +';
        const mons = stored[KEY_METAGAMES][stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]].filter((mon) => !mon.header).map((mon) => mon.value).join(", +");
        copyTextToClipboard(prefix + mons);
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
