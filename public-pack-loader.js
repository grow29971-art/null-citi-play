async function startPublicGame(engine, config) {
	const response = await fetch('pack-manifest.json', { cache: 'no-store' });
	if (!response.ok) throw new Error('게임 다운로드 정보를 불러오지 못했습니다. 새로고침해 주세요.');
	const manifest = await response.json();
	let offset = 0;
	for (const part of manifest.parts) {
		if (part.offset !== offset || !Number.isSafeInteger(part.size) || part.size <= 0) throw new Error('Invalid game pack manifest');
		offset += part.size;
	}
	if (offset !== manifest.size) throw new Error('Invalid game pack size');
	const cacheName = 'null-citi-assets-v1';
	let cache = null;
	try { cache = await caches.open(cacheName); } catch (_) {}
	const bytes = new Uint8Array(manifest.size);
	let next = 0;
	let loaded = 0;
	const initialized = engine.init('index');
	async function download() {
		while (next < manifest.parts.length) {
			const part = manifest.parts[next++];
			const key = part.sha256 ? 'pack-cache/' + part.sha256 + '.bin' : part.file;
			const saved = cache ? await cache.match(key).catch(() => null) : null;
			const result = saved || await fetch(part.file);
			if (!result.ok) throw new Error('게임 파일 다운로드 실패: ' + part.file);
			const reader = result.body.getReader();
			let received = 0;
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (received + value.length > part.size) {
					if (cache) await cache.delete(key).catch(() => {});
					throw new Error('게임 파일 크기가 올바르지 않습니다.');
				}
				bytes.set(value, part.offset + received);
				received += value.length;
				loaded += value.length;
				config.onProgress(loaded, manifest.size);
			}
			if (received !== part.size) {
				if (cache) await cache.delete(key).catch(() => {});
				throw new Error('게임 파일 다운로드가 중단됐습니다. 새로고침해 주세요.');
			}
			const contents = bytes.subarray(part.offset, part.offset + part.size);
			if (part.sha256) {
				const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', contents));
				if (Array.from(hash, value => value.toString(16).padStart(2, '0')).join('') !== part.sha256) {
					if (cache) await cache.delete(key).catch(() => {});
					throw new Error('Game download checksum failed. Please reload.');
				}
			}
			if (cache && !saved) await cache.put(key, new Response(contents)).catch(() => {});
		}
	}
	await Promise.all([initialized, download(), download(), download(), download()]);
	engine.copyToFS('index.pck', bytes.buffer);
	if (cache && cache.keys) {
		const keep = manifest.parts.map(part => part.sha256 ? 'pack-cache/' + part.sha256 + '.bin' : part.file);
		cache.keys().then(keys => Promise.all(keys.filter(key => !keep.some(name => key.url.endsWith('/' + name) || key.url === name)).map(key => cache.delete(key)))).catch(() => {});
	}
	if (cache) caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('null-citi-pack-') && key !== cacheName).map(key => caches.delete(key)))).catch(() => {});
	return engine.start({ ...config, args: ['--main-pack', 'index.pck'] });
}
