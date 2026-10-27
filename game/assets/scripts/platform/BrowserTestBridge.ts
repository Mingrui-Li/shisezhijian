import { sys } from 'cc';

/** Optional tester-build accessibility for the Cocos canvas. Never runs in a tt host. */
export class BrowserTestBridge {
    private controls = new Map<string, { label: string; invoke: () => void }>();
    private texts: string[] = [];
    private sequence = 0;
    private layer: HTMLDivElement | null = null;
    constructor(enabled: boolean, private snapshot: () => object, private height = 844) {
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
                controls: [...this.controls].map(([id, item]) => ({ id, label: item.label })) }) }] }; }
            catch (error) { return { content: [{ type: 'text', text: String(error) }] }; }
        };
        const register = (tool: object) => {
            try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch { /* Optional browser support. */ }
        };
        register({ name: 'shise_state', description: 'Read the visible Cocos tester UI state. Does not reveal puzzle answers.',
            inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true }, execute: result });
        register({ name: 'shise_tap', description: 'Tap a currently visible Cocos control by id from shise_state. Same callback as screen controls; no arbitrary state edits.',
            inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
            execute: (input: { id: string }) => { this.controls.get(input.id)?.invoke(); return result(); } });
    }
    clear(): void { this.controls.clear(); this.texts = []; this.layer?.replaceChildren(); }
    removeControls(labels: readonly string[]): void {
        for (const [id, control] of this.controls) if (labels.includes(control.label)) this.controls.delete(id);
        if (this.layer) for (const button of Array.from(this.layer.querySelectorAll('button')))
            if (labels.includes(button.getAttribute('aria-label') || '')) button.remove();
    }
    modal(): void { this.controls.clear(); this.layer?.replaceChildren(); }
    text(value: string): void { this.texts.push(value); }
    control(label: string, invoke: () => void, bounds?: { x: number; y: number; width: number; height: number }): void {
        this.controls.set(`control-${++this.sequence}`, { label, invoke });
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
