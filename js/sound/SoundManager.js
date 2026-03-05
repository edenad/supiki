/**
 * SoundManager.js
 * スピキのセリフ音声を管理するモジュール。
 *
 * カテゴリ:
 *   STARTLE … 驚き  : ｱ.wav のみ
 *   IDLE    … 独り言 : ｽﾋﾟｷ.wav
 *   SAD     … 悲しみ : ｴｱｱ (感情0、好感度プラス時)
 *   SAD_NEG … 悲しみ(好感度マイナス) : ｽﾋﾟｷｦｲｼﾞﾒﾇﾝﾃﾞ (好感度<0のみ)
 *   HAPPY   … 機嫌良い : ｼﾞｮｱﾔ系4種 (感情2以上)
 *   PET     … なでられ : ﾁｮﾜﾖ系 (ピンク色フキダシ)
 *   PUMPKIN … かぼちゃ専用 : ｼﾞｮｱﾖﾎﾊﾞｷﾞ
 *   FREEZE  … 凍結   : ﾋﾟｷ.wav
 *   INTERACT… 相互作用 : ｳｱｱｽﾋﾟｷｴﾙｼﾞ, ｼﾞｮｱﾖ系
 */

const BASE = 'sounds/';
const LOGICAL_WIDTH = 1000;

const CLIPS = {
    STARTLE: ['ｱ.wav'],
    IDLE: ['ｽﾋﾟｷ.wav'],
    SAD: ['ｴｱｱ.wav'],
    SAD_NEG: ['ｽﾋﾟｷｦｲｼﾞﾒﾇﾝﾃﾞ.wav'],
    HAPPY: ['ｼﾞｮｱﾔ.wav', 'ｼﾞｮｱﾖｽﾝﾊﾞｺｯﾁ.wav', 'ｼﾞｮｱﾖﾎﾊﾞｷﾞ.wav', 'ｼﾞｮｱﾖﾑﾙｺﾞﾙ.wav'],
    PET: ['ｼﾞｮｱﾔ.wav', 'ｼﾞｮｱﾖｽﾝﾊﾞｺｯﾁ.wav', 'ｼﾞｮｱﾖﾎﾊﾞｷﾞ.wav', 'ｼﾞｮｱﾖﾑﾙｺﾞﾙ.wav'],
    DEKOPIN: ['ｳｱｱｽﾋﾟｷｴﾙｼﾞ.wav'],
    PUMPKIN: ['ｼﾞｮｱﾖﾎﾊﾞｷﾞ.wav'],
    FREEZE: ['ﾋﾟｷ.wav'],
    INTERACT: ['ｼﾞｮｱﾔ.wav', 'ｼﾞｮｱﾖｽﾝﾊﾞｺｯﾁ.wav', 'ｼﾞｮｱﾖﾑﾙｺﾞﾙ.wav'],
};

/** フキダシ表示テキスト */
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

/** ピンク色フキダシのカテゴリ */
const PINK_CATEGORIES = new Set(['PET']);

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
function showSubtitle(mateId, text, pink = false) {
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
            'font-size:11px',
            'font-family:sans-serif',
            'padding:3px 9px',
            'border-radius:12px',
            'white-space:nowrap',
            'pointer-events:none',
            'z-index:10001',
            'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
            'transition:opacity 0.55s ease',
        ].join(';');
        mateEl.appendChild(sub);
    }
    sub.textContent = text;
    sub.style.opacity = '1';
    if (pink) {
        sub.style.background = 'rgba(220,80,140,0.85)';
        sub.style.border = '1px solid rgba(255,180,220,0.5)';
        sub.style.color = '#fff0f8';
    } else {
        sub.style.background = 'rgba(15,15,25,0.82)';
        sub.style.border = '1px solid rgba(255,255,255,0.22)';
        sub.style.color = '#f8f8ff';
    }
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
        const pink = PINK_CATEGORIES.has(category);
        showSubtitle(mateId, CLIP_TEXT[file] || file.replace('.wav', ''), pink);
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
        // 好感度マイナスならネガティブセリフ、プラスなら普通の悲しみ
        if ((mate.friendliness || 0) < 0) {
            if (Math.random() < 0.003) trySpeak(mate.id, 'SAD_NEG', { minInterval: 8000, volume: 0.9, pan });
        } else {
            if (Math.random() < 0.003) trySpeak(mate.id, 'SAD', { minInterval: 8000, volume: 0.9, pan });
        }
        return;
    }
    if (mate.emotion >= 2) {
        if (Math.random() < 0.003) trySpeak(mate.id, 'HAPPY', { minInterval: 6000, volume: 0.85, pan });
        return;
    }
    if (Math.random() < 0.0015) trySpeak(mate.id, 'IDLE', { minInterval: 10000, volume: 0.8, pan });
}
