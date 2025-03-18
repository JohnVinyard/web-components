import { playAudio, context, fetchAudio } from './audioview';
export class AudioTimeline extends HTMLElement {
    constructor() {
        super();
        this.events = '[]';
        this.duration = '';
        this.width = '';
        this.height = '';
        this.play = 'true';
    }
    get shouldPlayOnClick() {
        return this.play.toLowerCase() === 'true';
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
        const eventComponent = (event) => {
            var _a;
            const step = ((_a = event.eventDuration) !== null && _a !== void 0 ? _a : 0.5) / event.eventEnvelope.length;
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
                g:hover rect {
                    stroke: rgba(0, 0, 0, 0.2);
                    stroke-width: 0.01;
                }
                @media (max-width: 992px) {
                    .audio-timeline {
                        max-width: 100%;
                        overflow-x: scroll;
                    }
                }
            </style>
            <div class="audio-timeline">
                <svg 
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                    width="${this.width}" 
                    height="${this.height}" 
                    viewbox="0 0 ${this.duration} 1">
                        ${events.map(eventComponent).join('')}
                </svg>
            </div>
        `;
        shadow.querySelectorAll('g').forEach((element, index) => {
            element.addEventListener('click', (evt) => {
                evt.stopPropagation();
                const event = events[index];
                const playedEvent = new CustomEvent('audio-view-played', {
                    cancelable: true,
                    bubbles: true,
                    detail: {
                        url: event.audioUrl,
                        startSeconds: event.offset,
                        durationSeconds: event.eventDuration,
                        eventTime: evt.timeStamp / 1000,
                        patternStartTime: event.eventTime,
                    },
                });
                this.dispatchEvent(playedEvent);
                if (this.shouldPlayOnClick) {
                    playAudio(event.audioUrl, context, event.offset, event.eventDuration);
                }
            });
        });
    }
    static get observedAttributes() {
        return ['events', 'duration', 'width', 'height', 'play'];
    }
    attributeChangedCallback(property, oldValue, newValue) {
        if (newValue === oldValue) {
            return;
        }
        this[property] = newValue;
        if (AudioTimeline.observedAttributes.some((x) => x === property)) {
            if (property === 'events') {
                Promise.all(this.eventData.map(({ audioUrl }) => {
                    return fetchAudio(audioUrl, context);
                })).then((results) => {
                    const event = new CustomEvent('audio-view-loaded', {
                        bubbles: true,
                        cancelable: true,
                        detail: {
                            timeline: true,
                        },
                    });
                    this.dispatchEvent(event);
                });
            }
            this.render();
        }
    }
}
window.customElements.define('audio-timeline', AudioTimeline);
//# sourceMappingURL=audiotimeline.js.map