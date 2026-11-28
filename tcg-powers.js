// Versión del catálogo TCG: incrementala cada vez que modifiques las cartas puras o la matriz de 81 combinaciones
const TCG_CATALOG_VERSION = '2026-11-28-v3';

// Definición de las 9 Gemas / Tipos para Condiciones y Efectos
const TCG_GEM_TYPES_LIST = [
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

// Modos TCG soportados:
// - 'preset': Cartas con coste, condición y efecto preasignados; el jugador solo asigna valor débil/dirección
// - 'custom': Libertad para configurar coste, condición y efecto además de valor débil/dirección
const TCG_SUBMODES = {
    PRESET: 'preset',
    CUSTOM: 'custom'
};

function getGemMetaById(gemId) {
    return TCG_GEM_TYPES_LIST.find(g => g.id === gemId) || {
        id: gemId || 'none',
        name: 'Sin gema',
        short: 'Base',
        icon: '✨'
    };
}

function getEffectMeta(effectGemId, condGemId) {
    const condMeta = condGemId && condGemId !== 'none' ? getGemMetaById(condGemId) : null;
    const condText = condMeta
        ? `Si controlás ${condMeta.short}`
        : 'Sin condición (siempre activa)';

    switch (effectGemId) {
        case 'rojo':
            return {
                energyCost: 2,
                triggerType: 'continuous',
                oneShot: false,
                label: `${condMeta ? `${condMeta.icon} ${condMeta.short}` : '✨ Libre'} → 🔴 Rubí (+1⚡ Atacar)`,
                desc: `${condText}: +1⚡ la 1ª vez que ataques con éxito en cada turno.`
            };
        case 'azul':
            return {
                energyCost: 2,
                triggerType: 'continuous',
                oneShot: false,
                label: `${condMeta ? `${condMeta.icon} ${condMeta.short}` : '✨ Libre'} → 🔵 Zafiro (+1⚡ Robar)`,
                desc: `${condText}: +1⚡ la 1ª vez que robes una carta en cada turno.`
            };
        case 'negro':
            return {
                energyCost: 2,
                triggerType: 'continuous',
                oneShot: false,
                label: `${condMeta ? `${condMeta.icon} ${condMeta.short}` : '✨ Libre'} → ⚫ Ónix (+1⚡ Descartar)`,
                desc: `${condText}: +1⚡ la 1ª vez que descartes una carta al rival en cada turno.`
            };
        case 'naranja':
            return {
                energyCost: 2,
                triggerType: 'continuous',
                oneShot: false,
                label: `${condMeta ? `${condMeta.icon} ${condMeta.short}` : '✨ Libre'} → 🟠 Ámbar (Máx 4⚡)`,
                desc: `${condText}: tu energía máxima de turno pasa a 4⚡.`
            };
        case 'marron':
            return {
                energyCost: 2,
                triggerType: 'continuous',
                oneShot: false,
                label: `${condMeta ? `${condMeta.icon} ${condMeta.short}` : '✨ Libre'} → 🟤 Cuarzo (Iguala Lados)`,
                desc: `${condText}: iguala todos los lados de tus cartas a su mayor valor propio.`
            };
        case 'amarillo':
            return {
                energyCost: 2,
                triggerType: 'continuous',
                oneShot: false,
                label: `${condMeta ? `${condMeta.icon} ${condMeta.short}` : '✨ Libre'} → 🟡 Topacio (+1⚡ Recup.)`,
                desc: `${condText}: +1⚡ la 1ª vez que recuperes del descarte en cada turno.`
            };
        case 'blanco':
            return {
                energyCost: 2,
                triggerType: 'on_deploy',
                oneShot: true,
                label: `${condMeta ? `${condMeta.icon} ${condMeta.short}` : '✨ Libre'} → ⚪ Diamante (🛡️ 1T)`,
                desc: `${condText} al desplegar: invulnerable hasta el inicio de tu siguiente turno.`
            };
        case 'verde':
            return {
                energyCost: 2,
                triggerType: 'on_deploy',
                oneShot: true,
                label: `${condMeta ? `${condMeta.icon} ${condMeta.short}` : '✨ Libre'} → 🟢 Esmeralda (Ciclo)`,
                desc: `${condText} al caer: recupera hasta 2 al mazo, roba 1 y descarta 1 al rival.`
            };
        case 'violeta':
        default: {
            const gain = condGemId === 'violeta' ? 2 : 1;
            return {
                energyCost: 2,
                triggerType: 'on_deploy',
                oneShot: true,
                label: `${condMeta ? `${condMeta.icon} ${condMeta.short}` : '✨ Libre'} → 🟣 Amatista (+${gain}⚡)`,
                desc: `${condText} al caer: otorga +${gain}⚡ inmediatos.`
            };
        }
    }
}

// Construye las 27 cartas puras:
// - 9 Explorador (valor 5, sin condición: salto y revelado a gema)
// - 9 Chispa (valor 5, con condición: cuesta 1⚡ y recupera 1⚡ si controla la gema)
// - 9 Filo (valor 6, con condición: cuesta 1⚡ menos si controla la gema)
function buildPure27Catalog() {
    const byVal = { 5: [], 6: [] };

    TCG_GEM_TYPES_LIST.forEach((gem, idx) => {
        byVal[5].push({
            id: `pure_5_exp_${gem.id}_${idx}`,
            name: `🧭 Explorador de ${gem.short} (${gem.icon})`,
            energyCost: 2,
            powerCondition: 'none',
            powerEffect: 'jump_reveal_gem',
            targetGemId: gem.id,
            triggerType: 'on_deploy',
            oneShot: true,
            desc: `Sin condición. Al jugar, si ${gem.short} está libre se mueve allí y la revela si estaba oculta.`
        });

        byVal[5].push({
            id: `pure_5_chispa_${gem.id}_${idx}`,
            name: `⚡ Chispa de ${gem.short} (${gem.icon})`,
            energyCost: 1,
            powerCondition: gem.id,
            powerEffect: 'refund_energy_1',
            targetGemId: gem.id,
            triggerType: 'on_deploy',
            oneShot: true,
            desc: `Cuesta 1⚡. Si ya controlás ${gem.short} al jugarla, recuperás 1⚡.`
        });

        byVal[6].push({
            id: `pure_6_filo_${gem.id}_${idx}`,
            name: `🗡️ Filo de ${gem.short} (${gem.icon})`,
            energyCost: 2,
            powerCondition: gem.id,
            powerEffect: 'discount_energy_1',
            targetGemId: gem.id,
            triggerType: 'on_deploy',
            oneShot: true,
            desc: `Cuesta 1⚡ menos (1⚡ total) si ya controlás ${gem.short}.`
        });
    });

    return byVal;
}

// Construye las 81 combinaciones exactas (9 condiciones x 9 efectos = 81)
function build81CombinationsByValue() {
    const byVal = { 5: [], 6: [], 7: [], 8: [], 9: [] };
    const gems = TCG_GEM_TYPES_LIST;

    const EFFECTS_BY_CONDITION_INDEX = [
        ['rojo', 'azul', 'negro', 'naranja', 'marron', 'amarillo', 'blanco', 'violeta', 'verde'],
        ['rojo', 'azul', 'negro', 'naranja', 'marron', 'amarillo', 'blanco', 'verde', 'violeta'],
        ['rojo', 'azul', 'negro', 'naranja', 'marron', 'amarillo', 'blanco', 'violeta', 'verde'],
        ['rojo', 'azul', 'negro', 'naranja', 'marron', 'amarillo', 'blanco', 'verde', 'violeta'],
        ['rojo', 'azul', 'negro', 'naranja', 'marron', 'blanco', 'amarillo', 'violeta', 'verde'],
        ['rojo', 'azul', 'negro', 'marron', 'naranja', 'blanco', 'amarillo', 'verde', 'violeta'],
        ['rojo', 'negro', 'azul', 'marron', 'naranja', 'blanco', 'amarillo', 'violeta', 'verde'],
        ['rojo', 'negro', 'azul', 'marron', 'naranja', 'blanco', 'amarillo', 'verde', 'violeta'],
        ['rojo', 'negro', 'azul', 'marron', 'naranja', 'amarillo', 'blanco', 'verde', 'violeta']
    ];

    const SLOT_VALUES_BY_POS = [5, 5, 6, 6, 7, 7, 8, 8, 9];

    gems.forEach((condGem, condIdx) => {
        const effList = EFFECTS_BY_CONDITION_INDEX[condIdx];
        effList.forEach((effId, posIdx) => {
            const slotVal = SLOT_VALUES_BY_POS[posIdx];
            const meta = getEffectMeta(effId, condGem.id);
            byVal[slotVal].push({
                id: `combo_${slotVal}_cond_${condGem.id}_eff_${effId}`,
                name: meta.label,
                energyCost: meta.energyCost,
                powerCondition: condGem.id,
                powerEffect: effId,
                triggerType: meta.triggerType,
                oneShot: meta.oneShot,
                desc: meta.desc
            });
        });
    });

    return byVal;
}

const PURE_27_BY_VAL = buildPure27Catalog();
const COMBOS_81_BY_VAL = build81CombinationsByValue();

const TCG_PRESET_CATALOG_BY_VAL = {
    5: [...PURE_27_BY_VAL[5], ...COMBOS_81_BY_VAL[5]],
    6: [...PURE_27_BY_VAL[6], ...COMBOS_81_BY_VAL[6]],
    7: [...COMBOS_81_BY_VAL[7]],
    8: [...COMBOS_81_BY_VAL[8]],
    9: [...COMBOS_81_BY_VAL[9]]
};

// Devuelve una lista de presets disponibles para un slot de valor base dado
function getPresetOptionsForValue(val) {
    return TCG_PRESET_CATALOG_BY_VAL[val] || TCG_PRESET_CATALOG_BY_VAL[6] || [];
}

// Verifica si un presetId pertenece al catálogo vigente para ese valor base
function isValidPresetIdForValue(val, presetId) {
    if (!presetId || typeof presetId !== 'string') return false;
    const pool = getPresetOptionsForValue(val);
    return pool.some(item => item.id === presetId);
}

// Busca un preset por id o devuelve uno por defecto para el valor base indicado
function resolvePresetCardConfig(val, presetId) {
    const pool = getPresetOptionsForValue(val);
    if (presetId) {
        const found = pool.find(item => item.id === presetId);
        if (found) return { ...found };
    }
    return pool[0] ? { ...pool[0] } : {
        id: `preset_default_${val}`,
        name: `Carta ${val}`,
        energyCost: 2,
        powerCondition: 'none',
        powerEffect: 'none',
        triggerType: 'continuous',
        oneShot: false,
        desc: 'Sin poder especial.'
    };
}

// Función auxiliar para verificar si el jugador controla una gema en el tablero
function playerControlsGem(board, player, gemId) {
    if (!Array.isArray(board)) return false;
    return board.some(c => c !== null && c.owner === player && c.gemRevealed && c.gemRevealed.id === gemId);
}

// Evaluador central de condiciones TCG
function evaluateTCGCondition(condition, player, context = {}) {
    if (!condition || condition === 'none' || condition === 'any') {
        return true;
    }

    const boardRef = context.board || (typeof board !== 'undefined' ? board : []);
    return playerControlsGem(boardRef, player, condition);
}

// Calcula el coste de energía efectivo de una carta antes de jugarla
function getEffectiveCardEnergyCost(card, player, context = {}) {
    if (!card) return 2;
    let cost = typeof card.energyCost === 'number' ? card.energyCost : 2;

    if (card.powerEffect === 'discount_energy_1') {
        const condMet = evaluateTCGCondition(card.powerCondition || card.targetGemId, player, context);
        if (condMet) {
            cost = Math.max(0, cost - 1);
        }
    }
    return cost;
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
function refreshPermanentBoardPowers(currentBoard, context = {}) {
    if (!Array.isArray(currentBoard)) return;

    currentBoard.forEach((card) => {
        if (!card) return;
        clearPermanentCardFlags(card);

        const owner = card.owner;
        if (!owner) return;

        const effectType = card.powerEffect;
        if (!effectType || effectType === 'none') return;

        if (
            effectType === 'verde' ||
            effectType === 'violeta' ||
            effectType === 'blanco' ||
            effectType === 'jump_reveal_gem' ||
            effectType === 'refund_energy_1' ||
            effectType === 'discount_energy_1'
        ) {
            return;
        }

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
                card.hasTCGQuartzEffect = true;
                break;
            default:
                break;
        }
    });
}

// Resolver el poder TCG al desplegar una carta en board[boardIndex]
function resolveTCGCardPower(card, currentBoard, player, currentEnergy, playerDecks, playerHands, playerDiscards, boardIndex, context = {}) {
    if (!card || !card.powerCondition || !card.powerEffect) {
        return { logText: '', energyDelta: 0, finalBoardIndex: boardIndex };
    }

    const condition = card.powerCondition;
    const effectType = card.powerEffect;
    let activeIdx = boardIndex;

    card.diamondTempShield = false;
    card.diamondShieldOwner = null;
    card.isProtected = (card.gemRevealed && card.gemRevealed.protected) || false;
    clearPermanentCardFlags(card);

    // --- SALTO Y REVELADO A GEMA ESPECÍFICA (Explorador) ---
    if (effectType === 'jump_reveal_gem' && card.targetGemId && Array.isArray(context.gems)) {
        const destIdx = context.gems.findIndex(g => g && g.id === card.targetGemId);
        if (destIdx !== -1 && destIdx !== activeIdx && currentBoard[destIdx] === null) {
            const destGem = context.gems[destIdx];
            if (Array.isArray(context.revealedBoardGems)) {
                context.revealedBoardGems[destIdx] = true;
            }
            card.gemRevealed = destGem;
            card.isProtected = Boolean(destGem && destGem.protected);
            currentBoard[destIdx] = card;
            currentBoard[activeIdx] = null;
            activeIdx = destIdx;
            if (typeof context.onCardMoved === 'function') {
                context.onCardMoved(activeIdx);
            }
            return {
                logText: ` 💎 [Salto a ${destGem.name} y revelada]`,
                energyDelta: 0,
                finalBoardIndex: activeIdx
            };
        }
        return { logText: '', energyDelta: 0, finalBoardIndex: activeIdx };
    }

    const conditionMet = evaluateTCGCondition(condition, player, {
        ...context,
        board: currentBoard,
        decks: playerDecks,
        hands: playerHands,
        discards: playerDiscards
    });

    if (!conditionMet) {
        return { logText: '', energyDelta: 0, finalBoardIndex: activeIdx };
    }

    let energyDelta = 0;

    // --- REEMBOLSO DE 1⚡ (Chispa) ---
    if (effectType === 'refund_energy_1') {
        energyDelta += 1;
        const gemLabel = getGemMetaById(card.targetGemId || condition).short;
        return {
            logText: ` ⚡ [Reembolso +1⚡ por ${gemLabel}]`,
            energyDelta,
            finalBoardIndex: activeIdx
        };
    }

    // --- DESPLIEGUE: Diamante ---
    if (effectType === 'blanco') {
        card.isProtected = true;
        card.diamondTempShield = true;
        card.diamondShieldOwner = player;
        return {
            logText: ` 🎴 [Poder: Diamante (🛡️ Invuln. hasta tu próximo turno)]`,
            energyDelta: 0,
            finalBoardIndex: activeIdx
        };
    }

    // --- DESPLIEGUE: Esmeralda ---
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
        return {
            logText: ` 🎴 [Efecto Esmeralda: Recup/Robo/Desc]`,
            energyDelta: 0,
            finalBoardIndex: activeIdx
        };
    }

    // --- DESPLIEGUE: Amatista ---
    if (effectType === 'violeta') {
        const energyGain = (condition === 'violeta') ? 2 : 1;
        energyDelta += energyGain;
        return {
            logText: ` 🎴 [Efecto Amatista: +${energyGain}⚡]`,
            energyDelta,
            finalBoardIndex: activeIdx
        };
    }

    // Efectos permanentes continuos ('rojo', 'azul', 'amarillo', 'naranja', 'negro', 'marron')
    refreshPermanentBoardPowers(currentBoard, {
        ...context,
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

    return {
        logText: ` 🎴${labels[effectType] || ''}`,
        energyDelta: 0,
        finalBoardIndex: activeIdx
    };
}
