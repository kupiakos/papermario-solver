
function main() {
    let canvas = document.getElementById('wheel');
    let wheel = new Wheel(canvas);
    wheel.draw();

    canvas.addEventListener('mousedown', event => {
        let pos = wheel.xyToWheelPos({x: event.offsetX, y: event.offsetY});
        if (!pos) { return; }
        console.log(pos);
        wheel.clickCell(pos);
        let ctx = canvas.getContext('2d');
        wheel.drawCell(ctx, pos);
    });

    document.addEventListener('keydown', event => {
        let r = parseInt(event.key, 10);
        if (isNaN(r)) {
            r = ')!@#$%^&*('.indexOf(event.key);
        }
        let ctx = canvas.getContext('2d');
        let reverse = event.shiftKey;
        if (r === -1) {
            let th = 'AOEUIDHTNS-'.indexOf(event.key.toUpperCase());
            if (event.key === 'Enter') { th = 11; }
            if (th != -1) {
                let dir = reverse ?  'Inwards' : 'Outwards';
                console.log('Shift row', th,
                            dir, '(', event.key, ')');
                wheel.shiftRow(th, !reverse);
                wheel.drawRow(ctx, th);
                wheel.drawRow(ctx, (th + 6) % 12);
            }
        } else if (r >= 0 && r < 4) {
            let dir = reverse ? 'clockwise' : 'anti-clockwise';
            console.log('Rotate ring', r,
                        dir, '(', event.key, ')');
            wheel.rotateRing(r, reverse);
            wheel.drawRing(ctx, r);
        }
    });
}

window.addEventListener('load', main);
