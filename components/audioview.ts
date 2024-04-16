class AudioView extends HTMLElement {
    public connectedCallback() {
        this.textContent = 'AudioView!';
    }
}

window.customElements.define('audio-view', AudioView);
