import type { Vec } from '../../sim/types';
import type { Rect } from './geometry';
import { anchoredView, panByPixels, screenToWorld, type ScreenBounds } from './camera';

const DRAG_SLOP_PX = 5;
const midpoint = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

interface GestureCamera {
  getView: () => Rect;
  getBase: () => Rect;
  getBounds: () => ScreenBounds;
  moveTo: (view: Rect) => void;
  onNavigate: () => void;
  onActiveChange: (active: boolean) => void;
}

/** One continuous gesture survives pointer replacement and pinch-to-drag transitions. */
export class MapGestures {
  private pointers = new Map<number, Vec>();
  private previous: Vec[] = [];
  private navigated = false;
  private suppressClick = false;

  constructor(private camera: GestureCamera) {}

  get pointerCount(): number { return this.pointers.size; }

  private rebase(): void { this.previous = [...this.pointers.values()].slice(0, 2); }

  private beginNavigation(): void {
    this.suppressClick = true;
    if (this.navigated) return;
    this.navigated = true;
    this.camera.onNavigate();
    this.camera.onActiveChange(true);
  }

  down(id: number, point: Vec): void {
    if (this.pointers.has(id)) return;
    if (!this.pointers.size) {
      this.navigated = false;
      this.suppressClick = false;
    }
    this.pointers.set(id, point);
    if (this.pointers.size >= 2) this.beginNavigation();
    if (this.pointers.size <= 2) this.rebase();
  }

  move(id: number, point: Vec): void {
    if (!this.pointers.has(id)) return;
    this.pointers.set(id, point);
    const active = [...this.pointers.entries()].slice(0, 2);
    if (!active.some(([pointerId]) => pointerId === id)) return;
    const points = active.map(([, p]) => p);
    const view = this.camera.getView();
    const base = this.camera.getBase();
    const bounds = this.camera.getBounds();
    if (points.length === 1) {
      if (!this.navigated && distance(points[0], this.previous[0]) < DRAG_SLOP_PX) return;
      this.beginNavigation();
      this.camera.moveTo(panByPixels(view, base, points[0].x - this.previous[0].x, points[0].y - this.previous[0].y, bounds));
    } else {
      const oldDistance = distance(this.previous[0], this.previous[1]);
      const newDistance = distance(points[0], points[1]);
      // Coincident contacts have no usable scale; rebase until they separate.
      if (oldDistance >= 2 && newDistance >= 2) {
        const anchor = screenToWorld(view, midpoint(this.previous[0], this.previous[1]), bounds);
        this.camera.moveTo(anchoredView(view, base, newDistance / oldDistance, anchor, midpoint(points[0], points[1]), bounds));
      }
    }
    this.rebase();
  }

  up(id: number, cancelled = false): void {
    if (!this.pointers.has(id)) return;
    if (cancelled) this.beginNavigation();
    this.pointers.delete(id);
    this.rebase();
    if (!this.pointers.size) this.camera.onActiveChange(false);
  }

  cancel(): void {
    if (this.pointers.size) this.beginNavigation();
    this.pointers.clear();
    this.previous = [];
    this.camera.onActiveChange(false);
  }

  /** Keyboard/screen-reader activation (detail=0) is never mistaken for a drag click. */
  blocksClick(detail: number): boolean { return detail !== 0 && this.suppressClick; }
}
