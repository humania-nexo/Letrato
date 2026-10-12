import type { LetratoConfig } from '../core/types';

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: number;
  config: LetratoConfig;
  imageDataUrl: string;
}

const STORAGE_KEY = 'letrato_saved_projects_v1';
const LAST_CONFIG_KEY = 'letrato_last_config_v1';

export class ProjectStorage {
  public static saveProject(name: string, config: LetratoConfig, imageDataUrl: string): SavedProject {
    const projects = this.getAllProjects();
    const newProject: SavedProject = {
      id: 'proj_' + Date.now(),
      name: name || 'Mi Letrato ' + new Date().toLocaleDateString(),
      updatedAt: Date.now(),
      config,
      imageDataUrl
    };

    projects.unshift(newProject);
    // Limitar a los 15 proyectos más recientes para no saturar almacenamiento local
    const trimmed = projects.slice(0, 15);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return newProject;
  }

  public static getAllProjects(): SavedProject[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Error al leer proyectos guardados:', e);
      return [];
    }
  }

  public static deleteProject(id: string): void {
    const projects = this.getAllProjects().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  public static saveLastConfig(config: LetratoConfig): void {
    try {
      localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      // Ignorar si falla
    }
  }

  public static getLastConfig(): Partial<LetratoConfig> | null {
    try {
      const raw = localStorage.getItem(LAST_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
}
