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
    return board.some(c => c !== null && c.owner === player && c.gemRevealed && c.gemRevealed.id === gemId);
}

// Resolver el poder TCG al jugar una carta en board[index]
function resolveTCGCardPower(card, board, player, currentEnergy, decks, hands, discards, boardIndex) {
    if (!card || !card.powerCondition || !card.powerEffect) return { logText: '', energyDelta: 0 };

    const condition = card.powerCondition; // 'none', 'any', o el id de una gema
    const effectType = card.powerEffect;   // El efecto exclusivo a disparar

    // VALIDADOR DE CONDICIÓN:
    // Si la condición es distinta de 'none' y 'any', se requiere controlar esa gema obligatoriamente.
    if (condition !== 'none' && condition !== 'any') {
        if (!playerControlsGem(board, player, condition)) {
            return { logText: '', energyDelta: 0 }; // No se cumple la condición -> La carta no activa su efecto
        }
    }

    let logText = ` 🎴 [Sinergia TCG]`;
    let energyDelta = 0;

    // Blanquear banderas anteriores para evitar efectos fantasma
    card.hasTCGRubyEffect = false;
    card.hasTCGZafiroEffect = false;
    card.hasTCGTopacioEffect = false;
    card.hasTCGOnixEffect = false;
    card.hasTCGAmberEffect = false;
    card.hasTCGQuartzEffect = false;
    card.isBufferedByQuartz = false;
    card.tcgQuartzBoostedSides = null;
    card.diamondTempShield = false;
    card.diamondShieldOwner = null;
    card.isProtected = (card.gemRevealed && card.gemRevealed.protected) || false;

    // --- REGLA ESPECIAL: Diamante (Invulnerabilidad hasta el inicio de tu siguiente turno) ---
    if (effectType === 'blanco') {
        card.isProtected = true;
        card.diamondTempShield = true;
        card.diamondShieldOwner = player;
        return { logText: ` 🎴 [Poder: Diamante (Invulnerable hasta tu próximo turno)]`, energyDelta: 0 };
    }

    // APLICAR EL EFECTO ELEGIDO
    switch (effectType) {
        case 'rojo': // Efecto Rubí: Activa pasiva de energía al atacar
            card.hasTCGRubyEffect = true;
            logText += ` [Efecto Rubí: +1⚡ al Atacar]`;
            break;

        case 'azul': // Efecto Zafiro: Activa pasiva de energía al robar carta
            card.hasTCGZafiroEffect = true;
            logText += ` [Efecto Zafiro: +1⚡ al Robar]`;
            break;

        case 'amarillo': // Efecto Topacio: +1 energía al recuperar
            card.hasTCGTopacioEffect = true;
            logText += ` [Efecto Topacio: +1⚡ al Recuperar]`;
            break;

        case 'verde': // Efecto Esmeralda: Recupera 2 del descarte al mazo, roba 1, descarta 1 al rival
            for (let i = 0; i < 2; i++) {
                if (discards[player].length > 0) { decks[player].push(discards[player].pop()); }
            }
            if (decks[player].length > 0) {
                hands[player].push(decks[player].pop());
            }
            const opponent = player === 'red' ? 'blue' : 'red';
            if (hands[opponent] && hands[opponent].length > 0) {
                const rIdx = Math.floor(Math.random() * hands[opponent].length);
                discards[opponent].push(hands[opponent].splice(rIdx, 1)[0]);
            }
            logText += ` [Efecto Esmeralda: Recup/Robo/Desc]`;
            break;

        case 'naranja': // Efecto Ámbar: Extiende energía máxima a 4
            card.hasTCGAmberEffect = true;
            logText += ` [Efecto Ámbar: Máx 4⚡]`;
            break;

        case 'violeta': // Efecto Amatista: Da energía (+2 si la condición era amatista, sino +1)
            let energyGain = (condition === 'violeta') ? 2 : 1;
            energyDelta += energyGain;
            logText += ` [Efecto Amatista: +${energyGain}⚡]`;
            break;

        case 'negro': // Efecto Ónix: +1 energía al descartar
            card.hasTCGOnixEffect = true;
            logText += ` [Efecto Ónix: +1⚡ al Descartar]`;
            break;

        case 'marron': // Efecto Cuarzo
            if (condition === 'marron') {
                const row = Math.floor(boardIndex / 3);
                const col = boardIndex % 3;
                const targetIndices = [boardIndex];
                if (row > 0) targetIndices.push((row - 1) * 3 + col);
                if (row < 2) targetIndices.push((row + 1) * 3 + col);
                if (col > 0) targetIndices.push(row * 3 + (col - 1));
                if (col < 2) targetIndices.push(row * 3 + (col + 1));

                targetIndices.forEach(idx => {
                    if (board[idx] && board[idx].owner === player) {
                        board[idx].quartzAuraTempBuff = (board[idx].quartzAuraTempBuff || 0) + 1;
                        board[idx].quartzAuraOwner = player;
                    }
                });
                logText += ` [Efecto Cuarzo: +1 a carta y adyacentes hasta tu turno]`;
            } else {
                card.hasTCGQuartzEffect = true;
                logText += ` [Efecto Cuarzo: Iguala al mayor en todas tus cartas]`;
            }
            break;

        default:
            break;
    }

    return { logText, energyDelta };
}
