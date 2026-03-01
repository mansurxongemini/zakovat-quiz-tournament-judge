// ========================================
// ZERO-SUM CORPORATE BATTLE - DISPLAY DASHBOARD
// Premium Corporate Theme with Firebase Real-time Sync
// ========================================

// --- STATE MANAGEMENT ---
let state = defaultState;
let timerInterval = null;

// ========================================
// UI UPDATE FUNCTIONS
// ========================================

function updateDropDisplay() {
    const currentDrop = drops[state.currentDropIndex];

    if (!currentDrop) {
        document.getElementById('current-drop-title').innerText = "SIMULATION COMPLETE";
        document.getElementById('drop-scenario').innerText = "All corporate scenarios have been adjudicated. Final market valuations will determine the winning entity.";
        document.getElementById('drop-number').innerText = 'SCENARIO COMPLETE';
        return;
    }

    // Update title and scenario
    document.getElementById('current-drop-title').innerText = currentDrop.title;
    document.getElementById('drop-scenario').innerText = currentDrop.scenario;
    document.getElementById('drop-number').innerText = `SCENARIO ${state.currentDropIndex + 1} OF ${drops.length}`;

    // Update word tags for Alpha
    const wordsAlphaContainer = document.getElementById('words-alpha');
    wordsAlphaContainer.innerHTML = '';
    currentDrop.wordsAlpha.forEach(word => {
        const span = document.createElement('span');
        span.className = 'word-tag team-alpha';
        span.innerText = word;
        wordsAlphaContainer.appendChild(span);
    });

    // Update word tags for Beta
    const wordsBetaContainer = document.getElementById('words-beta');
    wordsBetaContainer.innerHTML = '';
    currentDrop.wordsBeta.forEach(word => {
        const span = document.createElement('span');
        span.className = 'word-tag team-beta';
        span.innerText = word;
        wordsBetaContainer.appendChild(span);
    });

    updatePhaseDisplay();
}

function updatePhaseDisplay() {
    const prepModal = document.getElementById('prep-phase-modal');
    if (!prepModal) return;

    if (state.phase === 'prep') {
        const currentDrop = drops[state.currentDropIndex];
        if (currentDrop) {
            document.getElementById('prep-modal-title').innerText = currentDrop.title;
            document.getElementById('prep-modal-scenario').innerText = currentDrop.scenario;
        }
        prepModal.classList.remove('hidden');
    } else {
        prepModal.classList.add('hidden');
    }
}

function updateValuesUI() {
    const alphaEl = document.getElementById('value-alpha');
    const betaEl = document.getElementById('value-beta');

    alphaEl.innerText = formatMoney(state.valAlpha);
    betaEl.innerText = formatMoney(state.valBeta);

    // Reset and update color classes
    alphaEl.className = 'value-display transition-all duration-300';
    betaEl.className = 'value-display transition-all duration-300';

    if (state.valAlpha > 1000000) {
        alphaEl.classList.add('positive');
    } else if (state.valAlpha < 1000000) {
        alphaEl.classList.add('negative');
    } else {
        alphaEl.classList.add('neutral');
    }

    if (state.valBeta > 1000000) {
        betaEl.classList.add('positive');
    } else if (state.valBeta < 1000000) {
        betaEl.classList.add('negative');
    } else {
        betaEl.classList.add('neutral');
    }

    // Trigger animation
    alphaEl.classList.remove('value-changed');
    betaEl.classList.remove('value-changed');
    void alphaEl.offsetWidth; // trigger reflow
    void betaEl.offsetWidth;
    alphaEl.classList.add('value-changed');
    betaEl.classList.add('value-changed');

    // Update market position bars
    updateBars();
}

function updateBars() {
    const total = state.valAlpha + state.valBeta;
    if (total === 0) return;

    const alphaPercent = Math.round((state.valAlpha / total) * 100);
    const betaPercent = 100 - alphaPercent;

    const barAlpha = document.getElementById('bar-alpha');
    const barBeta = document.getElementById('bar-beta');

    if (barAlpha && barBeta) {
        barAlpha.style.width = alphaPercent + '%';
        barBeta.style.width = betaPercent + '%';
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.innerText = timeStr;

        // Warning state for last 60 seconds (only during battle)
        if (state.timeRemaining <= 60 && state.phase === 'battle') {
            timerEl.classList.add('warning');
        } else {
            timerEl.classList.remove('warning');
        }
    }

    const prepTimerEl = document.getElementById('prep-modal-timer');
    if (prepTimerEl && state.phase === 'prep') {
        prepTimerEl.innerText = timeStr;
    }
}

function updateTimerStatus() {
    const statusEl = document.getElementById('timer-status');
    if (state.isTimerRunning) {
        statusEl.innerHTML = '<span class="status-badge live">Live</span>';
    } else {
        statusEl.innerHTML = '<span class="text-gray-500 font-medium">Paused</span>';
    }
}

// ========================================
// TIMER FUNCTIONS (Now driven by master state)
// ========================================

function syncTimer(newState) {
    if (newState.isTimerRunning && !timerInterval) {
        runLocalTimer();
    } else if (!newState.isTimerRunning && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function runLocalTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        if (!state.isTimerRunning) {
            clearInterval(timerInterval);
            timerInterval = null;
            return;
        }

        // Local decrement for visual smoothness, 
        // will be corrected by master state sync every heartbeat
        if (state.timeRemaining > 0) {
            state.timeRemaining--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }, 1000);
}

// ========================================
// VERDICT MODAL FUNCTIONS
// ========================================

function closeModal() {
    const modal = document.getElementById('verdict-modal');
    const modalContent = document.getElementById('modal-content');

    if (modalContent) {
        modalContent.classList.remove('scale-100');
        modalContent.classList.add('scale-95');
    }

    setTimeout(() => {
        if (modal) {
            modal.classList.add('hidden');
        }
    }, 300);
}

function nextDrop() {
    if (state.currentDropIndex < drops.length - 1) {
        state.currentDropIndex++;
        state.phase = 'prep';
        state.timeRemaining = 30;
        state.isTimerRunning = true;
        saveStateFirebase(state);
    }
}

function showVerdictModal(winner, swing, reason) {
    const modal = document.getElementById('verdict-modal');
    const modalContent = document.getElementById('modal-content');

    if (!modal || !modalContent) return;

    // Play sound
    playSound('sound-success');

    // Set winner text
    const winnerTextEl = document.getElementById('modal-winner-text');
    const isAlphaWinner = winner.toLowerCase().includes('alpha');

    winnerTextEl.innerText = `${isAlphaWinner ? 'Team Alpha' : 'Team Beta'} wins the round!`;
    winnerTextEl.className = `text-xl text-center mb-6 font-bold uppercase ${isAlphaWinner ? 'text-blue-600' : 'text-red-600'}`;

    // Set reasoning
    document.getElementById('modal-verdict-reason').innerText = `"${reason}"`;

    // Set swing amounts
    const alphaSwingEl = document.getElementById('modal-alpha-swing');
    const betaSwingEl = document.getElementById('modal-beta-swing');

    if (isAlphaWinner) {
        alphaSwingEl.innerText = `+ ${formatMoney(swing)}`;
        alphaSwingEl.className = 'text-2xl font-bold text-green-600';
        betaSwingEl.innerText = `- ${formatMoney(swing)}`;
        betaSwingEl.className = 'text-2xl font-bold text-red-600';
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { x: 0.2, y: 0.6 },
            colors: ['#3b82f6', '#60a5fa', '#93c5fd']
        });
    } else {
        betaSwingEl.innerText = `+ ${formatMoney(swing)}`;
        betaSwingEl.className = 'text-2xl font-bold text-green-600';
        alphaSwingEl.innerText = `- ${formatMoney(swing)}`;
        alphaSwingEl.className = 'text-2xl font-bold text-red-600';
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { x: 0.8, y: 0.6 },
            colors: ['#ef4444', '#f87171', '#fca5a5']
        });
    }

    // Show modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);

    // Add to leaderboard if not already there for this drop
    updateLeaderboard(winner, swing);
}

function updateLeaderboard(winner, swing) {
    if (!state.leaderboard) state.leaderboard = [];

    // Add new entry
    state.leaderboard.unshift({
        drop: drops[state.currentDropIndex]?.title || "Verdict",
        winner: winner,
        swing: swing,
        timestamp: Date.now()
    });

    // Limit to 5 entries
    if (state.leaderboard.length > 5) state.leaderboard.pop();

    updateLeaderboardUI();
}

function updateLeaderboardUI() {
    const list = document.getElementById('leaderboard-list');
    if (!list || !state.leaderboard || state.leaderboard.length === 0) return;

    document.getElementById('leaderboard-section').classList.remove('hidden');

    list.innerHTML = state.leaderboard.map(entry => `
        <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 animate-fadeIn">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${entry.winner.includes('Alpha') ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}">
                    ${entry.winner.includes('Alpha') ? 'A' : 'B'}
                </div>
                <div>
                    <p class="text-xs font-bold text-slate-700 dark:text-slate-200">${entry.drop}</p>
                    <p class="text-[10px] text-slate-400">${new Date(entry.timestamp).toLocaleTimeString()}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-xs font-bold text-green-600">+${formatMoney(entry.swing)}</p>
            </div>
        </div>
    `).join('');
}

// ========================================
// SETTINGS & MODES
// ========================================

function toggleDarkMode() {
    const isDark = !document.body.classList.contains('dark-mode');
    applyDarkMode(isDark);

    // Push setting to Firebase so all screens switch
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

function togglePresentationMode() {
    const isPres = !document.body.classList.contains('presentation-mode');
    applyPresentationMode(isPres);

    if (state.settings) {
        state.settings.presentationMode = isPres;
        saveStateFirebase(state);
    }
}

function applyPresentationMode(isPres) {
    if (isPres) {
        document.body.classList.add('presentation-mode');
    } else {
        document.body.classList.remove('presentation-mode');
    }
}

// ========================================
// UTILITIES
// ========================================

function playSound(id) {
    const sound = document.getElementById(id);
    if (sound && state.settings?.soundEnabled !== false) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log('Sound blocked by browser'));
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-900 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.style.animation = 'fadeIn 0.3s ease';
    notification.innerText = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========================================
// INITIALIZATION & SYNC
// ========================================

async function init() {
    // Initial load from Firebase
    state = await loadStateFirebase();

    // Initialize UI
    updateDropDisplay();
    updatePhaseDisplay();
    updateValuesUI();
    updateTimerDisplay();
    updateTimerStatus();

    // Check for first-time student tutorial
    checkStudentTutorial();

    // Start local timer if needed
    if (state.isTimerRunning) {
        runLocalTimer();
    }

    // Start listening for real-time changes
    onStateChange((newState) => {
        const dropChanged = newState.currentDropIndex !== state.currentDropIndex;
        const phaseChanged = newState.phase !== state.phase;
        const valuesChanged = newState.valAlpha !== state.valAlpha || newState.valBeta !== state.valBeta;
        const timerStatusChanged = newState.isTimerRunning !== state.isTimerRunning;
        const resetTriggered = newState.resetSignal && !state.resetSignal;

        // Sync local state
        const oldState = { ...state };
        state = { ...newState };

        if (resetTriggered) {
            location.reload();
            return;
        }

        if (dropChanged) {
            updateDropDisplay();
            playSound('sound-ding');
        }

        if (phaseChanged) {
            updatePhaseDisplay();
        }

        if (valuesChanged) {
            updateValuesUI();
        }

        if (timerStatusChanged) {
            updateTimerStatus();
            syncTimer(newState);
        }

        // Sync settings
        if (newState.settings) {
            applyDarkMode(newState.settings.darkMode);
            applyPresentationMode(newState.settings.presentationMode);
        }

        // Sync leaderboard
        if (newState.leaderboard && JSON.stringify(newState.leaderboard) !== JSON.stringify(oldState.leaderboard)) {
            updateLeaderboardUI();
        }

        // Sync timer value if it drifts by more than 2 seconds
        if (Math.abs(newState.timeRemaining - oldState.timeRemaining) > 2) {
            updateTimerDisplay();
        }
    });

    // Listen for verdict triggers
    onVerdictTrigger((verdict) => {
        // Only show if it's new (last 2 seconds)
        if (Date.now() - verdict.timestamp < 2000) {
            showVerdictModal(verdict.winner, verdict.swing, verdict.reason);
        }
    });

    console.log('Corporate Battle Display initialized with Firebase Sync');
}

window.addEventListener('DOMContentLoaded', init);
window.closeModal = closeModal; // Ensure global access
window.closeStudentTutorial = closeStudentTutorial; // Ensure global access
window.nextDrop = nextDrop; // Ensure global access for auto-advance

// ========================================
// STUDENT TUTORIAL MODAL LOGIC
// ========================================

function checkStudentTutorial() {
    const tutorialSeen = localStorage.getItem('studentTutorialSeen');
    if (!tutorialSeen) {
        document.getElementById('student-tutorial-modal').classList.remove('hidden');
    }
}

function closeStudentTutorial() {
    document.getElementById('student-tutorial-modal').classList.add('hidden');
    localStorage.setItem('studentTutorialSeen', 'true');
}

