import type { SceneGraph } from '../types/scene';

interface AppState {
    sceneGraph: SceneGraph | null;
    isLoading: boolean;
    error: string | null;
    objectVisibility: Map<string, boolean>;
    activeVariants: Map<string, number>;
    blendShapeValues: Map<string, number>;
}

let state: AppState = {
    sceneGraph: null,
    isLoading: false,
    error: null,
    objectVisibility: new Map(),
    activeVariants: new Map(),
    blendShapeValues: new Map(),
};

export const getState = (): Readonly<AppState> => state;

export const setState = (patch: Partial<AppState>): void => {
    state = { ...state, ...patch };
};

export const resetForNewPackage = (): void => {
    state = {
        sceneGraph: null,
        isLoading: false,
        error: null,
        objectVisibility: new Map(),
        activeVariants: new Map(),
        blendShapeValues: new Map(),
    };
};
