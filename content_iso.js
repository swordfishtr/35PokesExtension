"use strict";
(async () => {

	// Polyfill for browser compatibility
	if (typeof browser === "undefined") globalThis.browser = chrome;

	if(globalThis.hasRun_35pokes_iso) return;
	globalThis.hasRun_35pokes_iso = true;

	const {
		KEY_CURRENT,
		KEY_METAGAMES,
		KEY_POWER,
		MSG_META,
		MSG_REFRESH,
	} = await import(browser.runtime.getURL("lib/globals.js"));

	// KEY_CURRENT, KEY_METAGAMES, KEY_POWER are never together
	browser.storage.onChanged.addListener(async (changes) => {
		// User selected another meta.
		if(changes[KEY_CURRENT]) {
			const stored = await browser.storage.local.get([KEY_METAGAMES, KEY_POWER]);
			if(stored[KEY_POWER] === false) return;
			const meta = stored[KEY_METAGAMES][changes[KEY_CURRENT].newValue[0]][changes[KEY_CURRENT].newValue[1]];
			document.dispatchEvent(new CustomEvent("35Pokes", { detail: JSON.stringify(meta) }));
		}

		// Metagame index was updated.
		else if(changes[KEY_METAGAMES]) {
			const stored = await browser.storage.local.get([KEY_CURRENT, KEY_POWER]);
			if(stored[KEY_POWER] === false) return;
			const meta = changes[KEY_METAGAMES].newValue[stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]];
			document.dispatchEvent(new CustomEvent("35Pokes", { detail: JSON.stringify(meta) }));
		}

		// User toggled the power state.
		else if(changes[KEY_POWER]){
			if(changes[KEY_POWER].newValue === true) {
				const stored = await browser.storage.local.get([KEY_METAGAMES, KEY_CURRENT]);
				const meta = stored[KEY_METAGAMES][stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]];
				document.dispatchEvent(new CustomEvent("35Pokes", { detail: JSON.stringify(meta) }));
			}
			else if(changes[KEY_POWER].newValue === false)
				document.dispatchEvent(new CustomEvent("35Pokes", { detail: "null" }));
		}
	});

	const stored = await browser.storage.local.get([KEY_METAGAMES, KEY_CURRENT, KEY_POWER])
	if(stored[KEY_POWER] === true && stored[KEY_METAGAMES] && stored[KEY_CURRENT]) {
		const meta = stored[KEY_METAGAMES][stored[KEY_CURRENT][0]][stored[KEY_CURRENT][1]];
		document.dispatchEvent(new CustomEvent("35Pokes", { detail: JSON.stringify(meta) }));
	}
	await browser.runtime.sendMessage(MSG_REFRESH);

	console.log("35Pokes Isolated: Successful init.");
})();
