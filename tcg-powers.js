// Definición de las 9 Gemas / Tipos para Condiciones y Efectos
const TCG_GEM_TYPES_LIST = [
    { id: 'rojo', name: 'Rubí (Rojo)' },
    { id: 'azul', name: 'Zafiro (Azul)' },
    { id: 'amarillo', name: 'Topacio (Amarillo)' },
    { id: 'verde', name: 'Esmeralda (Verde)' },
    { id: 'naranja', name: 'Ámbar (Naranja)' },
    { id: 'violeta', name: 'Amatista (Violeta)' },
    { id: 'blanco', name: 'Diamante (Blanco)' },
    { id: 'negro', name: 'Ónix (Negro)' },
    { id: 'marron', name: 'Cuarzo (Marrón)' }
];

// Función auxiliar para verificar si el jugador controla una gema en el tablero
function playerControlsGem(board, player, gemId) {
    if (!Array.isArray(board)) return false;
    return board.some(c => c !== null && c.owner === player && c.gemRevealed && c.gemRevealed.id === gemId);
}

// Evaluador central de condiciones TCG (extensible a futuro a mano, mazo o descarte)
function evaluateTCGCondition(condition, player, context = {}) {
    if (!condition || condition === 'none' || condition === 'any') {
        return true;
    }

    const boardRef = context.board || (typeof board !== 'undefined' ? board : []);
    // Futuro: const handsRef = context.hands || (typeof hands !== 'undefined' ? hands : null);
    // Futuro: const decksRef = context.decks || (typeof decks !== 'undefined' ? decks : null);
    // Futuro: const discardsRef = context.discards || (typeof discards !== 'undefined' ? discards : null);

    return playerControlsGem(boardRef, player, condition);
}

// Limpia banderas de efectos permanentes previos antes de recalcular
function clearPermanentCardFlags(card) {
    if (!card) return;
    card.hasTCGRubyEffect = false;
    card.hasTCGZafiroEffect = false;
    card.hasTCGTopacioEffect = false;
    card.hasTCGOnixEffect = false;
    card.hasTCGAmberEffect = false;
    card.hasTCGQuartzEffect = false;
    card.isBufferedByQuartz = false;
    card.tcgQuartzBoostedSides = null;
}

// Recalcula poderes permanentes de las cartas en el campo para ambos jugadores
// cada vez que cambian las cartas controladas en el tablero
function refreshPermanentBoardPowers(currentBoard, context = {}) {
    if (!Array.isArray(currentBoard)) return;

    currentBoard.forEach((card) => {
        if (!card) return;
        clearPermanentCardFlags(card);

        const owner = card.owner;
        if (!owner) return;

        const effectType = card.powerEffect;
        if (!effectType || effectType === 'none') return;

        // Verde y Violeta son efectos de despliegue, no permanentes
        if (effectType === 'verde' || effectType === 'violeta') return;

        const conditionMet = evaluateTCGCondition(card.powerCondition, owner, {
            ...context,
            board: currentBoard
        });

        if (!conditionMet) return;

        switch (effectType) {
            case 'rojo':
                card.hasTCGRubyEffect = true;
                break;
            case 'azul':
                card.hasTCGZafiroEffect = true;
                break;
            case 'amarillo':
                card.hasTCGTopacioEffect = true;
                break;
            case 'naranja':
                card.hasTCGAmberEffect = true;
                break;
            case 'negro':
                card.hasTCGOnixEffect = true;
                break;
            case 'marron':
                // Cuarzo con condición propia ('marron') aplica aura temporal al desplegarse;
                // en otros casos actúa como efecto permanente mientras se cumpla la condición.
                if (card.powerCondition !== 'marron') {
                    card.hasTCGQuartzEffect = true;
                }
                break;
            case 'blanco':
                // Diamante se activa al desplegarse; se mantiene su escudo si está activo
                break;
            default:
                break;
        }
    });
}

// Resolver el poder TCG al desplegar una carta en board[boardIndex]
function resolveTCGCardPower(card, currentBoard, player, currentEnergy, playerDecks, playerHands, playerDiscards, boardIndex) {
    if (!card || !card.powerCondition || !card.powerEffect) return { logText: '', energyDelta: 0 };

    const condition = card.powerCondition; // 'none', 'any', o el id de una gema
    const effectType = card.powerEffect;   // El efecto exclusivo a disparar

    // Inicializar estado de escudo temporal de la carta al desplegarse
    card.diamondTempShield = false;
    card.diamondShieldOwner = null;
    card.isProtected = (card.gemRevealed && card.gemRevealed.protected) || false;
    clearPermanentCardFlags(card);

    const conditionMet = evaluateTCGCondition(condition, player, {
        board: currentBoard,
        decks: playerDecks,
        hands: playerHands,
        discards: playerDiscards
    });

    if (!conditionMet) {
        return { logText: '', energyDelta: 0 };
    }

    let energyDelta = 0;

    // --- DESPLIEGUE: Diamante (Invulnerabilidad hasta el inicio de tu siguiente turno) ---
    if (effectType === 'blanco') {
        card.isProtected = true;
        card.diamondTempShield = true;
        card.diamondShieldOwner = player;
        return { logText: ` 🎴 [Poder: Diamante (🛡️ Invuln. hasta tu próximo turno)]`, energyDelta: 0 };
    }

    // --- DESPLIEGUE: Esmeralda (verde) ---
    if (effectType === 'verde') {
        for (let i = 0; i < 2; i++) {
            if (playerDiscards[player] && playerDiscards[player].length > 0) {
                playerDecks[player].push(playerDiscards[player].pop());
            }
        }
        if (playerDecks[player] && playerDecks[player].length > 0) {
            playerHands[player].push(playerDecks[player].pop());
        }
        const opponent = player === 'red' ? 'blue' : 'red';
        if (playerHands[opponent] && playerHands[opponent].length > 0) {
            const rIdx = Math.floor(Math.random() * playerHands[opponent].length);
            playerDiscards[opponent].push(playerHands[opponent].splice(rIdx, 1)[0]);
        }
        return { logText: ` 🎴 [Efecto Esmeralda: Recup/Robo/Desc]`, energyDelta: 0 };
    }

    // --- DESPLIEGUE: Amatista (violeta) ---
    if (effectType === 'violeta') {
        const energyGain = (condition === 'violeta') ? 2 : 1;
        energyDelta += energyGain;
        return { logText: ` 🎴 [Efecto Amatista: +${energyGain}⚡]`, energyDelta };
    }

    // --- DESPLIEGUE CON AURA TEMPORAL: Cuarzo con condición 'marron' ---
    if (effectType === 'marron' && condition === 'marron') {
        const row = Math.floor(boardIndex / 3);
        const col = boardIndex % 3;
        const targetIndices = [boardIndex];
        if (row > 0) targetIndices.push((row - 1) * 3 + col);
        if (row < 2) targetIndices.push((row + 1) * 3 + col);
        if (col > 0) targetIndices.push(row * 3 + (col - 1));
        if (col < 2) targetIndices.push(row * 3 + (col + 1));

        targetIndices.forEach(idx => {
            if (currentBoard[idx] && currentBoard[idx].owner === player) {
                currentBoard[idx].quartzAuraTempBuff = (currentBoard[idx].quartzAuraTempBuff || 0) + 1;
                currentBoard[idx].quartzAuraOwner = player;
            }
        });
        return { logText: ` 🎴 [Efecto Cuarzo: +1 a carta y adyacentes hasta tu turno]`, energyDelta: 0 };
    }

    // Los demás efectos ('rojo', 'azul', 'amarillo', 'naranja', 'negro', 'marron')
    // se sincronizan como permanentes en el campo mediante refreshPermanentBoardPowers.
    refreshPermanentBoardPowers(currentBoard, {
        decks: playerDecks,
        hands: playerHands,
        discards: playerDiscards
    });

    const labels = {
        rojo: ' [Efecto Rubí: +1⚡ al Atacar]',
        azul: ' [Efecto Zafiro: +1⚡ al Robar]',
        amarillo: ' [Efecto Topacio: +1⚡ al Recuperar]',
        naranja: ' [Efecto Ámbar: Máx 4⚡]',
        negro: ' [Efecto Ónix: +1⚡ al Descartar]',
        marron: ' [Efecto Cuarzo: Iguala al mayor en todas tus cartas]'
    };

    return { logText: ` 🎴${labels[effectType] || ''}`, energyDelta: 0 };
}
