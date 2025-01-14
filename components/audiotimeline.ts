import { playAudio, context } from './audioview';

interface Event {
    eventTime: number;
    eventDuration: number;
    eventEnvelope: number[];
    audioUrl: string;
    color: string;
    y: number;
    offset: number;
}

export class AudioTimeline extends HTMLElement {
    public events: string | null;
    public duration: string | null;
    public width: string | null;
    public height: string | null;

    constructor() {
        super();
        this.events = '[]';
        this.duration = '';
        this.width = '';
        this.height = '';
    }

    public get eventData(): Event[] {
        const parsed = JSON.parse(this.events) as Event[];
        return parsed;
    }

    public get durationSeconds(): number {
        return parseFloat(this.duration);
    }

    public connectedCallback() {
        this.render();
    }

    private render() {
        let shadow: ShadowRoot | null = this.shadowRoot;

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

        const eventComponent = (event: Event): string => {
            const step = event.eventDuration / event.eventEnvelope.length;

            const maxValue = Math.max(...event.eventEnvelope);

            const elementHeight = 0.1;

            const barHeight = (x: number) => {
                return (x / maxValue) * elementHeight;
            };

            const startY = (x: number) => {
                const bh = barHeight(x);
                const diff = elementHeight - bh;
                return diff * 0.5;
            };
            // TODO: rounder corners and pretty colors

            return `
                    <g>
                        ${event.eventEnvelope
                            .map(
                                (e, index) =>
                                    `<rect rx="0.2" ry="0.2" x="${
                                        event.eventTime + index * step
                                    }" y="${
                                        event.y + startY(e)
                                    }" width="${step}" height="${barHeight(
                                        e
                                    )}" fill="${event.color}" />`
                            )
                            .join('')}
                    </g>
            `;
        };

        console.log('DURATION', this.durationSeconds, this.duration);

        shadow.innerHTML = `
            <style>
                svg {
                    border: solid 1px #000;
                }

                g {
                    cursor: pointer;
                }
            </style>
            <svg 
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
                overflow="visible"
                width="${this.width}" 
                height="${this.height}" 
                viewbox="0 0 ${this.duration} 1">
                    ${events.map(eventComponent).join('')}
            </svg>
        `;

        // const svgContainer = shadow.querySelector('svg');

        shadow.querySelectorAll('g').forEach((element, index) => {
            element.addEventListener('click', (evt: PointerEvent) => {
                const event = events[index];

                playAudio(
                    event.audioUrl,
                    context,
                    event.offset,
                    event.eventDuration
                );
            });
        });
    }

    public static get observedAttributes(): (keyof AudioTimeline)[] {
        return ['events', 'duration', 'width', 'height'];
    }

    public attributeChangedCallback(
        property: string,
        oldValue: string,
        newValue: string
    ) {
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
