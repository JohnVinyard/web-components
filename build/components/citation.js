export class CitationBlock extends HTMLElement {
    constructor() {
        super();
        this.tag = null;
        this.author = null;
        this.header = null;
        this.url = null;
        this.year = null;
    }
    render() {
        let shadow = this.shadowRoot;
        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }
        const citation = `
@misc{${this.tag},
    author = {${this.author}},
    title = {${this.header}},
    url = {<a href="${this.url}" target="_blank">${this.url}</a>}
    year = {${this.year}}
}
        `;
        shadow.innerHTML = `
<style>
        .container {
            position: relative
        }
        .copy-to-clipboard {
            position: absolute;
            top: 15px;
            right: 30px;
            background-color: #eee;
            padding: 5px;
            cursor: pointer;
            box-shadow: 5px 5px 5px -5px rgba(0,0,0,0.75);
            border-radius: 3px;
            border: 0px solid #000000;
        }
        .copy-to-clipboard:active {
            background-color: #aaa;
        }
</style>
<div class="container">
    <div class='copy-to-clipboard'>
        copy
    </div>
<pre>
    <code>
${citation}
    </code>
</pre>
</div
        `;
        const copyButton = shadow.querySelector('.copy-to-clipboard');
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(citation);
        });
    }
    connectedCallback() {
        this.render();
    }
    static get observedAttributes() {
        return ['tag', 'author', 'header', 'url', 'year'];
    }
    attributeChangedCallback(property, oldValue, newValue) {
        if (newValue === oldValue) {
            return;
        }
        this[property] = newValue;
        this.render();
    }
}
window.customElements.define('citation-block', CitationBlock);
//# sourceMappingURL=citation.js.map