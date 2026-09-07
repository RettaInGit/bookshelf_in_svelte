// The query arrives already trimmed and lowercased from the header, so the search runs on a
// lowercased copy while the pieces are cut from the ORIGINAL text: what is drawn keeps the
// page's own capitalisation. indexOf, not a regex, so a query like 'c++' matches literally.
export function splitMatches(text, query) {
	if (!query) return [{ text, hit: false }];

	const haystack = text.toLowerCase();
	const parts = [];
	let at = 0;

	for (let i = haystack.indexOf(query); i !== -1; i = haystack.indexOf(query, at)) {
		if (i > at) parts.push({ text: text.slice(at, i), hit: false });
		parts.push({ text: text.slice(i, i + query.length), hit: true });
		at = i + query.length;
	}
	if (at < text.length) parts.push({ text: text.slice(at), hit: false });

	return parts;
}
