import './_globals.js';

import { assert, assertEquals } from '@std/assert';

const LOCALES = ['en', 'ja', 'ko', 'th', 'vi', 'zh_CN', 'zh_TW', 'id'];

/** @param {string} locale */
const readMessages = (locale) =>
	JSON.parse(Deno.readTextFileSync(new URL(`../src/_locales/${locale}/messages.json`, import.meta.url)));

Deno.test('every locale declares the same message keys as the default (en)', () => {
	const keys = Object.keys(readMessages('en'));
	for (const locale of LOCALES.filter((l) => l !== 'en')) {
		const messages = readMessages(locale);
		assertEquals(Object.keys(messages).length, keys.length, `${locale} key count`);
		const missing = keys.filter((key) => messages[key] === undefined);
		assertEquals(missing, [], `${locale} missing keys`);
	}
});

/** Empty values are intentional in some locales (e.g. `translationTiming` is blank in `en` because the option labels read as a full sentence), so only a missing entry is an error. */
Deno.test('every message value is a string in every locale', () => {
	const source = readMessages('ja');
	for (const locale of LOCALES) {
		const messages = readMessages(locale);
		const invalid = Object.keys(source)
			.filter((key) => typeof messages[key]?.message !== 'string')
			.map((key) => key);
		assertEquals(invalid, [], `${locale} non-string messages`);
	}
});

Deno.test('substitution placeholders survive translation', () => {
	const source = readMessages('ja');
	/** @param {string} text @param {RegExp} re */
	const count = (text, re) => text.match(re)?.length ?? 0;
	for (const locale of LOCALES) {
		const messages = readMessages(locale);
		const mismatched = Object.keys(source).filter((key) => count(source[key].message, /\$1/g) !== count(messages[key].message, /\$1/g));
		assertEquals(mismatched, [], `${locale} placeholder mismatch`);
	}
});

Deno.test('manifest name and description are translated in every locale', () => {
	for (const locale of LOCALES) {
		const messages = readMessages(locale);
		assert(messages.manifestName.message.length > 0, `${locale} manifestName`);
		assert(messages.manifestDescription.message.length > 0, `${locale} manifestDescription`);
	}
});
