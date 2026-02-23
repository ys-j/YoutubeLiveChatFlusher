const defaultClient = {
	clientName: 'WEB',
	clientVersion: '2.20251022.01.00',
	mainAppWebInfo: { graftUrl: location.href },
};

/**
 * Fetches JSON via InnerTube API
 * @param {URL} url url string or url object
 * @param {Record<string, any>} body request body
 * @param {object} [options] request options
 * @param {boolean} [options.auth] if required logged in
 * @param {boolean} [options.key] if required API key
 * @returns {Promise<Record<string, any>>}
 */
export async function fetchInnerTube(url, body, options = {}) {
	const stored = sessionStorage.getItem('ytlcf-cfg');
	const data = stored ? JSON.parse(stored) : null;
	if (options.key && data) {
		url.searchParams.set('key', data['INNERTUBE_API_KEY']);
	}
	const client = data?.['INNERTUBE_CONTEXT']?.client ?? defaultClient;
	const headers = new Headers();
	headers.set('Content-Type', 'application/json');
	if (options.auth && data) {
		headers.set('Authorization', await getAuthorication(data));
	}
	const res = await fetch(url, {
		method: 'post',
		headers,
		body: JSON.stringify({
			context: { client },
			...body,
		}),
	});
	const json = res.ok ? await res.json() : null;
	if (!json) throw 'Request failed.';
	return json;
}

/**
 * Fetches the value of Authorization header.
 * @param {Record<string, string>} data stored data
 * @returns {Promise<string>} authorization value
 */
export async function getAuthorication(data) {
	const datasyncId = data['DATASYNC_ID'].split('||')[0];
	const timestamp = Math.floor(Date.now() / 1e3);
	const cookies = new Map(document.cookie.split(/;\s*/).map(kv => {
		const pos = kv.indexOf('=');
		return pos >= 0 ? [ kv.substring(0, pos), kv.substring(pos + 1) ] : [ '', '' ];
	}));
	const sApisId = cookies.get('SAPISID');
	const bytes = new TextEncoder().encode([datasyncId, timestamp, sApisId, location.origin].join(' '));
	const digested = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes));
	const hash = Array.from(digested, b => b.toString(16).padStart(2, '0')).join('');
	return ['SAPISIDHASH', 'SAPISID1PHASH', 'SAPISID3PHASH'].map(k => `${k} ${timestamp}_${hash}_u`).join(' ');
}