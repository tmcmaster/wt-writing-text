import {LitElement, html, svg, css} from "https://unpkg.com/lit-element/lit-element.js?module"

window.customElements.define('wt-writing-text', class extends LitElement {

    // noinspection JSUnusedGlobalSymbols
    static get properties() {
        return {
            text: {type: String},
            speed: {type: Number},
            textHeight: {type: String},
        }
    }

    constructor() {
        super();
        this.text = '';
        this.speed = 1;
        this.textHeight = 12;
    }

    getSplitLines() {
        const lineHeight = this.textHeight * 1.7;
        const numberOfLines = Math.floor(this.clientHeight / lineHeight);
        const lineLength = this.text.length / (numberOfLines);

        let string = this.text;
        let pointer = 0;
        const lines = [];
        while (pointer < string.length) {
            const index = string.indexOf(' ', pointer + lineLength);
            const nextPointer = index < 0 ? pointer + lineLength : index;
            lines.push(string.substring(pointer, nextPointer));
            pointer = nextPointer;
        }
        // console.log(lines);
        return lines;
    }

    // noinspection JSUnusedGlobalSymbols
    firstUpdated() {
        const slot = this.renderRoot.querySelector('slot');
        const nodesText = slot.assignedNodes().map((n) => n.innerText ? n.innerText.trim() : n.innerHTML).join(" ");
        console.log(nodesText);
        if (nodesText.length > 0) {
            this.text = nodesText;
        }
    }

    // noinspection JSUnusedGlobalSymbols
    updated() {
        this.renderRoot.querySelectorAll('.bar').forEach((node, i) => {
            setTimeout(() => {
                node.className = 'bar move';
            }, this.speed * 1000 * i);
        });
    }

    // noinspection JSUnusedGlobalSymbols
    render() {
        const textHeight = this.textHeight;
        const lineHeight = textHeight * 1.7;
        const splitLines = this.getSplitLines();

        return this.text == null ? html`
            <div></div>` : html`
            <style>
                ${css`
                    svg {
                        position: relative;
                    }

                    div.bar {
                        position: absolute;
                        background: blue;
                        width: 100%;
                        left: -100%;
                    }

                    div.move {
                        background: cadetblue;
                        left: 0px;
                        transition: left ${this.speed + 0.5}s;
                    }

                    div.container {
                        //display: inline-block;
                    }

                    div.wrapper {
                        position: relative;
                        left: 0;
                        top: 0;
                        background: white;
                        overflow: clip;
                        width: 100%;
                        height: 100%;
                        display: inline-block;
                    }

                    #slot {
                        display: none;
                    }
                `}
            </style>
            <div class="container">
                <div class="wrapper">

                    ${splitLines.map((line, i) => html`
                        <div class="bar" style="top:${(i + 0.5) * lineHeight}px;height:${lineHeight}px"></div>
                    `)}

                    <svg width="100%" height="100%">
                        <mask id="m">
                            <rect x="0" y="0" width="800px" height="100%" fill="white"/>

                            ${splitLines.map((line, i) => svg`
                                <text x="10"
                                    y="${(i + 1) * lineHeight}"
                                    font-size="${textHeight}"
                                    font-family="arial"
                                    dominant-baseline="top"
                                    text-anchor="left"
                                    fill="black">${line}</text>
                            `)}

                        </mask>
                        <rect x="0" y="0" width="100%" height="100%" rx="0" mask="url(#m)" fill="white"/>
                    </svg>
                    <div style="visibility: false; position:absolute;left:-1000px;display:none">
                        <slot id="slot"></slot>
                    </div>
                </div>
            </div>
        `;
    }
});
