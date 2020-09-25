import {Ring} from './ring';
import {Cursor} from './cursor';
import {MoveHistory} from './movement';
import {Solver, Solution} from './solver';

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
  const moveHistory = new MoveHistory(getNotNullById('ring-moves'));
  const cursor = new Cursor(ring, moveHistory, getNotNullById('controls'));
  const solver = new Solver();
  const solveButton = getNotNullById('solve-button');
  ring.draw();
  cursor.draw();

  overlay.addEventListener('mousedown', e => {
    ring.onMouseDown(e);
    solveButton.innerText = 'Solve';
  });
  document.addEventListener('keydown', cursor.onKeyDown.bind(cursor));
  // Prevents mouse focus, https://stackoverflow.com/a/37580028.
  solveButton.addEventListener('mousedown', e => e.preventDefault());
  solveButton.addEventListener('click', async () => {
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
        await new Promise(r => setTimeout(r, 100));
      }
      cursor.show();
      solveButton.innerText = 'Solved!';
    } else {
      solveButton.innerText = "Can't solve in 3 turns!";
    }
    solveButton.classList.remove('solving');
  });
}

window.addEventListener('load', main);
