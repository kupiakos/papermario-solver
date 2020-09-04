
function main() {
  let overlay = document.getElementById('overlay-layer');
  let wheel = new Wheel({
    enemy: document.getElementById('enemy-layer'),
    wheel: document.getElementById('wheel-layer'),
    cursor: document.getElementById('cursor-layer'),
    overlay
  });
  wheel.draw();

  overlay.addEventListener('mousedown', event => {
    let pos = wheel.xyToWheelPos({x: event.offsetX, y: event.offsetY});
    if (!pos) { return; }
    console.log(pos);
    wheel.clickCell(pos);
    wheel.drawCellTop(pos);
  });

  document.addEventListener('keydown', event => {
    if (!wheel.cursor) { return; }
    // Manipulate cursor.
    // When moving, Up = Left, Down = Right.
    // Left = counter-clockwise, right = clockwise.
    // One exception is while actively shifting.
    // Then, it depends where on the board you are.
    // On the bottom-left/top-right rows, Up = Right, Down = Left.
    if (event.key === ' ' && !wheel.cursor.focused) {
      wheel.cursor.switchType();
      wheel.drawCursor();
    } else if (event.key === 'Enter') {
      wheel.cursor.focused = !wheel.cursor.focused;
      wheel.drawCursor();
    } else {
      let reverse;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        reverse = false;
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        reverse = true;
      } else {
        return;
      }
      if (wheel.cursor.focused) {
        if (wheel.cursor.type === 'ring') {
          let r = wheel.cursor.pos.r;
          wheel.rotateRing(r, reverse);
          wheel.drawRing(r);
        } else {
          let th = wheel.cursor.pos.th;
          if (th % (NUM_ANGLES / 2) >= NUM_ANGLES / 4 &&
            (event.key === 'ArrowLeft' ||
              event.key === 'ArrowRight')) {
            reverse = !reverse;
          }
          wheel.shiftRow(th, reverse);
          wheel.drawRow(th);
          wheel.drawRow((th + NUM_ANGLES / 2) % NUM_ANGLES);
        }
      } else {
        wheel.cursor.move(reverse);
        wheel.drawCursor();
      }
    }
  });
}

window.addEventListener('load', main);
