import { sys } from 'cc';

/** Browser accessibility for the Cocos canvas; the DOM layer never runs in a tt host. */
export class BrowserTestBridge {
    private controls: Record<string, { label: string; invoke: () => void }> = {};
    private texts: string[] = [];
    private sequence = 0;
    private layer: HTMLDivElement | null = null;
    constructor(enabled: boolean, private snapshot: () => object, private height = 844) {
        // Read-only diagnostic snapshot for the official IDE. It exposes no solution or commands.
        // A deep copy prevents external inspection from modifying the live wallet or attempt.
        try { Object.defineProperty(globalThis, '__SHISE_STATE__', {
            configurable: true, get: () => JSON.parse(JSON.stringify(this.snapshot())),
        }); } catch { /* Diagnostics never block a host without configurable global properties. */ }
        // Mini-game adapters also expose document, but it is not a browser DOM.
        if (!enabled || !sys.isBrowser || typeof document === 'undefined') return;
        this.layer = document.createElement('div');
        this.layer.setAttribute('aria-label', '拾色之间游戏操作');
        this.layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10';
        document.body.appendChild(this.layer);
        const style = document.createElement('style');
        style.textContent = '.shise-control{opacity:0;border:0;padding:0;pointer-events:auto;position:fixed;cursor:pointer}.shise-control:focus-visible{opacity:1;background:transparent;color:transparent;outline:2px solid #554D72;border-radius:8px}';
        document.head.appendChild(style);
        const context = (document as unknown as { modelContext?: { registerTool: (tool: object) => Promise<unknown> } }).modelContext
            || (navigator as unknown as { modelContext?: { registerTool: (tool: object) => Promise<unknown> } }).modelContext;
        if (!context) return;
        const result = () => {
            try { return { content: [{ type: 'text', text: JSON.stringify({ ...this.snapshot(), texts: [...this.texts],
                controls: Object.keys(this.controls).map(id => ({ id, label: this.controls[id].label })) }) }] }; }
            catch (error) { return { content: [{ type: 'text', text: String(error) }] }; }
        };
        const register = (tool: object) => {
            try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch { /* Optional browser support. */ }
        };
        register({ name: 'shise_state', description: 'Read the visible Cocos tester UI state. Does not reveal puzzle answers.',
            inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true }, execute: result });
        register({ name: 'shise_tap', description: 'Tap a currently visible Cocos control by id from shise_state. Same callback as screen controls; no arbitrary state edits.',
            inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
            execute: (input: { id: string }) => { this.controls[input.id]?.invoke(); return result(); } });
    }
    clear(): void { this.controls = {}; this.texts = []; this.layer?.replaceChildren(); }
    removeControls(labels: readonly string[]): void {
        for (const id of Object.keys(this.controls)) if (labels.includes(this.controls[id].label)) delete this.controls[id];
        if (this.layer) for (const button of Array.from(this.layer.querySelectorAll('button')))
            if (labels.includes(button.getAttribute('aria-label') || '')) button.remove();
    }
    modal(): void { this.controls = {}; this.layer?.replaceChildren(); }
    text(value: string): void { this.texts.push(value); }
    control(label: string, invoke: () => void, bounds?: { x: number; y: number; width: number; height: number }): void {
        this.controls[`control-${++this.sequence}`] = { label, invoke };
        if (!this.layer || !bounds) return;
        const canvas = document.getElementById('GameCanvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(rect.width / 390, rect.height / this.height);
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'shise-control';
        button.textContent = label; button.setAttribute('aria-label', label);
        button.style.left = `${rect.x + rect.width / 2 + (bounds.x - 195 - bounds.width / 2) * scale}px`;
        button.style.top = `${rect.y + rect.height / 2 + (bounds.y - this.height / 2 - bounds.height / 2) * scale}px`;
        button.style.width = `${bounds.width * scale}px`; button.style.height = `${bounds.height * scale}px`;
        button.addEventListener('click', invoke); this.layer.appendChild(button);
    }
}
