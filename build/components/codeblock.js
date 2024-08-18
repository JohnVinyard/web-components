import hljs from 'highlight.js';
import python from 'highlight.js/lib/languages/python';
hljs.registerLanguage('python', python);
export class CodeBlock extends HTMLElement {
    constructor() {
        super();
        this.language = null;
    }
    render() {
        let shadow = this.shadowRoot;
        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }
        setTimeout(() => {
            const highlightedCode = hljs.highlight(this.textContent, {
                language: this.language,
            });
            // choose a theme from here: https://www.jsdelivr.com/package/npm/highlightjs-themes?tab=files
            shadow.innerHTML = `
                <div>
                    <style>
                        pre {
                            padding: 30px !important;
                            line-height: 0.7em !important;
                        }
                    </style>
                    <link
                        rel="stylesheet"
                        href="https://cdn.jsdelivr.net/npm/highlightjs-themes@1.0.0/darkula.css"
                    />
                    <pre class="hljs"><code>${highlightedCode.value}</code></pre>
                </div>
            `;
            // KLUDGE: What's a more principled way to know when this.textContent is available?
        }, 1000);
    }
    connectedCallback() {
        this.render();
    }
    static get observedAttributes() {
        return ['language'];
    }
    attributeChangedCallback(property, oldValue, newValue) {
        if (newValue === oldValue) {
            return;
        }
        this[property] = newValue;
        if (property === 'language') {
            this.render();
            return;
        }
    }
}
window.customElements.define('code-block', CodeBlock);
//# sourceMappingURL=codeblock.js.map