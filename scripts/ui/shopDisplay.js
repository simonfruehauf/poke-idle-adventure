// scripts/ui/shopDisplay.js
import { gameState, pokeballData, itemData } from '../state.js'; // Adjusted path
import { formatNumberWithDots } from '../utils.js'; // Adjusted path
import { XP_SHARE_CONFIG } from '../config.js'; // Adjusted path

export function updateShopInterface() {
    // Update XP Share Shop Item
    const xpShareShopItemEl = document.getElementById('exp-share-shop-item');
    const xpShareTooltipEl = document.getElementById('tooltip-exp-share-shop-item');
    const xpShareTextEl = document.getElementById('exp-share-text'); // Corrected ID
    const xpShareButton = document.getElementById('exp-share-buy-btn');

    if (xpShareShopItemEl && xpShareTooltipEl && xpShareTextEl && xpShareButton) {
        if (gameState.xpShareLevel >= XP_SHARE_CONFIG.length) {
            xpShareTextEl.textContent = "XP Share (Max Level)";
            xpShareButton.textContent = "Max Level";
            xpShareButton.disabled = true;
            xpShareTooltipEl.textContent = "XP Share is at its maximum level.";
        } else {
            const nextLevelConfig = XP_SHARE_CONFIG[gameState.xpShareLevel];
            xpShareTextEl.textContent = `${nextLevelConfig.name}`;
            xpShareButton.textContent = `Buy - ${formatNumberWithDots(nextLevelConfig.cost)}₽`;
            xpShareButton.disabled = gameState.money < nextLevelConfig.cost || gameState.eventModalActive;
            xpShareTooltipEl.textContent = `${nextLevelConfig.name}: Increases EXP gained by benched Pokémon by ${nextLevelConfig.percentage * 100}%. Cost: ${formatNumberWithDots(nextLevelConfig.cost)}₽`;
        }
    }

    // Update Pokéball Shop Items
    for (const ballId in pokeballData) {
        if (Object.hasOwnProperty.call(pokeballData, ballId)) {
            const ballInfo = pokeballData[ballId];
            const shopItemEl = document.getElementById(`shop-item-${ballId}`);
            if (shopItemEl && ballInfo) {
                const nameSpan = shopItemEl.querySelector('span');
                if (nameSpan) nameSpan.textContent = `${ballInfo.name}`;

                const buyButton = shopItemEl.querySelector(`button[data-itemid="${ballId}"]`);
                if (buyButton && typeof ballInfo.cost === 'number') {
                    buyButton.textContent = `Buy - ${formatNumberWithDots(ballInfo.cost)}₽`;
                    buyButton.disabled = gameState.money < ballInfo.cost || gameState.eventModalActive;
                }

                const tooltipEl = document.getElementById(`tooltip-shop-item-${ballId}`);
                if (tooltipEl) tooltipEl.textContent = ballInfo.description || ballInfo.name;
            }
        }
    }

    // Update Other Item Shop Items
    for (const itemId in itemData) {
        if (Object.hasOwnProperty.call(itemData, itemId)) {
            // Skip XP Share as it's handled separately above
            if (itemId === 'expshare') continue;

            const itemInfo = itemData[itemId];
            const shopItemEl = document.getElementById(`shop-item-${itemId}`);
            if (shopItemEl && itemInfo) {
                const nameSpan = shopItemEl.querySelector('span');
                if (nameSpan) nameSpan.textContent = `${itemInfo.name}`;

                const buyButton = shopItemEl.querySelector(`button[data-itemid="${itemId}"]`);
                if (buyButton && typeof itemInfo.cost === 'number') {
                    buyButton.textContent = `Buy - ${formatNumberWithDots(itemInfo.cost)}₽`;
                    buyButton.disabled = gameState.money < itemInfo.cost || gameState.eventModalActive;
                }

                const tooltipEl = document.getElementById(`tooltip-shop-item-${itemId}`);
                if (tooltipEl) tooltipEl.textContent = itemInfo.description || itemInfo.name;
            }
        }
    }
}
