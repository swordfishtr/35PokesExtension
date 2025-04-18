"use strict";
import { parseTar } from "./lib/nanotar.js";
import { parseMeta, parseNews } from "./lib/MetagameIndexParser.js";

import {
	KEY_CURRENT,
	KEY_METAGAMES,
	KEY_NEWS,
	KEY_NEWSREAD,
	KEY_TIMESTAMP,
	MSG_REFRESH,
} from "./lib/globals.js";

// Polyfill for browser compatibility
if (typeof browser === "undefined") globalThis.browser = chrome;

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
	const news = parseNews("");

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

		// Relevant non-metagame data in the index
		const nameNews = /^[^/]+\/news.txt$/;

		// Not working with "pax_global_header" and repo root dir.
		delete tar[0];
		delete tar[1];

		// Prepare the metagames to be parsed.
		tar.forEach((file, i) => {
			if(file.type === "file") {
				const name = nameFile.exec(file.name)?.[1];
				// Metagame file
				if(name) {
					file.name = name;
					file.data = td.decode(file.data);
				}
				// News file
				else if(nameNews.test(file.name)) {
					file.data = td.decode(file.data);
					Object.assign(news, parseNews(file.data));
					delete tar[i];
				}
				// Other files
				else {
					delete tar[i];
				}
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

		const sSet = browser.storage.local.set({
			[KEY_METAGAMES]: metagames,
			[KEY_TIMESTAMP]: timestamp,
		});

		const sGet = browser.storage.local.get(KEY_NEWS);

		return Promise.all([sSet, sGet]);
	})
	.then((result) => {
		const stored = result[1][KEY_NEWS];
		for(const x in news) {
			if(news[x] !== stored?.[x]) {
				return browser.storage.local.set({
					[KEY_NEWS]: news,
					[KEY_NEWSREAD]: false,
				});
			}
		}
	})
	.catch((err) => {
		if(err !== 0) throw err;
	})
	.finally(() => {
		STATE_DOWNLOADING = false;
	});
}
