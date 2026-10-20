async function startPublicGame(engine, config) {
	const response = await fetch('pack-manifest.json');
	if (!response.ok) throw new Error('게임 다운로드 정보를 불러오지 못했습니다. 새로고침해 주세요.');
	const manifest = await response.json();
	const cacheName = 'null-citi-pack-' + manifest.sha256;
	let cache = null;
	try { cache = await caches.open(cacheName); } catch (_) {}
	const bytes = new Uint8Array(manifest.size);
	let next = 0;
	let loaded = 0;
	const initialized = engine.init('index');
	async function download() {
		while (next < manifest.parts.length) {
			const part = manifest.parts[next++];
			const saved = cache ? await cache.match(part.file).catch(() => null) : null;
			const result = saved || await fetch(part.file);
			if (!result.ok) throw new Error('게임 파일 다운로드 실패: ' + part.file);
			const copy = cache && !saved ? result.clone() : null;
			const reader = result.body.getReader();
			let received = 0;
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (received + value.length > part.size) {
					if (cache) await cache.delete(part.file).catch(() => {});
					throw new Error('게임 파일 크기가 올바르지 않습니다.');
				}
				bytes.set(value, part.offset + received);
				received += value.length;
				loaded += value.length;
				config.onProgress(loaded, manifest.size);
			}
			if (received !== part.size) {
				if (cache) await cache.delete(part.file).catch(() => {});
				throw new Error('게임 파일 다운로드가 중단됐습니다. 새로고침해 주세요.');
			}
			if (copy) await cache.put(part.file, copy).catch(() => {});
		}
	}
	await Promise.all([initialized, download(), download(), download(), download()]);
	engine.copyToFS('index.pck', bytes.buffer);
	if (cache) caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('null-citi-pack-') && key !== cacheName).map(key => caches.delete(key)))).catch(() => {});
	return engine.start({ ...config, args: ['--main-pack', 'index.pck'] });
}
