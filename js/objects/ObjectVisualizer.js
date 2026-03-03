export const ANCHOR_MODES = {
    BOTTOM: 'bottom',
    CENTER: 'center',
    TOP: 'top'
};

export class ObjectVisualizer {
    /**
     * Applies precise anchor and positioning styles to the object wrapper and image
     * @param {HTMLElement} wrapper The main container div
     * @param {HTMLElement} imageElement The inner img or content element
     * @param {string} mode One of ANCHOR_MODES
     */
    static applyAnchor(wrapper, imageElement, mode) {
        switch (mode) {
            case ANCHOR_MODES.CENTER:
                // Center the object visually around its local (0,0) which is top-left of wrapper
                // But wrapper is positioned at (left, top).
                // If we want the "center" of the image to be at the object's (x,z),
                // The wrapper is already translated to (x - width/2, y - height).

                // transformOrigin affects scaling and rotation pivot.
                wrapper.style.transformOrigin = 'center center';

                // objectPosition affects how the image fills the box
                if (imageElement) {
                    imageElement.style.objectPosition = 'center center';
                }
                break;

            case ANCHOR_MODES.TOP:
                wrapper.style.transformOrigin = 'center top';
                if (imageElement) {
                    imageElement.style.objectPosition = 'center top';
                }
                break;

            case ANCHOR_MODES.BOTTOM:
            default:
                wrapper.style.transformOrigin = 'center bottom';
                if (imageElement) {
                    imageElement.style.objectPosition = 'center bottom';
                }
                break;
        }
    }
}
