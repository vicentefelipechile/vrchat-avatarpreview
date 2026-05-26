import type { BlendShape } from '../viewer/blend-shapes';
import { setBlendShape } from '../viewer/blend-shapes';

type Category = 'Body' | 'Clothing' | 'Other';
const ORDER: Category[] = ['Body', 'Clothing', 'Other'];

export function renderBlendShapePanel(container: HTMLElement, shapes: BlendShape[]): void {
    container.innerHTML = '';

    if (shapes.length === 0) {
        container.innerHTML = '<p class="panel-empty">No blend shapes found.</p>';
        return;
    }

    const byCategory = new Map<Category, BlendShape[]>();
    for (const cat of ORDER) byCategory.set(cat, []);
    for (const s of shapes) {
        byCategory.get(s.category)!.push(s);
    }

    for (const cat of ORDER) {
        const items = byCategory.get(cat)!;
        if (items.length === 0) continue;

        const section = document.createElement('div');
        section.className = 'panel-section collapsible';

        const header = document.createElement('div');
        header.className = 'panel-section-title collapsible-header';
        header.innerHTML = `
            <svg class="chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            ${cat} <span class="count">(${items.length})</span>
        `;

        const body = document.createElement('div');
        body.className = 'collapsible-body';

        for (const shape of items) {
            body.appendChild(buildShapeRow(shape));
        }

        header.addEventListener('click', () => {
            section.classList.toggle('collapsed');
        });

        section.appendChild(header);
        section.appendChild(body);
        container.appendChild(section);
    }
}

function buildShapeRow(shape: BlendShape): HTMLElement {
    const row = document.createElement('div');
    row.className = 'shape-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'shape-name';
    nameEl.textContent = shape.cleanName;
    nameEl.title = shape.cleanName;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = String(shape.defaultValue);
    slider.className = 'shape-slider';

    const valueEl = document.createElement('span');
    valueEl.className = 'shape-value';
    valueEl.textContent = Math.round(shape.defaultValue * 100) + '%';

    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        setBlendShape(shape, v);
        valueEl.textContent = Math.round(v * 100) + '%';
    });

    row.appendChild(nameEl);
    row.appendChild(slider);
    row.appendChild(valueEl);
    return row;
}
