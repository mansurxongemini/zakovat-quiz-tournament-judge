// ========================================
// ZERO-SUM CORPORATE BATTLE - JUDGE CONTROL PANEL
// Teacher Interface with Firebase Real-time Sync
// ========================================

// --- STATE MANAGEMENT ---
let state = defaultState;
let activityLog = [];
let stateHistory = []; // For Undo functionality

// ========================================
// UI UPDATE FUNCTIONS
// ========================================

function updateDisplay() {
    // Update current drop display
    const currentDrop = drops[state.currentDropIndex];
    if (currentDrop) {
        document.getElementById('current-drop-display').innerText = currentDrop.title;
        document.getElementById('drop-progress').innerText = `Scenario ${state.currentDropIndex + 1} of ${drops.length}`;
        document.getElementById('scenario-preview').innerText = currentDrop.scenario;
    } else {
        document.getElementById('current-drop-display').innerText = "SIMULATION COMPLETE";
        document.getElementById('drop-progress').innerText = "All scenarios concluded";
        document.getElementById('scenario-preview').innerText = "The simulation has concluded. Review final valuations to determine the winner.";
    }

    // Update values
    document.getElementById('judge-val-alpha').innerText = formatMoney(state.valAlpha);
    document.getElementById('judge-val-beta').innerText = formatMoney(state.valBeta);

    // Update color indicators
    const alphaEl = document.getElementById('judge-val-alpha');
    const betaEl = document.getElementById('judge-val-beta');

    alphaEl.className = 'text-2xl font-bold ' + (state.valAlpha > 1000000 ? 'text-green-600' : state.valAlpha < 1000000 ? 'text-red-600' : 'text-blue-600');
    betaEl.className = 'text-2xl font-bold ' + (state.valBeta > 1000000 ? 'text-green-600' : state.valBeta < 1000000 ? 'text-red-600' : 'text-red-600');
}

function logActivity(message) {
    const timestamp = new Date().toLocaleTimeString();
    activityLog.unshift(`[${timestamp}] ${message}`);

    const logContainer = document.getElementById('activity-log');
    if (logContainer) {
        logContainer.innerHTML = activityLog.map(log =>
            `<div class="text-xs text-slate-600 py-1 border-b border-slate-100 last:border-0">${log}</div>`
        ).join('');
    }
}

// ========================================
// STATE PERSISTENCE & HISTORY
// ========================================

function pushToHistory() {
    stateHistory.push(JSON.parse(JSON.stringify(state)));
    if (stateHistory.length > 20) stateHistory.shift(); // Limit history
}

function undo() {
    if (stateHistory.length > 0) {
        state = stateHistory.pop();
        saveStateFirebase(state);
        updateDisplay();
        logActivity('Undo: Reverted to previous state');
    } else {
        alert('Nothing to undo');
    }
}

// ========================================
// TIMER CONTROLS
// ========================================

let heartbeatInterval = null;

function startPrepTimer() {
    pushToHistory();
    state.phase = 'prep';
    state.timeRemaining = 30;
    state.isTimerRunning = true;
    saveStateFirebase(state);
    logActivity('Started 30s Prep Timer');
    startHeartbeat();
}

function startBattleTimer() {
    pushToHistory();
    state.phase = 'battle';
    state.timeRemaining = 180;
    state.isTimerRunning = true;
    saveStateFirebase(state);
    logActivity('Started 3m Battle Timer');
    startHeartbeat();
}

function pauseTimer() {
    state.isTimerRunning = false;
    saveStateFirebase(state);
    logActivity('Timer paused');
    stopHeartbeat();
}

/**
 * Update timer in background to sync all clients
 */
function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (state.isTimerRunning && state.timeRemaining > 0) {
            state.timeRemaining--;
            // Only push to Firebase every 5 seconds to reduce quota usage
            // or if it's the final 10 seconds
            if (state.timeRemaining % 5 === 0 || state.timeRemaining < 10) {
                saveStateFirebase(state);
            }
        } else if (state.timeRemaining <= 0) {
            pauseTimer();
        }
    }, 1000);
}

function stopHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
}

// ========================================
// NAVIGATION
// ========================================

function nextDrop() {
    pushToHistory();
    if (state.currentDropIndex < drops.length - 1) {
        state.currentDropIndex++;
        // Immediately start 30s prep phase for the new drop
        state.phase = 'prep';
        state.timeRemaining = 30;
        state.isTimerRunning = true;
        saveStateFirebase(state);
        updateDisplay();
        logActivity(`Advanced to ${drops[state.currentDropIndex].title}. Auto-started 30s Prep.`);
        startHeartbeat();
    } else {
        alert('All scenarios completed! The simulation has ended.');
    }
}

// ========================================
// MANUAL VALUE ADJUSTMENT
// ========================================

function adjustValue(team) {
    const inputId = team === 'alpha' ? 'manual-alpha' : 'manual-beta';
    const amount = parseInt(document.getElementById(inputId).value) || 0;

    if (amount === 0) return;

    pushToHistory();
    if (team === 'alpha') {
        state.valAlpha += amount;
    } else {
        state.valBeta += amount;
    }

    saveStateFirebase(state);
    updateDisplay();
    document.getElementById(inputId).value = '';
    logActivity(`${team === 'alpha' ? 'Alpha' : 'Beta'} manually adjusted by ${formatMoney(amount)}`);
}

// ========================================
// VERDICT EXECUTION
// ========================================

function executeManualVerdict() {
    const winner = document.getElementById('winner-select').value;
    const swingAmount = parseInt(document.getElementById('swing-amount').value) || 0;
    const reasoning = document.getElementById('verdict-reason').value || 'No reasoning provided';

    if (winner === 'draw') {
        logActivity('Verdict: Draw - No value transfer');
        showNotification('Verdict recorded: Draw');
        return;
    }

    if (swingAmount <= 0) {
        alert('Please enter a valid swing amount');
        return;
    }

    pushToHistory();
    // Apply the swing
    if (winner === 'alpha') {
        state.valAlpha += swingAmount;
        state.valBeta -= swingAmount;
    } else {
        state.valBeta += swingAmount;
        state.valAlpha -= swingAmount;
    }

    saveStateFirebase(state);
    updateDisplay();

    // Trigger verdict modal on all displays
    const winnerName = winner === 'alpha' ? 'Team Alpha' : 'Team Beta';
    triggerVerdictFirebase(winnerName, swingAmount, reasoning);

    // Log and notify
    logActivity(`Verdict: ${winnerName} wins ${formatMoney(swingAmount)}`);
    showNotification(`Verdict executed: ${winnerName} +${formatMoney(swingAmount)}`);

    // Clear reasoning
    document.getElementById('verdict-reason').value = '';
}

// ========================================
// TAB SWITCHING
// ========================================

function switchTab(tab) {
    const manualTab = document.getElementById('tab-manual');
    const geminiTab = document.getElementById('tab-gemini'); // This is now the Grok tab
    const manualPanel = document.getElementById('panel-manual');
    const geminiPanel = document.getElementById('panel-gemini'); // This is now the Grok panel

    if (tab === 'manual') {
        manualTab.classList.add('bg-white', 'shadow-sm', 'text-slate-800');
        manualTab.classList.remove('text-slate-500');
        geminiTab.classList.remove('bg-white', 'shadow-sm', 'text-slate-800');
        geminiTab.classList.add('text-slate-500');
        manualPanel.classList.remove('hidden');
        geminiPanel.classList.add('hidden');
    } else {
        geminiTab.classList.add('bg-white', 'shadow-sm', 'text-slate-800');
        geminiTab.classList.remove('text-slate-500');
        manualTab.classList.remove('bg-white', 'shadow-sm', 'text-slate-800');
        manualTab.classList.add('text-slate-500');
        geminiPanel.classList.remove('hidden');
        manualPanel.classList.add('hidden');
    }
}

// ========================================
// GROK JSON EXECUTOR
// ========================================

async function executeGrokJSON() {
    const jsonInput = document.getElementById('grok-json-input');
    const jsonText = jsonInput.value.trim();

    if (!jsonText) {
        alert('Please paste the Grok JSON response');
        return;
    }

    try {
        // Robuast extraction: Handle markdown JSON blocks if present
        const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
        const verdict = JSON.parse(cleanJson);

        // Required fields check: winner, swing_amount
        // (Accepting both 'swing' and 'swing_amount' for backwards/flexible compatibility)
        if (!verdict.winner || (verdict.swing_amount === undefined && verdict.swing === undefined)) {
            throw new Error('Invalid JSON: must contain "winner" and "swing_amount"');
        }

        const swing = verdict.swing_amount !== undefined ? verdict.swing_amount : verdict.swing;
        const reasoning = verdict.display_message_for_gemini || verdict.reasoning || "Verdict processed via Grok JSON Executor.";

        const winnerStr = (verdict.winner || "").toLowerCase();
        let normalizedWinner = 'draw';
        if (winnerStr.includes('alpha')) normalizedWinner = 'alpha';
        else if (winnerStr.includes('beta')) normalizedWinner = 'beta';

        if (normalizedWinner === 'draw') {
            logActivity('Grok Verdict: Draw - No value transfer');
            showNotification('Grok Verdict recorded: Draw');
            jsonInput.value = '';
            return;
        }

        pushToHistory();

        // Apply the swing
        if (normalizedWinner === 'alpha') {
            state.valAlpha += swing;
            state.valBeta -= swing;
        } else {
            state.valBeta += swing;
            state.valAlpha -= swing;
        }

        saveStateFirebase(state);
        updateDisplay();

        const winnerName = normalizedWinner === 'alpha' ? 'Team Alpha' : 'Team Beta';
        triggerVerdictFirebase(winnerName, swing, reasoning);

        // Log and notify
        logActivity(`Grok JSON Verdict: ${winnerName} wins ${formatMoney(swing)}`);
        showNotification(`Grok Verdict executed: ${winnerName} +${formatMoney(swing)}`);

        // Clear input
        jsonInput.value = '';

    } catch (error) {
        console.error('Grok JSON Parse Error:', error);
        alert('Failed to parse or execute Grok JSON. Error: ' + error.message);
    }
}

// ========================================
// UTILITIES
// ========================================

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-20 right-4 bg-slate-900 text-white px-6 py-3 rounded-lg shadow-xl z-50';
    notification.style.animation = 'fadeIn 0.3s ease';
    notification.innerText = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function resetSimulation() {
    if (!confirm('Are you sure you want to reset the entire simulation? All progress will be lost.')) {
        return;
    }

    pushToHistory();
    state = { ...defaultState, resetSignal: true };
    saveStateFirebase(state);

    setTimeout(() => {
        state.resetSignal = false;
        saveStateFirebase(state);
    }, 1000);

    activityLog = [];
    updateDisplay();
    logActivity('Simulation reset to initial state');
}

// ========================================
// INITIALIZATION
// ========================================

async function init() {
    state = await loadStateFirebase();
    updateDisplay();

    // Resume heartbeat if timer was running
    if (state.isTimerRunning) {
        startHeartbeat();
    }

    logActivity('Judge panel initialized with Firebase Sync');
}

window.addEventListener('DOMContentLoaded', init);

// ========================================
// SETTINGS & MODES
// ========================================

function toggleDarkMode() {
    const isDark = !document.body.classList.contains('dark-mode');
    applyDarkMode(isDark);

    if (state.settings) {
        state.settings.darkMode = isDark;
        saveStateFirebase(state);
    }
}

function applyDarkMode(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Global access for UI buttons
window.startPrepTimer = startPrepTimer;
window.startBattleTimer = startBattleTimer;
window.pauseTimer = pauseTimer;
window.nextDrop = nextDrop;
window.adjustValue = adjustValue;
window.executeManualVerdict = executeManualVerdict;
window.switchTab = switchTab;
window.executeGrokJSON = executeGrokJSON;
window.undo = undo;
window.resetSimulation = resetSimulation;
window.toggleDarkMode = toggleDarkMode;

