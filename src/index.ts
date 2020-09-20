import {Ring} from './ring';
import {Cursor} from './cursor';
import {MoveHistory} from './movement';
import {test} from './solver';

function getNotNullById<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error('Could not find element with id ' + id);
  }
  return element as T;
}

function main() {
  const overlay = getNotNullById<HTMLCanvasElement>('overlay-layer');
  const ring = new Ring({
    enemy: getNotNullById<HTMLCanvasElement>('enemy-layer'),
    ring: getNotNullById<HTMLCanvasElement>('ring-layer'),
    cursor: getNotNullById<HTMLCanvasElement>('cursor-layer'),
    overlay,
  });
  const cursor = new Cursor(
    ring,
    new MoveHistory(getNotNullById('ring-moves')),
    getNotNullById('controls')
  );
  ring.draw();
  cursor.draw();

  overlay.addEventListener('mousedown', ring.onMouseDown.bind(ring));
  document.addEventListener('keydown', cursor.onKeyDown.bind(cursor));
  test();
}

window.addEventListener('load', main);
