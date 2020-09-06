import { Wheel } from './wheel';
import { Cursor } from './cursor';

function main() {
  let overlay = document.getElementById('overlay-layer') as HTMLCanvasElement;
  let wheel = new Wheel({
    enemy: document.getElementById('enemy-layer') as HTMLCanvasElement,
    wheel: document.getElementById('wheel-layer') as HTMLCanvasElement,
    cursor: document.getElementById('cursor-layer') as HTMLCanvasElement,
    overlay
  });
  let cursor = new Cursor(wheel);
  wheel.draw();
  cursor.draw();

  overlay.addEventListener('mousedown', wheel.onMouseDown.bind(wheel));
  document.addEventListener('keydown', cursor.onKeyDown.bind(cursor));
}

window.addEventListener('load', main);
