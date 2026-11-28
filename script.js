const firebaseConfig = { databaseURL: "https://wayki-cacl2.firebaseio.com" };
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const TARGET_SCORE = 7;

// Claves de persistencia en localStorage
const STORAGE_KEYS = {
    skin: '9gemas_selected_skin',
    tcgMode: '9gemas_tcg_mode',
    tcgSubmode: '9gemas_tcg_submode',
    aiTcgMode: '9gemas_ai_tcg_mode',
    toroidalOpt: '9gemas_opt_toroidal',
    diagonalOpt: '9gemas_opt_diagonal',
    onboardingDone: '9gemas_onboarding_done'
};

// Respaldo seguro por si tcg-powers.js no estuviera disponible
const ACTIVE_TCG_GEM_TYPES_LIST = (typeof TCG_GEM_TYPES_LIST !== 'undefined') ? TCG_GEM_TYPES_LIST : [
    { id: 'rojo', name: 'Rubí (Rojo)', short: 'Rubí', icon: '🔴' },
    { id: 'azul', name: 'Zafiro (Azul)', short: 'Zafiro', icon: '🔵' },
    { id: 'amarillo', name: 'Topacio (Amarillo)', short: 'Topacio', icon: '🟡' },
    { id: 'verde', name: 'Esmeralda (Verde)', short: 'Esmeralda', icon: '🟢' },
    { id: 'naranja', name: 'Ámbar (Naranja)', short: 'Ámbar', icon: '🟠' },
    { id: 'violeta', name: 'Amatista (Violeta)', short: 'Amatista', icon: '🟣' },
    { id: 'blanco', name: 'Diamante (Blanco)', short: 'Diamante', icon: '⚪' },
    { id: 'negro', name: 'Ónix (Negro)', short: 'Ónix', icon: '⚫' },
    { id: 'marron', name: 'Cuarzo (Marrón)', short: 'Cuarzo', icon: '🟤' }
];

const ACTIVE_TCG_CATALOG_VERSION = (typeof TCG_CATALOG_VERSION !== 'undefined') ? TCG_CATALOG_VERSION : 'default-v1';

// Diccionario detallado de poderes TCG para visualización en mano, tablero y modal
const TCG_POWER_METADATA = {
    'rojo': {
        shortName: 'Rubí',
        icon: '🔴',
        desc: 'Permanente (si se cumple la condición): otorga +1⚡ la primera vez que ataques con éxito en cada turno.'
    },
    'azul': {
        shortName: 'Zafiro',
        icon: '🔵',
        desc: 'Permanente (si se cumple la condición): otorga +1⚡ la primera vez que robes una carta en cada turno.'
    },
    'amarillo': {
        shortName: 'Topacio',
        icon: '🟡',
        desc: 'Permanente (si se cumple la condición): otorga +1⚡ la primera vez que recuperes cartas del descarte en cada turno.'
    },
    'verde': {
        shortName: 'Esmeralda',
        icon: '🟢',
        desc: 'Al desplegarse (si se cumple la condición): recupera hasta 2 cartas del descarte al mazo, roba 1 carta y descarta 1 al azar de la mano rival.'
    },
    'naranja': {
        shortName: 'Ámbar',
        icon: '🟠',
        desc: 'Permanente (si se cumple la condición): tu energía máxima pasa a ser 4⚡ en lugar de 3⚡ mientras se mantenga.'
    },
    'violeta': {
        shortName: 'Amatista',
        icon: '🟣',
        desc: 'Al desplegarse (si se cumple la condición): otorga +1⚡ inmediato (o +2⚡ si la condición es Amatista).'
    },
    'blanco': {
        shortName: 'Diamante',
        icon: '⚪',
        desc: 'Al desplegarse (si se cumple la condición): vuelve a esta carta invulnerable a ataques hasta el inicio de tu próximo turno.'
    },
    'negro': {
        shortName: 'Ónix',
        icon: '⚫',
        desc: 'Permanente (si se cumple la condición): otorga +1⚡ la primera vez que descartes una carta al rival en cada turno.'
    },
    'marron': {
        shortName: 'Cuarzo',
        icon: '🟤',
        desc: 'Permanente (si se cumple la condición): iguala todos los lados de tus cartas al mayor valor propio de cada una.'
    },
    'jump_reveal_gem': {
        shortName: 'Explorador',
        icon: '🧭',
        desc: 'Sin condición. Al jugarse, si la gema indicada está libre en el tablero, salta a ella y la revela si estaba oculta.'
    },
    'refund_energy_1': {
        shortName: 'Chispa',
        icon: '⚡',
        desc: 'Al desplegarse: si ya controlás la gema indicada al jugarla, recuperás 1⚡.'
    },
    'discount_energy_1': {
        shortName: 'Filo',
        icon: '🗡️',
        desc: 'Al desplegarse: cuesta 1⚡ menos (1⚡ total) si ya controlás la gema indicada.'
    }
};

function getTCGGemMeta(gemId) {
    return TCG_POWER_METADATA[gemId] || { shortName: gemId || 'Sin poder', icon: '✨', desc: 'Sin poder especial.' };
}

function getCardTCGShortPillHTML(card) {
    if (!card || !card.powerEffect || card.powerEffect === 'none') return '';
    const effMeta = getTCGGemMeta(card.powerEffect);
    if (card.powerEffect === 'jump_reveal_gem' || card.powerEffect === 'refund_energy_1' || card.powerEffect === 'discount_energy_1') {
        const targetMeta = card.targetGemId ? getTCGGemMeta(card.targetGemId) : null;
        return targetMeta ? `${effMeta.icon} ${effMeta.shortName} (${targetMeta.icon})` : `${effMeta.icon} ${effMeta.shortName}`;
    }
    const hasCond = card.powerCondition && card.powerCondition !== 'none';
    const condLabel = hasCond ? getTCGGemMeta(card.powerCondition).icon : '✨';
    const effLabel = card.powerEffect === 'blanco'
        ? '🛡️ Invuln.'
        : `${effMeta.icon} ${effMeta.shortName}`;
    return `${condLabel} => ${effLabel}`;
}

function getRequiredGemIdForSelectedCard(card) {
    if (!card || !card.powerEffect || card.powerEffect === 'none') return null;
    if (card.powerEffect === 'jump_reveal_gem') return null;
    if (card.powerEffect === 'refund_energy_1' || card.powerEffect === 'discount_energy_1') {
        return (card.powerCondition && card.powerCondition !== 'none') ? card.powerCondition : card.targetGemId;
    }
    if (card.powerCondition && card.powerCondition !== 'none') {
        return card.powerCondition;
    }
    return null;
}

function isBoardCellMatchingSelectedCardCondition(cell, selectedHandCard, activePlayer) {
    if (!cell || !cell.gemRevealed || !selectedHandCard) return false;
    if (cell.owner !== activePlayer) return false;
    const reqGemId = getRequiredGemIdForSelectedCard(selectedHandCard);
    if (!reqGemId) return false;
    if (reqGemId === 'any') return true;
    return cell.gemRevealed.id === reqGemId;
}

function applyConditionGlowStyle(div, isCondMatch) {
    if (!div) return;
    if (isCondMatch) {
        div.style.borderColor = '#facc15';
        div.style.boxShadow = '0 0 0 2px rgba(250, 204, 21, 0.95), 0 0 14px rgba(250, 204, 21, 0.75)';
    } else {
        div.style.borderColor = '';
        div.style.boxShadow = '';
    }
}

function isCardTCGConditionMetNow(card, player) {
    if (!card || !card.powerEffect || card.powerEffect === 'none') return false;
    if (card.powerEffect === 'jump_reveal_gem') return true;
    if (typeof evaluateTCGCondition === 'function') {
        const condToCheck = (card.powerEffect === 'refund_energy_1' || card.powerEffect === 'discount_energy_1')
            ? (card.powerCondition || card.targetGemId)
            : card.powerCondition;
        return evaluateTCGCondition(condToCheck, player, { board, hands, decks, discards });
    }
    if (!card.powerCondition || card.powerCondition === 'none' || card.powerCondition === 'any') return true;
    return hasPlayerControlledGem(player, card.powerCondition);
}

function getSelectedCardStatusTag(card, player) {
    if (!card || !card.powerEffect || card.powerEffect === 'none') return '';
    const playCost = getCardPlayEnergyCost(card, player);
    const baseCost = typeof card.energyCost === 'number' ? card.energyCost : 2;
    const hasDiscount = playCost < baseCost;
    const condMet = isCardTCGConditionMetNow(card, player);

    if (hasDiscount) return ' • 🔥 Activa';
    if (condMet) return ' • ⚡ Lista';
    return '';
}

function showCardTCGDetails(card, locationType, player, boardIdx) {
    if (!card) return;
    playSound('click');
    triggerVibrate(20);

    const hasPower = card.powerEffect && card.powerEffect !== 'none';
    const effMeta = getTCGGemMeta(card.powerEffect);
    const condMeta = (card.powerCondition && card.powerCondition !== 'none') ? getTCGGemMeta(card.powerCondition) : null;
    const targetGemMeta = card.targetGemId ? getTCGGemMeta(card.targetGemId) : null;

    const badgeEl = document.getElementById('tcg-modal-badge');
    const ownerEl = document.getElementById('tcg-modal-owner');
    const previewEl = document.getElementById('tcg-modal-card-preview');
    const topEl = document.getElementById('tcg-pv-top');
    const bottomEl = document.getElementById('tcg-pv-bottom');
    const leftEl = document.getElementById('tcg-pv-left');
    const rightEl = document.getElementById('tcg-pv-right');
    const gemIconEl = document.getElementById('tcg-pv-gem-icon');
    const baseEl = document.getElementById('tcg-pv-base');
    const titleEl = document.getElementById('tcg-modal-title');
    const statusPillEl = document.getElementById('tcg-modal-status-pill');
    const condEl = document.getElementById('tcg-modal-cond');
    const descEl = document.getElementById('tcg-modal-desc');

    if (badgeEl) badgeEl.innerText = locationType === 'board' ? '⚔️ Carta en Tablero' : '🎴 Carta en Mano';
    if (ownerEl) {
        ownerEl.innerText = player === 'red' ? '🔴 Jugador Rojo' : (gameMode === 'ai' ? '🤖 IA (Azul)' : '🔵 Jugador Azul');
    }

    if (previewEl) {
        previewEl.className = `tcg-preview-card ${player === 'blue' ? 'blue' : 'red'}`;
    }

    const displayVals = (locationType === 'board' && typeof boardIdx === 'number' && board[boardIdx])
        ? getEffectiveCardValues(boardIdx)
        : card;

    if (topEl) {
        topEl.innerText = displayVals.top;
        topEl.classList.toggle('weak', card.specialDir === 'top');
    }
    if (bottomEl) {
        bottomEl.innerText = displayVals.bottom;
        bottomEl.classList.toggle('weak', card.specialDir === 'bottom');
    }
    if (leftEl) {
        leftEl.innerText = displayVals.left;
        leftEl.classList.toggle('weak', card.specialDir === 'left');
    }
    if (rightEl) {
        rightEl.innerText = displayVals.right;
        rightEl.classList.toggle('weak', card.specialDir === 'right');
    }

    if (gemIconEl) {
        const isClassic = document.body.classList.contains('skin-classic');
        const iconId = (card.powerEffect === 'jump_reveal_gem' || card.powerEffect === 'refund_energy_1' || card.powerEffect === 'discount_energy_1')
            ? (card.targetGemId || (card.gemRevealed ? card.gemRevealed.id : null))
            : (hasPower ? card.powerEffect : (card.gemRevealed ? card.gemRevealed.id : null));
        if (iconId) {
            gemIconEl.innerHTML = isClassic
                ? `<span style="font-size: 1.8rem;">${GEM_CLASSIC_ICONS[iconId] || '💎'}</span>`
                : (GEM_SVGS[iconId] || '');
        } else {
            gemIconEl.innerHTML = `<span style="font-size: 1.5rem;">💎</span>`;
        }
    }

    if (baseEl) baseEl.innerText = `Base ${card.val || Math.max(card.top, card.bottom, card.left, card.right)}`;

    if (!hasPower) {
        if (titleEl) titleEl.innerText = 'Carta Estándar';
        if (statusPillEl) {
            statusPillEl.innerText = '⚡ Sin poder TCG asignado';
            statusPillEl.classList.add('inactive');
        }
        if (condEl) condEl.innerText = 'Ninguna';
        if (descEl) descEl.innerText = 'Esta carta pertenece al mazo estándar y combate únicamente con sus valores numéricos.';
    } else if (card.powerEffect === 'jump_reveal_gem') {
        const gName = targetGemMeta ? `${targetGemMeta.icon} ${targetGemMeta.shortName}` : 'gema objetivo';
        if (titleEl) titleEl.innerText = `Explorador de ${targetGemMeta ? targetGemMeta.shortName : 'Gema'}`;
        if (condEl) condEl.innerText = '✨ Sin condición (salto al desplegar)';
        if (statusPillEl) {
            statusPillEl.innerText = locationType === 'hand'
                ? `🧭 Salta a ${gName} si está libre al jugar`
                : '🧭 Carta Explorador desplegada';
            statusPillEl.classList.toggle('inactive', locationType === 'board');
        }
        if (descEl) {
            descEl.innerText = `Sin condición. Al jugar, si ${gName} está libre en el tablero, salta a ella y la revela si estaba oculta.`;
        }
    } else if (card.powerEffect === 'refund_energy_1') {
        const reqMeta = condMeta || targetGemMeta;
        const gName = reqMeta ? `${reqMeta.icon} ${reqMeta.shortName}` : 'la gema indicada';
        if (titleEl) titleEl.innerText = `Chispa de ${reqMeta ? reqMeta.shortName : 'Gema'}`;
        if (condEl) condEl.innerText = reqMeta ? `${reqMeta.icon} Controlar ${reqMeta.shortName}` : 'Gema indicada';
        if (statusPillEl) {
            const ready = isCardTCGConditionMetNow(card, player);
            statusPillEl.innerText = locationType === 'hand'
                ? (ready ? '✅ Condición cumplida: recuperás +1⚡ al jugar' : `🔒 Requiere controlar ${gName} al jugar`)
                : '⚡ Carta Chispa desplegada';
            statusPillEl.classList.toggle('inactive', locationType === 'board' || !ready);
        }
        if (descEl) {
            descEl.innerText = `Cuesta 1⚡. Si ya controlás ${gName} al jugarla, recuperás 1⚡.`;
        }
    } else if (card.powerEffect === 'discount_energy_1') {
        const reqMeta = condMeta || targetGemMeta;
        const gName = reqMeta ? `${reqMeta.icon} ${reqMeta.shortName}` : 'la gema indicada';
        if (titleEl) titleEl.innerText = `Filo de ${reqMeta ? reqMeta.shortName : 'Gema'}`;
        if (condEl) condEl.innerText = reqMeta ? `${reqMeta.icon} Controlar ${reqMeta.shortName}` : 'Gema indicada';
        if (statusPillEl) {
            const ready = isCardTCGConditionMetNow(card, player);
            statusPillEl.innerText = locationType === 'hand'
                ? (ready ? '✅ Descuento activo: cuesta 1⚡ en vez de 2⚡' : `🔒 Requiere controlar ${gName} para descuento`)
                : '🗡️ Carta Filo desplegada';
            statusPillEl.classList.toggle('inactive', locationType === 'board' || !ready);
        }
        if (descEl) {
            descEl.innerText = `Cuesta 1⚡ menos (1⚡ total) si ya controlás ${gName}.`;
        }
    } else {
        const effTitleLabel = card.powerEffect === 'blanco' ? '🛡️ Invuln.' : `${effMeta.icon} ${effMeta.shortName}`;
        if (titleEl) titleEl.innerText = `Poder: ${effTitleLabel}`;

        let descText = effMeta.desc;
        if (card.powerEffect === 'violeta' && card.powerCondition === 'violeta') {
            descText = 'Al desplegarse otorga +2⚡ inmediatos si se cumple la condición de Amatista.';
        } else if (card.powerEffect === 'marron' && card.powerCondition === 'marron') {
            descText = 'Al desplegarse otorga +1 en todos los lados a esta carta y a tus cartas adyacentes hasta el inicio de tu próximo turno.';
        } else if (card.powerEffect === 'marron') {
            descText = 'Permanente (mientras se cumpla la condición): iguala todos los lados de tus cartas al mayor valor propio de cada una.';
        }

        if (condEl) {
            condEl.innerText = condMeta ? `${condMeta.icon} Controlar ${condMeta.shortName}` : '✨ Sin condición (siempre activa)';
        }

        if (statusPillEl) {
            if (locationType === 'hand') {
                const ready = isCardTCGConditionMetNow(card, player);
                statusPillEl.innerText = ready
                    ? '✅ Condición cumplida: se activará al desplegar'
                    : `🔒 Requiere cumplir condición (${condMeta ? condMeta.shortName : 'gema'})`;
                statusPillEl.classList.toggle('inactive', !ready);
            } else {
                const hasOngoingEffect = Boolean(
                    card.hasTCGRubyEffect ||
                    card.hasTCGZafiroEffect ||
                    card.hasTCGTopacioEffect ||
                    card.hasTCGOnixEffect ||
                    card.hasTCGAmberEffect ||
                    card.hasTCGQuartzEffect ||
                    card.diamondTempShield
                );
                if (hasOngoingEffect) {
                    statusPillEl.innerText = '🔥 Efecto activo en el tablero';
                    statusPillEl.classList.remove('inactive');
                } else {
                    statusPillEl.innerText = '🎴 Carta TCG desplegada';
                    statusPillEl.classList.add('inactive');
                }
            }
        }

        if (descEl) descEl.innerText = descText;
    }

    const modal = document.getElementById('card-tcg-modal');
    if (modal) modal.style.display = 'flex';
}

function closeCardTCGModal() {
    playSound('click');
    const modal = document.getElementById('card-tcg-modal');
    if (modal) modal.style.display = 'none';
}

let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function isSoundEnabled() {
    const chk = document.getElementById('check-sound');
    return chk ? chk.checked : true;
}

function isHapticEnabled() {
    const chk = document.getElementById('check-haptic');
    return chk ? chk.checked : false;
}

function isTCGModeEnabled() {
    const chk = document.getElementById('check-tcg-mode');
    return chk ? chk.checked : false;
}

function isAITCGModeEnabled() {
    const chk = document.getElementById('check-ai-tcg-mode');
    return chk ? chk.checked : false;
}

function getTCGSubmode() {
    const sel = document.getElementById('select-tcg-submode');
    const raw = sel ? sel.value : localStorage.getItem(STORAGE_KEYS.tcgSubmode);
    return raw === 'custom' ? 'custom' : 'preset';
}

function getTCGSaveStorageKey(player, submode = getTCGSubmode()) {
    return submode === 'custom'
        ? `9gemas_tcg_deck_custom_${player}`
        : `9gemas_tcg_deck_preset_${player}`;
}

function isToroidalOptionEnabled() {
    const chk = document.getElementById('check-opt-toroidal');
    if (chk) return chk.checked;
    return localStorage.getItem(STORAGE_KEYS.toroidalOpt) === 'true';
}

function isDiagonalOptionEnabled() {
    const chk = document.getElementById('check-opt-diagonal');
    if (chk) return chk.checked;
    return localStorage.getItem(STORAGE_KEYS.diagonalOpt) === 'true';
}

let prevToroidalBeforeTutorial = false;
let prevDiagonalBeforeTutorial = false;

function enableSpecialAttackModesForTutorial() {
    const chkTor = document.getElementById('check-opt-toroidal');
    const chkDiag = document.getElementById('check-opt-diagonal');
    prevToroidalBeforeTutorial = chkTor
        ? Boolean(chkTor.checked)
        : localStorage.getItem(STORAGE_KEYS.toroidalOpt) === 'true';
    prevDiagonalBeforeTutorial = chkDiag
        ? Boolean(chkDiag.checked)
        : localStorage.getItem(STORAGE_KEYS.diagonalOpt) === 'true';

    localStorage.setItem(STORAGE_KEYS.toroidalOpt, 'true');
    localStorage.setItem(STORAGE_KEYS.diagonalOpt, 'true');
    if (chkTor) chkTor.checked = true;
    if (chkDiag) chkDiag.checked = true;
}

function restoreSpecialAttackModesAfterTutorial() {
    const torVal = Boolean(prevToroidalBeforeTutorial);
    const diagVal = Boolean(prevDiagonalBeforeTutorial);

    localStorage.setItem(STORAGE_KEYS.toroidalOpt, String(torVal));
    localStorage.setItem(STORAGE_KEYS.diagonalOpt, String(diagVal));

    const chkTor = document.getElementById('check-opt-toroidal');
    const chkDiag = document.getElementById('check-opt-diagonal');
    if (chkTor) chkTor.checked = torVal;
    if (chkDiag) chkDiag.checked = diagVal;

    if (!torVal) isMapamundiActive = false;
    if (!diagVal) isDiagonalActive = false;
}

function isTutorialSpecialModeLocked() {
    return isTutorialSession && turn === 'red' && tutorialTurnCount <= 2;
}

function advanceTutorialOnSpecialActivation(activatedMode) {
    if (!isTutorialSession || turn !== 'red' || tutorialTurnCount < 3) return;
    if (activatedMode === 'toroidal' && tutorialStep === 8) {
        tutorialStep = 9;
    } else if (activatedMode === 'diagonal' && tutorialStep === 9) {
        tutorialStep = 10;
        tutorialTurn3DoneWaitingNextTurn = true;
    }
}

function triggerVibrate(pattern) {
    if (!isHapticEnabled()) return;
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

function playSound(type) {
    if (!isSoundEnabled()) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (type === 'click') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.05);
        } else if (type === 'fly') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.15);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'hit') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.12);
        } else if (type === 'win') {
            const notes = [261.63, 329.63, 392.00, 523.25];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.1);
                gain.gain.setValueAtTime(0.2, now + idx * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(now + idx * 0.1);
                osc.stop(now + idx * 0.1 + 0.3);
            });
        }
    } catch (e) { console.error(e); }
}

const GEM_SVGS = {
    'rojo': `<svg class="gem-svg" viewBox="0 0 24 24"><path fill="#ffe4e6" d="M12 2L6 8h12l-6-6z"/><path fill="#f43f5e" d="M2 8l10 14L6 8H2z"/><path fill="#e11d48" d="M22 8l-10 14 6-14h4z"/><path fill="#ffffff" opacity="0.8" d="M12 2l6 6H6l6-6z"/><path fill="#be123c" d="M6 8l6 14 6-14H6z"/></svg>`,
    'azul': `<svg class="gem-svg" viewBox="0 0 24 24"><path fill="#e0f2fe" d="M12 2L5 8h14l-7-6z"/><path fill="#38bdf8" d="M1 8l11 14L5 8H1z"/><path fill="#0284c7" d="M23 8l-11 14 6-14h5z"/><path fill="#ffffff" opacity="0.85" d="M12 2l7 6H5l7-6z"/><path fill="#0369a1" d="M5 8l7 14 7-14H5z"/></svg>`,
    'amarillo': `<svg class="gem-svg" viewBox="0 0 24 24"><path fill="#fef08a" d="M12 2l9 4v12l-9 4-9-4V6l9-4zm0 2.8L5 7.5v9l7 3.1 7-3.1v-9l-7-2.7z"/><path fill="#ca8a04" d="M3 6l9 14V7.5z"/><path fill="#fde047" d="M12 2v5.5h9z"/></svg>`,
    'verde': `<svg class="gem-svg" viewBox="0 0 24 24"><path fill="#dcfce7" d="M5 3h14l4 6-11 13L1 9l4-6zm7 2.2L4 9h16l-8-3.8z"/><path fill="#15803d" d="M1 9l11 13V9H1z"/><path fill="#4ade80" d="M12 3v6h8z"/></svg>`,
    'naranja': `<svg class="gem-svg" viewBox="0 0 24 24"><path fill="#ffedd5" d="M12 2L3 8l9 14 9-14-9-6zm0 3.5l5.5 3.7H6.5L12 5.5z"/><path fill="#ea580c" d="M3 8l9 14V9.2z"/><path fill="#f97316" d="M12 2v7.2h6.5z"/></svg>`,
    'violeta': `<svg class="gem-svg" viewBox="0 0 24 24"><path fill="#f3e8ff" d="M12 2l8 5-3 13H7L4 7l8-5zm0 3L6 8h12l-6-3z"/><path fill="#6b21a8" d="M4 7l3 13 5-12z"/><path fill="#c084fc" d="M12 2v8h8z"/></svg>`,
    'blanco': `<svg class="gem-svg" viewBox="0 0 24 24"><path fill="#ffffff" d="M12 2L2 9l10 13L22 9 12 2zm0 2.5l6.5 5H5.5L12 4.5z"/><path fill="#94a3b8" d="M2 9l10 13V9.5z"/><path fill="#f8fafc" d="M12 2v7.5h6.5z"/></svg>`,
    'negro': `<svg class="gem-svg" viewBox="0 0 24 24"><path fill="#475569" d="M12 2L2 9l10 13L22 9 12 2zm0 2.5l6.5 5H5.5L12 4.5z"/><path fill="#000000" d="M2 9l10 13V9.5z"/><path fill="#0f172a" d="M12 2v7.5h6.5z"/><path fill="#94a3b8" opacity="0.6" d="M12 4.5l6.5 4.5H12z"/></svg>`,
    'marron': `<svg class="gem-svg" viewBox="0 0 24 24"><path fill="#fed7aa" d="M6 2h12l5 6-11 14L1 8l5-6zm6 2.5L3.8 8h16.4L12 4.5z"/><path fill="#1c0a00" d="M1 8l11 14V8H1z"/><path fill="#582307" d="M12 2v6h8.2z"/></svg>`
};

const GEM_CLASSIC_ICONS = {
    'rojo': '🔴', 'azul': '🔵', 'amarillo': '🟡',
    'verde': '🟢', 'naranja': '🟠', 'violeta': '🟣',
    'blanco': '⚪', 'negro': '⚫', 'marron': '🟤'
};

const GEM_TYPES = [
    { id: 'rojo', name: 'Rubí', pts: 1, type: 'primary', desc: '+1⚡ al atacar' },
    { id: 'azul', name: 'Zafiro', pts: 1, type: 'primary', desc: '+1⚡ al robar' },
    { id: 'amarillo', name: 'Topacio', pts: 1, type: 'primary', desc: '+1⚡ al recup.' },
    { id: 'verde', name: 'Esmeralda', pts: 1, type: 'secondary', desc: 'Recupera y roba' },
    { id: 'naranja', name: 'Ámbar', pts: 1, type: 'secondary', desc: 'Max 4⚡ energía' },
    { id: 'violeta', name: 'Amatista', pts: 2, type: 'secondary', desc: '+1⚡ jugar/0⚡ ver' },
    { id: 'blanco', name: 'Diamante', pts: 0, protected: true, type: 'special', desc: 'Protegida/x2 stats' },
    { id: 'negro', name: 'Ónix', pts: 1, type: 'special', desc: '+1⚡ descartar' },
    { id: 'marron', name: 'Cuarzo', pts: 1, type: 'special', desc: 'Iguala al mayor' }
];

let gameMode = 'online';
let aiDifficulty = 'normal';
let myRole = null;
let currentRoomCode = null;
let roomRef = null;
let isSyncing = false;

let board = Array(9).fill(null);
let newlyDeployedCellIndex = null;
let revealedBoardGems = Array(9).fill(false);
let gems = [];
let turn = 'red';
let lastTurnNotified = null;

let currentEnergy = 3;
let previousEnergy = 3;
let maxEnergy = 3;

let isMapamundiActive = false;
let isDiagonalActive = false;

let usedRedEnergyBonusThisTurn = false;
let usedBlueEnergyBonusThisTurn = false;
let usedYellowEnergyBonusThisTurn = false;
let usedBlackEnergyBonusThisTurn = false;

let isInspectMode = false;
let actionLogHistory = [];

let selectedCard = null;
let selectedHandIndex = null;
let selectedBoardIndex = null;
let hands = { red: [], blue: [] };
let decks = { red: [], blue: [] };
let discards = { red: [], blue: [] };

let newlyDrawnCardIndex = { red: null, blue: null };
let discardingCardInfo = { player: null, cardIndex: null };

let lastComboSignatures = { red: "", blue: "" };
let comboFlashTriggers = { red: true, blue: true };

// --- MODO TUTORIAL JUGADA POR JUGADA ---
let isTutorialSession = false;
let tutorialStep = 0;
let tutorialTurnCount = 1;
let didStepTwoAttack = false;
let tutorialTurn2DoneWaitingNextTurn = false;
let tutorialTurn3DoneWaitingNextTurn = false;
let coachmarkSequenceTimer = null;

function isOnboardingDismissed() {
    return !isTutorialSession && localStorage.getItem(STORAGE_KEYS.onboardingDone) === 'true';
}

function isTutorialSideActionLocked() {
    if (!isTutorialSession || turn !== 'red') return false;
    if (tutorialStep === 0 || tutorialStep === 1 || tutorialStep === 2 || tutorialStep === 3) return true;
    return false;
}

function finishTutorialSessionWithNotice() {
    isTutorialSession = false;
    tutorialStep = 0;
    tutorialTurnCount = 1;
    didStepTwoAttack = false;
    tutorialTurn2DoneWaitingNextTurn = false;
    tutorialTurn3DoneWaitingNextTurn = false;
    localStorage.setItem(STORAGE_KEYS.onboardingDone, 'true');

    restoreSpecialAttackModesAfterTutorial();
    clearCoachmarkHighlights();

    const bubble = document.getElementById('coachmark-bubble');
    if (bubble) bubble.classList.add('hidden');

    const finishMsg = "✅ ¡Tutorial completado! Podés volver a iniciarlo cuando quieras desde Configuración (⚙️).";
    actionLogHistory.unshift(finishMsg);
    if (actionLogHistory.length > 15) actionLogHistory.pop();
    const logEl = document.getElementById('log-message');
    if (logEl) logEl.innerText = finishMsg;
    const statusEl = document.getElementById('room-status');
    if (statusEl && gameMode === 'ai') {
        statusEl.innerText = `${getAIStatusLabel()}. Sos ROJO • Tutorial listo en ⚙️.`;
    }
    render();
}

function skipOnboardingCoachmarks() {
    playSound('click');
    finishTutorialSessionWithNotice();
}

function advanceTutorialStepManual() {
    playSound('click');
    triggerVibrate(20);
    if (!isTutorialSession) return;
    if (tutorialStep === 2) {
        tutorialStep = 3;
        renderCoachmarks();
    } else if (tutorialStep >= 4 && tutorialStep <= 6) {
        tutorialStep += 1;
        renderCoachmarks();
    } else if (tutorialStep === 7) {
        tutorialTurn2DoneWaitingNextTurn = true;
        renderCoachmarks();
    } else if (tutorialStep === 8) {
        tutorialStep = 9;
        renderCoachmarks();
    } else if (tutorialStep === 9) {
        tutorialStep = 10;
        tutorialTurn3DoneWaitingNextTurn = true;
        renderCoachmarks();
    } else if (tutorialStep === 10) {
        tutorialStep = 11;
        renderCoachmarks();
    } else if (tutorialStep === 11) {
        tutorialStep = 12;
        renderCoachmarks();
    } else if (tutorialStep === 12) {
        tutorialStep = 13;
        renderCoachmarks();
    } else if (tutorialStep >= 13) {
        finishTutorialSessionWithNotice();
    }
}

function resetOnboardingCoachmarks() {
    playSound('click');
    triggerVibrate(25);
    localStorage.removeItem(STORAGE_KEYS.onboardingDone);
    enableSpecialAttackModesForTutorial();
    isTutorialSession = true;
    tutorialStep = 0;
    tutorialTurnCount = 1;
    didStepTwoAttack = false;
    tutorialTurn2DoneWaitingNextTurn = false;
    tutorialTurn3DoneWaitingNextTurn = false;
    gameMode = 'ai';
    aiDifficulty = 'easy';
    myRole = 'red';
    lastTurnNotified = null;
    actionLogHistory = [];

    const btnOnline = document.getElementById('btn-mode-online');
    const btnAi = document.getElementById('btn-mode-ai');
    if (btnOnline) btnOnline.classList.remove('active');
    if (btnAi) btnAi.classList.add('active');
    const onlineCtrl = document.getElementById('online-controls');
    const aiCtrl = document.getElementById('ai-controls');
    if (onlineCtrl) onlineCtrl.classList.add('hidden');
    if (aiCtrl) aiCtrl.classList.remove('hidden');

    const statusEl = document.getElementById('room-status');
    if (statusEl) statusEl.innerText = `🎓 Modo Tutorial activo vs IA (Sos ROJO).`;

    const tutState = createTutorialGameState();
    applyGameState(tutState);
}

function clearCoachmarkHighlights() {
    if (coachmarkSequenceTimer) {
        clearTimeout(coachmarkSequenceTimer);
        coachmarkSequenceTimer = null;
    }
    document.querySelectorAll('.coachmark-highlight, .coachmark-highlight-pass').forEach(el => {
        el.classList.remove('coachmark-highlight');
        el.classList.remove('coachmark-highlight-pass');
    });
}

function startSequentialCoachmarkHighlight(selectors, stepDelayMs = 480) {
    clearCoachmarkHighlights();
    if (!Array.isArray(selectors) || selectors.length === 0) return;

    const validEls = selectors
        .map(sel => document.querySelector(sel))
        .filter(Boolean);
    if (validEls.length === 0) return;

    if (validEls.length === 1) {
        validEls[0].classList.add('coachmark-highlight');
        return;
    }

    let currentIdx = 0;
    const stepHighlight = () => {
        validEls.forEach(el => el.classList.remove('coachmark-highlight'));
        validEls[currentIdx].classList.add('coachmark-highlight');
        currentIdx = (currentIdx + 1) % validEls.length;
        coachmarkSequenceTimer = setTimeout(stepHighlight, stepDelayMs);
    };

    stepHighlight();
}

function scrollDownToTarget(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function ensureAtLeastOneGemVisibleForTutorial() {
    const hasRevealedGem = board.some((c, idx) => (c && c.gemRevealed) || revealedBoardGems[idx]);
    if (!hasRevealedGem) {
        const targetIdx = board.findIndex(c => c !== null) >= 0 ? board.findIndex(c => c !== null) : 4;
        const g = gems[targetIdx] || GEM_TYPES[0];
        revealedBoardGems[targetIdx] = true;
        if (board[targetIdx] && !board[targetIdx].gemRevealed) {
            board[targetIdx].gemRevealed = g;
        }
    }
}

function hasAnyAttackableEnemyForPlayer(player) {
    const directions = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const realMapamundi = isMapamundiActive;
    const realDiagonal = isDiagonalActive;
    isMapamundiActive = isToroidalOptionEnabled();
    isDiagonalActive = isDiagonalOptionEnabled();

    let found = false;
    for (let idx = 0; idx < 9; idx++) {
        const cell = board[idx];
        if (!cell || cell.owner !== player) continue;
        for (const dir of directions) {
            const targetInfo = getAttackTarget(idx, dir);
            if (!targetInfo || targetInfo.targetIdx === null) continue;
            const defender = board[targetInfo.targetIdx];
            if (defender && defender.owner !== player && !defender.isProtected) {
                found = true;
                break;
            }
        }
        if (found) break;
    }

    isMapamundiActive = realMapamundi;
    isDiagonalActive = realDiagonal;
    return found;
}

function hasOrthogonalAttackableEnemyForPlayer(player) {
    const orthoDirs = ['top', 'bottom', 'left', 'right'];
    for (let idx = 0; idx < 9; idx++) {
        const cell = board[idx];
        if (!cell || cell.owner !== player) continue;
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        for (const dir of orthoDirs) {
            let tRow = row;
            let tCol = col;
            if (dir === 'top') tRow -= 1;
            else if (dir === 'bottom') tRow += 1;
            else if (dir === 'left') tCol -= 1;
            else if (dir === 'right') tCol += 1;
            if (tRow < 0 || tRow > 2 || tCol < 0 || tCol > 2) continue;
            const tIdx = tRow * 3 + tCol;
            const defender = board[tIdx];
            if (defender && defender.owner !== player && !defender.isProtected) {
                return true;
            }
        }
    }
    return false;
}

function renderCoachmarks() {
    const bubble = document.getElementById('coachmark-bubble');
    const badgeEl = document.getElementById('coachmark-step-badge');
    const textEl = document.getElementById('coachmark-text');
    const nextBtn = document.getElementById('btn-next-coachmark');
    clearCoachmarkHighlights();

    if (!bubble || !badgeEl || !textEl) return;
    if (nextBtn) nextBtn.classList.add('hidden');

    if (isOnboardingDismissed()) {
        bubble.classList.add('hidden');
        return;
    }

    const activePlayer = gameMode === 'ai' ? 'red' : (myRole || 'red');
    const isHumanTurn = (gameMode === 'ai' && turn === 'red') || (gameMode === 'online' && myRole && turn === myRole);

    if (!isHumanTurn) {
        bubble.classList.add('hidden');
        return;
    }

    const hasOwnedCardOnBoard = board.some(c => c !== null && c.owner === activePlayer);
    const hasEmptyCell = board.some(c => c === null);
    const hasHandCards = hands[activePlayer] && hands[activePlayer].length > 0;
    const hasEnemyOnBoard = board.some(c => c !== null && c.owner !== activePlayer && !c.isProtected);
    const canAttackNow = currentEnergy >= 1 && hasOwnedCardOnBoard && hasEnemyOnBoard && hasAnyAttackableEnemyForPlayer(activePlayer);

    if (isTutorialSession) {
        if ((tutorialTurn2DoneWaitingNextTurn && tutorialTurnCount === 2) ||
            (tutorialTurn3DoneWaitingNextTurn && tutorialTurnCount === 3)) {
            bubble.classList.add('hidden');
            return;
        }

        if (tutorialStep === 0 && currentEnergy >= 2 && hasHandCards && hasEmptyCell) {
            badgeEl.innerText = 'Tutorial 1/4 • Jugar Carta';
            textEl.innerText = 'Elegí una carta de tu mano y tocá una casilla vacía ortogonal junto a la carta Azul del centro para jugarla (2⚡).';
            bubble.classList.remove('hidden');
            const handEl = document.getElementById(`hand-${activePlayer}`);
            if (handEl) handEl.classList.add('coachmark-highlight');
            return;
        }

        if (tutorialStep === 1 && currentEnergy >= 1 && hasOwnedCardOnBoard && hasOrthogonalAttackableEnemyForPlayer(activePlayer)) {
            badgeEl.innerText = 'Tutorial 2/4 • Atacar Rival';
            textEl.innerText = 'Tocá tu carta Roja en el tablero y elegí la dirección hacia la carta Azul para atacarla (1⚡). Si tu número supera al suyo, la conquistás.';
            bubble.classList.remove('hidden');
            const gridEl = document.getElementById('dynamic-grid');
            if (gridEl) gridEl.classList.add('coachmark-highlight');
            return;
        }

        if (tutorialStep === 2) {
            badgeEl.innerText = 'Tutorial 3/4 • Puntaje y Combos';
            textEl.innerText = didStepTwoAttack
                ? 'Gemas y combos suman hacia la meta (7 pts). Mirá el marcador arriba y tocá "Siguiente".'
                : 'Sin rival ortogonal al lado ahora. Para atacar (1⚡), tocá tu carta y elegí dirección si tu número supera al rival. Mirá puntaje/combos arriba y tocá "Siguiente".';
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            const scoreboardEl = document.querySelector('.scoreboard');
            if (scoreboardEl) {
                scoreboardEl.classList.add('coachmark-highlight');
                scoreboardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
        }

        if (tutorialStep === 3) {
            badgeEl.innerText = 'Tutorial 4/4 • Pasar Turno';
            textEl.innerText = 'Tocá PASAR ⏭️ (resaltado en cian) para ceder el turno y ver las acciones laterales en el próximo turno.';
            bubble.classList.remove('hidden');
            const btnPass = document.getElementById('btn-pass-turn');
            if (btnPass && !btnPass.classList.contains('hidden')) {
                btnPass.classList.add('coachmark-highlight-pass');
                btnPass.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
        }

        if (tutorialStep === 4 && tutorialTurnCount === 2) {
            badgeEl.innerText = 'Turno 2 • Acción 1/4: Robar 1';
            textEl.innerText = 'Robar 1 (1⚡) toma 1 carta del Mazo y la suma a tu Mano. Mirá cómo se iluminan en secuencia y tocá "Siguiente".';
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            startSequentialCoachmarkHighlight(['#btn-action-draw', `#pile-deck-${activePlayer}`, `#hand-${activePlayer}`], 480);
            scrollDownToTarget(document.getElementById('btn-action-draw') || bubble);
            return;
        }

        if (tutorialStep === 5 && tutorialTurnCount === 2) {
            const hasDiscardCards = discards[activePlayer] && discards[activePlayer].length > 0;
            badgeEl.innerText = 'Turno 2 • Acción 2/4: Recup. 2';
            textEl.innerText = hasDiscardCards
                ? 'Recup. 2 (1⚡) mueve cartas de tu Descarte hacia tu Mazo. Mirá el orden iluminado y tocá "Siguiente".'
                : 'Recup. 2 (1⚡) mueve cartas del Descarte al Mazo (ahora no tenés descartes). Tocá "Siguiente".';
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            startSequentialCoachmarkHighlight(['#btn-action-recover', `#pile-discard-${activePlayer}`, `#pile-deck-${activePlayer}`], 480);
            scrollDownToTarget(document.getElementById('btn-action-recover') || bubble);
            return;
        }

        if (tutorialStep === 6 && tutorialTurnCount === 2) {
            const oppPlayer = activePlayer === 'red' ? 'blue' : 'red';
            badgeEl.innerText = 'Turno 2 • Acción 3/4: Descartar Rival';
            textEl.innerText = 'Descartar Rival (1⚡) saca 1 carta de la Mano rival y la envía al Descarte rival. Mirá la secuencia y tocá "Siguiente".';
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            startSequentialCoachmarkHighlight(['#btn-action-discard-opp', `#hand-${oppPlayer}`, `#pile-discard-${oppPlayer}`], 480);
            scrollDownToTarget(document.getElementById('btn-action-discard-opp') || bubble);
            return;
        }

        if (tutorialStep === 7 && tutorialTurnCount === 2) {
            const vCost = hasPlayerControlledGem(activePlayer, 'violeta') ? 0 : 1;
            badgeEl.innerText = 'Turno 2 • Acción 4/4: Ver Gema';
            textEl.innerText = `Ver Gema (${vCost}⚡) revela una gema en el Campo antes de jugar. Tocá "Siguiente" y pasá al Turno 3 para probar los modos especiales.`;
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            startSequentialCoachmarkHighlight(['#btn-action-inspect', '#dynamic-grid'], 520);
            scrollDownToTarget(document.getElementById('btn-action-inspect') || bubble);
            return;
        }

        if (tutorialStep === 8 && tutorialTurnCount === 3) {
            const toroidalOn = isToroidalOptionEnabled();
            badgeEl.innerText = 'Turno 3 • Modo 1/2: Borde Opuesto';
            textEl.innerText = toroidalOn
                ? 'Atq. borde opuesto (1⚡ en el turno) permite atacar atravesando los bordes del tablero (efecto espejo 5x5). Activalo o tocá "Siguiente".'
                : 'Atq. borde opuesto está "Off en ⚙️": si querés probar ataques que cruzan los bordes (1⚡ en el turno), activalo en ⚙️. Tocá "Siguiente".';
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            const btnMap = document.getElementById('btn-action-mapamundi');
            if (btnMap) {
                btnMap.classList.add('coachmark-highlight');
                scrollDownToTarget(btnMap);
            }
            return;
        }

        if (tutorialStep === 9 && tutorialTurnCount === 3) {
            const diagonalOn = isDiagonalOptionEnabled();
            badgeEl.innerText = 'Turno 3 • Modo 2/2: Atq. Diagonal';
            textEl.innerText = diagonalOn
                ? 'Atq. Diagonal (1⚡ en el turno) habilita ataques en las 4 esquinas y muestra los valores diagonales en las celdas. Activalo o tocá "Siguiente" para pasar al Turno 4.'
                : 'Atq. Diagonal está "Off en ⚙️": si querés atacar en diagonal (1⚡ en el turno), activalo en ⚙️. Tocá "Siguiente" para avanzar.';
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            const btnDiag = document.getElementById('btn-action-diagonal');
            if (btnDiag) {
                btnDiag.classList.add('coachmark-highlight');
                scrollDownToTarget(btnDiag);
            }
            return;
        }

        if (tutorialStep === 10 && tutorialTurnCount >= 4) {
            badgeEl.innerText = 'Turno 4 • Gemas 1/2: Descripción Corta';
            textEl.innerText = 'En cada gema revelada ves su descripción corta (puntos, bono de energía o efecto rápido). Mirá el tablero y tocá "Siguiente" para ver la ampliación.';
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            const gridEl = document.getElementById('dynamic-grid');
            if (gridEl) {
                gridEl.classList.add('coachmark-highlight');
                scrollDownToTarget(gridEl);
            }
            return;
        }

        if (tutorialStep === 11 && tutorialTurnCount >= 4) {
            badgeEl.innerText = 'Turno 4 • Gemas 2/2: Ampliación (ℹ️)';
            textEl.innerText = 'Tocá el ícono ℹ️ de una gema para abrir su ficha ampliada (puntos, estado de control y detalle). Luego tocá "Siguiente" para seguir.';
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            const gemInfoBtn = document.querySelector('#dynamic-grid .gem-info-btn');
            if (gemInfoBtn) {
                gemInfoBtn.classList.add('coachmark-highlight');
                scrollDownToTarget(gemInfoBtn);
            } else {
                const gridEl = document.getElementById('dynamic-grid');
                if (gridEl) {
                    gridEl.classList.add('coachmark-highlight');
                    scrollDownToTarget(gridEl);
                }
            }
            return;
        }

        if (tutorialStep === 12 && tutorialTurnCount >= 4) {
            badgeEl.innerText = 'Extras • Historial de Jugadas';
            textEl.innerText = 'Tocá el registro de acciones para desplegar el historial de jugadas y repasar qué pasó en los últimos turnos. Tocá "Siguiente" para continuar.';
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            const logContainerEl = document.getElementById('log-container');
            if (logContainerEl) {
                logContainerEl.classList.add('coachmark-highlight');
                scrollDownToTarget(logContainerEl);
            }
            return;
        }

        if (tutorialStep === 13 && tutorialTurnCount >= 4) {
            badgeEl.innerText = 'Extras • Mazo TCG y Rejugabilidad';
            textEl.innerText = 'Si activás el modo TCG y su ℹ️ en cartas/tablero, ves condición y efecto de cada carta. Tocá "Siguiente" para finalizar (podés reabrir el tutorial desde ⚙️).';
            bubble.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            const tcgTarget = document.querySelector('.hand-card-info-btn, .card-tcg-info-btn, #tcg-mode-badge, #btn-settings');
            if (tcgTarget) {
                tcgTarget.classList.add('coachmark-highlight');
                scrollDownToTarget(tcgTarget);
            }
            return;
        }

        bubble.classList.add('hidden');
        return;
    }

    if (currentEnergy >= 2 && hasHandCards && hasEmptyCell) {
        badgeEl.innerText = 'Guía 1/3 • Jugar Carta';
        textEl.innerText = 'Elegí una carta de tu mano y tocá una casilla vacía para jugarla (cuesta 2⚡).';
        bubble.classList.remove('hidden');
        const handEl = document.getElementById(`hand-${activePlayer}`);
        if (handEl) handEl.classList.add('coachmark-highlight');
        return;
    }

    if (canAttackNow) {
        badgeEl.innerText = 'Guía 2/3 • Atacar';
        textEl.innerText = 'Tocá tu carta en el tablero y elegí una dirección para atacar si superás al rival (cuesta 1⚡).';
        bubble.classList.remove('hidden');
        const gridEl = document.getElementById('dynamic-grid');
        if (gridEl) gridEl.classList.add('coachmark-highlight');
        return;
    }

    if (hasOwnedCardOnBoard || currentEnergy < 2) {
        badgeEl.innerText = 'Guía 3/3 • Puntaje y Turno';
        textEl.innerText = 'Sumá puntos controlando gemas y combos hasta llegar a la meta, y pasá el turno cuando termines.';
        bubble.classList.remove('hidden');
        const btnPass = document.getElementById('btn-pass-turn');
        if (btnPass && !btnPass.classList.contains('hidden')) {
            btnPass.classList.add('coachmark-highlight-pass');
        }
        return;
    }

    bubble.classList.add('hidden');
}

function createTutorialGameState() {
    const baseState = createInitialGameState();
    const tutorialGems = [...GEM_TYPES];
    const centerGem = tutorialGems[4];

    const newBoard = Array(9).fill(null);
    newBoard[4] = {
        val: 3,
        top: 3,
        right: 3,
        bottom: 3,
        left: 3,
        specialDir: 'top',
        powerCondition: 'none',
        powerEffect: 'none',
        owner: 'blue',
        gemRevealed: centerGem,
        isProtected: false
    };

    const newRevealed = Array(9).fill(false);
    newRevealed[4] = true;

    const redHand = [...baseState.hands.red];
    if (!redHand.some(c => Math.max(c.top, c.bottom, c.left, c.right) >= 6)) {
        redHand[0] = {
            val: 7,
            top: 7,
            right: 7,
            bottom: 7,
            left: 2,
            specialDir: 'left',
            powerCondition: 'none',
            powerEffect: 'none'
        };
    }

    const redDiscards = baseState.discards.red && baseState.discards.red.length > 0
        ? baseState.discards.red
        : [{
            val: 5,
            top: 5,
            right: 5,
            bottom: 5,
            left: 1,
            specialDir: 'left',
            powerCondition: 'none',
            powerEffect: 'none'
        }];

    return {
        ...baseState,
        board: newBoard,
        revealedBoardGems: newRevealed,
        gems: tutorialGems,
        turn: 'red',
        currentEnergy: 3,
        maxEnergy: 3,
        hands: {
            red: redHand,
            blue: baseState.hands.blue
        },
        discards: {
            red: redDiscards,
            blue: baseState.discards.blue
        },
        lastLog: '🎓 Tutorial iniciado: jugá una carta al lado de la carta Azul del centro (2⚡) y luego atacala (1⚡).'
    };
}

function getDiamondTempShieldBadgeHTML(cell) {
    if (!cell || !cell.diamondTempShield) return '';
    return `<div class="diamond-temp-shield-badge" title="Escudo temporal de Diamante (expira al iniciar el siguiente turno del dueño)">💠 1T</div>`;
}

function getAIStatusLabel() {
    const diffNames = { easy: 'Fácil', normal: 'Normal', hard: 'Avanzado' };
    const tcgLabel = isAITCGModeEnabled() ? ' • 🎴 Mazo con Poderes TCG' : ' • ⚡ Mazo Estándar (Sin Poderes)';
    return `🤖 IA (${diffNames[aiDifficulty] || 'Normal'})${tcgLabel}`;
}

function initGameApp() {
    initSettingsManager();

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('sala');

    if (!roomParam && localStorage.getItem(STORAGE_KEYS.onboardingDone) !== 'true') {
        enableSpecialAttackModesForTutorial();
        isTutorialSession = true;
        tutorialStep = 0;
        tutorialTurnCount = 1;
        didStepTwoAttack = false;
        tutorialTurn2DoneWaitingNextTurn = false;
        tutorialTurn3DoneWaitingNextTurn = false;
        gameMode = 'ai';
        aiDifficulty = 'easy';
        myRole = 'red';
        const btnOnline = document.getElementById('btn-mode-online');
        const btnAi = document.getElementById('btn-mode-ai');
        if (btnOnline) btnOnline.classList.remove('active');
        if (btnAi) btnAi.classList.add('active');
        const onlineCtrl = document.getElementById('online-controls');
        const aiCtrl = document.getElementById('ai-controls');
        if (onlineCtrl) onlineCtrl.classList.add('hidden');
        if (aiCtrl) aiCtrl.classList.remove('hidden');
        const statusEl = document.getElementById('room-status');
        if (statusEl) statusEl.innerText = `🎓 Modo Tutorial activo vs IA (Sos ROJO).`;

        applyGameState(createTutorialGameState());
        return;
    }

    const initialState = createInitialGameState();
    applyGameState(initialState);

    if (roomParam) {
        switchGameMode('online');
        const roomInput = document.getElementById('room-code-input');
        if (roomInput) roomInput.value = roomParam;
        joinRoomAuto(roomParam);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGameApp);
} else {
    initGameApp();
}

function toggleLogExpand() {
    playSound('click');
    triggerVibrate(20);
    const container = document.getElementById('log-container');
    if (container) container.classList.toggle('expanded');
}

const TCG_DEEF_SLOTS = [
    { val: 5, label: 'Valor 5 (#1)' },
    { val: 5, label: 'Valor 5 (#2)' },
    { val: 6, label: 'Valor 6 (#1)' },
    { val: 6, label: 'Valor 6 (#2)' },
    { val: 7, label: 'Valor 7 (#1)' },
    { val: 7, label: 'Valor 7 (#2)' },
    { val: 8, label: 'Valor 8 (#1)' },
    { val: 8, label: 'Valor 8 (#2)' },
    { val: 9, label: 'Valor 9 (#1)' }
];

const REQUIRED_MINOR_COUNTS = { 0: 1, 1: 2, 2: 2, 3: 2, 4: 2 };

function updateMinorCounterLive() {
    const counterEl = document.getElementById('tcg-minor-counter');
    if (!counterEl) return;

    const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let idx = 0; idx < TCG_DEEF_SLOTS.length; idx++) {
        const sel = document.getElementById(`tcg-minor-${idx}`);
        if (!sel) continue;
        const val = parseInt(sel.value, 10);
        if (counts[val] !== undefined) counts[val]++;
    }

    let allValid = true;
    const pills = [0, 1, 2, 3, 4].map((v) => {
        const current = counts[v];
        const target = REQUIRED_MINOR_COUNTS[v];
        const ok = current === target;
        if (!ok) allValid = false;
        const bg = ok ? 'rgba(34, 197, 94, 0.16)' : 'rgba(245, 158, 11, 0.14)';
        const border = ok ? 'rgba(34, 197, 94, 0.55)' : 'rgba(245, 158, 11, 0.45)';
        const color = ok ? '#4ade80' : '#fbbf24';
        return `<span style="padding: 2px 5px; border-radius: 5px; background: ${bg}; border: 1px solid ${border}; color: ${color}; font-weight: bold;">${v}: ${current}/${target}</span>`;
    }).join(' ');

    counterEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 0.58rem; color: ${allValid ? '#4ade80' : '#fbbf24'}; font-weight: bold;">
                ${allValid ? '✅ Valores flojos listos para guardar' : '⚠️ Valores flojos requeridos (0×1, 1..4×2)'}
            </span>
            <button type="button" id="btn-autocomplete-minors" style="padding: 3px 7px; font-size: 0.56rem; font-weight: bold; background: rgba(56, 189, 248, 0.18); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.5); border-radius: 5px; cursor: pointer;">
                🎲 Autocompletar válido
            </button>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px; font-size: 0.56rem;">${pills}</div>
    `;

    const btnAuto = document.getElementById('btn-autocomplete-minors');
    if (btnAuto) {
        btnAuto.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            autocompleteValidMinors();
        };
    }
}

function autocompleteValidMinors() {
    playSound('click');
    triggerVibrate(25);
    const validPool = shuffle([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    for (let idx = 0; idx < TCG_DEEF_SLOTS.length; idx++) {
        const sel = document.getElementById(`tcg-minor-${idx}`);
        if (sel && validPool[idx] !== undefined) {
            sel.value = String(validPool[idx]);
        }
    }
    updateMinorCounterLive();
}

function buildDefaultTCGDeckForSubmode(submode) {
    const usedPresetIds = new Set();
    return TCG_DEEF_SLOTS.map((slot) => {
        if (submode === 'preset' && typeof getPresetOptionsForValue === 'function') {
            const pool = getPresetOptionsForValue(slot.val);
            const unused = pool.find(opt => !usedPresetIds.has(opt.id)) || pool[0];
            if (unused) {
                usedPresetIds.add(unused.id);
                return {
                    val: slot.val,
                    minorVal: 2,
                    specialDir: 'top',
                    presetId: unused.id,
                    energyCost: unused.energyCost,
                    powerCondition: unused.powerCondition,
                    powerEffect: unused.powerEffect,
                    targetGemId: unused.targetGemId || null
                };
            }
        }
        return {
            val: slot.val,
            minorVal: 2,
            specialDir: 'top',
            powerCondition: 'none',
            powerEffect: 'rojo',
            energyCost: 2
        };
    });
}

function initSettingsManager() {
    const DEFAULT_SKIN = 'modern';

    const btnSettings = document.getElementById('btn-settings');
    const modalSettings = document.getElementById('modal-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const selectSkin = document.getElementById('select-skin');
    const checkHaptic = document.getElementById('check-haptic');
    const checkTcgMode = document.getElementById('check-tcg-mode');
    const selectTcgSubmode = document.getElementById('select-tcg-submode');
    const checkAiTcgMode = document.getElementById('check-ai-tcg-mode');
    const checkToroidalOpt = document.getElementById('check-opt-toroidal');
    const checkDiagonalOpt = document.getElementById('check-opt-diagonal');
    const btnResetCoachmarks = document.getElementById('btn-reset-coachmarks');
    const tcgBuilderContainer = document.getElementById('tcg-builder-container');
    const btnOpenTcgBuilder = document.getElementById('btn-open-tcg-builder');

    if (checkTcgMode) {
        checkTcgMode.checked = localStorage.getItem(STORAGE_KEYS.tcgMode) === 'true';
        if (tcgBuilderContainer) tcgBuilderContainer.classList.toggle('hidden', !checkTcgMode.checked);
    }

    if (selectTcgSubmode) {
        const savedSubmode = localStorage.getItem(STORAGE_KEYS.tcgSubmode) || 'preset';
        selectTcgSubmode.value = savedSubmode === 'custom' ? 'custom' : 'preset';
        selectTcgSubmode.addEventListener('change', () => {
            playSound('click');
            localStorage.setItem(STORAGE_KEYS.tcgSubmode, selectTcgSubmode.value);
            render();
        });
    }

    if (checkAiTcgMode) {
        checkAiTcgMode.checked = localStorage.getItem(STORAGE_KEYS.aiTcgMode) === 'true';
    }

    if (checkToroidalOpt) {
        checkToroidalOpt.checked = localStorage.getItem(STORAGE_KEYS.toroidalOpt) === 'true';
        checkToroidalOpt.addEventListener('change', () => {
            playSound('click');
            localStorage.setItem(STORAGE_KEYS.toroidalOpt, checkToroidalOpt.checked);
            if (!checkToroidalOpt.checked) isMapamundiActive = false;
            render();
        });
    }

    if (checkDiagonalOpt) {
        checkDiagonalOpt.checked = localStorage.getItem(STORAGE_KEYS.diagonalOpt) === 'true';
        checkDiagonalOpt.addEventListener('change', () => {
            playSound('click');
            localStorage.setItem(STORAGE_KEYS.diagonalOpt, checkDiagonalOpt.checked);
            if (!checkDiagonalOpt.checked) isDiagonalActive = false;
            render();
        });
    }

    if (checkAiTcgMode) {
        checkAiTcgMode.addEventListener('change', () => {
            playSound('click');
            localStorage.setItem(STORAGE_KEYS.aiTcgMode, checkAiTcgMode.checked);
            const statusEl = document.getElementById('room-status');
            if (gameMode === 'ai' && statusEl) {
                statusEl.innerText = `${getAIStatusLabel()}. Sos ROJO.`;
            }
            render();
        });
    }

    if (checkTcgMode) {
        checkTcgMode.addEventListener('change', () => {
            playSound('click');
            if (tcgBuilderContainer) tcgBuilderContainer.classList.toggle('hidden', !checkTcgMode.checked);
            localStorage.setItem(STORAGE_KEYS.tcgMode, checkTcgMode.checked);
            render();
        });
    }

    if (btnOpenTcgBuilder) {
        btnOpenTcgBuilder.addEventListener('click', () => {
            playSound('click');
            openTCGBuilderModal();
        });
    }

    if (btnResetCoachmarks) {
        btnResetCoachmarks.addEventListener('click', () => {
            resetOnboardingCoachmarks();
            if (modalSettings) modalSettings.style.display = 'none';
        });
    }

    if (checkHaptic && localStorage.getItem('9gemas_haptic_set') === null) {
        checkHaptic.checked = false;
    } else if (checkHaptic) {
        checkHaptic.checked = localStorage.getItem('9gemas_haptic_val') === 'true';
    }

    function applySkin(skinName) {
        const classesToRemove = [];
        document.body.classList.forEach(className => {
            if (className.startsWith('skin-')) classesToRemove.push(className);
        });
        classesToRemove.forEach(cls => document.body.classList.remove(cls));
        document.body.classList.add(`skin-${skinName}`);
    }

    function loadSavedSkin() {
        const savedSkin = localStorage.getItem(STORAGE_KEYS.skin) || DEFAULT_SKIN;
        applySkin(savedSkin);
        if (selectSkin) selectSkin.value = savedSkin;
    }

    function saveSkinPreference() {
        playSound('click');
        triggerVibrate(30);
        if (!selectSkin) return;
        const chosenSkin = selectSkin.value;
        localStorage.setItem(STORAGE_KEYS.skin, chosenSkin);
        applySkin(chosenSkin);

        if (checkToroidalOpt) {
            localStorage.setItem(STORAGE_KEYS.toroidalOpt, checkToroidalOpt.checked);
            if (!checkToroidalOpt.checked) isMapamundiActive = false;
        }
        if (checkDiagonalOpt) {
            localStorage.setItem(STORAGE_KEYS.diagonalOpt, checkDiagonalOpt.checked);
            if (!checkDiagonalOpt.checked) isDiagonalActive = false;
        }
        if (checkTcgMode) {
            localStorage.setItem(STORAGE_KEYS.tcgMode, checkTcgMode.checked);
        }
        if (selectTcgSubmode) {
            localStorage.setItem(STORAGE_KEYS.tcgSubmode, selectTcgSubmode.value);
        }
        if (checkAiTcgMode) {
            localStorage.setItem(STORAGE_KEYS.aiTcgMode, checkAiTcgMode.checked);
        }

        if (checkHaptic) {
            localStorage.setItem('9gemas_haptic_set', 'true');
            localStorage.setItem('9gemas_haptic_val', checkHaptic.checked);
        }

        if (modalSettings) modalSettings.style.display = 'none';
        render();
    }

    if (btnSettings && modalSettings) {
        btnSettings.addEventListener('click', () => { playSound('click'); triggerVibrate(20); modalSettings.style.display = 'flex'; });
    }
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', saveSkinPreference);
    }
    if (modalSettings) {
        modalSettings.addEventListener('click', (e) => {
            if (e.target === modalSettings) modalSettings.style.display = 'none';
        });
    }

    loadSavedSkin();
}

function openTCGBuilderModal() {
    const container = document.getElementById('tcg-slots-container');
    if (!container) return;
    container.innerHTML = '';

    const submode = getTCGSubmode();
    const titleEl = document.getElementById('tcg-builder-title');
    const subEl = document.getElementById('tcg-builder-subtitle');

    if (titleEl) {
        titleEl.innerText = submode === 'preset'
            ? 'Mazo TCG Preasignado'
            : 'Constructor de Mazo TCG Custom';
    }
    if (subEl) {
        subEl.innerText = submode === 'preset'
            ? 'Sin repetir carta: elegí carta preasignada, valor flojo (0-4) y dirección débil.'
            : 'Configura valor flojo, dirección débil, condición y efecto para cada carta.';
    }

    const counterBox = document.createElement('div');
    counterBox.id = 'tcg-minor-counter';
    counterBox.style.cssText = 'background: rgba(15, 23, 42, 0.75); border: 1px solid #334155; border-radius: 7px; padding: 6px 8px; margin-bottom: 8px;';
    container.appendChild(counterBox);

    const savedDeck = getSavedCustomTCGDeck('red', submode);

    TCG_DEEF_SLOTS.forEach((slot, idx) => {
        const currentVal = savedDeck[idx] || { minorVal: 2, specialDir: 'top', powerCondition: 'none', powerEffect: 'rojo' };
        const div = document.createElement('div');
        div.className = 'tcg-card-row';
        div.style.cssText = "flex-direction: column; align-items: stretch; gap: 4px; margin-bottom: 8px;";

        const minorAndDirHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><b>${slot.label}</b> (Base: ${slot.val})</span>
                <div style="display: flex; gap: 4px;">
                    <select id="tcg-minor-${idx}" title="Valor Flojo (0-4)">
                        <option value="0" ${currentVal.minorVal === 0 ? 'selected' : ''}>0</option>
                        <option value="1" ${currentVal.minorVal === 1 ? 'selected' : ''}>1</option>
                        <option value="2" ${currentVal.minorVal === 2 ? 'selected' : ''}>2</option>
                        <option value="3" ${currentVal.minorVal === 3 ? 'selected' : ''}>3</option>
                        <option value="4" ${currentVal.minorVal === 4 ? 'selected' : ''}>4</option>
                    </select>
                    <select id="tcg-dir-${idx}" title="Dirección Débil">
                        <option value="top" ${currentVal.specialDir === 'top' ? 'selected' : ''}>⬆️ Arriba</option>
                        <option value="bottom" ${currentVal.specialDir === 'bottom' ? 'selected' : ''}>⬇️ Abajo</option>
                        <option value="left" ${currentVal.specialDir === 'left' ? 'selected' : ''}>⬅️ Izquierda</option>
                        <option value="right" ${currentVal.specialDir === 'right' ? 'selected' : ''}>➡️ Derecha</option>
                    </select>
                </div>
            </div>
        `;

        if (submode === 'preset') {
            const options = (typeof getPresetOptionsForValue === 'function')
                ? getPresetOptionsForValue(slot.val)
                : [];
            const chosenPreset = (typeof resolvePresetCardConfig === 'function')
                ? resolvePresetCardConfig(slot.val, currentVal.presetId)
                : { id: 'default', name: 'Carta Preasignada', energyCost: 2, desc: '' };

            const presetOptionsHtml = options.map(opt =>
                `<option value="${opt.id}" ${chosenPreset.id === opt.id ? 'selected' : ''}>${opt.name} (${opt.energyCost}⚡)</option>`
            ).join('');

            div.innerHTML = `
                ${minorAndDirHtml}
                <select id="tcg-preset-${idx}" style="width: 100%; font-size: 0.62rem; padding: 3px; background: #0f172a; color: #38bdf8; border: 1px solid #334155; border-radius: 4px;">
                    ${presetOptionsHtml}
                </select>
                <div style="font-size: 0.56rem; color: #cbd5e1; line-height: 1.25; padding: 2px 4px; background: rgba(15,23,42,0.5); border-radius: 4px;">
                    ${chosenPreset.desc || ''}
                </div>
            `;
            container.appendChild(div);

            const presetSelect = div.querySelector(`#tcg-preset-${idx}`);
            if (presetSelect) {
                presetSelect.addEventListener('change', (e) => {
                    const nextPreset = (typeof resolvePresetCardConfig === 'function')
                        ? resolvePresetCardConfig(slot.val, e.target.value)
                        : chosenPreset;
                    const descBox = div.lastElementChild;
                    if (descBox) descBox.innerText = nextPreset.desc || '';
                });
            }
        } else {
            const conditionOptionsHtml = `<option value="none" ${currentVal.powerCondition === 'none' ? 'selected' : ''}>Sin Condición</option>` +
                ACTIVE_TCG_GEM_TYPES_LIST.map(g => `<option value="${g.id}" ${currentVal.powerCondition === g.id ? 'selected' : ''}>Controlar: ${g.name}</option>`).join('');

            const effectOptionsHtml = ACTIVE_TCG_GEM_TYPES_LIST.map(g => `<option value="${g.id}" ${currentVal.powerEffect === g.id ? 'selected' : ''}>Efecto: ${g.name}</option>`).join('');

            div.innerHTML = `
                ${minorAndDirHtml}
                <div style="display: flex; gap: 4px;">
                    <select id="tcg-cond-${idx}" style="flex: 1; font-size: 0.6rem; padding: 3px; background: #0f172a; color: #38bdf8; border: 1px solid #334155; border-radius: 4px;">
                        ${conditionOptionsHtml}
                    </select>
                    <select id="tcg-eff-${idx}" style="flex: 1; font-size: 0.6rem; padding: 3px; background: #0f172a; color: #fbbf24; border: 1px solid #334155; border-radius: 4px;">
                        ${effectOptionsHtml}
                    </select>
                </div>
            `;
            container.appendChild(div);
        }

        const minorSelect = div.querySelector(`#tcg-minor-${idx}`);
        if (minorSelect) {
            minorSelect.addEventListener('change', () => {
                playSound('click');
                updateMinorCounterLive();
            });
        }
    });

    updateMinorCounterLive();

    const modalBuilder = document.getElementById('modal-tcg-builder');
    if (modalBuilder) modalBuilder.style.display = 'flex';
}

function getSavedCustomTCGDeck(player, submode = getTCGSubmode()) {
    const key = getTCGSaveStorageKey(player, submode);
    const raw = localStorage.getItem(key);

    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.slots)) {
                const versionMatches = parsed.version === ACTIVE_TCG_CATALOG_VERSION;
                const validCount = parsed.slots.length === TCG_DEEF_SLOTS.length;
                const allPresetsValid = submode !== 'preset' || parsed.slots.every((item, idx) => {
                    const expectedVal = TCG_DEEF_SLOTS[idx].val;
                    return typeof isValidPresetIdForValue === 'function'
                        ? isValidPresetIdForValue(expectedVal, item && item.presetId)
                        : Boolean(item && item.presetId);
                });

                if (versionMatches && validCount && allPresetsValid) {
                    return parsed.slots.map((item, idx) => {
                        const slotVal = TCG_DEEF_SLOTS[idx].val;
                        if (submode === 'preset' && typeof resolvePresetCardConfig === 'function') {
                            const fresh = resolvePresetCardConfig(slotVal, item.presetId);
                            return {
                                val: slotVal,
                                minorVal: typeof item.minorVal === 'number' ? item.minorVal : 2,
                                specialDir: item.specialDir || 'top',
                                presetId: fresh.id,
                                energyCost: fresh.energyCost,
                                powerCondition: fresh.powerCondition,
                                powerEffect: fresh.powerEffect,
                                targetGemId: fresh.targetGemId || null
                            };
                        }
                        return {
                            ...item,
                            val: slotVal
                        };
                    });
                }
            }
        } catch (e) {}

        localStorage.removeItem(key);
    }

    const freshDeck = buildDefaultTCGDeckForSubmode(submode);
    localStorage.setItem(key, JSON.stringify({
        version: ACTIVE_TCG_CATALOG_VERSION,
        slots: freshDeck
    }));
    return freshDeck;
}

function saveCustomTCGDeck() {
    playSound('click');
    triggerVibrate(30);

    const submode = getTCGSubmode();
    const customDeck = [];
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const seenPresetIds = new Set();

    for (let idx = 0; idx < TCG_DEEF_SLOTS.length; idx++) {
        const slot = TCG_DEEF_SLOTS[idx];
        const minorVal = parseInt(document.getElementById(`tcg-minor-${idx}`).value, 10);
        const specialDir = document.getElementById(`tcg-dir-${idx}`).value;

        if (counts[minorVal] !== undefined) {
            counts[minorVal]++;
        }

        if (submode === 'preset') {
            const presetEl = document.getElementById(`tcg-preset-${idx}`);
            const presetId = presetEl ? presetEl.value : undefined;
            const preset = (typeof resolvePresetCardConfig === 'function')
                ? resolvePresetCardConfig(slot.val, presetId)
                : { id: presetId, energyCost: 2, powerCondition: 'none', powerEffect: 'rojo' };

            if (seenPresetIds.has(preset.id)) {
                triggerVibrate([40, 40]);
                alert(`⚠️ Carta repetida en el mazo:\n"${preset.name}" ya está asignada en otro slot.\nNo se pueden repetir cartas en el mazo.`);
                return;
            }
            seenPresetIds.add(preset.id);

            customDeck.push({
                val: slot.val,
                minorVal,
                specialDir,
                presetId: preset.id,
                energyCost: preset.energyCost,
                powerCondition: preset.powerCondition,
                powerEffect: preset.powerEffect,
                targetGemId: preset.targetGemId || null
            });
        } else {
            const powerCondition = document.getElementById(`tcg-cond-${idx}`).value;
            const powerEffect = document.getElementById(`tcg-eff-${idx}`).value;
            const customKey = `${slot.val}_${minorVal}_${specialDir}_${powerCondition}_${powerEffect}`;
            if (seenPresetIds.has(customKey)) {
                triggerVibrate([40, 40]);
                alert(`⚠️ Carta repetida en el mazo:\nTenés dos cartas idénticas (mismo valor, flojo, dirección, condición y efecto).`);
                return;
            }
            seenPresetIds.add(customKey);

            customDeck.push({
                val: slot.val,
                minorVal,
                specialDir,
                powerCondition,
                powerEffect,
                energyCost: 2
            });
        }
    }

    if (counts[0] !== 1 || counts[1] !== 2 || counts[2] !== 2 || counts[3] !== 2 || counts[4] !== 2) {
        triggerVibrate([40, 40]);
        alert(`⚠️ Mazo inválido:\nDebes elegir exactamente:\n- Un (1) '0'\n- Dos (2) '1'\n- Dos (2) '2'\n- Dos (3) '3'\n- Dos (4) '4'\n\nRevisa los valores seleccionados.`);
        return;
    }

    localStorage.setItem(getTCGSaveStorageKey('red', submode), JSON.stringify({
        version: ACTIVE_TCG_CATALOG_VERSION,
        slots: customDeck
    }));
    const modalBuilder = document.getElementById('modal-tcg-builder');
    if (modalBuilder) modalBuilder.style.display = 'none';
    alert(submode === 'preset' ? "¡Mazo TCG Preasignado guardado con éxito!" : "¡Mazo TCG custom guardado con éxito!");
}

function showGemDetails(gemObj, isControlled, owner) {
    if (!gemObj) return;
    playSound('click');
    triggerVibrate(20);
    const isClassic = document.body.classList.contains('skin-classic');
    const iconContainer = document.getElementById('modal-gem-icon');

    if (iconContainer) {
        iconContainer.innerHTML = isClassic
            ? `<span style="font-size: 2.8rem;">${GEM_CLASSIC_ICONS[gemObj.id] || '💎'}</span>`
            : (GEM_SVGS[gemObj.id] || '');
    }

    const titleEl = document.getElementById('modal-gem-title');
    if (titleEl) titleEl.innerText = `${gemObj.protected ? '🛡️ ' : ''}${gemObj.name}`;

    const statusText = isControlled
        ? (owner === 'red' ? '🔴 Controlada por Jugador Rojo' : '🔵 Controlada por Jugador Azul')
        : '💎 Gema en el Tablero';
    const ptsEl = document.getElementById('modal-gem-pts');
    if (ptsEl) ptsEl.innerText = `Puntos: ${gemObj.pts} | ${statusText}`;

    const descEl = document.getElementById('modal-gem-desc');
    if (descEl) descEl.innerText = gemObj.desc;

    const modalGem = document.getElementById('gem-info-modal');
    if (modalGem) modalGem.style.display = 'flex';
}

function closeGemInfoModal() {
    playSound('click');
    const modalGem = document.getElementById('gem-info-modal');
    if (modalGem) modalGem.style.display = 'none';
}

function switchGameMode(mode) {
    playSound('click');
    triggerVibrate(25);
    gameMode = mode;
    const btnOnline = document.getElementById('btn-mode-online');
    const btnAi = document.getElementById('btn-mode-ai');
    if (btnOnline) btnOnline.classList.toggle('active', mode === 'online');
    if (btnAi) btnAi.classList.toggle('active', mode === 'ai');

    const onlineCtrl = document.getElementById('online-controls');
    const aiCtrl = document.getElementById('ai-controls');
    const btnShare = document.getElementById('btn-share-link');
    if (onlineCtrl) onlineCtrl.classList.toggle('hidden', mode !== 'online');
    if (aiCtrl) aiCtrl.classList.toggle('hidden', mode !== 'ai');
    if (btnShare) btnShare.classList.add('hidden');

    const statusEl = document.getElementById('room-status');
    if (statusEl) {
        statusEl.innerText = mode === 'ai'
            ? `${getAIStatusLabel()}. Elegí dificultad e iniciá.`
            : "Crea una sala o únete con un código.";
    }
    render();
}

function shuffle(array) { return [...array].sort(() => Math.random() - 0.5); }

function generateBalancedDeck() {
    const globals = [5, 5, 6, 6, 7, 7, 8, 8, 9];
    const minors = shuffle([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    const directions = ['top', 'right', 'bottom', 'left'];

    return globals.map((majorVal, idx) => {
        const specialDir = directions[Math.floor(Math.random() * directions.length)];
        const card = {
            val: majorVal, top: majorVal, right: majorVal, bottom: majorVal, left: majorVal,
            specialDir, powerCondition: 'none', powerEffect: 'none'
        };
        card[specialDir] = minors[idx];
        return card;
    });
}

function generateAITCGDeckConfig() {
    const baseDeck = generateBalancedDeck();
    const effectPool = ['rojo', 'azul', 'amarillo', 'verde', 'naranja', 'violeta', 'blanco', 'negro', 'marron'];
    const conditionPool = aiDifficulty === 'easy'
        ? ['none', 'none', 'rojo', 'azul']
        : ['none', 'rojo', 'azul', 'amarillo', 'verde', 'naranja', 'violeta'];

    return baseDeck.map((card, idx) => {
        const powerEffect = effectPool[idx % effectPool.length];
        const powerCondition = aiDifficulty === 'hard'
            ? conditionPool[(idx + 2) % conditionPool.length]
            : (idx % 2 === 0 ? 'none' : conditionPool[idx % conditionPool.length]);

        return {
            val: card.val,
            minorVal: card[card.specialDir],
            specialDir: card.specialDir,
            powerCondition,
            powerEffect,
            energyCost: 2
        };
    });
}

function getCardPlayEnergyCost(card, player = turn) {
    if (!card) return 2;
    if (typeof getEffectiveCardEnergyCost === 'function') {
        return getEffectiveCardEnergyCost(card, player, { board, decks, hands, discards });
    }
    return typeof card.energyCost === 'number' ? card.energyCost : 2;
}

function generateTCGDeckForPlayer(player) {
    const submode = player === 'blue' && gameMode === 'ai' ? 'custom' : getTCGSubmode();
    const customConfig = (player === 'blue' && gameMode === 'ai')
        ? generateAITCGDeckConfig()
        : getSavedCustomTCGDeck(player, submode);

    return customConfig.map((item, idx) => {
        const slotVal = item.val || (TCG_DEEF_SLOTS[idx] ? TCG_DEEF_SLOTS[idx].val : 6);
        const minorVal = typeof item.minorVal === 'number' ? item.minorVal : 2;
        const specialDir = item.specialDir || 'top';

        let resolved = {
            powerCondition: item.powerCondition || 'none',
            powerEffect: item.powerEffect || 'rojo',
            energyCost: typeof item.energyCost === 'number' ? item.energyCost : 2,
            targetGemId: item.targetGemId || null
        };

        if (submode === 'preset' && typeof resolvePresetCardConfig === 'function') {
            const freshPreset = resolvePresetCardConfig(slotVal, item.presetId);
            resolved = {
                powerCondition: freshPreset.powerCondition,
                powerEffect: freshPreset.powerEffect,
                energyCost: freshPreset.energyCost,
                targetGemId: freshPreset.targetGemId || null
            };
        }

        const card = {
            val: slotVal,
            top: slotVal, right: slotVal, bottom: slotVal, left: slotVal,
            specialDir,
            powerCondition: resolved.powerCondition,
            powerEffect: resolved.powerEffect,
            energyCost: resolved.energyCost,
            targetGemId: resolved.targetGemId
        };
        card[specialDir] = minorVal;
        return card;
    });
}

function canPlayerUseTCG(player) {
    return (player === 'blue' && gameMode === 'ai') ? isAITCGModeEnabled() : isTCGModeEnabled();
}

function triggerTCGPower(playedCard, currentBoard, player, energyNow, playerDecks, playerHands, playerDiscards, boardIdx) {
    if (!canPlayerUseTCG(player)) return { logText: '', energyDelta: 0, finalBoardIndex: boardIdx };
    if (!playedCard || !playedCard.powerEffect || playedCard.powerEffect === 'none') {
        return { logText: '', energyDelta: 0, finalBoardIndex: boardIdx };
    }
    if (typeof resolveTCGCardPower === 'function') {
        return resolveTCGCardPower(
            playedCard,
            currentBoard,
            player,
            energyNow,
            playerDecks,
            playerHands,
            playerDiscards,
            boardIdx,
            {
                gems,
                revealedBoardGems,
                onCardMoved: (newIdx) => {
                    newlyDeployedCellIndex = newIdx;
                }
            }
        );
    }
    return { logText: '', energyDelta: 0, finalBoardIndex: boardIdx };
}

function applyGemDeployEffect(gem, player, boardIdx) {
    if (!gem) return { logText: '', energyDelta: 0 };

    const condMet = typeof evaluateTCGCondition === 'function'
        ? evaluateTCGCondition('none', player, { board, decks, hands, discards })
        : true;

    if (!condMet) return { logText: '', energyDelta: 0 };

    if (gem.id === 'violeta') {
        return { logText: ` 🟣 [+1⚡]`, energyDelta: 1 };
    }

    if (gem.id === 'verde') {
        for (let i = 0; i < 2; i++) {
            if (discards[player] && discards[player].length > 0) {
                decks[player].push(discards[player].pop());
            }
        }
        if (decks[player] && decks[player].length > 0) {
            hands[player].push(decks[player].pop());
        }
        const opponent = player === 'red' ? 'blue' : 'red';
        if (hands[opponent] && hands[opponent].length > 0) {
            const rIdx = Math.floor(Math.random() * hands[opponent].length);
            discards[opponent].push(hands[opponent].splice(rIdx, 1)[0]);
        }
        return { logText: ` 🟢 [Esmeralda: Recup/Robo/Desc]`, energyDelta: 0 };
    }

    return { logText: '', energyDelta: 0 };
}

function syncPermanentBoardEffects() {
    if (typeof refreshPermanentBoardPowers === 'function') {
        refreshPermanentBoardPowers(board, { decks, hands, discards });
    }
    maxEnergy = getMaxEnergyForPlayer(turn);
}

function splitTCGDeck(fullDeck) {
    const fives = fullDeck.filter(c => c.val === 5);
    const sixes = fullDeck.filter(c => c.val === 6);
    const sevens = shuffle(fullDeck.filter(c => c.val === 7));
    const eights = fullDeck.filter(c => c.val === 8);
    const nines = fullDeck.filter(c => c.val === 9);

    const handSevens = sevens.slice(0, 1);
    const deckSevens = sevens.slice(1);

    const hand = [...fives, ...sixes, ...handSevens].sort((a, b) => a.val - b.val);
    const deck = [...deckSevens, ...eights, ...nines];

    return {
        hand: hand,
        deck: shuffle(deck)
    };
}

function startAIGame() {
    playSound('click');
    triggerVibrate(40);
    const diffSelect = document.getElementById('ai-difficulty');
    aiDifficulty = diffSelect ? diffSelect.value : 'normal';
    myRole = 'red';
    lastTurnNotified = null;
    actionLogHistory = [];

    if (!isTutorialSession && localStorage.getItem(STORAGE_KEYS.onboardingDone) !== 'true') {
        enableSpecialAttackModesForTutorial();
        isTutorialSession = true;
        tutorialStep = 0;
        tutorialTurnCount = 1;
        didStepTwoAttack = false;
        tutorialTurn2DoneWaitingNextTurn = false;
        tutorialTurn3DoneWaitingNextTurn = false;
        const tutState = createTutorialGameState();
        applyGameState(tutState);
        const statusEl = document.getElementById('room-status');
        if (statusEl) statusEl.innerText = `🎓 Modo Tutorial activo vs IA (Sos ROJO).`;
        const modalSettings = document.getElementById('modal-settings');
        if (modalSettings) modalSettings.style.display = 'none';
        return;
    }

    const initialState = createInitialGameState();
    applyGameState(initialState);

    const statusEl = document.getElementById('room-status');
    if (statusEl) statusEl.innerText = `${getAIStatusLabel()}. Sos ROJO.`;

    const startLog = isAITCGModeEnabled()
        ? `Partida vs IA con Mazo TCG iniciada. ¡Tu turno!`
        : `Partida contra IA (sin poderes TCG) iniciada. ¡Tu turno!`;
    syncGameState(startLog);

    const modalSettings = document.getElementById('modal-settings');
    if (modalSettings) modalSettings.style.display = 'none';
}

function createRoom() {
    playSound('click');
    triggerVibrate(40);
    isTutorialSession = false;
    tutorialStep = 0;
    tutorialTurnCount = 1;
    didStepTwoAttack = false;
    tutorialTurn2DoneWaitingNextTurn = false;
    tutorialTurn3DoneWaitingNextTurn = false;
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    myRole = 'red';
    currentRoomCode = code;
    lastTurnNotified = null;
    actionLogHistory = [];
    const roomInput = document.getElementById('room-code-input');
    if (roomInput) roomInput.value = code;
    const statusEl = document.getElementById('room-status');
    if (statusEl) statusEl.innerText = `Sala: ${code} (Sos ROJO).`;
    const btnShare = document.getElementById('btn-share-link');
    if (btnShare) btnShare.classList.remove('hidden');

    roomRef = database.ref('rooms/' + code);
    const initialState = createInitialGameState();
    roomRef.set(initialState);
    listenRoomState();
    render();

    const modalSettings = document.getElementById('modal-settings');
    if (modalSettings) modalSettings.style.display = 'none';
}

function shareRoomLink() {
    playSound('click');
    if (!currentRoomCode) return;
    const baseUrl = window.location.href.split('?')[0];
    const inviteUrl = `${baseUrl}?sala=${currentRoomCode}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(inviteUrl).then(() => {
            alert("¡Enlace copiado al portapapeles!");
        }).catch(() => { prompt("Copiá este enlace:", inviteUrl); });
    } else { prompt("Copiá este enlace:", inviteUrl); }
}

function joinRoom() {
    playSound('click');
    triggerVibrate(40);
    isTutorialSession = false;
    tutorialStep = 0;
    tutorialTurnCount = 1;
    didStepTwoAttack = false;
    tutorialTurn2DoneWaitingNextTurn = false;
    tutorialTurn3DoneWaitingNextTurn = false;
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (code.length !== 4) return alert("Ingresá un código válido de 4 letras.");
    myRole = 'blue';
    currentRoomCode = code;
    lastTurnNotified = null;
    actionLogHistory = [];
    const statusEl = document.getElementById('room-status');
    if (statusEl) statusEl.innerText = `Sala: ${code} (Sos AZUL).`;
    roomRef = database.ref('rooms/' + code);
    listenRoomState();
    render();

    const modalSettings = document.getElementById('modal-settings');
    if (modalSettings) modalSettings.style.display = 'none';
}

function joinRoomAuto(code) {
    isTutorialSession = false;
    tutorialStep = 0;
    tutorialTurnCount = 1;
    didStepTwoAttack = false;
    tutorialTurn2DoneWaitingNextTurn = false;
    tutorialTurn3DoneWaitingNextTurn = false;
    myRole = 'blue';
    currentRoomCode = code;
    lastTurnNotified = null;
    actionLogHistory = [];
    const statusEl = document.getElementById('room-status');
    if (statusEl) statusEl.innerText = `Sala: ${code} (Sos AZUL).`;
    roomRef = database.ref('rooms/' + code);

    roomRef.once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data) applyGameState(data);
        listenRoomState();
    });
}

function createInitialGameState() {
    const shuffledGemTypes = shuffle(GEM_TYPES);
    const isPlayerTCG = isTCGModeEnabled();
    const isBlueTCG = gameMode === 'ai' ? isAITCGModeEnabled() : isPlayerTCG;

    let handRed, fullDeckRed, handBlue, fullDeckBlue;

    if (isPlayerTCG) {
        const redCustomDeck = generateTCGDeckForPlayer('red');
        const splitRed = splitTCGDeck(redCustomDeck);
        handRed = splitRed.hand;
        fullDeckRed = splitRed.deck;
    } else {
        fullDeckRed = generateBalancedDeck();
        handRed = fullDeckRed.splice(0, 5);
    }

    if (isBlueTCG) {
        const blueCustomDeck = generateTCGDeckForPlayer('blue');
        const splitBlue = splitTCGDeck(blueCustomDeck);
        handBlue = splitBlue.hand;
        fullDeckBlue = splitBlue.deck;
    } else {
        fullDeckBlue = generateBalancedDeck();
        handBlue = fullDeckBlue.splice(0, 5);
    }

    newlyDrawnCardIndex = { red: null, blue: null };
    discardingCardInfo = { player: null, cardIndex: null };
    newlyDeployedCellIndex = null;
    lastTurnNotified = null;
    isMapamundiActive = false;
    isDiagonalActive = false;

    let initialLog = "Configura tu partida en el menú ⚙️.";
    if (gameMode === 'ai') {
        initialLog = isBlueTCG
            ? "Modo IA con Mazo TCG Activo."
            : "Modo IA Estándar (sin poderes TCG).";
    } else if (isPlayerTCG) {
        initialLog = `Modo TCG (${getTCGSubmode() === 'preset' ? 'Preasignado' : 'Custom'}) Activo. ¡Mazo cargado!`;
    }

    return {
        board: Array(9).fill(false),
        revealedBoardGems: Array(9).fill(false),
        gems: shuffledGemTypes,
        turn: 'red',
        currentEnergy: 3,
        maxEnergy: 3,
        isMapamundiActive: false,
        isDiagonalActive: false,
        usedRedEnergyBonusThisTurn: false,
        usedBlueEnergyBonusThisTurn: false,
        usedYellowEnergyBonusThisTurn: false,
        usedBlackEnergyBonusThisTurn: false,
        hands: { red: handRed, blue: handBlue },
        decks: { red: fullDeckRed, blue: fullDeckBlue },
        discards: { red: [], blue: [] },
        lastLog: initialLog,
        logHistory: []
    };
}

function applyGameState(data) {
    board = (data.board || Array(9).fill(false)).map(item => item === false ? null : item);
    revealedBoardGems = data.revealedBoardGems || Array(9).fill(false);
    gems = (data.gems && data.gems.length === 9) ? data.gems : shuffle(GEM_TYPES);
    turn = data.turn || 'red';

    const newEnergy = data.currentEnergy !== undefined ? data.currentEnergy : 3;
    if (newEnergy > currentEnergy) spawnEnergyParticles();
    previousEnergy = currentEnergy;
    currentEnergy = newEnergy;

    maxEnergy = data.maxEnergy !== undefined ? data.maxEnergy : 3;
    isMapamundiActive = isToroidalOptionEnabled() ? (data.isMapamundiActive || false) : false;
    isDiagonalActive = isDiagonalOptionEnabled() ? (data.isDiagonalActive || false) : false;
    usedRedEnergyBonusThisTurn = data.usedRedEnergyBonusThisTurn || false;
    usedBlueEnergyBonusThisTurn = data.usedBlueEnergyBonusThisTurn || false;
    usedYellowEnergyBonusThisTurn = data.usedYellowEnergyBonusThisTurn || false;
    usedBlackEnergyBonusThisTurn = data.usedBlackEnergyBonusThisTurn || false;

    hands = data.hands || { red: [], blue: [] };
    decks = data.decks || { red: [], blue: [] };
    discards = data.discards || { red: [], blue: [] };
    actionLogHistory = data.logHistory || [];

    if (!hands.red) hands.red = []; if (!hands.blue) hands.blue = [];
    if (!decks.red) decks.red = []; if (!decks.blue) decks.blue = [];
    if (!discards.red) discards.red = []; if (!discards.blue) discards.blue = [];

    syncPermanentBoardEffects();

    const logEl = document.getElementById('log-message');
    if (data.lastLog && logEl) {
        logEl.innerText = data.lastLog;
    }
    render();
    checkGameOver();
}

function listenRoomState() {
    if (!roomRef || gameMode !== 'online') return;
    roomRef.on('value', (snapshot) => {
        if (isSyncing) return;
        const data = snapshot.val();
        if (!data) return;
        applyGameState(data);
    });
}

function syncGameState(logText) {
    syncPermanentBoardEffects();

    if (logText) {
        actionLogHistory.unshift(logText);
        if (actionLogHistory.length > 15) actionLogHistory.pop();
    }
    const logEl = document.getElementById('log-message');
    if (logEl) logEl.innerText = logText || "";
    render();
    checkGameOver();

    if (gameMode === 'ai') {
        if (turn === 'blue') setTimeout(executeAITurn, 700);
        return;
    }

    if (!roomRef) return;
    isSyncing = true;
    const boardToSync = board.map(item => item === null ? false : item);

    roomRef.update({
        board: boardToSync,
        revealedBoardGems: revealedBoardGems,
        gems: gems,
        turn: turn,
        currentEnergy: currentEnergy,
        maxEnergy: maxEnergy,
        isMapamundiActive: isMapamundiActive,
        isDiagonalActive: isDiagonalActive,
        usedRedEnergyBonusThisTurn: usedRedEnergyBonusThisTurn,
        usedBlueEnergyBonusThisTurn: usedBlueEnergyBonusThisTurn,
        usedYellowEnergyBonusThisTurn: usedYellowEnergyBonusThisTurn,
        usedBlackEnergyBonusThisTurn: usedBlackEnergyBonusThisTurn,
        hands: hands, decks: decks, discards: discards,
        lastLog: logText, logHistory: actionLogHistory
    }).then(() => {
        setTimeout(() => { isSyncing = false; }, 150);
    }).catch(() => { isSyncing = false; });
}

function isMyTurn() {
    if (gameMode === 'ai') return turn === 'red';
    if (!myRole) { alert("Primero crea o únete a una sala en el menú de configuración (⚙️)."); return false; }
    if (turn !== myRole) {
        const logEl = document.getElementById('log-message');
        if (logEl) logEl.innerText = "⚠️ Es el turno de tu rival.";
        return false;
    }
    return true;
}

function getMaxEnergyForPlayer(player) {
    const controlledNaranja = board.some(c => c !== null && c.owner === player && c.gemRevealed && c.gemRevealed.id === 'naranja');
    const hasAmberCardEffect = board.some(c => c !== null && c.owner === player && c.hasTCGAmberEffect);
    return (controlledNaranja || hasAmberCardEffect) ? 4 : 3;
}

function hasPlayerControlledGem(player, gemId) {
    return board.some(c => c !== null && c.owner === player && c.gemRevealed && c.gemRevealed.id === gemId);
}

function spawnEnergyParticles() {
    const energyBadge = document.getElementById('energy-badge');
    if (!energyBadge) return;
    energyBadge.classList.remove('energy-pulse');
    void energyBadge.offsetWidth;
    energyBadge.classList.add('energy-pulse');

    const rect = energyBadge.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'energy-particle';
        const angle = Math.random() * Math.PI * 2;
        const distance = 20 + Math.random() * 20;
        particle.style.left = `${centerX}px`;
        particle.style.top = `${centerY}px`;
        particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 600);
    }
}

function spawnConquestParticles(node, playerColor) {
    const wrapper = document.getElementById('board-wrapper');
    if (!node || !wrapper) return;
    const rect = node.getBoundingClientRect();
    const boardRect = wrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 - boardRect.left;
    const centerY = rect.top + rect.height / 2 - boardRect.top;

    const ring = document.createElement('div');
    ring.className = `conquest-ring ${playerColor}`;
    ring.style.left = `${centerX}px`;
    ring.style.top = `${centerY}px`;
    wrapper.appendChild(ring);
    setTimeout(() => ring.remove(), 500);

    for (let i = 0; i < 16; i++) {
        const spark = document.createElement('div');
        spark.className = `conquest-spark ${playerColor}`;
        const angle = Math.random() * Math.PI * 2;
        const distance = 25 + Math.random() * 45;
        spark.style.left = `${centerX}px`;
        spark.style.top = `${centerY}px`;
        spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
        wrapper.appendChild(spark);
        setTimeout(() => spark.remove(), 600);
    }
}

function startTurn(player) {
    if (isTutorialSession && player === 'red') {
        tutorialTurnCount += 1;
        tutorialTurn2DoneWaitingNextTurn = false;
        tutorialTurn3DoneWaitingNextTurn = false;
        if (tutorialTurnCount === 2) {
            tutorialStep = 4;
            if (!discards.red || discards.red.length === 0) {
                discards.red = [{
                    val: 5,
                    top: 5,
                    right: 5,
                    bottom: 5,
                    left: 1,
                    specialDir: 'left',
                    powerCondition: 'none',
                    powerEffect: 'none'
                }];
            }
            if (!decks.red || decks.red.length === 0) {
                decks.red = [{
                    val: 6,
                    top: 6,
                    right: 6,
                    bottom: 6,
                    left: 2,
                    specialDir: 'top',
                    powerCondition: 'none',
                    powerEffect: 'none'
                }];
            }
        } else if (tutorialTurnCount === 3) {
            enableSpecialAttackModesForTutorial();
            tutorialStep = 8;
        } else if (tutorialTurnCount >= 4) {
            tutorialStep = 10;
            ensureAtLeastOneGemVisibleForTutorial();
        }
    }

    turn = player;
    syncPermanentBoardEffects();
    maxEnergy = getMaxEnergyForPlayer(player);
    if (maxEnergy > currentEnergy) spawnEnergyParticles();
    currentEnergy = maxEnergy;

    board.forEach(c => {
        if (c) {
            if (c.quartzAuraOwner === player) {
                c.quartzAuraTempBuff = 0;
                c.quartzAuraOwner = null;
            }
            if (c.diamondTempShield && c.diamondShieldOwner === player) {
                c.diamondTempShield = false;
                c.diamondShieldOwner = null;
                c.isProtected = (c.gemRevealed && c.gemRevealed.protected) || false;
            }
        }
    });

    isMapamundiActive = false;
    isDiagonalActive = false;
    usedRedEnergyBonusThisTurn = false;
    usedBlueEnergyBonusThisTurn = false;
    usedYellowEnergyBonusThisTurn = false;
    usedBlackEnergyBonusThisTurn = false;

    isInspectMode = false;
    selectedCard = null; selectedHandIndex = null; selectedBoardIndex = null;
    const atkPanel = document.getElementById('attack-panel');
    if (atkPanel) atkPanel.classList.add('hidden');

    comboFlashTriggers.red = true;
    comboFlashTriggers.blue = true;

    const log = `Turno de ${turn === 'red' ? 'Rojo' : 'Azul'}. Energía: ${currentEnergy}⚡.`;
    syncGameState(log);
}

function endTurnManual() {
    playSound('click');
    triggerVibrate(20);
    if (!isMyTurn()) return;
    const nextTurn = turn === 'red' ? 'blue' : 'red';
    startTurn(nextTurn);
}

function actionActivateMapamundi() {
    playSound('click');
    triggerVibrate(30);
    if (!isMyTurn()) return;
    if (isTutorialSpecialModeLocked()) return;
    if (!isToroidalOptionEnabled()) {
        const logEl = document.getElementById('log-message');
        if (logEl) logEl.innerText = "🔒 Activá 'Ataque por Borde Opuesto' en ⚙️ para usarlo.";
        return;
    }
    if (isMapamundiActive) return;
    if (currentEnergy < 1) {
        triggerVibrate([30, 30]);
        const logEl = document.getElementById('log-message');
        if (logEl) logEl.innerText = "⚡ Necesitás 1⚡ para activar Atq. borde opuesto.";
        return;
    }

    currentEnergy -= 1;
    isMapamundiActive = true;
    advanceTutorialOnSpecialActivation('toroidal');
    spawnEnergyParticles();

    syncGameState(`🌍 ¡Atq. borde opuesto Activado! Los ataques atraviesan los bordes (-1⚡).`);
    const gridEl = document.getElementById('dynamic-grid');
    if (gridEl) gridEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function toggleDiagonal() {
    playSound('click');
    triggerVibrate(30);
    if (!isMyTurn()) return;
    if (isTutorialSpecialModeLocked()) return;
    if (!isDiagonalOptionEnabled()) {
        const logEl = document.getElementById('log-message');
        if (logEl) logEl.innerText = "🔒 Activá 'Ataque Diagonal' en ⚙️ para usarlo.";
        return;
    }
    if (isDiagonalActive) return;
    if (currentEnergy < 1) {
        triggerVibrate([30, 30]);
        const logEl = document.getElementById('log-message');
        if (logEl) logEl.innerText = "⚡ Necesitás 1⚡ para activar Atq. Diagonal.";
        return;
    }

    currentEnergy -= 1;
    isDiagonalActive = true;
    advanceTutorialOnSpecialActivation('diagonal');
    spawnEnergyParticles();

    syncGameState(`❖ ¡Ataque Diagonal Activado! Esquinas visibles (-1⚡).`);
    const gridEl = document.getElementById('dynamic-grid');
    if (gridEl) gridEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function getAttackTarget(idx, dir) {
    const row = Math.floor(idx / 3);
    const col = idx % 3;

    let targetRow = row;
    let targetCol = col;
    let oppSide = '';

    const toroidalAllowed = isToroidalOptionEnabled() && isMapamundiActive;
    const diagonalAllowed = isDiagonalOptionEnabled() && isDiagonalActive;

    if (dir === 'top') {
        targetRow = row - 1; oppSide = 'bottom';
        if (targetRow < 0) { if (!toroidalAllowed) return null; targetRow = 2; }
    } else if (dir === 'bottom') {
        targetRow = row + 1; oppSide = 'top';
        if (targetRow > 2) { if (!toroidalAllowed) return null; targetRow = 0; }
    } else if (dir === 'left') {
        targetCol = col - 1; oppSide = 'right';
        if (targetCol < 0) { if (!toroidalAllowed) return null; targetCol = 2; }
    } else if (dir === 'right') {
        targetCol = col + 1; oppSide = 'left';
        if (targetCol > 2) { if (!toroidalAllowed) return null; targetCol = 0; }
    } else if (dir === 'top-left') {
        if (!diagonalAllowed) return null;
        targetRow = row - 1; targetCol = col - 1; oppSide = 'bottom-right';
        if (targetRow < 0 || targetCol < 0) {
            if (!toroidalAllowed) return null;
            if (targetRow < 0) targetRow = 2;
            if (targetCol < 0) targetCol = 2;
        }
    } else if (dir === 'top-right') {
        if (!diagonalAllowed) return null;
        targetRow = row - 1; targetCol = col + 1; oppSide = 'bottom-left';
        if (targetRow < 0 || targetCol > 2) {
            if (!toroidalAllowed) return null;
            if (targetRow < 0) targetRow = 2;
            if (targetCol > 2) targetCol = 0;
        }
    } else if (dir === 'bottom-left') {
        if (!diagonalAllowed) return null;
        targetRow = row + 1; targetCol = col - 1; oppSide = 'top-right';
        if (targetRow > 2 || targetCol < 0) {
            if (!toroidalAllowed) return null;
            if (targetRow > 2) targetRow = 0;
            if (targetCol < 0) targetCol = 2;
        }
    } else if (dir === 'bottom-right') {
        if (!diagonalAllowed) return null;
        targetRow = row + 1; targetCol = col + 1; oppSide = 'top-left';
        if (targetRow > 2 || targetCol > 2) {
            if (!toroidalAllowed) return null;
            if (targetRow > 2) targetRow = 0;
            if (targetCol > 2) targetCol = 0;
        }
    }

    const targetIdx = targetRow * 3 + targetCol;
    return { targetIdx, oppSide };
}

function checkIfAnyAttackPossible() {
    const directions = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const realMapamundiState = isMapamundiActive;
    const realDiagonalState = isDiagonalActive;

    isMapamundiActive = isToroidalOptionEnabled();
    isDiagonalActive = isDiagonalOptionEnabled();

    let attackFound = false;

    for (let idx = 0; idx < 9; idx++) {
        const cell = board[idx];
        if (!cell) continue;

        const attVals = getEffectiveCardValues(idx);

        for (const dir of directions) {
            const targetInfo = getAttackTarget(idx, dir);
            if (targetInfo && targetInfo.targetIdx !== null) {
                const targetIdx = targetInfo.targetIdx;
                const defender = board[targetIdx];

                if (defender && defender.owner !== cell.owner && !defender.isProtected) {
                    const defVals = getEffectiveCardValues(targetIdx);
                    if (attVals[dir] > defVals[targetInfo.oppSide]) {
                        attackFound = true;
                        break;
                    }
                }
            }
        }
        if (attackFound) break;
    }

    isMapamundiActive = realMapamundiState;
    isDiagonalActive = realDiagonalState;
    return attackFound;
}

function triggerVictoryModal(title, detail) {
    playSound('win');
    triggerVibrate([80, 50, 80]);
    const winText = document.getElementById('winner-text');
    const winDetail = document.getElementById('winner-detail');
    const winModal = document.getElementById('game-over-modal');
    if (winText) winText.innerText = title;
    if (winDetail) winDetail.innerText = detail;
    if (winModal) winModal.style.display = 'flex';

    const particlesContainer = document.getElementById('victory-particles-container');
    if (particlesContainer) {
        particlesContainer.innerHTML = '';
        for (let i = 0; i < 22; i++) {
            const p = document.createElement('div');
            p.className = 'victory-particle';
            p.style.left = `${Math.random() * 100}%`;
            p.style.top = `${50 + Math.random() * 50}%`;
            p.style.animationDelay = `${Math.random() * 1.5}s`;
            p.style.animationDuration = `${0.9 + Math.random() * 1.1}s`;
            particlesContainer.appendChild(p);
        }
    }
}

function claimVictory() {
    playSound('click');
    triggerVibrate(40);
    const redTotal = getPlayerTotalScore('red');
    const blueTotal = getPlayerTotalScore('blue');

    const title = "👑 ¡Victoria por Bloqueo Táctico!";
    const winnerText = redTotal > blueTotal ? "Jugador Rojo" : (blueTotal > redTotal ? "Jugador Azul" : "Empate");
    const detail = redTotal === blueTotal
        ? `¡Empate técnico!\n(Rojo: ${redTotal} - Azul: ${blueTotal} puntos)`
        : `¡Victoria de ${winnerText} por superioridad táctica!\n(Rojo: ${redTotal} - Azul: ${blueTotal} puntos)`;

    triggerVictoryModal(title, detail);
}

function inspectBoardAfterVictory() {
    playSound('click');
    triggerVibrate(20);
    const winModal = document.getElementById('game-over-modal');
    if (winModal) winModal.style.display = 'none';
    const logEl = document.getElementById('log-message');
    if (logEl) logEl.innerText = "🔍 Modo Análisis: Analizando tablero final.";

    let analysisBar = document.getElementById('analysis-bar');
    if (!analysisBar) {
        analysisBar = document.createElement('div');
        analysisBar.id = 'analysis-bar';
        analysisBar.style.cssText = "background: rgba(14, 165, 233, 0.2); border: 1px solid #38bdf8; padding: 6px; border-radius: 8px; text-align: center; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;";
        analysisBar.innerHTML = `
            <span style="font-size: 0.6rem; color: #38bdf8; font-weight: bold;">🔍 Modo Análisis Activo</span>
            <button onclick="resetGame()" class="btn-pass" style="padding: 3px 8px; font-size: 0.55rem;">Reiniciar Partida</button>
        `;
        const boardWrapper = document.getElementById('board-wrapper');
        if (boardWrapper && boardWrapper.parentNode) {
            boardWrapper.parentNode.insertBefore(analysisBar, boardWrapper);
        }
    } else {
        analysisBar.style.display = 'flex';
    }
}

function executeAITurn() {
    if (turn !== 'blue' || gameMode !== 'ai') return;

    const isBoardFull = board.every(c => c !== null);
    if (isBoardFull && !checkIfAnyAttackPossible()) {
        claimVictory();
        return;
    }

    if (aiDifficulty === 'easy') {
        if (currentEnergy >= 2 && hands.blue.length > 0) {
            const emptyCells = board.map((c, i) => c === null ? i : null).filter(i => i !== null);
            if (emptyCells.length > 0) {
                const targetCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
                const cardIdx = Math.floor(Math.random() * hands.blue.length);
                aiPlayCard(cardIdx, targetCell);
                return;
            }
        }
        startTurn('red');
        return;
    }

    let bestAttack = findBestAIAttack();
    if (bestAttack) { aiExecuteAttack(bestAttack); return; }

    if (aiDifficulty === 'hard' && isToroidalOptionEnabled() && !isMapamundiActive && currentEnergy >= 2) {
        isMapamundiActive = true;
        currentEnergy -= 1;
        bestAttack = findBestAIAttack();
        if (bestAttack) { aiExecuteAttack(bestAttack); return; }
        currentEnergy += 1;
        isMapamundiActive = false;
    }

    if (currentEnergy >= 2 && hands.blue.length > 0) {
        const emptyCells = board.map((c, i) => c === null ? i : null).filter(i => i !== null);
        if (emptyCells.length > 0) {
            let bestPlacement = findBestAICardPlacement();
            if (!bestPlacement) {
                const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
                bestPlacement = { handIndex: 0, boardIndex: randomCell };
            }
            aiPlayCard(bestPlacement.handIndex, bestPlacement.boardIndex);
            return;
        }
    }

    if (currentEnergy >= 1) {
        if (decks.blue.length > 0 && hands.blue.length < 5) { actionDrawCard(); return; }
        if (discards.blue.length > 0) { actionRecoverDiscard(); return; }
    }

    startTurn('red');
}

function findBestAIAttack() {
    if (currentEnergy < 1) return null;
    const possibleAttacks = [];
    const directions = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

    board.forEach((cell, idx) => {
        if (cell && cell.owner === 'blue') {
            directions.forEach(dir => {
                const targetInfo = getAttackTarget(idx, dir);
                if (targetInfo) {
                    const targetIdx = targetInfo.targetIdx;
                    if (targetIdx !== null && board[targetIdx] && board[targetIdx].owner === 'red' && !board[targetIdx].isProtected) {
                        const attVals = getEffectiveCardValues(idx);
                        const defVals = getEffectiveCardValues(targetIdx);

                        if (attVals[dir] > defVals[targetInfo.oppSide]) {
                            let priority = 10;
                            const gemTarget = gems[targetIdx];
                            if (aiDifficulty === 'hard' && gemTarget) {
                                if (gemTarget.id === 'violeta' || gemTarget.id === 'naranja') priority += 20;
                                if (gemTarget.pts >= 2) priority += 15;
                            }
                            possibleAttacks.push({ from: idx, dir: dir, priority: priority });
                        }
                    }
                }
            });
        }
    });

    if (possibleAttacks.length === 0) return null;
    possibleAttacks.sort((a, b) => b.priority - a.priority);
    return possibleAttacks[0];
}

function findBestAICardPlacement() {
    const emptyCells = board.map((c, i) => c === null ? i : null).filter(i => i !== null);
    if (emptyCells.length === 0) return null;

    let bestChoice = null; let maxScore = -999;
    hands.blue.forEach((card, hIdx) => {
        emptyCells.forEach(bIdx => {
            let score = card.top + card.bottom + card.left + card.right;
            const gem = gems[bIdx];
            if (isAITCGModeEnabled() && card.powerEffect && card.powerEffect !== 'none') score += 6;
            if (aiDifficulty === 'hard' && gem) {
                if (gem.id === 'violeta') score += 15;
                if (gem.id === 'naranja') score += 10;
                if (gem.id === 'blanco') score += 8;
            }
            if (score > maxScore) { maxScore = score; bestChoice = { handIndex: hIdx, boardIndex: bIdx }; }
        });
    });

    return bestChoice;
}

function aiPlayCard(handIdx, boardIdx) {
    playSound('fly');
    triggerVibrate(35);
    const card = hands.blue[handIdx];
    const playCost = getCardPlayEnergyCost(card, 'blue');
    currentEnergy -= playCost;
    const gem = gems[boardIdx] || GEM_TYPES[0];
    revealedBoardGems[boardIdx] = true;

    const playedCard = {
        val: card.val,
        top: card.top, right: card.right, bottom: card.bottom, left: card.left,
        specialDir: card.specialDir,
        powerCondition: card.powerCondition,
        powerEffect: card.powerEffect,
        energyCost: playCost,
        targetGemId: card.targetGemId || null,
        owner: 'blue', gemRevealed: gem, isProtected: gem.protected || false
    };

    board[boardIdx] = playedCard;
    hands.blue.splice(handIdx, 1);
    newlyDrawnCardIndex.blue = null;
    newlyDeployedCellIndex = boardIdx;

    let logText = `🤖 IA jugó en ${gem.name}! (-${playCost}⚡)`;

    const tcgRes = triggerTCGPower(playedCard, board, 'blue', currentEnergy, decks, hands, discards, boardIdx);
    const activeBoardIdx = typeof tcgRes.finalBoardIndex === 'number' ? tcgRes.finalBoardIndex : boardIdx;
    const activeGem = (board[activeBoardIdx] && board[activeBoardIdx].gemRevealed) || gem;

    if (tcgRes.logText) logText += tcgRes.logText;
    if (tcgRes.energyDelta) {
        currentEnergy += tcgRes.energyDelta;
        spawnEnergyParticles();
    }

    const gemDeployRes = applyGemDeployEffect(activeGem, 'blue', activeBoardIdx);
    if (gemDeployRes.logText) logText += gemDeployRes.logText;
    if (gemDeployRes.energyDelta) {
        currentEnergy += gemDeployRes.energyDelta;
        spawnEnergyParticles();
    }

    syncPermanentBoardEffects();

    syncGameState(logText);
}

function aiExecuteAttack(attackData) {
    selectedBoardIndex = attackData.from;
    executeAttack(attackData.dir);
}

function selectHandCard(player, index) {
    playSound('click');
    triggerVibrate(20);
    if (!isMyTurn()) return;
    const candidateCard = hands[player][index];
    const playCost = getCardPlayEnergyCost(candidateCard, player);
    if (currentEnergy < playCost) {
        triggerVibrate([30, 30]);
        return;
    }
    isInspectMode = false;
    selectedCard = candidateCard;
    selectedHandIndex = index;
    selectedBoardIndex = null;
    const atkPanel = document.getElementById('attack-panel');
    if (atkPanel) atkPanel.classList.add('hidden');
    const statusTag = getSelectedCardStatusTag(candidateCard, player);
    const logEl = document.getElementById('log-message');
    if (logEl) logEl.innerText = `Tocá casilla vacía para JUGAR la carta (${playCost}⚡)${statusTag}.`;
    render();
}

function toggleInspectMode() {
    playSound('click');
    triggerVibrate(20);
    if (!isMyTurn()) return;
    if (isTutorialSideActionLocked()) return;
    const controlsViolet = hasPlayerControlledGem(turn, 'violeta');
    const inspectCost = controlsViolet ? 0 : 1;

    if (currentEnergy < inspectCost) {
        triggerVibrate([30, 30]);
        return;
    }
    isInspectMode = !isInspectMode;
    selectedCard = null; selectedHandIndex = null; selectedBoardIndex = null;
    const atkPanel = document.getElementById('attack-panel');
    if (atkPanel) atkPanel.classList.add('hidden');
    const logEl = document.getElementById('log-message');
    if (logEl) logEl.innerText = isInspectMode ? `👁️ Inspección activa (${inspectCost}⚡). Tocá casilla vacía.` : "Inspección cancelada.";
    render();
}

function handleBoardClick(index) {
    if (!isMyTurn()) return;

    if (isInspectMode && !isTutorialSideActionLocked()) {
        if (board[index] === null) {
            if (revealedBoardGems[index]) return;
            const controlsViolet = hasPlayerControlledGem(turn, 'violeta');
            const inspectCost = controlsViolet ? 0 : 1;

            if (currentEnergy < inspectCost) {
                triggerVibrate([30, 30]);
                return;
            }

            currentEnergy -= inspectCost;
            revealedBoardGems[index] = true;
            isInspectMode = false;
            if (isTutorialSession && turn === 'red' && tutorialStep === 7) {
                tutorialTurn2DoneWaitingNextTurn = true;
            }
            triggerVibrate(30);

            const gName = gems[index] ? gems[index].name : "Gema";
            const logText = `👁️ ${turn === 'red' ? 'Rojo' : 'Azul'} reveló ${gName}!`;
            syncGameState(logText);
            return;
        }
    }

    if (selectedCard !== null && board[index] === null) {
        const playCost = getCardPlayEnergyCost(selectedCard, turn);
        if (currentEnergy < playCost) {
            triggerVibrate([30, 30]);
            return;
        }
        playSound('fly');
        playCard(index);
        return;
    }

    if (board[index] !== null && board[index].owner === turn) {
        if (currentEnergy < 1) {
            triggerVibrate([30, 30]);
            return;
        }
        playSound('click');
        triggerVibrate(25);
        selectedBoardIndex = index;
        selectedCard = null; selectedHandIndex = null;
        const atkPanel = document.getElementById('attack-panel');
        if (atkPanel) atkPanel.classList.remove('hidden');
        const logEl = document.getElementById('log-message');
        if (logEl) logEl.innerText = "Elegí dirección para ATACAR (1⚡).";
        render();
    }
}

function cancelAttack() {
    playSound('click');
    triggerVibrate(15);
    selectedBoardIndex = null;
    const atkPanel = document.getElementById('attack-panel');
    if (atkPanel) atkPanel.classList.add('hidden');
    const logEl = document.getElementById('log-message');
    if (logEl) logEl.innerText = "Ataque cancelado.";
    render();
}

function playCard(index) {
    const playCost = getCardPlayEnergyCost(selectedCard, turn);
    if (currentEnergy < playCost) {
        triggerVibrate([30, 30]);
        return;
    }

    currentEnergy -= playCost;
    const gem = gems[index] || GEM_TYPES[0];
    revealedBoardGems[index] = true;

    const playedCard = {
        val: selectedCard.val,
        top: selectedCard.top, right: selectedCard.right, bottom: selectedCard.bottom, left: selectedCard.left,
        specialDir: selectedCard.specialDir,
        powerCondition: selectedCard.powerCondition,
        powerEffect: selectedCard.powerEffect,
        energyCost: playCost,
        targetGemId: selectedCard.targetGemId || null,
        owner: turn, gemRevealed: gem,
        isProtected: gem.protected || false
    };

    board[index] = playedCard;
    hands[turn].splice(selectedHandIndex, 1);
    newlyDrawnCardIndex[turn] = null;
    newlyDeployedCellIndex = index;
    if (isTutorialSession && turn === 'red' && tutorialStep === 0) {
        tutorialStep = hasOrthogonalAttackableEnemyForPlayer('red') ? 1 : 2;
    }
    triggerVibrate(35);

    let logText = `${turn === 'red' ? 'Rojo' : 'Azul'} jugó en ${gem.name}! (-${playCost}⚡)`;

    const tcgRes = triggerTCGPower(playedCard, board, turn, currentEnergy, decks, hands, discards, index);
    const activeBoardIdx = typeof tcgRes.finalBoardIndex === 'number' ? tcgRes.finalBoardIndex : index;
    const activeGem = (board[activeBoardIdx] && board[activeBoardIdx].gemRevealed) || gem;

    if (tcgRes.logText) logText += tcgRes.logText;
    if (tcgRes.energyDelta) {
        currentEnergy += tcgRes.energyDelta;
        spawnEnergyParticles();
    }

    const gemDeployRes = applyGemDeployEffect(activeGem, turn, activeBoardIdx);
    if (gemDeployRes.logText) logText += gemDeployRes.logText;
    if (gemDeployRes.energyDelta) {
        currentEnergy += gemDeployRes.energyDelta;
        spawnEnergyParticles();
    }

    syncPermanentBoardEffects();

    selectedCard = null; selectedHandIndex = null;
    syncGameState(logText);
}

function actionDrawCard() {
    playSound('click');
    if (isTutorialSideActionLocked()) return;
    if (currentEnergy < 1 || !decks[turn] || decks[turn].length === 0) {
        triggerVibrate([30, 30]);
        return;
    }
    triggerVibrate(25);
    currentEnergy -= 1;
    hands[turn].push(decks[turn].pop());
    newlyDrawnCardIndex[turn] = hands[turn].length - 1;
    if (isTutorialSession && turn === 'red' && tutorialStep === 4) {
        tutorialStep = 5;
    }

    let logText = `${turn === 'red' ? 'Rojo' : 'Azul'} robó 1 carta (-1⚡).`;

    const controlledGemIds = board.filter(c => c !== null && c.owner === turn && c.gemRevealed).map(c => c.gemRevealed.id);
    const hasZafiroCardEffect = board.some(c => c !== null && c.owner === turn && c.hasTCGZafiroEffect);

    if ((controlledGemIds.includes('azul') || hasZafiroCardEffect) && !usedBlueEnergyBonusThisTurn) {
        usedBlueEnergyBonusThisTurn = true;
        currentEnergy += 1;
        spawnEnergyParticles();
        logText += ` 🔵 [+1⚡ Bonus Zafiro]`;
    }

    syncGameState(logText);
}

function actionRecoverDiscard() {
    playSound('click');
    if (isTutorialSideActionLocked()) return;
    if (currentEnergy < 1 || !discards[turn] || discards[turn].length === 0) {
        triggerVibrate([30, 30]);
        return;
    }
    triggerVibrate(25);
    currentEnergy -= 1;
    for (let i = 0; i < 2; i++) {
        if (discards[turn].length > 0) decks[turn].push(discards[turn].pop());
    }
    if (isTutorialSession && turn === 'red' && tutorialStep === 5) {
        tutorialStep = 6;
    }

    let logText = `${turn === 'red' ? 'Rojo' : 'Azul'} recuperó cartas al mazo (-1⚡).`;
    const controlledGemIds = board.filter(c => c !== null && c.owner === turn && c.gemRevealed).map(c => c.gemRevealed.id);
    const hasTopacioCardEffect = board.some(c => c !== null && c.owner === turn && c.hasTCGTopacioEffect);

    if ((controlledGemIds.includes('amarillo') || hasTopacioCardEffect) && !usedYellowEnergyBonusThisTurn) {
        usedYellowEnergyBonusThisTurn = true;
        currentEnergy += 1;
        spawnEnergyParticles();
        logText += ` 🟡 [+1⚡ Bonus Topacio]`;
    }

    syncGameState(logText);
}

function actionDiscardOpponent() {
    playSound('click');
    if (isTutorialSideActionLocked()) return;
    if (currentEnergy < 1) {
        triggerVibrate([30, 30]);
        return;
    }
    const opponent = turn === 'red' ? 'blue' : 'red';
    if (!hands[opponent] || hands[opponent].length === 0) return;

    triggerVibrate(30);
    currentEnergy -= 1;
    const randomIdx = Math.floor(Math.random() * hands[opponent].length);
    if (isTutorialSession && turn === 'red' && tutorialStep === 6) {
        tutorialStep = 7;
    }

    discardingCardInfo = { player: opponent, cardIndex: randomIdx };

    let logText = `${turn === 'red' ? 'Rojo' : 'Azul'} descartó 1 carta al rival (-1⚡).`;
    const controlledGemIds = board.filter(c => c !== null && c.owner === turn && c.gemRevealed).map(c => c.gemRevealed.id);
    const hasOnixCardEffect = board.some(c => c !== null && c.owner === turn && c.hasTCGOnixEffect);

    if ((controlledGemIds.includes('negro') || hasOnixCardEffect) && !usedBlackEnergyBonusThisTurn) {
        usedBlackEnergyBonusThisTurn = true;
        currentEnergy += 1;
        spawnEnergyParticles();
        logText += ` 🖤 [+1⚡ Bonus Ónix]`;
    }

    render();

    setTimeout(() => {
        const discarded = hands[opponent].splice(randomIdx, 1)[0];
        discards[opponent].push(discarded);
        discardingCardInfo = { player: null, cardIndex: null };
        syncGameState(logText);
    }, 300);
}

function getEffectiveCardValues(boardIndex) {
    const card = board[boardIndex];
    if (!card) return null;

    const owner = card.owner;
    const ownerGemIds = board.filter(c => c !== null && c.owner === owner && c.gemRevealed).map(c => c.gemRevealed.id);
    const hasMarron = ownerGemIds.includes('marron');
    const hasAnyQuartzCardEffect = board.some(c => c !== null && c.owner === owner && c.hasTCGQuartzEffect);
    const cardGemId = card.gemRevealed ? card.gemRevealed.id : null;

    const values = {
        top: card.top, right: card.right, bottom: card.bottom, left: card.left,
        'top-left': (card.top + card.left) / 2,
        'top-right': (card.top + card.right) / 2,
        'bottom-left': (card.bottom + card.left) / 2,
        'bottom-right': (card.bottom + card.right) / 2
    };
    const boosted = { top: false, right: false, bottom: false, left: false };

    if (hasMarron || hasAnyQuartzCardEffect) {
        const currentMax = Math.max(card.top, card.right, card.bottom, card.left);
        ['top', 'right', 'bottom', 'left'].forEach(dir => {
            if (card[dir] < currentMax) boosted[dir] = true;
            values[dir] = currentMax;
        });
    }

    if (card.quartzAuraTempBuff && card.quartzAuraTempBuff > 0) {
        ['top', 'right', 'bottom', 'left'].forEach(dir => {
            values[dir] += card.quartzAuraTempBuff;
            boosted[dir] = true;
        });
    }

    values['top-left'] = (values.top + values.left) / 2;
    values['top-right'] = (values.top + values.right) / 2;
    values['bottom-left'] = (values.bottom + values.left) / 2;
    values['bottom-right'] = (values.bottom + values.right) / 2;

    if (cardGemId === 'blanco') {
        ['top', 'right', 'bottom', 'left', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(dir => {
            values[dir] *= 2;
        });
    }
    return { ...values, boosted };
}

function executeAttack(dir) {
    if (selectedBoardIndex === null || currentEnergy < 1) {
        triggerVibrate([30, 30]);
        return;
    }

    const idx = selectedBoardIndex;
    const targetInfo = getAttackTarget(idx, dir);

    if (!targetInfo || targetInfo.targetIdx === null) return;
    const targetIdx = targetInfo.targetIdx;
    const oppSide = targetInfo.oppSide;

    if (board[targetIdx] === null) return;
    const defender = board[targetIdx];
    if (defender.owner === turn || defender.isProtected) return;

    const atkPanel = document.getElementById('attack-panel');
    if (atkPanel) atkPanel.classList.add('hidden');
    playSound('fly');

    const gridEl = document.getElementById('dynamic-grid');
    if (!gridEl) {
        processAttackLogic(idx, targetIdx, dir, oppSide);
        return;
    }
    const gridNodes = gridEl.children;

    const toroidalVisual = isToroidalOptionEnabled() && isMapamundiActive;
    let attackerVisualIdx = idx;
    let targetVisualIdx = targetIdx;
    if (toroidalVisual) {
        const rFrom = Math.floor(idx / 3) + 1;
        const cFrom = (idx % 3) + 1;
        attackerVisualIdx = rFrom * 5 + cFrom;

        const rTo = Math.floor(targetIdx / 3) + 1;
        const cTo = (targetIdx % 3) + 1;
        targetVisualIdx = rTo * 5 + cTo;
    }

    const attackerNode = gridNodes[attackerVisualIdx];
    const targetNode = gridNodes[targetVisualIdx];

    if (!attackerNode || !targetNode) {
        processAttackLogic(idx, targetIdx, dir, oppSide);
        return;
    }

    const sourceRect = attackerNode.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();
    const boardRect = gridEl.getBoundingClientRect();

    const deltaX = targetRect.left - sourceRect.left;
    const deltaY = targetRect.top - sourceRect.top;

    const isToroidalWrap = toroidalVisual && (
        (dir === 'top' && Math.floor(idx / 3) === 0) ||
        (dir === 'bottom' && Math.floor(idx / 3) === 2) ||
        (dir === 'left' && (idx % 3) === 0) ||
        (dir === 'right' && (idx % 3) === 2) ||
        dir.includes('top-left') || dir.includes('top-right') || dir.includes('bottom-left') || dir.includes('bottom-right')
    );

    const flyer = document.createElement('div');
    flyer.className = `flying-projectile ${board[idx].owner === 'red' ? 'card-red' : 'card-blue'}`;
    flyer.style.left = `${sourceRect.left - boardRect.left}px`;
    flyer.style.top = `${sourceRect.top - boardRect.top}px`;
    flyer.style.width = `${sourceRect.width}px`;
    flyer.style.height = `${sourceRect.height}px`;

    flyer.innerHTML = attackerNode.innerHTML;
    const boardWrapper = document.getElementById('board-wrapper');
    if (boardWrapper) boardWrapper.appendChild(flyer);

    attackerNode.style.opacity = '0';

    requestAnimationFrame(() => {
        if (isToroidalWrap) {
            let outX = 0, outY = 0;
            if (dir.includes('top')) outY = -sourceRect.height * 1.5;
            if (dir.includes('bottom')) outY = sourceRect.height * 1.5;
            if (dir.includes('left')) outX = -sourceRect.width * 1.5;
            if (dir.includes('right')) outX = sourceRect.width * 1.5;

            flyer.style.transform = `translate3d(${outX}px, ${outY}px, 0) scale(0.6)`;
            flyer.style.opacity = '0.2';

            setTimeout(() => {
                flyer.style.transition = 'none';
                const inX = outX * -1;
                const inY = outY * -1;
                flyer.style.transform = `translate3d(${deltaX + inX}px, ${deltaY + inY}px, 0) scale(0.6)`;
                flyer.style.opacity = '0.2';

                requestAnimationFrame(() => {
                    flyer.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease-out';
                    flyer.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(1.05)`;
                    flyer.style.opacity = '1';
                });
            }, 200);
        } else {
            flyer.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(1.05)`;
        }
    });

    setTimeout(() => {
        playSound('hit');
        triggerVibrate(50);
        targetNode.classList.add('anim-target-hit');

        const attVals = getEffectiveCardValues(idx);
        if (attVals[dir] >= 8) {
            const gameCont = document.getElementById('game-container');
            if (gameCont) {
                gameCont.classList.add('screen-shake');
                setTimeout(() => gameCont.classList.remove('screen-shake'), 300);
            }
        }

        setTimeout(() => {
            flyer.remove();
            attackerNode.style.opacity = '1';
            processAttackLogic(idx, targetIdx, dir, oppSide);
        }, 200);
    }, isToroidalWrap ? 550 : 350);
}

function processAttackLogic(idx, targetIdx, dir, oppSide) {
    currentEnergy -= 1;
    const attVals = getEffectiveCardValues(idx);
    const defVals = getEffectiveCardValues(targetIdx);

    const attackVal = attVals[dir];
    const defenseVal = defVals[oppSide];
    let attackMsg = "";

    const controlledBeforeAttack = board.filter(c => c !== null && c.owner === turn && c.gemRevealed).map(c => c.gemRevealed.id);
    const hasRedBeforeAttack = controlledBeforeAttack.includes('rojo');
    const hasRubíCardEffect = board.some(c => c !== null && c.owner === turn && c.hasTCGRubyEffect);

    if (attackVal > defenseVal) {
        const defender = board[targetIdx];
        discards[defender.owner].push(defender);
        const attackerCard = board[idx];
        const targetGem = gems[targetIdx] || GEM_TYPES[0];
        revealedBoardGems[targetIdx] = true;

        attackerCard.gemRevealed = targetGem;
        attackerCard.isProtected = (targetGem.protected || attackerCard.diamondTempShield) || false;

        board[targetIdx] = attackerCard;
        board[idx] = null;
        newlyDeployedCellIndex = null;

        const toroidalVisual = isToroidalOptionEnabled() && isMapamundiActive;
        let targetVisualIdx = targetIdx;
        if (toroidalVisual) {
            const rTo = Math.floor(targetIdx / 3) + 1;
            const cTo = (targetIdx % 3) + 1;
            targetVisualIdx = rTo * 5 + cTo;
        }
        const gridEl = document.getElementById('dynamic-grid');
        if (gridEl && gridEl.children[targetVisualIdx]) {
            spawnConquestParticles(gridEl.children[targetVisualIdx], turn);
        }

        attackMsg = `⚔️ ¡ATAQUE EXITOSO! Conquistó ${targetGem.name} (-1⚡).`;

        const gemDeployRes = applyGemDeployEffect(targetGem, turn, targetIdx);
        if (gemDeployRes.logText) attackMsg += gemDeployRes.logText;
        if (gemDeployRes.energyDelta) {
            currentEnergy += gemDeployRes.energyDelta;
            spawnEnergyParticles();
        }

        if ((hasRedBeforeAttack || hasRubíCardEffect) && !usedRedEnergyBonusThisTurn) {
            usedRedEnergyBonusThisTurn = true;
            currentEnergy += 1;
            spawnEnergyParticles();
            attackMsg += ` 🔴 [+1⚡ Bonus Rubí]`;
        }

        syncPermanentBoardEffects();
    } else {
        attackMsg = `🛡️ ATAQUE FALLIDO (${attackVal} vs ${defenseVal}) (-1⚡).`;
    }

    if (isTutorialSession && turn === 'red' && tutorialStep === 1) {
        didStepTwoAttack = true;
        tutorialStep = 2;
    }

    selectedBoardIndex = null;
    selectedCard = null;
    selectedHandIndex = null;
    isInspectMode = false;

    syncGameState(attackMsg);
}

function getActiveCombosDetails(player) {
    const controlledCards = board.map((c, i) => (c !== null && c.owner === player && c.gemRevealed) ? { idx: i, id: c.gemRevealed.id } : null).filter(Boolean);
    const gemIds = controlledCards.map(c => c.id);
    const hasAll = (arr) => arr.every(item => gemIds.includes(item));

    const active = [];
    if (hasAll(['azul', 'verde', 'violeta'])) active.push({ name: 'Trinidad Arcana', pts: 1 });
    if (hasAll(['rojo', 'amarillo', 'naranja'])) active.push({ name: 'Furia Elemental', pts: 1 });
    if (hasAll(['rojo', 'azul', 'amarillo'])) active.push({ name: 'Trinidad Primaria', pts: 1 });
    if (hasAll(['verde', 'naranja', 'violeta'])) active.push({ name: 'Dominio Místico', pts: 1 });
    if (hasAll(['blanco', 'negro', 'marron'])) active.push({ name: 'Trinidad Absoluta', pts: 2 });
    return active;
}

function countPlayerCombos(player) {
    return getActiveCombosDetails(player).reduce((sum, c) => sum + c.pts, 0);
}

function getComboCardsIndices(player) {
    const controlledCards = board.map((c, i) => (c !== null && c.owner === player && c.gemRevealed) ? { idx: i, id: c.gemRevealed.id } : null).filter(Boolean);
    const activeCombos = getActiveCombosDetails(player);

    const comboMap = {
        'Trinidad Arcana': ['azul', 'verde', 'violeta'],
        'Furia Elemental': ['rojo', 'amarillo', 'naranja'],
        'Trinidad Primaria': ['rojo', 'azul', 'amarillo'],
        'Dominio Místico': ['verde', 'naranja', 'violeta'],
        'Trinidad Absoluta': ['blanco', 'negro', 'marron']
    };

    const comboGemIds = new Set();
    activeCombos.forEach(c => {
        if (comboMap[c.name]) comboMap[c.name].forEach(g => comboGemIds.add(g));
    });

    return controlledCards.filter(c => comboGemIds.has(c.id)).map(c => c.idx);
}

function getPlayerTotalScore(player) {
    const controlledCards = board.filter(c => c !== null && c.owner === player && c.gemRevealed);
    const controlledGems = controlledCards.map(c => c.gemRevealed);
    const gemPts = controlledGems.reduce((sum, g) => sum + (g.pts || 0), 0);
    return gemPts + countPlayerCombos(player);
}

function checkGameOver() {
    const redTotal = getPlayerTotalScore('red');
    const blueTotal = getPlayerTotalScore('blue');

    if (redTotal >= TARGET_SCORE || blueTotal >= TARGET_SCORE) {
        const title = "¡Fin del Duelo!";
        const winnerText = redTotal >= TARGET_SCORE ? "Jugador Rojo" : "Jugador Azul";
        const winningScore = redTotal >= TARGET_SCORE ? redTotal : blueTotal;
        const detail = `¡Victoria de ${winnerText} con ${winningScore} puntos!\n(Rojo: ${redTotal} - Azul: ${blueTotal})`;

        triggerVictoryModal(title, detail);
    } else {
        const winModal = document.getElementById('game-over-modal');
        if (winModal) winModal.style.display = 'none';
    }
}

function resetGame() {
    playSound('click');
    triggerVibrate(30);
    const winModal = document.getElementById('game-over-modal');
    if (winModal) winModal.style.display = 'none';
    const analysisBar = document.getElementById('analysis-bar');
    if (analysisBar) analysisBar.style.display = 'none';

    newlyDrawnCardIndex = { red: null, blue: null };
    discardingCardInfo = { player: null, cardIndex: null };
    newlyDeployedCellIndex = null;
    lastTurnNotified = null;
    isMapamundiActive = false;
    isDiagonalActive = false;
    actionLogHistory = [];
    if (gameMode === 'ai') startAIGame();
    else if (roomRef) {
        const initialState = createInitialGameState();
        roomRef.set(initialState);
    } else {
        const initialState = createInitialGameState();
        applyGameState(initialState);
    }
}

function showTurnBanner(player) {
    const container = document.getElementById('game-container');
    if (!container) return;
    const existingBanner = container.querySelector('.turn-banner');
    if (existingBanner) existingBanner.remove();

    const banner = document.createElement('div');
    banner.className = 'turn-banner';
    const isRed = player === 'red';
    banner.style.color = isRed ? '#f43f5e' : '#38bdf8';
    banner.style.borderColor = isRed ? '#f43f5e' : '#38bdf8';
    banner.innerText = isRed ? '⚔️ TURNO ROJO ⚔️' : '⚔️ TURNO AZUL ⚔️';

    container.appendChild(banner);
    setTimeout(() => { if (banner) banner.remove(); }, 1200);
}

function renderDynamicGrid() {
    const gridEl = document.getElementById('dynamic-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const isClassic = document.body.classList.contains('skin-classic');
    const toroidalAllowed = isToroidalOptionEnabled();
    const diagonalAllowed = isDiagonalOptionEnabled();
    const showToroidalGrid = toroidalAllowed && isMapamundiActive;
    const showDiagonalNums = diagonalAllowed && isDiagonalActive;

    const redCombos = getActiveCombosDetails('red');
    const blueCombos = getActiveCombosDetails('blue');
    const redComboIndices = getComboCardsIndices('red');
    const blueComboIndices = getComboCardsIndices('blue');

    const redComboSig = redCombos.map(c => c.name).sort().join(',');
    const blueComboSig = blueCombos.map(c => c.name).sort().join(',');

    if (redComboSig !== lastComboSignatures.red) {
        comboFlashTriggers.red = true;
        lastComboSignatures.red = redComboSig;
    }
    if (blueComboSig !== lastComboSignatures.blue) {
        comboFlashTriggers.blue = true;
        lastComboSignatures.blue = blueComboSig;
    }

    const activeHumanPlayer = gameMode === 'ai' ? 'red' : (myRole || 'red');

    if (!showToroidalGrid) {
        gridEl.className = `dynamic-grid mode-3x3${showDiagonalNums ? ' diagonal-active' : ''}`;

        for (let idx = 0; idx < 9; idx++) {
            const cell = board[idx];
            const gemData = gems[idx] || GEM_TYPES[idx % GEM_TYPES.length];
            const isSelectedAttacker = selectedBoardIndex === idx;
            const isNewlyDeployed = newlyDeployedCellIndex === idx;
            const isCondMatch = isBoardCellMatchingSelectedCardCondition(cell, selectedCard, activeHumanPlayer);

            let isComboCard = false;
            if (cell) {
                if (cell.owner === 'red' && redComboIndices.includes(idx) && comboFlashTriggers.red) isComboCard = true;
                if (cell.owner === 'blue' && blueComboIndices.includes(idx) && comboFlashTriggers.blue) isComboCard = true;
            }

            const div = document.createElement('div');
            div.className = `cell-dynamic core-cell ${cell ? (cell.owner === 'red' ? 'card-red' : 'card-blue') : ''} ${isInspectMode && !revealedBoardGems[idx] ? 'inspectable' : ''} ${isSelectedAttacker ? 'selected-attacker' : ''} ${isNewlyDeployed ? 'anim-card-deploy' : ''} ${isComboCard ? 'card-combo-flash' : ''} ${isCondMatch ? 'condition-match-glow' : ''}`;
            applyConditionGlowStyle(div, isCondMatch);
            div.onclick = () => handleBoardClick(idx);

            if (cell && cell.gemRevealed) {
                const eff = getEffectiveCardValues(idx);

                let litTop = false, litBottom = false, litLeft = false, litRight = false;
                if (eff && eff.boosted) {
                    if (eff.boosted.top) litTop = true;
                    if (eff.boosted.bottom) litBottom = true;
                    if (eff.boosted.left) litLeft = true;
                    if (eff.boosted.right) litRight = true;
                }

                const gemDisplay = isClassic
                    ? `<span style="font-size: 1.15rem;">${GEM_CLASSIC_ICONS[cell.gemRevealed.id] || '💎'}</span>`
                    : (GEM_SVGS[cell.gemRevealed.id] || '');

                let diagonalHTML = '';
                if (showDiagonalNums && eff) {
                    const diagTL = eff['top-left'].toFixed(1).replace('.0', '');
                    const diagTR = eff['top-right'].toFixed(1).replace('.0', '');
                    const diagBR = eff['bottom-right'].toFixed(1).replace('.0', '');
                    const diagBL = eff['bottom-left'].toFixed(1).replace('.0', '');

                    diagonalHTML = `
                        <div style="position: absolute; top: 3px; left: 4px; font-size: 10px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagTL}</div>
                        <div style="position: absolute; top: 3px; right: 4px; font-size: 10px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagTR}</div>
                        <div style="position: absolute; bottom: 3px; right: 4px; font-size: 10px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagBR}</div>
                        <div style="position: absolute; bottom: 3px; left: 4px; font-size: 10px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagBL}</div>
                    `;
                }

                const tempShieldBadge = getDiamondTempShieldBadgeHTML(cell);
                const hasCardTCG = cell.powerEffect && cell.powerEffect !== 'none';
                const cardTCGButtonHTML = hasCardTCG
                    ? `<div class="card-tcg-info-btn" title="Ver Poder TCG de la Carta">🎴</div>`
                    : '';
                const boardTCGPillHTML = hasCardTCG
                    ? `<div class="board-tcg-pill" title="Tocar para ver el poder de la carta">${getCardTCGShortPillHTML(cell)}</div>`
                    : '';

                div.innerHTML = `
                    ${tempShieldBadge}
                    ${diagonalHTML}
                    <span class="card-line-star star-top-1 ${litTop ? 'lit' : ''}">⭐</span>
                    <span class="card-line-star star-top-2 ${litTop ? 'lit' : ''}">⭐</span>
                    <span class="card-line-star star-bottom-1 ${litBottom ? 'lit' : ''}">⭐</span>
                    <span class="card-line-star star-bottom-2 ${litBottom ? 'lit' : ''}">⭐</span>
                    <span class="card-line-star star-left-1 ${litLeft ? 'lit' : ''}">⭐</span>
                    <span class="card-line-star star-left-2 ${litLeft ? 'lit' : ''}">⭐</span>
                    <span class="card-line-star star-right-1 ${litRight ? 'lit' : ''}">⭐</span>
                    <span class="card-line-star star-right-2 ${litRight ? 'lit' : ''}">⭐</span>

                    <div class="val-wrapper val-top">
                        <div class="card-val ${eff && eff.boosted.top ? 'boosted' : ''}">${eff ? eff.top : cell.top}</div>
                    </div>
                    <div class="val-wrapper val-bottom">
                        <div class="card-val ${eff && eff.boosted.bottom ? 'boosted' : ''}">${eff ? eff.bottom : cell.bottom}</div>
                    </div>
                    <div class="val-wrapper val-left">
                        <div class="card-val ${eff && eff.boosted.left ? 'boosted' : ''}">${eff ? eff.left : cell.left}</div>
                    </div>
                    <div class="val-wrapper val-right">
                        <div class="card-val ${eff && eff.boosted.right ? 'boosted' : ''}">${eff ? eff.right : cell.right}</div>
                    </div>

                    <div class="cell-content">
                        <div class="gem-pod">
                            ${gemDisplay}
                            ${cardTCGButtonHTML}
                            <div class="gem-info-btn" onclick="event.stopPropagation(); showGemDetails(${JSON.stringify(cell.gemRevealed).replace(/"/g, '&quot;')}, true, '${cell.owner}')" title="Ver Gema">ℹ️</div>
                        </div>
                        <span style="font-size:0.68rem; color:#cbd5e1; font-weight:bold; line-height:1.05; max-width:90%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${cell.isProtected ? '🛡️ ' : ''}${cell.gemRevealed.name}</span>
                        ${boardTCGPillHTML || `<span style="font-size:0.52rem; color:#38bdf8; text-align:center; line-height:1.1; margin-top:2px; max-width:95%; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${cell.gemRevealed.desc}</span>`}
                    </div>
                `;

                if (hasCardTCG) {
                    const tcgBtn = div.querySelector('.card-tcg-info-btn');
                    if (tcgBtn) {
                        tcgBtn.onclick = (e) => {
                            e.stopPropagation();
                            showCardTCGDetails(cell, 'board', cell.owner, idx);
                        };
                    }
                    const tcgPill = div.querySelector('.board-tcg-pill');
                    if (tcgPill) {
                        tcgPill.onclick = (e) => {
                            e.stopPropagation();
                            showCardTCGDetails(cell, 'board', cell.owner, idx);
                        };
                    }
                }
            } else if (revealedBoardGems[idx] && gemData) {
                const gemDisplay = isClassic
                    ? `<span style="font-size: 1.2rem;">${GEM_CLASSIC_ICONS[gemData.id] || '💎'}</span>`
                    : (GEM_SVGS[gemData.id] || '');
                div.innerHTML = `
                    <div class="cell-content">
                        <div class="gem-pod">
                            ${gemDisplay}
                            <div class="gem-info-btn" onclick="event.stopPropagation(); showGemDetails(${JSON.stringify(gemData).replace(/"/g, '&quot;')}, false, null)" title="Ver Gema">ℹ️</div>
                        </div>
                        <span style="font-size:0.72rem; color:#cbd5e1; font-weight:bold; line-height:1.1; max-width:90%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${gemData.protected ? '🛡️ ' : ''}${gemData.name}</span>
                        <span style="font-size:0.55rem; color:#38bdf8; text-align:center; line-height:1.1; margin-top:2px; max-width:95%; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">${gemData.desc}</span>
                    </div>
                `;
            } else {
                div.innerHTML = `<div class="cell-content"><span style="font-size:1.1rem; opacity:0.35; color:#94a3b8;">💎</span></div>`;
            }
            gridEl.appendChild(div);
        }
    } else {
        gridEl.className = `dynamic-grid mode-5x5${showDiagonalNums ? ' diagonal-active' : ''}`;

        const rowMap = { 0: 2, 1: 0, 2: 1, 3: 2, 4: 0 };
        const colMap = { 0: 2, 1: 0, 2: 1, 3: 2, 4: 0 };

        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const isCore = (r >= 1 && r <= 3 && c >= 1 && c <= 3);
                const r_core = rowMap[r];
                const c_core = colMap[c];
                const originalCoreIdx = r_core * 3 + c_core;

                const div = document.createElement('div');
                const cell = board[originalCoreIdx];
                const gemData = gems[originalCoreIdx] || GEM_TYPES[originalCoreIdx % GEM_TYPES.length];

                if (isCore) {
                    const coreIdx = originalCoreIdx;
                    const coreCell = board[coreIdx];
                    const coreGemData = gems[coreIdx] || GEM_TYPES[coreIdx % GEM_TYPES.length];
                    const isCoreSel = selectedBoardIndex === coreIdx;
                    const isCoreNew = newlyDeployedCellIndex === coreIdx;
                    const isCoreCondMatch = isBoardCellMatchingSelectedCardCondition(coreCell, selectedCard, activeHumanPlayer);

                    let isCoreCombo = false;
                    if (coreCell) {
                        if (coreCell.owner === 'red' && redComboIndices.includes(coreIdx) && comboFlashTriggers.red) isCoreCombo = true;
                        if (coreCell.owner === 'blue' && blueComboIndices.includes(coreIdx) && comboFlashTriggers.blue) isCoreCombo = true;
                    }

                    div.className = `cell-dynamic core-cell ${coreCell ? (coreCell.owner === 'red' ? 'card-red' : 'card-blue') : ''} ${isInspectMode && !revealedBoardGems[coreIdx] ? 'inspectable' : ''} ${isCoreSel ? 'selected-attacker' : ''} ${isCoreNew ? 'anim-card-deploy' : ''} ${isCoreCombo ? 'card-combo-flash' : ''} ${isCoreCondMatch ? 'condition-match-glow' : ''}`;
                    applyConditionGlowStyle(div, isCoreCondMatch);
                    div.onclick = () => handleBoardClick(coreIdx);

                    if (coreCell && coreCell.gemRevealed) {
                        const eff = getEffectiveCardValues(coreIdx);

                        const gemDisplay = isClassic
                            ? `<span style="font-size: 0.65rem;">${GEM_CLASSIC_ICONS[coreCell.gemRevealed.id] || '💎'}</span>`
                            : (GEM_SVGS[coreCell.gemRevealed.id] || '');

                        let diagonalHTML = '';
                        if (showDiagonalNums && eff) {
                            const diagTL = eff['top-left'].toFixed(1).replace('.0', '');
                            const diagTR = eff['top-right'].toFixed(1).replace('.0', '');
                            const diagBR = eff['bottom-right'].toFixed(1).replace('.0', '');
                            const diagBL = eff['bottom-left'].toFixed(1).replace('.0', '');

                            diagonalHTML = `
                                <div style="position: absolute; top: 1px; left: 2px; font-size: 8px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagTL}</div>
                                <div style="position: absolute; top: 1px; right: 2px; font-size: 8px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagTR}</div>
                                <div style="position: absolute; bottom: 1px; right: 2px; font-size: 8px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagBR}</div>
                                <div style="position: absolute; bottom: 1px; left: 2px; font-size: 8px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagBL}</div>
                            `;
                        }

                        const tempShieldBadge = getDiamondTempShieldBadgeHTML(coreCell);

                        div.innerHTML = `
                            ${tempShieldBadge}
                            ${diagonalHTML}
                            <div class="val-wrapper val-top"><div class="card-val ${eff && eff.boosted.top ? 'boosted' : ''}">${eff ? eff.top : coreCell.top}</div></div>
                            <div class="val-wrapper val-bottom"><div class="card-val ${eff && eff.boosted.bottom ? 'boosted' : ''}">${eff ? eff.bottom : coreCell.bottom}</div></div>
                            <div class="val-wrapper val-left"><div class="card-val ${eff && eff.boosted.left ? 'boosted' : ''}">${eff ? eff.left : coreCell.left}</div></div>
                            <div class="val-wrapper val-right"><div class="card-val ${eff && eff.boosted.right ? 'boosted' : ''}">${eff ? eff.right : coreCell.right}</div></div>

                            <div class="cell-content">
                                <div class="gem-pod">${gemDisplay}</div>
                                <span style="font-size:0.48rem; color:#cbd5e1; font-weight:bold; line-height:1; max-width:90%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${coreCell.isProtected ? '🛡️ ' : ''}${coreCell.gemRevealed.name}</span>
                            </div>
                        `;
                    } else if (revealedBoardGems[coreIdx] && coreGemData) {
                        const gemDisplay = isClassic
                            ? `<span style="font-size: 0.65rem;">${GEM_CLASSIC_ICONS[coreGemData.id] || '💎'}</span>`
                            : (GEM_SVGS[coreGemData.id] || '');
                        div.innerHTML = `
                            <div class="cell-content">
                                <div class="gem-pod">${gemDisplay}</div>
                                <span style="font-size:0.48rem; color:#cbd5e1; font-weight:bold; line-height:1; max-width:90%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${coreGemData.protected ? '🛡️ ' : ''}${coreGemData.name}</span>
                            </div>
                        `;
                    } else {
                        div.innerHTML = `<div class="cell-content"><span style="font-size:0.6rem; opacity:0.35; color:#94a3b8;">💎</span></div>`;
                    }
                } else {
                    const mirrorOwnerClass = cell ? (cell.owner === 'red' ? 'card-red' : 'card-blue') : '';
                    const isMirrorCondMatch = isBoardCellMatchingSelectedCardCondition(cell, selectedCard, activeHumanPlayer);
                    let isMirrorCombo = false;
                    if (cell) {
                        if (cell.owner === 'red' && redComboIndices.includes(originalCoreIdx) && comboFlashTriggers.red) isMirrorCombo = true;
                        if (cell.owner === 'blue' && blueComboIndices.includes(originalCoreIdx) && comboFlashTriggers.blue) isMirrorCombo = true;
                    }

                    div.className = `cell-dynamic mirror-edge-cell ${mirrorOwnerClass} ${isMirrorCombo ? 'card-combo-flash' : ''} ${isMirrorCondMatch ? 'condition-match-glow' : ''}`;
                    applyConditionGlowStyle(div, isMirrorCondMatch);
                    const mirrorTag = `<div class="mirror-tag">ESPEJO</div>`;

                    if (cell && cell.gemRevealed) {
                        const effMirror = getEffectiveCardValues(originalCoreIdx);
                        const gemDisplay = isClassic
                            ? `<span style="font-size: 0.65rem;">${GEM_CLASSIC_ICONS[cell.gemRevealed.id] || '💎'}</span>`
                            : (GEM_SVGS[cell.gemRevealed.id] || '');

                        let diagonalMirrorHTML = '';
                        if (showDiagonalNums && effMirror) {
                            const diagTL = effMirror['top-left'].toFixed(1).replace('.0', '');
                            const diagTR = effMirror['top-right'].toFixed(1).replace('.0', '');
                            const diagBR = effMirror['bottom-right'].toFixed(1).replace('.0', '');
                            const diagBL = effMirror['bottom-left'].toFixed(1).replace('.0', '');

                            diagonalMirrorHTML = `
                                <div style="position: absolute; top: 1px; left: 2px; font-size: 8px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagTL}</div>
                                <div style="position: absolute; top: 1px; right: 2px; font-size: 8px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagTR}</div>
                                <div style="position: absolute; bottom: 1px; right: 2px; font-size: 8px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagBR}</div>
                                <div style="position: absolute; bottom: 1px; left: 2px; font-size: 8px; font-weight: 900; z-index: 16; color: #ffffff; text-shadow: 0 1px 2px #000;">${diagBL}</div>
                            `;
                        }

                        const tempShieldBadge = getDiamondTempShieldBadgeHTML(cell);

                        div.innerHTML = `
                            ${tempShieldBadge}
                            ${mirrorTag}
                            ${diagonalMirrorHTML}
                            <div class="val-wrapper val-top"><div class="card-val ${effMirror && effMirror.boosted.top ? 'boosted' : ''}">${effMirror ? effMirror.top : cell.top}</div></div>
                            <div class="val-wrapper val-bottom"><div class="card-val ${effMirror && effMirror.boosted.bottom ? 'boosted' : ''}">${effMirror ? effMirror.bottom : cell.bottom}</div></div>
                            <div class="val-wrapper val-left"><div class="card-val ${effMirror && effMirror.boosted.left ? 'boosted' : ''}">${effMirror ? effMirror.left : cell.left}</div></div>
                            <div class="val-wrapper val-right"><div class="card-val ${effMirror && effMirror.boosted.right ? 'boosted' : ''}">${effMirror ? effMirror.right : cell.right}</div></div>
                            <div class="cell-content">
                                <div class="gem-pod">${gemDisplay}</div>
                                <span style="font-size:0.48rem; color:#cbd5e1; font-weight:bold; line-height:1; max-width:90%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${cell.isProtected ? '🛡️ ' : ''}${cell.gemRevealed.name}</span>
                            </div>
                        `;
                    } else {
                        div.innerHTML = `${mirrorTag}<span style="font-size:0.5rem; opacity:0.3; color:#94a3b8;">✨</span>`;
                    }
                }

                gridEl.appendChild(div);
            }
        }
    }
    newlyDeployedCellIndex = null;
    comboFlashTriggers.red = false;
    comboFlashTriggers.blue = false;
}

function render() {
    try {
        if (turn !== lastTurnNotified) {
            lastTurnNotified = turn;
            showTurnBanner(turn);
        }

        const toroidalAllowed = isToroidalOptionEnabled();
        const diagonalAllowed = isDiagonalOptionEnabled();
        if (!toroidalAllowed) isMapamundiActive = false;
        if (!diagonalAllowed) isDiagonalActive = false;

        const boardWrapper = document.getElementById('board-wrapper');
        if (boardWrapper) boardWrapper.classList.toggle('mapamundi-active', toroidalAllowed && isMapamundiActive);

        renderDynamicGrid();

        const tcgBadge = document.getElementById('tcg-mode-badge');
        if (tcgBadge) {
            const isTcgActive = isTCGModeEnabled();
            const submodeLabel = getTCGSubmode() === 'preset' ? 'Preasignado' : 'Custom';
            tcgBadge.innerText = isTcgActive ? `🎴 TCG (${submodeLabel})` : '⚡ Mazo Normal';
            tcgBadge.style.color = isTcgActive ? '#fbbf24' : '#38bdf8';
            tcgBadge.style.borderColor = isTcgActive ? 'rgba(251, 191, 36, 0.4)' : 'rgba(56, 189, 248, 0.4)';
            tcgBadge.style.background = isTcgActive ? 'rgba(251, 191, 36, 0.1)' : 'rgba(56, 189, 248, 0.1)';
        }

        const redCombos = getActiveCombosDetails('red');
        const blueCombos = getActiveCombosDetails('blue');

        const currentActiveCombos = turn === 'red' ? redCombos : blueCombos;
        const totalComboPts = currentActiveCombos.reduce((sum, c) => sum + c.pts, 0);

        const comboListTextEl = document.getElementById('combo-list-text');
        const comboTotalPtsEl = document.getElementById('combo-total-pts');

        if (comboTotalPtsEl) comboTotalPtsEl.innerText = `+${totalComboPts} pts`;
        if (comboListTextEl) {
            if (currentActiveCombos.length > 0) {
                comboListTextEl.innerText = currentActiveCombos.map(c => `${c.name} (+${c.pts})`).join(' • ');
            } else {
                comboListTextEl.innerText = "Ninguno";
            }
        }

        const redTotal = getPlayerTotalScore('red');
        const blueTotal = getPlayerTotalScore('blue');

        const scoreRed = document.getElementById('score-red');
        const scoreBlue = document.getElementById('score-blue');
        if (scoreRed) scoreRed.innerText = `${redTotal} / ${TARGET_SCORE}`;
        if (scoreBlue) scoreBlue.innerText = `${blueTotal} / ${TARGET_SCORE}`;

        const redPercent = Math.min(100, (redTotal / TARGET_SCORE) * 100);
        const bluePercent = Math.min(100, (blueTotal / TARGET_SCORE) * 100);
        const progRed = document.getElementById('progress-red');
        const progBlue = document.getElementById('progress-blue');
        if (progRed) progRed.style.width = `${redPercent}%`;
        if (progBlue) progBlue.style.width = `${bluePercent}%`;

        const redDiscardLen = discards.red ? discards.red.length : 0;
        const blueDiscardLen = discards.blue ? discards.blue.length : 0;
        const redDeckLen = decks.red ? decks.red.length : 0;
        const blueDeckLen = decks.blue ? decks.blue.length : 0;

        const discRed = document.getElementById('discard-count-red');
        const discBlue = document.getElementById('discard-count-blue');
        const deckRed = document.getElementById('deck-count-red');
        const deckBlue = document.getElementById('deck-count-blue');
        if (discRed) discRed.innerText = redDiscardLen;
        if (discBlue) discBlue.innerText = blueDiscardLen;
        if (deckRed) deckRed.innerText = redDeckLen;
        if (deckBlue) deckBlue.innerText = blueDeckLen;

        const pileDiscRed = document.getElementById('pile-discard-red');
        const pileDiscBlue = document.getElementById('pile-discard-blue');
        const pileDeckRed = document.getElementById('pile-deck-red');
        const pileDeckBlue = document.getElementById('pile-deck-blue');
        if (pileDiscRed) pileDiscRed.classList.toggle('empty-pile', redDiscardLen === 0);
        if (pileDiscBlue) pileDiscBlue.classList.toggle('empty-pile', blueDiscardLen === 0);
        if (pileDeckRed) pileDeckRed.classList.toggle('empty-pile', redDeckLen === 0);
        if (pileDeckBlue) pileDeckBlue.classList.toggle('empty-pile', blueDeckLen === 0);

        const turnInd = document.getElementById('turn-indicator');
        if (turnInd) {
            turnInd.innerText = `Turno: ${turn === 'red' ? 'Rojo' : 'Azul'}`;
            turnInd.style.color = turn === 'red' ? '#f43f5e' : '#38bdf8';
        }
        const energyBadge = document.getElementById('energy-badge');
        if (energyBadge) energyBadge.innerText = `⚡ ${currentEnergy} / ${maxEnergy} ENERGÍA`;

        const historyEl = document.getElementById('log-history');
        if (historyEl) {
            historyEl.innerHTML = actionLogHistory.map(item => `<div class="log-history-item">• ${item}</div>`).join('');
        }

        const isBoardFull = board.every(c => c !== null);
        const anyAttackPossible = checkIfAnyAttackPossible();
        const isBoardDeadlocked = isBoardFull && !anyAttackPossible;

        const btnPass = document.getElementById('btn-pass-turn');
        const btnClaimWin = document.getElementById('btn-claim-victory');
        const logMsg = document.getElementById('log-message');
        if (isBoardDeadlocked) {
            if (btnPass) btnPass.classList.add('hidden');
            if (btnClaimWin) btnClaimWin.classList.remove('hidden');
            if (logMsg) logMsg.innerText = "⚠️ ¡Bloqueo Táctico! Podés Reclamar la Victoria.";
        } else {
            if (btnPass) btnPass.classList.remove('hidden');
            if (btnClaimWin) btnClaimWin.classList.add('hidden');
        }

        const myPlayerRole = myRole || 'red';
        const labelRed = document.getElementById('label-hand-red');
        const labelBlue = document.getElementById('label-hand-blue');
        if (myPlayerRole === 'blue') {
            if (labelRed) labelRed.innerText = 'Mano Jugador Rojo';
            if (labelBlue) labelBlue.innerText = 'Mano Jugador Azul (Vos)';
        } else {
            if (labelRed) labelRed.innerText = 'Mano Jugador Rojo (Vos)';
            if (labelBlue) labelBlue.innerText = gameMode === 'ai'
                ? (isAITCGModeEnabled() ? 'Mano IA (Azul • 🎴 TCG)' : 'Mano IA (Azul • Sin Poderes)')
                : 'Mano Jugador Azul';
        }

        const controlledGemIds = board.filter(c => c !== null && c.owner === turn && c.gemRevealed).map(c => c.gemRevealed.id);
        const hasZafiroCardEffect = board.some(c => c !== null && c.owner === turn && c.hasTCGZafiroEffect);
        const hasTopacioCardEffect = board.some(c => c !== null && c.owner === turn && c.hasTCGTopacioEffect);
        const hasOnixCardEffect = board.some(c => c !== null && c.owner === turn && c.hasTCGOnixEffect);
        const hasRubíCardEffect = board.some(c => c !== null && c.owner === turn && c.hasTCGRubyEffect);

        const hasBlueBonus = (controlledGemIds.includes('azul') || hasZafiroCardEffect) && !usedBlueEnergyBonusThisTurn;
        const hasYellowBonus = (controlledGemIds.includes('amarillo') || hasTopacioCardEffect) && !usedYellowEnergyBonusThisTurn;
        const hasBlackBonus = (controlledGemIds.includes('negro') || hasOnixCardEffect) && !usedBlackEnergyBonusThisTurn;
        const hasRedBonus = (controlledGemIds.includes('rojo') || hasRubíCardEffect) && !usedRedEnergyBonusThisTurn;
        const controlsViolet = controlledGemIds.includes('violeta');

        const indDraw = document.getElementById('indicator-draw');
        const indRec = document.getElementById('indicator-recover');
        const indDisc = document.getElementById('indicator-discard');
        const indAtk = document.getElementById('indicator-attack');
        const indInsp = document.getElementById('indicator-inspect');
        if (indDraw) indDraw.classList.toggle('hidden', !hasBlueBonus);
        if (indRec) indRec.classList.toggle('hidden', !hasYellowBonus);
        if (indDisc) indDisc.classList.toggle('hidden', !hasBlackBonus);
        if (indAtk) indAtk.classList.toggle('hidden', !hasRedBonus);
        if (indInsp) indInsp.classList.toggle('hidden', !controlsViolet);

        const inspectCost = controlsViolet ? 0 : 1;
        const inspectLabel = document.getElementById('inspect-cost-label');
        if (inspectLabel) inspectLabel.innerText = `(${inspectCost}⚡)`;

        const isMyTurnActive = gameMode === 'ai' ? turn === 'red' : turn === myRole;
        const sideActionsLocked = isMyTurnActive && isTutorialSideActionLocked();
        const specialModesLocked = isMyTurnActive && isTutorialSpecialModeLocked();

        const btnMapamundi = document.getElementById('btn-action-mapamundi');
        if (btnMapamundi) {
            const isMapActiveNow = toroidalAllowed && isMapamundiActive;
            btnMapamundi.classList.toggle('mapamundi-btn-active', isMapActiveNow);
            btnMapamundi.classList.toggle('special-mode-locked', !toroidalAllowed || specialModesLocked);
            btnMapamundi.disabled = !isMyTurnActive || specialModesLocked || !toroidalAllowed || isMapamundiActive || currentEnergy < 1;
            if (!toroidalAllowed) {
                btnMapamundi.innerHTML = `🌐 Atq. borde opuesto <span class="special-mode-tag">Off en ⚙️</span>`;
                btnMapamundi.title = 'Deshabilitado en Configuración (⚙️)';
            } else if (specialModesLocked) {
                btnMapamundi.innerHTML = `🌐 Atq. borde opuesto <span class="special-mode-tag">Turno 3</span>`;
                btnMapamundi.title = 'Disponible desde el Turno 3 del tutorial';
            } else if (isMapActiveNow) {
                btnMapamundi.innerHTML = `🌐 Atq. borde opuesto <span class="special-mode-tag active">ACTIVO</span>`;
                btnMapamundi.title = 'Activo en este turno (borde opuesto y grilla 5x5 habilitados)';
            } else {
                btnMapamundi.innerHTML = `🌐 Atq. borde opuesto <span class="special-mode-tag">(1⚡)</span>`;
                btnMapamundi.title = 'Activar ataque por borde opuesto por 1⚡ en este turno';
            }
        }

        const btnDiagonal = document.getElementById('btn-action-diagonal');
        if (btnDiagonal) {
            const isDiagActiveNow = diagonalAllowed && isDiagonalActive;
            btnDiagonal.classList.toggle('mapamundi-btn-active', isDiagActiveNow);
            btnDiagonal.classList.toggle('special-mode-locked', !diagonalAllowed || specialModesLocked);
            btnDiagonal.disabled = !isMyTurnActive || specialModesLocked || !diagonalAllowed || isDiagonalActive || currentEnergy < 1;
            if (!diagonalAllowed) {
                btnDiagonal.innerHTML = `❖ Atq. Diagonal <span class="special-mode-tag">Off en ⚙️</span>`;
                btnDiagonal.title = 'Deshabilitado en Configuración (⚙️)';
            } else if (specialModesLocked) {
                btnDiagonal.innerHTML = `❖ Atq. Diagonal <span class="special-mode-tag">Turno 3</span>`;
                btnDiagonal.title = 'Disponible desde el Turno 3 del tutorial';
            } else if (isDiagActiveNow) {
                btnDiagonal.innerHTML = `❖ Atq. Diagonal <span class="special-mode-tag active">ACTIVO</span>`;
                btnDiagonal.title = 'Activo en este turno (diagonales habilitadas)';
            } else {
                btnDiagonal.innerHTML = `❖ Atq. Diagonal <span class="special-mode-tag">(1⚡)</span>`;
                btnDiagonal.title = 'Activar ataque diagonal por 1⚡ en este turno';
            }
        }

        ['tl', 'tr', 'bl', 'br'].forEach(corner => {
            const btn = document.getElementById(`btn-atk-${corner}`);
            if (btn) {
                if (diagonalAllowed && isDiagonalActive) {
                    btn.classList.remove('diagonal-hidden');
                    btn.disabled = false;
                } else {
                    btn.classList.add('diagonal-hidden');
                    btn.disabled = true;
                }
            }
        });

        if (btnPass) btnPass.disabled = !isMyTurnActive;
        const btnDraw = document.getElementById('btn-action-draw');
        const btnRec = document.getElementById('btn-action-recover');
        const btnDiscOpp = document.getElementById('btn-action-discard-opp');
        const btnInsp = document.getElementById('btn-action-inspect');
        const opp = turn === 'red' ? 'blue' : 'red';
        if (btnDraw) btnDraw.disabled = !isMyTurnActive || sideActionsLocked || currentEnergy < 1 || !decks[turn] || decks[turn].length === 0;
        if (btnRec) btnRec.disabled = !isMyTurnActive || sideActionsLocked || currentEnergy < 1 || !discards[turn] || discards[turn].length === 0;
        if (btnDiscOpp) btnDiscOpp.disabled = !isMyTurnActive || sideActionsLocked || currentEnergy < 1 || !hands[opp] || hands[opp].length === 0;
        if (btnInsp) btnInsp.disabled = !isMyTurnActive || sideActionsLocked || currentEnergy < inspectCost;

        ['red', 'blue'].forEach(p => {
            const handEl = document.getElementById(`hand-${p}`);
            if (!handEl) return;
            handEl.innerHTML = '';
            if (hands[p]) {
                hands[p].forEach((card, idx) => {
                    const div = document.createElement('div');
                    const isSel = turn === p && selectedHandIndex === idx;
                    const isRivalHand = gameMode === 'online' ? (myRole && myRole !== p) : (p === 'blue');

                    if (isRivalHand) {
                        div.className = 'card-item hidden-card';
                        div.innerHTML = `<span style="font-size:0.6rem; opacity:0.3;">💎</span>`;
                    } else {
                        const isNewlyDrawn = newlyDrawnCardIndex[p] === idx;
                        const playCost = getCardPlayEnergyCost(card, p);
                        const baseCost = typeof card.energyCost === 'number' ? card.energyCost : 2;
                        const hasDiscountNow = playCost < baseCost;
                        const condReadyNow = isCardTCGConditionMetNow(card, p);
                        const lacksEnergy = (isMyTurnActive && currentEnergy < playCost);
                        const hasTCG = card.powerEffect && card.powerEffect !== 'none';

                        div.className = `card-item ${p} ${hasTCG ? 'has-tcg-power' : ''} ${isSel ? 'selected' : ''} ${isNewlyDrawn ? 'anim-card-draw' : ''} ${lacksEnergy ? 'disabled-energy' : ''}`;

                        div.onclick = () => {
                            if (lacksEnergy && isMyTurnActive) return;
                            selectHandCard(p, idx);
                        };

                        let tcgCenterHTML = '';
                        let tcgInfoBtnHTML = '';
                        if (hasTCG) {
                            const effMeta = getTCGGemMeta(card.powerEffect);
                            const condMeta = (card.powerCondition && card.powerCondition !== 'none') ? getTCGGemMeta(card.powerCondition) : null;
                            const targetMeta = card.targetGemId ? getTCGGemMeta(card.targetGemId) : null;
                            const effIcon = card.powerEffect === 'blanco' ? '🛡️' : effMeta.icon;
                            const iconsStr = (card.powerEffect === 'jump_reveal_gem' || card.powerEffect === 'refund_energy_1' || card.powerEffect === 'discount_energy_1')
                                ? (targetMeta ? `${effIcon}${targetMeta.icon}` : effIcon)
                                : (condMeta ? `${condMeta.icon}${effIcon}` : effIcon);
                            tcgCenterHTML = `
                                <div class="hand-tcg-center">
                                    <span class="hand-tcg-icons">${iconsStr}</span>
                                </div>
                            `;
                            tcgInfoBtnHTML = `<div class="hand-card-info-btn" title="Ver poder de la carta">ℹ️</div>`;
                        }

                        const costBadgeStyle = hasDiscountNow
                            ? 'background: rgba(34, 197, 94, 0.25); border: 1px solid #4ade80; color: #4ade80;'
                            : (condReadyNow && hasTCG ? 'border: 1px solid rgba(251, 191, 36, 0.75); color: #fde047;' : '');

                        const weakDir = card.specialDir;
                        div.innerHTML = `
                            <div class="card-energy-hint" style="${costBadgeStyle}">${playCost}⚡</div>
                            ${tcgInfoBtnHTML}
                            ${tcgCenterHTML}
                            <div class="card-val-pos val-top ${weakDir === 'top' ? 'weak-side' : ''}">${card.top}</div>
                            <div class="card-val-pos val-bottom ${weakDir === 'bottom' ? 'weak-side' : ''}">${card.bottom}</div>
                            <div class="card-val-pos val-left ${weakDir === 'left' ? 'weak-side' : ''}">${card.left}</div>
                            <div class="card-val-pos val-right ${weakDir === 'right' ? 'weak-side' : ''}">${card.right}</div>
                        `;

                        if (hasTCG) {
                            const infoBtn = div.querySelector('.hand-card-info-btn');
                            if (infoBtn) {
                                infoBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    showCardTCGDetails(card, 'hand', p, null);
                                };
                            }
                        }
                    }
                    handEl.appendChild(div);
                });
            }
            newlyDrawnCardIndex[p] = null;
        });

        renderCoachmarks();
    } catch (err) {
        console.error("Error en render():", err);
    }
}
