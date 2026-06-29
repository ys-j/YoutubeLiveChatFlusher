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
 * @returns {Promise<Record<string, any>>} JSON object
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
	if (res.ok) return res.json();
	else throw new Error(`Request failed: ${res.status} ${res.statusText}`);
}

/**
 * Fetches the value of Authorization header.
 * @param {Record<string, string>} data stored data
 * @returns {Promise<string>} authorization value
 */
export async function getAuthorication(data) {
	const datasyncId = data['DATASYNC_ID'].split('||')[0];
	const timestamp = (Date.now() / 1e3) | 0;
	const cookies = new Map(document.cookie.split(/;\s*/).flatMap(c => {
		const i = c.indexOf('=');
		return i < 0 ? [] : [[ c.substring(0, i).trim(), decodeURIComponent(c.substring(i + 1)) ]];
	}));
	const sApisId = cookies.get('SAPISID');
	const bytes = new TextEncoder().encode([datasyncId, timestamp, sApisId, location.origin].join(' '));
	const digested = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes));
	const hash = Array.from(digested, b => b.toString(16).padStart(2, '0')).join('');
	return ['SAPISIDHASH', 'SAPISID1PHASH', 'SAPISID3PHASH'].map(k => `${k} ${timestamp}_${hash}_u`).join(' ');
}
