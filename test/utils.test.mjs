import './_globals.mjs';

import { assert, assertEquals, assertThrows } from '@std/assert';
import {
	getText,
	toPascalCase,
	getColorRGB,
	formatMilliseconds,
	getValueByJSONPointer,
} from '../src/modules/utils.mjs';

Deno.test('getText joins runs of text and emoji shortcuts', () => {
	const msg = {
		runs: [
			{ text: 'Hello' },
			{ emoji: { shortcuts: ['\u{1F44D}', 'like'] } },
			{ text: ' world' },
		],
	};
	assertEquals(getText(/** @type {any} */ (msg)), 'Hello\u{1F44D} world');
});

Deno.test('getText falls back to emojiId when no shortcuts exist', () => {
	const msg = { runs: [{ emoji: { emojiId: 'EMOJI_9' } }] };
	assertEquals(getText(/** @type {any} */ (msg)), 'EMOJI_9');
});

Deno.test('getText reads simpleText and rich content', () => {
	assertEquals(getText(/** @type {any} */ ({ simpleText: 'plain' })), 'plain');
	assertEquals(getText(/** @type {any} */ ({ content: 'rich text' })), 'rich text');
});

Deno.test('getText handles empty / missing input', () => {
	assertEquals(getText(undefined), '');
	assertEquals(getText(/** @type {any} */ (null)), '');
	assertEquals(getText({ runs: [] }), '');
});

Deno.test('toPascalCase lowercases then capitalizes separator-delimited words', () => {
	assertEquals(toPascalCase('hello_world'), 'HelloWorld');
	assertEquals(toPascalCase('foo-bar-baz'), 'FooBarBaz');
	assertEquals(toPascalCase('a_b_c'), 'ABC');
	assertEquals(toPascalCase('font_size'), 'FontSize');
	assertEquals(toPascalCase('already_pascal_case'), 'AlreadyPascalCase');
	assertEquals(toPascalCase(''), '');
});

Deno.test('getColorRGB drops the alpha byte and returns [R, G, B]', () => {
	// 0xAARRGGBB with fully opaque alpha (0xFF)
	assertEquals(getColorRGB(0xff886644), [136, 102, 68]);
	assertEquals(getColorRGB(0xff00ff00), [0, 255, 0]);
	assertEquals(getColorRGB(0xffffffff), [255, 255, 255]);
});

Deno.test('formatMilliseconds renders h:mm:ss.fff', () => {
	assertEquals(formatMilliseconds(0), '00:00.000');
	assertEquals(formatMilliseconds(1234), '00:01.234');
	assertEquals(formatMilliseconds(3661000), '1:01:01.000');
	assertEquals(formatMilliseconds(3723456), '1:02:03.456');
});

Deno.test('formatMilliseconds omits the hours field when under an hour', () => {
	const s = formatMilliseconds(59999);
	assertEquals(s, '00:59.999');
	assert(!s.startsWith('1:')); // no spurious hours prefix
});

Deno.test('getValueByJSONPointer resolves nested paths and array indices', () => {
	const obj = { a: { b: [10, 20, 30] }, c: 1 };
	assertEquals(getValueByJSONPointer(obj, ''), obj);
	assertEquals(getValueByJSONPointer(obj, '/c'), 1);
	assertEquals(getValueByJSONPointer(obj, '/a/b/1'), 20);
	assertEquals(getValueByJSONPointer(obj, '/a/b'), [10, 20, 30]);
});

Deno.test('getValueByJSONPointer returns undefined for missing paths', () => {
	const obj = { a: { b: 1 } };
	assertEquals(getValueByJSONPointer(obj, '/x'), undefined);
	assertEquals(getValueByJSONPointer(obj, '/a/x'), undefined);
	assertEquals(getValueByJSONPointer(obj, '/a/b/9'), undefined);
});

Deno.test('getValueByJSONPointer decodes JSON Pointer escape sequences', () => {
	const obj = { '/b': 5, 'a~b': 7 };
	assertEquals(getValueByJSONPointer(obj, '/~1b'), 5); // ~1 -> /
	assertEquals(getValueByJSONPointer(obj, '/a~0b'), 7); // ~0 -> ~
});

Deno.test('getValueByJSONPointer throws for a pointer not starting with "/"', () => {
	const err = assertThrows(() => getValueByJSONPointer({ a: 1 }, 'a'), Error);
	assert(err.message.match(/must start with "\/"/i));
});
