async function startPublicGame(engine, config) {
	const response = await fetch('pack-manifest.json');
	if (!response.ok) throw new Error('게임 다운로드 정보를 불러오지 못했습니다. 새로고침해 주세요.');
	const manifest = await response.json();
	const bytes = new Uint8Array(manifest.size);
	let next = 0;
	let loaded = 0;
	const initialized = engine.init('index');
	async function download() {
		while (next < manifest.parts.length) {
			const part = manifest.parts[next++];
			const result = await fetch(part.file);
			if (!result.ok) throw new Error('게임 파일 다운로드 실패: ' + part.file);
			const reader = result.body.getReader();
			let received = 0;
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (received + value.length > part.size) throw new Error('게임 파일 크기가 올바르지 않습니다.');
				bytes.set(value, part.offset + received);
				received += value.length;
				loaded += value.length;
				config.onProgress(loaded, manifest.size);
			}
			if (received !== part.size) throw new Error('게임 파일 다운로드가 중단됐습니다. 새로고침해 주세요.');
		}
	}
	await Promise.all([initialized, download(), download()]);
	await engine.preloadFile(bytes, 'index.pck');
	return engine.start({ ...config, args: ['--main-pack', 'index.pck'] });
}
