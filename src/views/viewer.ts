import type { SceneGraph } from '../types/scene';
import { navigate } from '../router';
import { renderObjectPanel } from '../panels/object-panel';
import { renderBlendShapePanel } from '../panels/blend-shape-panel';
import { renderShaderPanel } from '../panels/shader-panel';
import { renderWarningsPanel } from '../panels/warnings-panel';
import { renderStatsBar } from '../panels/stats-bar';
import { initScene, clearMeshes } from '../viewer/scene';
import { clearMaterialInstances } from '../viewer/material-mapper';
import { loadFbxNodes } from '../viewer/loader';
import { collectBlendShapes } from '../viewer/blend-shapes';

type Tab = 'objects' | 'shapes' | 'materials' | 'warnings';

let currentGraph: SceneGraph | null = null;
let activeTab: Tab = 'objects';
let layoutInitialized = false;

export function setSceneGraph(graph: SceneGraph): void {
    currentGraph = graph;
}

export function mountViewer(): void {
    const container = document.getElementById('view-viewer')!;

    if (!layoutInitialized) {
        initLayout(container);
        layoutInitialized = true;
    }

    if (!currentGraph) return;

    renderStatsBar(
        document.getElementById('stats-bar')!,
        currentGraph.stats
    );

    loadAndRender(currentGraph);
    switchTab(activeTab);
}

function initLayout(container: HTMLElement): void {
    container.innerHTML = `
        <div id="viewer-root">
            <div id="canvas-container">
                <canvas id="three-canvas"></canvas>
                <div id="loading-overlay" style="display:none">
                    <div class="spinner"></div>
                    <span>Loading model…</span>
                </div>
                <button id="btn-back" title="Open another package">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Back
                </button>
            </div>
            <div id="side-panel">
                <div id="tab-bar">
                    <button class="tab-btn active" data-tab="objects" title="Objects">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                        <span>Objects</span>
                    </button>
                    <button class="tab-btn" data-tab="shapes" title="Blend Shapes">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
                        <span>Shapes</span>
                    </button>
                    <button class="tab-btn" data-tab="materials" title="Materials">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                        <span>Materials</span>
                    </button>
                    <button class="tab-btn" data-tab="warnings" title="Warnings" id="warnings-tab-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span>Warnings <span id="warnings-badge" style="display:none" class="badge"></span></span>
                    </button>
                </div>
                <div id="panel-content"></div>
                <div id="stats-bar"></div>
            </div>
        </div>
    `;

    // Wire tab clicks
    document.querySelectorAll<HTMLElement>('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab as Tab;
            activeTab = tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderActiveTab();
        });
    });

    // Back button — keep Three.js scene alive (never dispose), just clear loaded objects
    document.getElementById('btn-back')!.addEventListener('click', () => {
        clearMaterialInstances();
        clearMeshes();
        navigate('welcome');
    });

    // Initialize Three.js scene (canvas never removed after this)
    const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
    initScene(canvas);
}

async function loadAndRender(graph: SceneGraph): Promise<void> {
    const overlay = document.getElementById('loading-overlay')!;
    overlay.style.display = 'flex';

    try {
        await loadFbxNodes(graph);
        const shapes = collectBlendShapes();

        // Update stats with blend shape count from Three.js
        const statsBar = document.getElementById('stats-bar');
        if (statsBar) {
            const updatedStats = {
                ...graph.stats,
                blend_shape_count: shapes.length,
            };
            renderStatsBar(statsBar, updatedStats);
        }

        // Update warnings badge
        const badge = document.getElementById('warnings-badge');
        if (badge && graph.warnings.length > 0) {
            badge.textContent = String(graph.warnings.length);
            badge.style.display = '';
        }
    } catch (e) {
        console.error('Failed to load FBX:', e);
    } finally {
        overlay.style.display = 'none';
    }

    renderActiveTab();
}

function renderActiveTab(): void {
    if (!currentGraph) return;
    const content = document.getElementById('panel-content')!;
    switchTab(activeTab, content);
}

function switchTab(tab: Tab, content?: HTMLElement): void {
    const el = content ?? document.getElementById('panel-content');
    if (!el || !currentGraph) return;

    switch (tab) {
        case 'objects':
            renderObjectPanel(el, currentGraph);
            break;
        case 'shapes':
            renderBlendShapePanel(el, collectBlendShapes());
            break;
        case 'materials':
            renderShaderPanel(el, currentGraph.materials);
            break;
        case 'warnings':
            renderWarningsPanel(el, currentGraph.warnings);
            break;
    }
}
