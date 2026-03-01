// ========================================
// ZERO-SUM CORPORATE BATTLE - COMMON MODULE
// Firebase Realtime Synchronization
// ========================================

// --- FIREBASE CONFIGURATION ---
// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAPLEZRb5EmKSNudJpo85NNUX3mV7B0Go0",
    authDomain: "englishlessdebate.firebaseapp.com",

    // 4-RASMDAGI TO'G'RI MANZIL SHU YERGA QO'YILDI:
    databaseURL: "https://englishlessdebate-default-rtdb.asia-southeast1.firebasedatabase.app",

    projectId: "englishlessdebate",
    storageBucket: "englishlessdebate.firebasestorage.app",
    messagingSenderId: "898977881644",
    appId: "1:898977881644:web:20ea02fd0ec5d9b2547b89",
    measurementId: "G-EYX3BWGK3X"
};

// Initialize Firebase (Compat mode for simple script inclusion)
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    var db = firebase.database();
}

const STORAGE_KEY = 'corporateBattleState';
const VERDICT_TRIGGER_KEY = 'corporateBattleVerdict';

// --- DEFAULT STATE ---
const defaultState = {
    currentDropIndex: 0,
    valAlpha: 1000000,
    valBeta: 1000000,
    timeRemaining: 15 * 60,
    isTimerRunning: false,
    phase: 'idle', // 'idle', 'prep' (30s), 'battle' (3m)
    lastUpdated: Date.now(),
    resetSignal: false,
    leaderboard: [],
    settings: {
        darkMode: false,
        presentationMode: false,
        soundEnabled: true
    }
};

// --- DROP SCENARIOS ---
const drops = [
    {
        title: "Drop 1: The Secret Founder Claim",
        scenario: "A mysterious individual has suddenly emerged claiming to be the original founder who contributed substantial capital and ideas before the company was officially incorporated. He demands a 35% proportion of the issued share capital based on a verbal agreement made during the early set up phase. The current board strongly disputes this, arguing that only the articles of association and certificate of incorporation define ownership and that the company enjoys full legal entity status with limited liability protection. The claimant threatens to sue for dividend rights and shareholder privileges, putting the entire market value of the startup at risk in this high-stakes corporate battle.",
        wordsAlpha: ["incorporate", "founder", "articles of association", "legal entity", "limited liability"],
        wordsBeta: ["dividend", "sleeping partner", "issued share capital", "proportion", "shareholder"]
    },
    {
        title: "Drop 2: The Balance Sheet Manipulation Crisis",
        scenario: "Internal auditors have discovered that the CFO deliberately altered the balance sheet and profit and loss account to conceal massive revenue, thereby avoiding corporation tax payments for three consecutive years. The company now faces severe penalties and possible dissolution. Team Alpha must defend the integrity of their records and accounts and argue that proper management was maintained. Team Beta claims the directors are personally liable because they ran up a debt and exposed personal assets through unlimited liability. The scandal has caused a dramatic drop in market value and triggered an official investigation by tax authorities.",
        wordsAlpha: ["balance sheet", "profit and loss account", "corporation tax", "records and accounts", "manage"],
        wordsBeta: ["unlimited liability", "personal assets", "run up a debt", "loss", "dissolved"]
    },
    {
        title: "Drop 3: The Hostile Takeover Assault",
        scenario: "A rival public limited company has secretly acquired a substantial stake and is now demanding board seats while threatening to dissolve the current management structure. They claim the target company is at risk and has been run into trouble due to poor investment decisions. Team Alpha must protect their market value, share capital and argue that shareholders cannot force such radical changes without following proper notice period and rules. Team Beta pushes for the option to sell or restructure, emphasizing how risky the current leadership has become for all investors involved in this aggressive corporate raid.",
        wordsAlpha: ["public limited company", "market value", "share capital", "shareholder", "invest"],
        wordsBeta: ["dissolved", "run into trouble", "option", "notice period", "risky"]
    },
    {
        title: "Drop 4: The Awakening Sleeping Partner Dispute",
        scenario: "A long-dormant partner who contributed almost nothing for years has suddenly awakened and is demanding full equity partner rights, drawings, and a large dividend payout from the limited liability partnership. He argues he was never properly expelled and remains a legal member. Team Alpha insists he was always a sleeping partner with no management role and must follow the partnership agreement. Team Beta counters that joint and several liability applies and he is entitled to his proportion of profits. The dispute threatens to destroy the entire business relationship and force the company into expensive legal battles.",
        wordsAlpha: ["limited liability partnership", "dormant partner", "partner", "management", "expel"],
        wordsBeta: ["sleeping partner", "dividend", "drawings", "equity partner", "resign"]
    },
    {
        title: "Drop 5: The Environmental Liability Nightmare",
        scenario: "Toxic waste from the manufacturing facility has contaminated local water supplies, leading to a massive class-action lawsuit. Residents demand billions in damages and immediate cessation of operations. The company claims it operated as a proper legal entity with limited liability and followed all register and registered office requirements. Team Beta argues the directors are personally liable because they ignored warnings and exposed personal assets through unlimited liability. The crisis has destroyed the market value and threatens to dissolve the entire incorporated business if not handled with extreme care.",
        wordsAlpha: ["legal entity", "limited liability", "register", "registered office", "assets"],
        wordsBeta: ["unlimited liability", "liable", "personal assets", "dissolved", "run a business"]
    }
];

// --- UTILITY FUNCTIONS ---

function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Load state from Firebase
 * @returns {Promise<Object>}
 */
async function loadStateFirebase() {
    if (!db) return loadStateLocal();
    try {
        const snapshot = await db.ref(STORAGE_KEY).get();
        if (snapshot.exists()) {
            return { ...defaultState, ...snapshot.val() };
        }
    } catch (e) {
        console.error('Firebase load failed:', e);
    }
    return loadStateLocal();
}

/**
 * Save state to Firebase
 */
function saveStateFirebase(state) {
    state.lastUpdated = Date.now();
    if (db) {
        db.ref(STORAGE_KEY).set(state);
    }
    // Still keep local copy as backup
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Trigger verdict with Firebase
 */
function triggerVerdictFirebase(winner, swing, reason) {
    const verdictData = {
        winner: winner,
        swing: swing,
        reason: reason,
        timestamp: Date.now()
    };
    if (db) {
        db.ref(VERDICT_TRIGGER_KEY).set(verdictData);
    }
    localStorage.setItem(VERDICT_TRIGGER_KEY, JSON.stringify(verdictData));
}

/**
 * Listen for real-time updates
 */
function onStateChange(callback) {
    if (db) {
        db.ref(STORAGE_KEY).on('value', (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val());
            }
        });
    }

    // Fallback/Legacy: Storage event (same tab only for Firebase, but good for local dev)
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            callback(JSON.parse(e.newValue));
        }
    });
}

function onVerdictTrigger(callback) {
    if (db) {
        db.ref(VERDICT_TRIGGER_KEY).on('value', (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val());
            }
        });
    }
}

// Legacy support
function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return { ...defaultState, ...JSON.parse(saved) };
        } catch (e) {
            return { ...defaultState };
        }
    }
    return { ...defaultState };
}

function loadStateLocal() {
    return loadState();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORAGE_KEY,
        VERDICT_TRIGGER_KEY,
        defaultState,
        drops,
        formatMoney,
        loadStateFirebase,
        saveStateFirebase,
        triggerVerdictFirebase,
        onStateChange,
        onVerdictTrigger
    };
}