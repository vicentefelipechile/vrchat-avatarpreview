import type { SceneGraph, SceneNode, VariantGroup } from '../types/scene';
import { setNodeVisible, getNodeVisible } from '../viewer/loader';

export function renderObjectPanel(container: HTMLElement, graph: SceneGraph): void {
    container.innerHTML = '';

    if (graph.nodes.length === 0) {
        container.innerHTML = '<p class="panel-empty">No objects found.</p>';
        return;
    }

    // Variant groups section
    if (graph.variant_groups.length > 0) {
        const section = document.createElement('div');
        section.className = 'panel-section';
        section.innerHTML = '<div class="panel-section-title">Variant Groups</div>';

        for (const group of graph.variant_groups) {
            section.appendChild(buildVariantGroup(group));
        }
        container.appendChild(section);
    }

    // Objects section
    const section = document.createElement('div');
    section.className = 'panel-section';
    section.innerHTML = '<div class="panel-section-title">Objects</div>';

    for (const node of graph.nodes) {
        section.appendChild(buildNodeRow(node));
    }
    container.appendChild(section);
}

function buildNodeRow(node: SceneNode): HTMLElement {
    const row = document.createElement('div');
    row.className = 'object-row';

    const visible = getNodeVisible(node.name);

    row.innerHTML = `
        <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <span class="object-name">${escHtml(node.name)}</span>
        <button class="vis-btn" data-name="${escHtml(node.name)}" title="Toggle visibility">
            ${eyeIcon(visible)}
        </button>
    `;

    if (!visible) row.classList.add('object-hidden');

    row.querySelector<HTMLButtonElement>('.vis-btn')!.addEventListener('click', (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        const name = btn.dataset.name!;
        const nowVisible = !getNodeVisible(name);
        setNodeVisible(name, nowVisible);
        btn.innerHTML = eyeIcon(nowVisible);
        row.classList.toggle('object-hidden', !nowVisible);
    });

    return row;
}

function buildVariantGroup(group: VariantGroup): HTMLElement {
    const el = document.createElement('div');
    el.className = 'variant-group';
    el.innerHTML = `<div class="variant-group-name">${escHtml(group.name)}</div>`;

    const btnRow = document.createElement('div');
    btnRow.className = 'variant-buttons';

    group.variants.forEach((variant, i) => {
        const btn = document.createElement('button');
        btn.className = 'variant-btn' + (i === group.active_index ? ' active' : '');
        btn.textContent = variant;
        btn.addEventListener('click', () => {
            // Hide all variants in group, show selected
            group.variants.forEach((v, j) => {
                setNodeVisible(v, j === i);
            });
            btnRow.querySelectorAll('.variant-btn').forEach((b, j) => {
                b.classList.toggle('active', j === i);
            });
        });
        btnRow.appendChild(btn);
    });

    el.appendChild(btnRow);
    return el;
}

function eyeIcon(visible: boolean): string {
    if (visible) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
