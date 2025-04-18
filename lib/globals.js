"use strict";

/**
 * Currently selected metagame
 * 
 * [ string (group), string (meta) ]
 */
export const KEY_CURRENT = "current";

/**
 * Metagame groups in the popup that aren't collapsed
 * 
 * string (group)[]
 */
export const KEY_GROUPS = "opengroups";

/**
 * Metagames
 * 
 * { ...groups: { ...metas: {}[] } }
 */
export const KEY_METAGAMES = "metagames";

/**
 * Latest news
 * 
 * { title: string, author: string, news: string }
 */
export const KEY_NEWS = "news";

/**
 * Whether latest news were dismissed
 * 
 * boolean
 */
export const KEY_NEWSREAD = "newsread";

/**
 * State of the extension (on/off)
 * 
 * boolean
 */
export const KEY_POWER = "power";

/**
 * Timestamp of the latest commit in the metagames index repository
 * 
 * string (date)
 */
export const KEY_TIMESTAMP = "timestamp";

/** Unused? */
export const MSG_META = "setMeta";

/** Command for checking metagames index update */
export const MSG_REFRESH = "refresh";
