/**
 * SoundManager.js
 * スピキのセリフ音声を管理するモジュール。
 *
 * カテゴリ:
 *   STARTLE  … 驚き  (ｱ, ｳｱｱ, ｴｱｱ, ｳｱｱｽﾋﾟｷｴﾙｼﾞ)
 *   IDLE     … 独り言 (ｽﾋﾟｷ)
 *   SAD      … 悲しみ (ｽﾋﾟｷｦｲｼﾞﾒﾇﾝﾃﾞ)
 *   HAPPY    … 機嫌良い (ｼﾞｮｱﾔ, ｼﾞｮｱﾖｽﾝﾊﾞｺｯﾁ, ｼﾞｮｱﾖﾎﾊﾞｷﾞ, ｼﾞｮｱﾖﾑﾙｺﾞﾙ)
 */

const BASE = 'sounds/';

const CLIPS = {
    STARTLE: [
        'ｱ.wav',
        'ｳｱｱ.wav',
        'ｴｱｱ.wav',
        'ｳｱｱｽﾋﾟｷｴﾙｼﾞ.wav',
    ],
    IDLE: [
        'ｽﾋﾟｷ.wav',
    ],
    SAD: [
        'ｽﾋﾟｷｦｲｼﾞﾒﾇﾝﾃﾞ.wav',
    ],
    HAPPY: [
        'ｼﾞｮｱﾔ.wav',
        'ｼﾞｮｱﾖｽﾝﾊﾞｺｯﾁ.wav',
        'ｼﾞｮｱﾖﾎﾊﾞｷﾞ.wav',
        'ｼﾞｮｱﾖﾑﾙｺﾞﾙ.wav',
    ],
};

// AudioBuffer キャッシュ
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
        const buf = await res.arrayBuffer();
        const decoded = await ac.decodeAudioData(buf);
        cache.set(filename, decoded);
        return decoded;
    } catch (e) {
        console.warn('[Sound] Failed to load:', filename, e);
        return null;
    }
}

// 全クリップをプリロード
export function preloadSounds() {
    const all = [...CLIPS.STARTLE, ...CLIPS.IDLE, ...CLIPS.SAD, ...CLIPS.HAPPY];
    all.forEach(f => loadClip(f));
}

/** 指定カテゴリのランダムなクリップを再生 */
export async function play(category, volume = 1.0) {
    const list = CLIPS[category];
    if (!list || list.length === 0) return;
    const file = list[Math.floor(Math.random() * list.length)];
    const buf = await loadClip(file);
    if (!buf) return;
    const ac = getCtx();
    if (ac.state === 'suspended') await ac.resume();
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(ac.destination);
    src.start();
}

// mates ごとのクールダウン (同時発話を防ぐ)
const talkCooldown = new Map(); // mateId -> timestamp

/** クールダウン付きで再生。返り値: 発話したかどうか */
export function trySpeak(mateId, category, { minInterval = 3000, volume = 1.0 } = {}) {
    const now = Date.now();
    const last = talkCooldown.get(mateId) || 0;
    if (now - last < minInterval) return false;
    talkCooldown.set(mateId, now);
    play(category, volume);
    return true;
}

/** IDLE中のランダムつぶやき用ヘルパー */
export function maybeSpeakIdle(mate) {
    // emotion 0: 悲しみを優先
    if (mate.emotion === 0) {
        // 低確率でぼやく
        if (Math.random() < 0.003) {
            trySpeak(mate.id, 'SAD', { minInterval: 8000, volume: 0.9 });
        }
        return;
    }
    // emotion >= 2: 機嫌良い
    if (mate.emotion >= 2) {
        if (Math.random() < 0.003) {
            trySpeak(mate.id, 'HAPPY', { minInterval: 6000, volume: 0.85 });
        }
        return;
    }
    // 中立: 独り言「ｽﾋﾟｷ」
    if (Math.random() < 0.0015) {
        trySpeak(mate.id, 'IDLE', { minInterval: 10000, volume: 0.8 });
    }
}
