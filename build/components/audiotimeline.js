import { playAudio, context } from './audioview';
export class AudioTimeline extends HTMLElement {
    constructor() {
        super();
        this.events = '[]';
        this.duration = '';
        this.width = '';
        this.height = '';
    }
    get eventData() {
        const parsed = JSON.parse(this.events);
        return parsed;
    }
    get durationSeconds() {
        return parseFloat(this.duration);
    }
    connectedCallback() {
        this.render();
    }
    render() {
        let shadow = this.shadowRoot;
        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }
        // establish bounds for x and y axes
        const events = this.eventData;
        // const y = events.map((p) => p.y);
        // const [xMin, xMax] = [0, this.duration];
        // const xSpan = xMax - xMin;
        // const [yMin, yMax] = [0, 1];
        // const ySpan = yMax - yMin;
        const eventComponent = (event) => {
            const step = event.eventDuration / event.eventEnvelope.length;
            const maxValue = Math.max(...event.eventEnvelope);
            const elementHeight = 0.05;
            const barHeight = (x) => {
                return (x / maxValue) * elementHeight;
            };
            const startY = (x) => {
                const bh = barHeight(x);
                return -(bh / 2);
            };
            return `
                    <g>
                        ${event.eventEnvelope
                .map((e, index) => `<rect rx="0.1" ry="0.1" x="${event.eventTime + index * step}" y="${event.y + startY(e)}" width="${step}" height="${barHeight(e)}" fill="${event.color}" />`)
                .join('')}
                    </g>
            `;
        };
        shadow.innerHTML = `
            <style>
                g {
                    cursor: pointer;
                }
            </style>
            <svg 
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
                width="${this.width}" 
                height="${this.height}" 
                viewbox="0 0 ${this.duration} 1">
                    ${events.map(eventComponent).join('')}
            </svg>
        `;
        shadow.querySelectorAll('g').forEach((element, index) => {
            element.addEventListener('click', (evt) => {
                const event = events[index];
                playAudio(event.audioUrl, context, event.offset, event.eventDuration);
            });
        });
    }
    static get observedAttributes() {
        return ['events', 'duration', 'width', 'height'];
    }
    attributeChangedCallback(property, oldValue, newValue) {
        if (newValue === oldValue) {
            return;
        }
        this[property] = newValue;
        if (AudioTimeline.observedAttributes.some((x) => x === property)) {
            this.render();
        }
    }
}
window.customElements.define('audio-timeline', AudioTimeline);
//# sourceMappingURL=audiotimeline.js.map