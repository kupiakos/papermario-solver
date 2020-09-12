import { Ring } from './ring';
import { Cursor } from './cursor';

function main() {
  let overlay = document.getElementById('overlay-layer') as HTMLCanvasElement;
  let ring = new Ring({
    enemy: document.getElementById('enemy-layer') as HTMLCanvasElement,
    ring: document.getElementById('ring-layer') as HTMLCanvasElement,
    cursor: document.getElementById('cursor-layer') as HTMLCanvasElement,
    overlay
  });
  let cursor = new Cursor(ring);
  ring.draw();
  cursor.draw();

  overlay.addEventListener('mousedown', ring.onMouseDown.bind(ring));
  document.addEventListener('keydown', cursor.onKeyDown.bind(cursor));
}

window.addEventListener('load', main);
