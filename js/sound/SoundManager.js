/**
 * SoundManager.js
 * スピキのセリフ音声を管理するモジュール。
 *
 * カテゴリ:
 *   STARTLE … 驚き  : ｱ.wav のみ
 *   IDLE    … 独り言 : ｽﾋﾟｷ.wav
 *   SAD     … 悲しみ : ｽﾋﾟｷｦｲｼﾞﾒﾇﾝﾃﾞ, ｴｱｱ (感情0)
 *   HAPPY   … 機嫌良い : ｼﾞｮｱﾔ系4種 (感情2以上)
 *   PUMPKIN … かぼちゃ専用 : ｼﾞｮｱﾖﾎﾊﾞｷﾞ
 *   FREEZE  … 凍結   : ﾋﾟｷ.wav
 *   INTERACT… 相互作用 : ｳｱｱｽﾋﾟｷｴﾙｼﾞ, ｼﾞｮｱﾖ系
 */

const BASE = 'sounds/';
const LOGICAL_WIDTH = 1000;

const CLIPS = {
    STARTLE: ['ｱ.wav'],                          // 驚き: ｱのみ
    IDLE: ['ｽﾋﾟｷ.wav'],
    SAD: ['ｽﾋﾟｷｦｲｼﾞﾒﾇﾝﾃﾞ.wav', 'ｴｱｱ.wav'],  // 感情0
    HAPPY: ['ｼﾞｮｱﾔ.wav', 'ｼﾞｮｱﾖｽﾝﾊﾞｺｯﾁ.wav', 'ｼﾞｮｱﾖﾎﾊﾞｷﾞ.wav', 'ｼﾞｮｱﾖﾑﾙｺﾞﾙ.wav'],
    PUMPKIN: ['ｼﾞｮｱﾖﾎﾊﾞｷﾞ.wav'],                // かぼちゃ専用
    FREEZE: ['ﾋﾟｷ.wav'],                         // 凍結専用 (新ファイル)
    INTERACT: ['ｳｱｱｽﾋﾟｷｴﾙｼﾞ.wav', 'ｼﾞｮｱﾔ.wav', 'ｼﾞｮｱﾖｽﾝﾊﾞｺｯﾁ.wav', 'ｼﾞｮｱﾖﾑﾙｺﾞﾙ.wav'],
};

/** フキダシ表示テキスト (略称) */
const CLIP_TEXT = {
    'ｱ.wav': 'ｱ！',
    'ｳｱｱ.wav': 'ｳｱｱ！',
    'ｴｱｱ.wav': 'ｴｱｱ…',
    'ｳｱｱｽﾋﾟｷｴﾙｼﾞ.wav': 'ｽﾋﾟｷﾈﾙｼﾞﾊﾞｾﾖ',
    'ｽﾋﾟｷ.wav': 'ｽﾋﾟｷ',
    'ｽﾋﾟｷｦｲｼﾞﾒﾇﾝﾃﾞ.wav': 'ｽﾋﾟｷｦｲｼﾞﾒﾇﾝﾃﾞ…',
    'ｼﾞｮｱﾔ.wav': 'ﾁｮｱﾔ',
    'ｼﾞｮｱﾖｽﾝﾊﾞｺｯﾁ.wav': 'ｽﾝﾊﾞｺｯﾁﾁｮﾜﾖ',
    'ｼﾞｮｱﾖﾎﾊﾞｷﾞ.wav': 'ﾎﾊﾞｷﾞﾁｮﾜﾖ',
    'ｼﾞｮｱﾖﾑﾙｺﾞﾙ.wav': 'ﾑﾙｺﾞﾙﾚｼﾞﾁｮﾜﾖ',
    'ﾋﾟｷ.wav': 'ﾋﾟｷ！',
};

const cache = new Map();
let ctx = null;

function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
}

async function loadClip(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const ac = getCtx();
    try {
        const res = await fetch(BASE + filename);
        if (!res.ok) { cache.set(filename, null); return null; }
        const buf = await res.arrayBuffer();
        const decoded = await ac.decodeAudioData(buf);
        cache.set(filename, decoded);
        return decoded;
    } catch (e) {
        console.warn('[Sound] Failed to load:', filename, e);
        cache.set(filename, null);
        return null;
    }
}

export function preloadSounds() {
    const all = [...new Set(Object.values(CLIPS).flat())];
    all.forEach(f => loadClip(f));
}

// -----------------------------------------------------------
// フキダシ字幕 (スピキ頭上DOM)
// -----------------------------------------------------------
function showSubtitle(mateId, text) {
    const mateEl = document.getElementById(`mate-${mateId}`);
    if (!mateEl) return;
    let sub = mateEl.querySelector('.mate-speech');
    if (!sub) {
        sub = document.createElement('div');
        sub.className = 'mate-speech';
        sub.style.cssText = [
            'position:absolute',
            'bottom:115%',
            'left:50%',
            'transform:translateX(-50%)',
            'background:rgba(15,15,25,0.82)',
            'color:#f8f8ff',
            'font-size:11px',
            'font-family:sans-serif',
            'padding:3px 9px',
            'border-radius:12px',
            'white-space:nowrap',
            'pointer-events:none',
            'z-index:10001',
            'border:1px solid rgba(255,255,255,0.22)',
            'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
            'transition:opacity 0.55s ease',
        ].join(';');
        mateEl.appendChild(sub);
    }
    sub.textContent = text;
    sub.style.opacity = '1';
    clearTimeout(sub._fadeTimer);
    sub._fadeTimer = setTimeout(() => { sub.style.opacity = '0'; }, 2400);
}

// -----------------------------------------------------------
// 再生 (立体音響付き)
// -----------------------------------------------------------
export async function play(category, { volume = 1.0, pan = 0, mateId = null } = {}) {
    const list = CLIPS[category];
    if (!list || list.length === 0) return;
    const file = list[Math.floor(Math.random() * list.length)];
    const buf = await loadClip(file);
    if (!buf) return;

    const ac = getCtx();
    if (ac.state === 'suspended') await ac.resume();

    const src = ac.createBufferSource();
    src.buffer = buf;

    const panner = ac.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));

    const gain = ac.createGain();
    gain.gain.value = volume;

    src.connect(panner);
    panner.connect(gain);
    gain.connect(ac.destination);
    src.start();

    if (mateId) {
        showSubtitle(mateId, CLIP_TEXT[file] || file.replace('.wav', ''));
    }
}

// -----------------------------------------------------------
// クールダウン付き発話
// -----------------------------------------------------------
const talkCooldown = new Map();

export function trySpeak(mateId, category, { minInterval = 3000, volume = 1.0, pan = 0 } = {}) {
    const now = Date.now();
    if (now - (talkCooldown.get(mateId) || 0) < minInterval) return false;
    talkCooldown.set(mateId, now);
    play(category, { volume, pan, mateId });
    return true;
}

// -----------------------------------------------------------
// ユーティリティ
// -----------------------------------------------------------
export function getPan(mate) {
    const cx = LOGICAL_WIDTH / 2;
    return Math.max(-1, Math.min(1, ((mate.screenX || cx) - cx) / cx));
}

export function maybeSpeakIdle(mate) {
    const pan = getPan(mate);
    if (mate.emotion === 0) {
        if (Math.random() < 0.003) trySpeak(mate.id, 'SAD', { minInterval: 8000, volume: 0.9, pan });
        return;
    }
    if (mate.emotion >= 2) {
        if (Math.random() < 0.003) trySpeak(mate.id, 'HAPPY', { minInterval: 6000, volume: 0.85, pan });
        return;
    }
    if (Math.random() < 0.0015) trySpeak(mate.id, 'IDLE', { minInterval: 10000, volume: 0.8, pan });
}
