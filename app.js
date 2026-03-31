document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let gameState = {
        players: [
            { id: 0, name: 'Oyuncu 1', score: 0, history: [] },
            { id: 1, name: 'Oyuncu 2', score: 0, history: [] },
            { id: 2, name: 'Oyuncu 3', score: 0, history: [] },
            { id: 3, name: 'Oyuncu 4', score: 0, history: [] }
        ],
        round: 1,
        viewedRound: 1,
        activePlayerId: null,
        currentInput: '0',
        inputMode: 'penalty' // 'penalty' or 'reward'
    };

    // --- DOM Elements ---
    const roundCounter = document.getElementById('roundCounter');
    const prevRoundBtn = document.getElementById('prevRoundBtn');
    const nextRoundNavBtn = document.getElementById('nextRoundNavBtn');
    const allHistoryBtn = document.getElementById('allHistoryBtn');
    const nextRoundBtn = document.getElementById('nextRoundBtn');
    const resetBtn = document.getElementById('resetBtn');

    const modalOverlay = document.getElementById('modalOverlay');
    const closeModal = document.getElementById('closeModal');
    const modalPlayerName = document.getElementById('modalPlayerName');

    const globalHistoryModal = document.getElementById('globalHistoryModal');
    const closeGlobalModal = document.getElementById('closeGlobalModal');
    const globalHistoryContainer = document.getElementById('globalHistoryContainer');

    const pastRoundModal = document.getElementById('pastRoundModal');
    const closePastModal = document.getElementById('closePastModal');
    const pastModalPlayerName = document.getElementById('pastModalPlayerName');
    const pastModalRoundInfo = document.getElementById('pastModalRoundInfo');
    const pastHistoryContainer = document.getElementById('pastHistoryContainer');

    const resultsModal = document.getElementById('resultsModal');
    const closeResultsBtn = document.getElementById('closeResultsModal');
    const finishGameBtn = document.getElementById('finishGameBtn');
    const newGameBtn = document.getElementById('newGameBtn');
    const shareResultBtn = document.getElementById('shareResultBtn');
    const rankingList = document.getElementById('rankingList');
    const winnerNameDisplay = document.getElementById('winnerNameDisplay');
    const trophyImg = document.getElementById('trophyImg');
    const penaltyBtn = document.getElementById('penaltyBtn');
    const rewardBtn = document.getElementById('rewardBtn');
    const currentInputDisplay = document.getElementById('currentInput');
    const saveScoreBtn = document.getElementById('saveScoreBtn');
    const numButtons = document.querySelectorAll('.num-btn[data-val]');
    const doubleZeroBtn = document.getElementById('doubleZeroBtn');
    const clearBtn = document.querySelector('.num-btn.clear');
    const backspaceBtn = document.getElementById('backspace');
    const tableContainer = document.querySelector('.table-container');
    const historyContainer = document.getElementById('historyContainer');
    const cikIndicator = document.getElementById('cikIndicator');

    // --- Initialization ---
    function init() {
        const savedData = sessionStorage.getItem('puanmatik_state_v3');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                gameState.players = parsed.players.map(p => ({
                    ...p,
                    history: (p.history || []).map(h => ({
                        ...h,
                        round: h.round || 1 // Support legacy data
                    }))
                }));
                gameState.round = parsed.round || 1;
                gameState.viewedRound = gameState.round; // Default to current round
            } catch (e) {
                console.error("Cache parsing error", e);
            }
        }
        updateUI();
    }

    function saveState() {
        sessionStorage.setItem('puanmatik_state_v3', JSON.stringify({
            players: gameState.players,
            round: gameState.round
        }));
    }

    // --- UI Updates ---
    function updateUI() {

        if (roundCounter) {
            roundCounter.textContent = gameState.viewedRound;
            // Highlight if viewing past round
            roundCounter.style.color = gameState.viewedRound === gameState.round ? 'var(--accent-primary)' : 'var(--accent-secondary)';
        }

        // Cik indicator logic
        if (cikIndicator) {
            const cikRounds = [1, 5, 9, 13];
            cikIndicator.style.display = cikRounds.includes(gameState.viewedRound) ? 'flex' : 'none';
        }

        // Find min and max scores (excluding 0 if nobody has points, or just handle all zero)
        const scores = gameState.players.map(p => p.score);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const allZero = scores.every(s => s === 0);

        gameState.players.forEach(player => {
            const scoreEl = document.getElementById(`score-${player.id}`);
            const nameEl = document.getElementById(`name-${player.id}`);
            const historyPreview = document.getElementById(`history-preview-${player.id}`);
            const card = document.querySelector(`.player-card[data-player-id="${player.id}"]`);

            if (scoreEl) scoreEl.textContent = player.score;
            if (nameEl) nameEl.textContent = player.name;

            if (card) {
                // Remove existing highlights
                card.classList.remove('card-highest', 'card-lowest');
                
                if (!allZero) {
                    if (player.score === maxScore) {
                        card.classList.add('card-highest');
                    }
                    if (player.score === minScore) {
                        card.classList.add('card-lowest');
                    }
                }
            }

            if (historyPreview) {
                // Filter history by viewed round
                const roundHistory = player.history.filter(h => h.round === gameState.viewedRound);
                const allItems = roundHistory.slice().reverse();
                historyPreview.innerHTML = allItems.map(item => `
                    <div class="history-item-mini">
                        <span class="history-val-${item.type}">${item.type === 'penalty' ? '+' : '-'}${item.value}</span>
                        <span>${item.type === 'penalty' ? 'Ceza' : 'Ödül'}</span>
                    </div>
                `).join('') || `<div style="opacity:0.3; font-size:0.7rem;">${gameState.viewedRound}. Turda işlem yok</div>`;
            }
        });

        // Update Winning Probabilities
        updateWinningProbabilities();
    }

    function updateWinningProbabilities() {
        const scores = gameState.players.map(p => p.score);
        const maxScore = Math.max(...scores);
        
        // We use an "inverse" logic: the further you are below the max score, the higher your chance.
        // We add a buffer so that even the person with the max score has some chance if the gap is small.
        const buffer = 50; 
        const weights = scores.map(s => (maxScore - s) + buffer);
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);

        gameState.players.forEach((player, index) => {
            const probEl = document.getElementById(`prob-${player.id}`);
            if (probEl) {
                const probability = ((weights[index] / totalWeight) * 100).toFixed(0);
                probEl.textContent = `%${probability}`;
            }
        });
    }

    function updateModalDisplay() {
        currentInputDisplay.textContent = gameState.currentInput;
        renderHistoryList();
    }

    function renderHistoryList() {
        if (gameState.activePlayerId === null) return;

        const player = gameState.players.find(p => p.id === gameState.activePlayerId);
        // Only show items from the round being viewed
        const roundHistory = player.history.filter(h => h.round === gameState.viewedRound);

        if (roundHistory.length === 0) {
            historyContainer.innerHTML = `<p style="text-align:center; color:var(--text-secondary); font-size:0.8rem; padding: 1rem;">${gameState.viewedRound}. Turda henüz işlem yok.</p>`;
            return;
        }

        historyContainer.innerHTML = `
            <div style="font-size:0.7rem; color:var(--accent-secondary); margin-bottom:0.5rem; text-align:center; opacity:0.8;">
                ${gameState.viewedRound}. Tur İşlemleri
            </div>
        ` + roundHistory.slice().reverse().map(item => `
            <div class="history-row">
                <div class="history-info">
                    <span class="history-type-tag type-${item.type}">${item.type === 'penalty' ? '+' : '-'}${item.value}</span>
                    <span style="font-size: 0.9rem; font-weight:600;">${item.type === 'penalty' ? 'Ceza' : 'Ödül'}</span>
                </div>
                <div class="history-actions">
                    <button class="action-btn edit" data-entry-id="${item.timestamp}" title="Düzenle">✎</button>
                    <button class="action-btn delete" data-entry-id="${item.timestamp}" title="Sil">🗑</button>
                </div>
            </div>
        `).join('');

        // Attach listeners
        historyContainer.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteHistoryEntry(player.id, parseInt(btn.dataset.entryId));
            });
        });

        historyContainer.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                editHistoryEntry(player.id, parseInt(btn.dataset.entryId));
            });
        });
    }

    function renderGlobalHistoryList() {
        if (gameState.players.every(p => p.history.length === 0)) {
            globalHistoryContainer.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding: 2rem;">Henüz kayıtlı işlem bulunamadı.</p>';
            return;
        }

        // Group by round
        const rounds = {};
        gameState.players.forEach(player => {
            player.history.forEach(item => {
                if (!rounds[item.round]) rounds[item.round] = {};
                if (!rounds[item.round][player.id]) rounds[item.round][player.id] = [];
                rounds[item.round][player.id].push(item);
            });
        });

        const sortedRounds = Object.keys(rounds).sort((a, b) => b - a);

        globalHistoryContainer.innerHTML = sortedRounds.map(rNum => {
            // Calculate totals for this round
            const roundTotals = {};
            let minRoundScore = Infinity;
            let roundWinnerId = null;

            // Calculate exact score changes for this round
            Object.keys(rounds[rNum]).forEach(pId => {
                const total = rounds[rNum][pId].reduce((sum, item) => {
                    return item.type === 'penalty' ? sum + item.value : sum - item.value;
                }, 0);
                roundTotals[pId] = total;

                // Lowest (or most negative) change is the "winner" for that round
                if (total < minRoundScore) {
                    minRoundScore = total;
                    roundWinnerId = pId;
                }
            });

            // Handle case where everyone has the same score (greater than 1 player)
            const entriesCount = Object.values(roundTotals).length;
            const allSame = entriesCount > 1 && Object.values(roundTotals).every(v => v === minRoundScore);
            const allZero = Object.values(roundTotals).every(v => v === 0);
            if (allSame || allZero) roundWinnerId = null;

            const winnerPlayer = roundWinnerId ? gameState.players.find(p => p.id === parseInt(roundWinnerId)) : null;
            const winnerMarkup = winnerPlayer ? `<span style="color:var(--success); font-size: 0.9em; margin-left: 10px;">- ${winnerPlayer.name} 🏆</span>` : '';

            return `
            <div class="round-group">
                <div class="round-group-title">
                    <span>${rNum}. TUR ${winnerMarkup}</span>
                </div>
                ${Object.keys(rounds[rNum]).map(pId => {
                const player = gameState.players.find(p => p.id === parseInt(pId));
                const pTotal = roundTotals[pId];
                return `
                        <div class="player-history-group">
                            <div class="player-group-name" style="display:flex; justify-content:space-between; align-items:center;">
                                <div><span style="color:var(--accent-primary)">●</span> ${player.name}</div>
                                <div style="font-size: 0.9em; color: ${pTotal < 0 ? 'var(--success)' : 'var(--danger)'};">
                                    ${pTotal > 0 ? '+' : ''}${pTotal} Puan
                                </div>
                            </div>
                            ${rounds[rNum][pId].map(item => `
                                <div class="history-row" style="padding: 0.6rem; margin-bottom: 0.4rem;">
                                    <div class="history-info">
                                        <span class="history-type-tag type-${item.type}" style="font-size:0.7rem;">${item.type === 'penalty' ? '+' : '-'}${item.value}</span>
                                    </div>
                                    <div class="history-actions">
                                        <button class="action-btn edit" data-player-id="${pId}" data-entry-id="${item.timestamp}" style="font-size:0.9rem;">✎</button>
                                        <button class="action-btn delete" data-player-id="${pId}" data-entry-id="${item.timestamp}" style="font-size:0.9rem;">🗑</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                 }).join('')}
            </div>
        `}).join('');

        // Attach listeners for global modal
        globalHistoryContainer.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteHistoryEntry(parseInt(btn.dataset.playerId), parseInt(btn.dataset.entryId));
                renderGlobalHistoryList();
            });
        });

        globalHistoryContainer.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', () => {
                editHistoryEntry(parseInt(btn.dataset.playerId), parseInt(btn.dataset.entryId));
                renderGlobalHistoryList();
            });
        });
    }

    // --- Actions ---
    function editPlayerName(playerId) {
        const player = gameState.players.find(p => p.id === playerId);
        const newName = prompt(`${player.name} için yeni isim girin:`, player.name);
        if (newName !== null && newName.trim() !== "") {
            player.name = newName.trim();
            updateUI();
            saveState();
        }
    }

    function deleteHistoryEntry(playerId, timestamp) {
        if (!confirm('Bu işlemi silmek istediğinize emin misiniz?')) return;
        const player = gameState.players.find(p => p.id === playerId);
        player.history = player.history.filter(item => item.timestamp !== timestamp);
        recalculatePlayerScore(player);
        updateUI();
        saveState();
        renderHistoryList();
    }

    function editHistoryEntry(playerId, timestamp) {
        const player = gameState.players.find(p => p.id === playerId);
        const entry = player.history.find(item => item.timestamp === timestamp);
        const newValue = prompt(`Yeni değeri girin (${entry.type === 'penalty' ? 'Ceza' : 'Ödül'}):`, entry.value);

        if (newValue !== null && !isNaN(parseInt(newValue))) {
            entry.value = Math.abs(parseInt(newValue));
            recalculatePlayerScore(player);
            updateUI();
            saveState();
            renderHistoryList();
        }
    }

    function recalculatePlayerScore(player) {
        player.score = player.history.reduce((total, item) => {
            return item.type === 'penalty' ? total + item.value : total - item.value;
        }, 0);
    }

    function nextRound() {
        if (confirm('Turu bitirip yeni tura geçmek istediğinize emin misiniz?')) {
            gameState.round++;
            gameState.viewedRound = gameState.round;
            updateUI();
            saveState();
        }
    }

    function changeViewedRound(dir) {
        const target = gameState.viewedRound + dir;
        if (target >= 1 && target <= gameState.round) {
            gameState.viewedRound = target;
            updateUI();
        }
    }

    function resetGame() {
        if (confirm('Tüm skorları ve turları sıfırlamak istediğinize emin misiniz? (Oyuncu isimleri korunacaktır)')) {
            gameState.players.forEach(p => {
                p.score = 0;
                p.history = [];
            });
            gameState.round = 1;
            gameState.viewedRound = 1;
            saveState(); // Overwrite cache with 0 score state instead of removing, keeps names
            updateUI();
        }
    }

    function openPlayerModal(playerId) {
        // Only allow adding scores to the current round
        if (gameState.viewedRound !== gameState.round) {
            openPastRoundModal(playerId);
            return;
        }

        gameState.activePlayerId = playerId;
        gameState.currentInput = '0';
        gameState.inputMode = 'penalty';

        const player = gameState.players.find(p => p.id === playerId);
        modalPlayerName.textContent = player.name;

        penaltyBtn.classList.add('active');
        rewardBtn.classList.remove('active');

        updateModalDisplay();
        modalOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent scroll
    }

    function openGlobalHistoryModal() {
        renderGlobalHistoryList();
        globalHistoryModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeGlobalHistoryModal() {
        globalHistoryModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function openPastRoundModal(playerId) {
        const player = gameState.players.find(p => p.id === playerId);
        const roundHistory = player.history.filter(h => h.round === gameState.viewedRound);

        pastModalPlayerName.textContent = player.name;
        pastModalRoundInfo.textContent = `${gameState.viewedRound}. Tur Geçmişi`;

        if (roundHistory.length === 0) {
            pastHistoryContainer.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding: 1rem;">Bu turda işlem yok.</p>';
        } else {
            pastHistoryContainer.innerHTML = roundHistory.slice().reverse().map(item => `
                <div class="history-row">
                    <div class="history-info">
                        <span class="history-type-tag type-${item.type}">${item.type === 'penalty' ? '+' : '-'}${item.value}</span>
                        <span style="font-size: 0.9rem; font-weight:600;">${item.type === 'penalty' ? 'Ceza' : 'Ödül'}</span>
                    </div>
                </div>
            `).join('');
        }

        pastRoundModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closePastRoundModal() {
        pastRoundModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function finishGame() {
        // Find winner (lowest score)
        const sortedPlayers = [...gameState.players].sort((a, b) => a.score - b.score);
        const winner = sortedPlayers[0];

        // Update UI
        winnerNameDisplay.textContent = winner.name;
        // Update trophy image path
        trophyImg.src = 'winner_trophy.png';

        rankingList.innerHTML = sortedPlayers.map((player, index) => `
            <div class="rank-item">
                <div class="rank-info">
                    <span class="rank-num">${index + 1}.</span>
                    <span class="rank-name">${player.name}</span>
                </div>
                <span class="rank-score">${player.score}</span>
            </div>
        `).join('');

        resultsModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeResultsModal() {
        resultsModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function closePlayerModal() {
        modalOverlay.style.display = 'none';
        gameState.activePlayerId = null;
        document.body.style.overflow = '';
    }

    function handleNumClick(val) {
        if (gameState.currentInput === '0') {
            gameState.currentInput = val;
        } else {
            if (gameState.currentInput.length < 6) { // Safety limit
                gameState.currentInput += val;
            }
        }
        updateModalDisplay();
    }

    function handleClear() {
        gameState.currentInput = '0';
        updateModalDisplay();
    }

    function handleBackspace() {
        if (gameState.currentInput.length > 1) {
            gameState.currentInput = gameState.currentInput.slice(0, -1);
        } else {
            gameState.currentInput = '0';
        }
        updateModalDisplay();
    }

    function switchMode(mode) {
        gameState.inputMode = mode;
        if (mode === 'penalty') {
            penaltyBtn.classList.add('active');
            rewardBtn.classList.remove('active');
        } else {
            penaltyBtn.classList.remove('active');
            rewardBtn.classList.add('active');
        }
    }

    function saveScore() {
        const value = parseInt(gameState.currentInput);
        if (isNaN(value) || value === 0) {
            closePlayerModal();
            return;
        }

        const player = gameState.players.find(p => p.id === gameState.activePlayerId);

        const entry = {
            timestamp: Date.now(),
            value: value,
            type: gameState.inputMode,
            round: gameState.round
        };

        player.history.push(entry);
        recalculatePlayerScore(player);

        updateUI();
        saveState();
        closePlayerModal();

        // Animation
        const card = document.querySelector(`.player-card[data-player-id="${gameState.activePlayerId}"]`);
        if (card) {
            card.style.transform = card.style.transform + ' scale(1.05)';
            setTimeout(() => {
                card.style.transform = card.style.transform.replace(' scale(1.05)', '');
            }, 200);
        }
    }

    // --- Delegate Event Listeners (More robust) ---

    // Header controls
    if (nextRoundBtn) nextRoundBtn.addEventListener('click', nextRound);
    if (resetBtn) resetBtn.addEventListener('click', resetGame);
    if (prevRoundBtn) prevRoundBtn.addEventListener('click', () => changeViewedRound(-1));
    if (nextRoundNavBtn) nextRoundNavBtn.addEventListener('click', () => changeViewedRound(1));
    if (allHistoryBtn) allHistoryBtn.addEventListener('click', openGlobalHistoryModal);
    if (finishGameBtn) finishGameBtn.addEventListener('click', finishGame);

    // Modal controls
    if (closeModal) closeModal.addEventListener('click', closePlayerModal);
    if (closeGlobalModal) closeGlobalModal.addEventListener('click', closeGlobalHistoryModal);
    if (closePastModal) closePastModal.addEventListener('click', closePastRoundModal);
    if (closeResultsBtn) closeResultsBtn.addEventListener('click', closeResultsModal);
    if (newGameBtn) newGameBtn.addEventListener('click', () => {
        closeResultsModal();
        resetGame();
    });
    if (penaltyBtn) penaltyBtn.addEventListener('click', () => switchMode('penalty'));
    if (rewardBtn) rewardBtn.addEventListener('click', () => switchMode('reward'));
    if (saveScoreBtn) saveScoreBtn.addEventListener('click', saveScore);
    if (clearBtn) clearBtn.addEventListener('click', handleClear);
    if (backspaceBtn) backspaceBtn.addEventListener('click', handleBackspace);
    if (doubleZeroBtn) doubleZeroBtn.addEventListener('click', () => {
        if (gameState.currentInput === '0') return; // don't add 00 to a bare zero
        if (gameState.currentInput.length < 5) {
            gameState.currentInput += '00';
            updateModalDisplay();
        }
    });

    // Prevent double-tap zoom on all numpad buttons
    document.querySelectorAll('.num-btn, .type-btn, .btn-save').forEach(btn => {
        btn.style.touchAction = 'manipulation';
    });

    numButtons.forEach(btn => {
        btn.addEventListener('click', () => handleNumClick(btn.dataset.val));
    });

    // Body delegation for cards and edit buttons
    document.addEventListener('click', (e) => {
        // Edit name button
        const editBtn = e.target.closest('.edit-name-btn');
        if (editBtn) {
            e.stopPropagation();
            const id = parseInt(editBtn.dataset.playerId);
            editPlayerName(id);
            return;
        }

        // Card click
        const card = e.target.closest('.player-card');
        if (card) {
            const id = parseInt(card.dataset.playerId);
            openPlayerModal(id);
            return;
        }

        // Close modal on overlay click
        if (e.target === modalOverlay) {
            closePlayerModal();
        }
        if (e.target === globalHistoryModal) {
            closeGlobalHistoryModal();
        }
        if (e.target === pastRoundModal) {
            closePastRoundModal();
        }
        if (e.target === resultsModal) {
            closeResultsModal();
        }
    });

    // Capture and Share Logic
    if (shareResultBtn) {
        shareResultBtn.addEventListener('click', async () => {
            const resultsContent = document.querySelector('.results-content');
            if (!resultsContent) {
                console.error("Results content not found for sharing");
                return;
            }

            // Temporarily hide elements we don't want in the screenshot
            const actionsDiv = document.querySelector('.results-actions');
            const closeBtn = document.getElementById('closeResultsModal');
            if (actionsDiv) actionsDiv.style.visibility = 'hidden';
            if (closeBtn) closeBtn.style.visibility = 'hidden';

            // Change Share button text to indicate loading
            const originalText = shareResultBtn.innerHTML;
            shareResultBtn.innerHTML = 'Hazırlanıyor...';

            // Wait a tiny bit for the DOM changes (visibility) to apply
            await new Promise(resolve => setTimeout(resolve, 150));

            try {
                const canvas = await html2canvas(resultsContent, {
                    backgroundColor: '#ffffff', // High-contrast for sharing
                    scale: 3, // Higher resolution for crisp text
                    useCORS: true,
                    logging: true,
                    onclone: (clonedDoc) => {
                        const clonedContent = clonedDoc.querySelector('.results-content');
                        if (clonedContent) {
                            // 1. Force Solid Base Theme
                            clonedContent.style.setProperty('background', '#ffffff', 'important');
                            clonedContent.style.setProperty('color', '#000000', 'important');
                            clonedContent.style.setProperty('opacity', '1', 'important');
                            clonedContent.style.setProperty('filter', 'none', 'important');
                            clonedContent.style.setProperty('backdrop-filter', 'none', 'important');
                            clonedContent.style.setProperty('border', '1px solid #e2e8f0', 'important');
                            clonedContent.style.setProperty('border-radius', '0', 'important');
                            clonedContent.style.setProperty('transform', 'none', 'important');
                            clonedContent.style.setProperty('animation', 'none', 'important');

                            // 2. Clear Header Interference (Gradients and Text Masks)
                            const congrats = clonedContent.querySelector('.congrats-text');
                            if (congrats) {
                                congrats.style.setProperty('color', '#1e1b4b', 'important');
                                congrats.style.setProperty('-webkit-text-fill-color', '#1e1b4b', 'important');
                                congrats.style.setProperty('background', 'transparent', 'important');
                                congrats.style.setProperty('-webkit-background-clip', 'padding-box', 'important');
                                congrats.style.setProperty('text-shadow', 'none', 'important');
                                congrats.style.setProperty('font-size', '42px', 'important');
                                congrats.style.setProperty('opacity', '1', 'important');
                                congrats.style.setProperty('animation', 'none', 'important');
                            }

                            const trophy = clonedContent.querySelector('.winner-trophy');
                            if (trophy) {
                                trophy.style.setProperty('animation', 'none', 'important');
                                trophy.style.setProperty('transform', 'none', 'important');
                            }

                            const winnerName = clonedContent.querySelector('.winner-name');
                            if (winnerName) {
                                winnerName.style.setProperty('color', '#000000', 'important');
                                winnerName.style.setProperty('font-size', '32px', 'important');
                                winnerName.style.setProperty('opacity', '1', 'important');
                            }

                            const winnerLabel = clonedContent.querySelector('.winner-label');
                            if (winnerLabel) {
                                winnerLabel.style.setProperty('color', '#6b7280', 'important');
                                winnerLabel.style.setProperty('font-weight', '700', 'important');
                                winnerLabel.style.setProperty('opacity', '1', 'important');
                            }

                            // 3. Clear Rank Item Opacity and Gradients
                            const rankItems = clonedContent.querySelectorAll('.rank-item');
                            rankItems.forEach((item, idx) => {
                                item.style.setProperty('background', '#f8fafc', 'important');
                                item.style.setProperty('border', '1px solid #e2e8f0', 'important');
                                item.style.setProperty('color', '#000000', 'important');
                                item.style.setProperty('transform', 'none', 'important');
                                item.style.setProperty('opacity', '1', 'important');
                                item.style.setProperty('animation', 'none', 'important');
                                
                                const num = item.querySelector('.rank-num');
                                if (num) num.style.setProperty('color', idx === 0 ? '#b45309' : '#6b7280', 'important');

                                const name = item.querySelector('.rank-name');
                                if (name) name.style.setProperty('color', '#000000', 'important');

                                const score = item.querySelector('.rank-score');
                                if (score) score.style.setProperty('color', idx === 0 ? '#16a34a' : '#000000', 'important');
                            });

                            // Winner Highlighting
                            if (rankItems[0]) {
                                rankItems[0].style.setProperty('border', '2px solid #16a34a', 'important');
                                rankItems[0].style.setProperty('background', '#f0fdf4', 'important');
                                rankItems[0].style.setProperty('transform', 'scale(1)', 'important');
                            }
                        }
                    }
                });

                // Restore hidden elements
                if (actionsDiv) actionsDiv.style.visibility = 'visible';
                if (closeBtn) closeBtn.style.visibility = 'visible';
                shareResultBtn.innerHTML = originalText;

                canvas.toBlob(async (blob) => {
                    const file = new File([blob], 'cetele-sonuclar.png', { type: 'image/png' });

                    // Only try Web Share API if Mobile/Supported
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android/i.test(navigator.userAgent)) {
                        try {
                            await navigator.share({
                                title: 'Cetele - Oyun Sonucu',
                                text: 'İşte oyunumuzun sonuçları! 🏆',
                                files: [file]
                            });
                        } catch (err) {
                            console.log('Share API failed or user cancelled:', err);
                            fallbackDownload(blob);
                        }
                    } else {
                        // Fallback: direct download for Desktop
                        fallbackDownload(blob);
                    }
                }, 'image/png');

            } catch (error) {
                console.error('Error generating screenshot:', error);
                // Restore hidden elements in case of error
                if (actionsDiv) actionsDiv.style.visibility = 'visible';
                if (closeBtn) closeBtn.style.visibility = 'visible';
                shareResultBtn.innerHTML = originalText;
                alert('Görsel oluşturulurken bir hata oluştu: ' + error.message);
            }
        });
    }

    function fallbackDownload(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cetele-sonuclar.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    init();
});
