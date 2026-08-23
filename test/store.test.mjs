import './_globals.mjs';

import { assertEquals } from '@std/assert';
import { store } from '../src/modules/store.mjs';

/**
 * Exercises the schema-migration logic in ConfigStore.migrate().
 * Each call receives a fresh `stored` payload and only mutates the
 * sub-fields it knows about, so every assertion targets exactly one field.
 */

Deno.test('migrates legacy translation flag into targetIndex / prefixLangCode', () => {
	store.migrate({ others: { translation: 3 } });
	assertEquals(store.data.translation.targetIndex, 3);
	assertEquals(store.data.translation.prefixLangCode, false);

	store.migrate({ others: { translation: -2 } });
	assertEquals(store.data.translation.targetIndex, 2);
	assertEquals(store.data.translation.prefixLangCode, true);
});

Deno.test('migrates legacy except_lang into exceptionFlag', () => {
	store.migrate({ others: { except_lang: 5 } });
	assertEquals(store.data.translation.exceptionFlag, 5);
});

Deno.test('migrates legacy suffix_original into suffixOriginal boolean', () => {
	store.migrate({ others: { suffix_original: 1 } });
	assertEquals(store.data.translation.suffixOriginal, true);

	store.migrate({ others: { suffix_original: 0 } });
	assertEquals(store.data.translation.suffixOriginal, false);
});

Deno.test('migrates legacy translation_timing into translation mode', () => {
	store.migrate({ others: { translation_timing: 1 } });
	assertEquals(store.data.translation.mode, 'lazy');

	store.migrate({ others: { translation_timing: 0 } });
	assertEquals(store.data.translation.mode, 'eager');
});

Deno.test('migrates legacy person_detection index into a device name', () => {
	store.migrate({ others: { person_detection: 2 } });
	assertEquals(store.data.personDetection.device, 'gpu');

	store.migrate({ others: { person_detection: 1 } });
	assertEquals(store.data.personDetection.device, 'wasm');

	// out-of-range index falls back to the empty device string
	store.migrate({ others: { person_detection: 99 } });
	assertEquals(store.data.personDetection.device, '');
});

Deno.test('migrate ignores payloads without a legacy others block', () => {
	store.migrate({});
	// no exception thrown; untouched fields keep their defaults / prior values
});
