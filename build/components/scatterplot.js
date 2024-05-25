class ScatterPlot extends HTMLElement {
    constructor() {
        super();
        this.points = '[]';
        this.width = '100';
        this.height = '100';
        this.radius = '1';
    }
    get pointData() {
        const parsed = JSON.parse(this.points);
        return parsed;
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
        const points = this.pointData;
        const x = points.map((p) => p.x);
        const y = points.map((p) => p.y);
        const [xMin, xMax] = [Math.min(...x), Math.max(...x)];
        const [yMin, yMax] = [Math.min(...y), Math.max(...y)];
        const xSpan = xMax - xMin;
        const ySpan = yMax - yMin;
        shadow.innerHTML = `
            <style>
                circle {
                    cursor: pointer;
                }
            </style>
            <svg 
                width="${this.width}" 
                height="${this.height}" 
                viewbox="${xMin} ${yMin} ${xSpan} ${ySpan}">
                    ${points
            .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${this.radius}" />`)
            .join('')}
            </svg>
        `;
        const svgContainer = shadow.querySelector('svg');
        shadow.querySelectorAll('circle').forEach((element, index) => {
            element.addEventListener('click', (event) => {
                // TODO: This needs to be linked back to a point object
                // so the audio can be played
                console.log('CLICKED', index);
                const point = points[index];
                const animationValues = [
                    this.radius,
                    (parseFloat(this.radius) * 1.5).toFixed(2),
                    this.radius,
                ];
                const values = animationValues.join(';');
                const startTime = svgContainer.getCurrentTime();
                const circleElement = event.target;
                circleElement.innerHTML = `
                    <animate
                        attributeName="r"
                        values="${values}"
                        begin="${startTime}s"
                        dur="0.25s"
                        repeatCount="1" />
                `;
                playAudio(point.url, context, point.startSeconds, point.durationSeconds);
            });
        });
    }
    static get observedAttributes() {
        return ['points', 'width', 'height', 'radius'];
    }
    attributeChangedCallback(property, oldValue, newValue) {
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
//# sourceMappingURL=scatterplot.js.map