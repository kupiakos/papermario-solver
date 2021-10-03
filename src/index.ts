import {Ring} from './ring';
import {Cursor} from './cursor';
import {MoveHistory} from './movement';
import {Solver, Solution} from './solver';
import {Controls} from './controls';

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
  const moveHistory = new MoveHistory(getNotNullById('move-count'));
  const controls = new Controls(getNotNullById('controls'));
  const cursor = new Cursor(ring, moveHistory, controls);
  const solver = new Solver();
  const solveButton = getNotNullById('solve-button');
  ring.draw();
  cursor.draw();

  overlay.addEventListener('mousedown', e => {
    if (solveButton.classList.contains('solving')) {
      return;
    }
    solveButton.innerText = 'Solve';
    ring.onMouseDown(e);
  });
  document.addEventListener('keydown', cursor.onKeyDown.bind(cursor));
  // Prevents mouse focus, https://stackoverflow.com/a/37580028.
  solveButton.addEventListener('mousedown', e => e.preventDefault());
  solveButton.addEventListener('click', async () => {
    if (solveButton.classList.contains('solving')) {
      return;
    }
    solveButton.classList.add('solving');
    solveButton.innerText = 'Solving';
    let solution: Solution | null;
    try {
      solution = await solver.solve(ring);
    } catch (e) {
      solveButton.innerText = 'Error!';
      solveButton.classList.add('error');
      solveButton.classList.remove('solving');
      throw e;
    }
    if (solution) {
      console.log(solution);
      
      cursor.hide();
      // Animate the solve.
      for (const move of solution.moves) {
        await ring.animateMove(move);
        moveHistory.addMovement(move);
        await new Promise(r => setTimeout(r, 250));
      }
      cursor.show();
      solveButton.innerText = 'Solved!';
    } else {
      solveButton.innerText = "Can't solve in 4 turns!";
    }
    solveButton.classList.remove('solving');
  });

  const undoButton = getNotNullById('undo-button');
  undoButton.addEventListener('mousedown', e => e.preventDefault());
  undoButton.addEventListener('click', () => {
    solveButton.innerText = 'Solve';
    cursor.cancel();
  });
}

window.addEventListener('load', main);

// Calculates the internal app height, used for the footer on mobile.
// I don't want to use JavaScript for this, but my hand has been forced.
// See: https://stackoverflow.com/a/50683190.
const appHeight = () => {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
};
window.addEventListener('resize', appHeight);
appHeight();
