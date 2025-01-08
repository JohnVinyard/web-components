import { playAudio, context } from './audioview';

interface Point {
    x: number;
    y: number;
    url: string;
    startSeconds: number;
    durationSeconds: number;
    eventDuration?: number;
    color: string | null;
}

export class ScatterPlot extends HTMLElement {
    public points: string | null;
    public width: string | null;
    public height: string | null;
    public radius: string | null;

    constructor() {
        super();
        this.points = '[]';
        this.width = '100';
        this.height = '100';
        this.radius = '1';
    }

    public get pointData(): Point[] {
        const parsed = JSON.parse(this.points) as Point[];
        return parsed;
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
        const points = this.pointData;
        const x = points.map((p) => p.x);
        const y = points.map((p) => p.y);
        const [xMin, xMax] = [Math.min(...x), Math.max(...x)];
        const [yMin, yMax] = [Math.min(...y), Math.max(...y)];

        const xSpan = xMax - xMin;
        const ySpan = yMax - yMin;

        shadow.innerHTML = `
            <style>
                circle, rect {
                    cursor: pointer;
                }
            </style>
            <svg 
                width="${this.width}" 
                height="${this.height}" 
                viewbox="${xMin} ${yMin} ${xSpan} ${ySpan}">
                    ${points
                        .map((p) =>
                            p.eventDuration
                                ? `<rect fill="${
                                      p.color ?? 'rgb(0 0 0)'
                                  }" width="${xSpan}" height="${
                                      this.radius
                                  }" x="${p.x}" y="${p.y}" />`
                                : `<circle cx="${p.x}" cy="${p.y}" r="${
                                      this.radius
                                  }" fill="${p.color ?? 'rgb(0 0 0)'}" />`
                        )
                        .join('')}
            </svg>
        `;

        const svgContainer = shadow.querySelector('svg');

        shadow.querySelectorAll('circle, rect').forEach((element, index) => {
            element.addEventListener('click', (event: PointerEvent) => {
                const point = points[index];

                const animationValues = [
                    this.radius,
                    (parseFloat(this.radius) * 1.5).toFixed(2),
                    this.radius,
                ];
                const values = animationValues.join(';');

                const startTime = svgContainer.getCurrentTime();
                const circleElement = event.target as SVGCircleElement;
                circleElement.innerHTML = `
                    <animate
                        attributeName="r"
                        values="${values}"
                        begin="${startTime}s"
                        dur="0.25s"
                        repeatCount="1" />
                `;

                playAudio(
                    point.url,
                    context,
                    point.startSeconds,
                    point.durationSeconds
                );
            });
        });
    }

    public static get observedAttributes(): (keyof ScatterPlot)[] {
        return ['points', 'width', 'height', 'radius'];
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

        if (ScatterPlot.observedAttributes.some((x) => x === property)) {
            this.render();
        }
    }
}

window.customElements.define('scatter-plot', ScatterPlot);
