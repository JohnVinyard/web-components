import { playAudio, context, fetchAudio } from './audioview';

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
    public playOnClick: string | null;

    constructor() {
        super();
        this.events = '[]';
        this.duration = '';
        this.width = '';
        this.height = '';
        this.playOnClick = 'true';
    }

    public get shouldPlayOnClick(): boolean {
        return this.playOnClick.toLowerCase() === 'true';
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

        const eventComponent = (event: Event): string => {
            const step = event.eventDuration / event.eventEnvelope.length;

            const maxValue = Math.max(...event.eventEnvelope);

            const elementHeight = 0.05;

            const barHeight = (x: number) => {
                return (x / maxValue) * elementHeight;
            };

            const startY = (x: number) => {
                const bh = barHeight(x);
                return -(bh / 2);
            };

            return `
                    <g>
                        ${event.eventEnvelope
                            .map(
                                (e, index) =>
                                    `<rect rx="0.1" ry="0.1" x="${
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
            element.addEventListener('click', (evt: PointerEvent) => {
                evt.stopPropagation();

                const event = events[index];
                const playedEvent = new CustomEvent('audio-view-played', {
                    cancelable: true,
                    bubbles: true,
                    detail: {
                        url: event.audioUrl,
                        startSeconds: event.offset,
                        durationSeconds: event.eventDuration,
                    },
                });
                this.dispatchEvent(playedEvent);

                if (this.shouldPlayOnClick) {
                    playAudio(
                        event.audioUrl,
                        context,
                        event.offset,
                        event.eventDuration
                    );
                }
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
            if (property === 'events') {
                Promise.all(
                    this.eventData.map(({ audioUrl }) => {
                        return fetchAudio(audioUrl, context);
                    })
                ).then((results) => {
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
