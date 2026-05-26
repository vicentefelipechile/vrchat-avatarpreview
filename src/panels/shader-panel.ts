import * as THREE from 'three';
import type { ResolvedMaterial } from '../types/scene';
import { shaderFamilyLabel } from '../types/scene';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getMeshesBySlot } from '../viewer/loader';
import { getMaterialInstance, rebuildMaterial, updateMaterialParams, MaterialParams } from '../viewer/material-mapper';

interface SlotState {
    mode: 'toon' | 'pbr';
    normalScale: number;
    emissionIntensity: number;
    metallic: number;
    roughness: number;
    expanded: boolean;
}

const slotStates = new Map<number, SlotState>();

export function clearShaderPanelState(): void {
    slotStates.clear();
}

export function renderShaderPanel(container: HTMLElement, materials: ResolvedMaterial[]): void {
    container.innerHTML = '';

    if (materials.length === 0) {
        container.innerHTML = '<p class="panel-empty">No materials found.</p>';
        return;
    }

    const section = document.createElement('div');
    section.className = 'panel-section';
    section.innerHTML = '<div class="panel-section-title">Materials</div>';

    for (const mat of materials) {
        if (!slotStates.has(mat.slot_index)) {
            const isPBR = mat.shader_family.type === 'Standard' || mat.shader_family.type === 'URP';
            slotStates.set(mat.slot_index, {
                mode: getMaterialInstance(mat.slot_index) instanceof THREE.MeshStandardMaterial ? 'pbr' : (isPBR ? 'pbr' : 'toon'),
                normalScale: 1.0,
                emissionIntensity: 0.0,
                metallic: mat.metallic,
                roughness: 1 - mat.smoothness,
                expanded: false,
            });
        }
        section.appendChild(buildMaterialBlock(mat));
    }

    container.appendChild(section);
}

function buildMaterialBlock(mat: ResolvedMaterial): HTMLElement {
    const state = slotStates.get(mat.slot_index)!;
    const block = document.createElement('div');
    block.className = 'material-block';

    const [r, g, b] = mat.color.map(v => Math.round(v * 255));
    const hexColor = `rgb(${r},${g},${b})`;
    const label = shaderFamilyLabel(mat.shader_family);
    const badgeClass = `shader-badge shader-${mat.shader_family.type.toLowerCase()}`;

    const thumbHtml = mat.albedo_path
        ? `<img class="mat-thumb" src="${convertFileSrc(mat.albedo_path)}" alt="albedo" />`
        : `<div class="mat-thumb mat-thumb-color" style="background:${hexColor}"></div>`;

    const CHEVRON_SVG = `<svg class="mat-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

    const row = document.createElement('div');
    row.className = 'material-row';
    row.innerHTML = `
        ${thumbHtml}
        <div class="mat-info">
            <span class="${badgeClass}">${label}</span>
            <span class="mat-shader-name" title="${escHtml(mat.shader_raw_name)}">${escHtml(truncate(mat.shader_raw_name, 32))}</span>
        </div>
        <div class="mat-color-chip" style="background:${hexColor}" title="Base color: ${hexColor}"></div>
        <button class="mat-expand-btn" title="Edit material parameters">${CHEVRON_SVG}</button>
    `;

    const editor = document.createElement('div');
    editor.className = 'mat-edit';
    editor.appendChild(buildEditor(mat, state));

    row.querySelector('.mat-expand-btn')!.addEventListener('click', () => {
        state.expanded = !state.expanded;
        row.querySelector('.mat-expand-btn')!.classList.toggle('expanded', state.expanded);
        editor.classList.toggle('open', state.expanded);
    });

    block.appendChild(row);
    block.appendChild(editor);
    return block;
}

function buildEditor(mat: ResolvedMaterial, state: SlotState): HTMLElement {
    const div = document.createElement('div');
    div.className = 'mat-editor';

    const modeRow = document.createElement('div');
    modeRow.className = 'mat-edit-row';
    modeRow.innerHTML = `
        <span class="mat-edit-label">Render</span>
        <div class="mat-mode-btns">
            <button class="mat-mode-btn${state.mode === 'toon' ? ' active' : ''}" data-mode="toon">Toon</button>
            <button class="mat-mode-btn${state.mode === 'pbr' ? ' active' : ''}" data-mode="pbr">PBR</button>
        </div>
    `;
    div.appendChild(modeRow);

    const pbrSection = document.createElement('div');
    pbrSection.className = 'mat-pbr-controls';
    pbrSection.style.display = state.mode === 'pbr' ? '' : 'none';
    pbrSection.appendChild(buildSlider('Metallic', state.metallic, 0, 1, 0.01, v => {
        state.metallic = v;
        updateMaterialParams(mat.slot_index, { metallic: v });
    }));
    pbrSection.appendChild(buildSlider('Roughness', state.roughness, 0, 1, 0.01, v => {
        state.roughness = v;
        updateMaterialParams(mat.slot_index, { roughness: v });
    }));
    div.appendChild(pbrSection);

    if (mat.normal_path) {
        div.appendChild(buildSlider('Normal', state.normalScale, 0, 2, 0.01, v => {
            state.normalScale = v;
            updateMaterialParams(mat.slot_index, { normalScale: v });
        }));
    }

    const [er, eg, eb] = mat.emission_color;
    if (mat.emission_path || er > 0.001 || eg > 0.001 || eb > 0.001) {
        div.appendChild(buildSlider('Emission', state.emissionIntensity, 0, 3, 0.01, v => {
            state.emissionIntensity = v;
            updateMaterialParams(mat.slot_index, { emissionIntensity: v });
        }));
    }

    modeRow.querySelectorAll('.mat-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newMode = (btn as HTMLElement).dataset.mode as 'toon' | 'pbr';
            if (newMode === state.mode) return;
            state.mode = newMode;
            modeRow.querySelectorAll('.mat-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            pbrSection.style.display = newMode === 'pbr' ? '' : 'none';
            applyModeSwitch(mat, state);
        });
    });

    return div;
}

function applyModeSwitch(mat: ResolvedMaterial, state: SlotState): void {
    const params: MaterialParams = {
        mode: state.mode,
        normalScale: state.normalScale,
        emissionIntensity: state.emissionIntensity,
        metallic: state.metallic,
        roughness: state.roughness,
    };
    const newMat = rebuildMaterial(mat, params);
    getMeshesBySlot(mat.slot_index).forEach(mesh => { mesh.material = newMat; });
}

function buildSlider(
    label: string,
    initialValue: number,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void
): HTMLElement {
    const row = document.createElement('div');
    row.className = 'mat-edit-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'mat-edit-label';
    labelEl.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'mat-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(initialValue);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'mat-edit-value';
    valueSpan.textContent = initialValue.toFixed(2);

    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        valueSpan.textContent = v.toFixed(2);
        onChange(v);
    });

    row.appendChild(labelEl);
    row.appendChild(slider);
    row.appendChild(valueSpan);
    return row;
}

function truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    const parts = s.split('/');
    return '…/' + parts[parts.length - 1];
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
