import { sleep } from './utils.mjs';

const defaultClient = {
	clientName: 'WEB',
	clientVersion: '2.20260714.01.00',
	mainAppWebInfo: { graftUrl: location.href },
};

/**
 * Fetches JSON via InnerTube API
 * @param {URL} url URL object to request
 * @param {Record<string, any>} payload request payload
 * @param {object} [options] request options
 * @param {boolean} [options.auth] whether authentication header is required
 * @param {boolean} [options.key] whether to include API key in request
 * @returns {Promise<Record<string, any>>} JSON object
 */
export async function fetchInnerTube(url, payload, options = {}) {
	const data = {
		INNERTUBE_API_KEY: sessionStorage.getItem('INNERTUBE_API_KEY') || '',
		INNERTUBE_CONTEXT: JSON.parse(sessionStorage.getItem('INNERTUBE_CONTEXT') || '{}'),
		DATASYNC_ID: sessionStorage.getItem('DATASYNC_ID'),
	};
	if (options.key && data.INNERTUBE_API_KEY) {
		url.searchParams.set('key', data.INNERTUBE_API_KEY);
	}
	const headers = new Headers();
	headers.set('Content-Type', 'application/json');
	if (options.auth && data.DATASYNC_ID) {
		headers.set('Authorization', await getAuthorization(data.DATASYNC_ID));
	}
	const client = data?.INNERTUBE_CONTEXT?.client;
	const context = { client: client?.clientName === 'WEB' ? client : defaultClient };
	const res = await fetch(url, {
		method: 'post',
		headers,
		body: JSON.stringify({ context, ...payload }),
	});
	if (res.ok) return res.json();

	const message = `Request failed: ${res.status} ${res.statusText}`;
	switch (res.status) {
		case 429:
		case 503:
			const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
			await sleep(retryAfter ?? 1000);
			// @ts-expect-error
			return fetchInnerTube(...arguments);
		default:
			throw new Error(message);
	}
}

/**
 * Lookup table for byte-to-hex string conversions (`0x00` to `0xff`)
 */
const HEX_LUT = Object.freeze(Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0')));

/**
 * Fetches the value of Authorization header.
 * @param {string} dataSyncId datasync id
 * @returns {Promise<string>} authorization value
 */
async function getAuthorization(dataSyncId) {
	const datasyncId = dataSyncId.split('||')[0];
	const timestamp = (Date.now() / 1e3) | 0;
	const cookies = new Map(document.cookie.split(/;\s*/).flatMap(c => {
		const i = c.indexOf('=');
		return i < 0 ? [] : [[ c.substring(0, i).trim(), decodeURIComponent(c.substring(i + 1)) ]];
	}));
	const sApisId = cookies.get('SAPISID');
	const bytes = new TextEncoder().encode([datasyncId, timestamp, sApisId, location.origin].join(' '));
	const digested = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes));
	const hash = Array.from(digested, b => HEX_LUT[b]).join('');
	return ['SAPISIDHASH', 'SAPISID1PHASH', 'SAPISID3PHASH'].map(k => `${k} ${timestamp}_${hash}_u`).join(' ');
}

/**
 * Parses "Retry-After" header value to milliseconds.
 * @param {?string} header "Retry-After" header
 */
function parseRetryAfter(header) {
	if (!header?.trim()) return null;
	const seconds = Number(header);
	if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1e3);
	const delay = Date.parse(header) - Date.now();
	if (!Number.isNaN(delay)) return Math.max(0, delay);
	return null;
}
