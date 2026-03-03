import { InteractableObject } from './InteractableObject.js';
import { ITEM_CONFIGS } from '../configs/ItemConfigs.js';

export class Pond extends InteractableObject {
    constructor(id, x, z) {
        // Use the centralized config for POND
        super(id, x, z, ITEM_CONFIGS.POND);

        // Custom visual override specific to Pond class if needed
        // (Though ITEM_CONFIGS could handle visuals if we extended logic, 
        // but simple style tweaks here are fine)
        if (this.element) {
            // Check if element is img directly or wrapper containing img
            // InteractableObject creates div wrapper -> img
            const img = this.element.querySelector('img');
            if (img) img.style.opacity = '0.8';
        }
    }
}
