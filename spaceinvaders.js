"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
function spaceinvaders() {
    // Inside this function you will use the classes and functions 
    // from rx.js
    // to add visuals to the svg element in pong.html, animate them, and make them interactive.
    // Study and complete the tasks in observable exampels first to get ideas.
    // Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/ 
    // You will be marked on your functional programming style
    // as well as the functionality that you implement.
    // Document your code!
    //subscribe function
    //Constants
    //constant values
    const Constants = {
        canvasSize: 600,
        bulletExpirationDuration: 1000,
        bulletRadius: 3,
        bulletVelocity: 2,
        shipRadius: 16,
        alienRadius: 16,
        alienPadding: [29, 10],
        startTime: 0,
        alienCount: 55,
        alienPerRow: 11,
        shieldCount: 4,
        shieldRadius: 32,
        scoreLabel: "SCORE: ",
        levelLabel: "Level ",
        pointsPerAlien: 10,
        alienMaxMove: 20,
        alienFireInterval: 3000,
        initialLevel: 1,
        maxShieldDmg: 6
    };
    //Functions//
    //Body object creation
    function createShip() {
        return {
            id: 'ship',
            type: 'ship',
            coord: new vector((Number(document.getElementById("canvas").getAttribute('width')) - 64) / 2, Number(document.getElementById("canvas").getAttribute('height')) - 42),
            velocity: vector.Zero,
            movedDist: 0,
            radius: Constants.shipRadius,
            startTime: 0,
            fireTime: 0,
        };
    }
    function createBullets(s, b, velocity) {
        const d = vector.unitVectorDirection(0), ycoord = velocity < 0 ? b.coord.y + 2 * b.radius + 2 : b.coord.y;
        return {
            id: `bullet${s.objCount}`,
            type: 'bullet',
            coord: new vector(b.coord.x + b.radius, ycoord),
            velocity: b.velocity.add(d.scale(velocity)),
            radius: 3,
            movedDist: 0,
            startTime: s.time,
            fireTime: 0,
        };
    }
    function createAlienArray(count, countPerRow) {
        const alienPadding = (Constants.canvasSize - (countPerRow * 2 * Constants.alienRadius)) / (countPerRow + 1), 
        //Create alien row
        createAlienRow = (count, direction, nRow = Math.ceil(count / countPerRow), yStart = 70) => {
            return nRow === 1 ? [createAlien(count, countPerRow, yStart, alienPadding, direction)] : [createAlien(count, countPerRow, yStart, alienPadding, direction)].concat(createAlienRow(count - countPerRow, direction, nRow - 1, yStart + (2 * Constants.alienRadius) + Constants.alienPadding[1]));
        }, createAlien = (count, countPerRow, yStart, xStart = alienPadding, direction) => {
            // boundaryCheck = () => xStart+(2*Constants.alienRadius)+(2*Constants.alienPadding[0] )> Number(canvas.getAttribute('width'))? {x: 58, y: yStart+(2*(Constants.alienPadding[1]+Constants.alienRadius))}:{x: xStart, y: yStart}
            const alienBody = {
                id: `alien${Constants.alienCount - count + 1}`,
                type: 'alien',
                startTime: 0,
                coord: new vector(xStart, yStart),
                velocity: new vector(direction, 0),
                movedDist: 0,
                radius: Constants.alienRadius,
                fireTime: 0,
                rank: Constants.alienCount - count + 1
            };
            return countPerRow === 1 || count === 1 ? [alienBody] : [alienBody].concat(createAlien(count - 1, countPerRow - 1, yStart, xStart + (2 * Constants.alienRadius) + alienPadding, direction));
        };
        return createAlienRow(count, 0.05);
    }
    function createShields() {
        const shieldPadding = (Constants.canvasSize - (Constants.shieldCount * 2 * Constants.shieldRadius)) / (Constants.shieldCount + 1), createShieldsArray = (count, xStart = shieldPadding, yStart = 440) => {
            const shieldBody = {
                id: `shield${count}`,
                type: 'shield',
                startTime: 0,
                coord: new vector(xStart, yStart),
                velocity: vector.Zero,
                movedDist: 0,
                radius: Constants.shieldRadius,
                fireTime: 0,
                damage: 0
            };
            return count === 1 ? [shieldBody] : [shieldBody].concat(createShieldsArray(count - 1, xStart + (2 * Constants.shieldRadius) + shieldPadding, yStart));
        };
        return createShieldsArray(Constants.shieldCount);
    }
    function createStats(score, level) {
        return {
            id: 'stats',
            type: 'stats',
            score: score,
            level: level
        };
    }
    //Helper functions
    const negate = (f) => (x) => !f(x), 
    //grab element by id
    element = (x) => (y) => x.findIndex(w => w.id === y.id) >= 0, 
    //everything in x except for those in y
    otherThan = (x) => (y) => x.filter(negate(element(y))), 
    //probability wrapper function
    prob = (probability) => Math.random() <= probability, 
    //calculate row
    rowGet = (pos) => Math.ceil(pos / Constants.alienPerRow) - 1 < 0 ? 0 : Math.ceil(pos / Constants.alienPerRow) - 1, 
    //set boundary for moving objects
    spaceBound = ({ x, y }, r) => {
        const canvas = document.getElementById('canvas'), canvasBound = { x: Number(canvas.getAttribute('width')) - (2 * r), y: Number(canvas.getAttribute('height')) }, xBound = x >= canvasBound.x ? canvasBound.x : x <= 0 ? 0 : x, yBound = y >= canvasBound.y ? canvasBound.y + 10 : y;
        return new vector(xBound, yBound);
    }, 
    //create observable stream for each keyevent and key
    keyAction = (eventName, k, result) => rxjs_1.fromEvent(document, eventName).pipe(operators_1.filter(({ key }) => key === k), operators_1.filter(({ repeat }) => !repeat), operators_1.map(result)), levelCleared = (score) => score === (Constants.alienCount * Constants.pointsPerAlien);
    //Actions classes
    class Tick {
        constructor(duration) {
            this.duration = duration;
        }
    }
    class shipMovement {
        constructor(direction) {
            this.direction = direction;
        }
    }
    class Shoot {
        constructor() { }
    }
    class Restart {
        constructor() {
            this.reset = () => {
                document.getElementById("canvas").remove();
                const newCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                newCanvas.setAttribute('id', 'canvas');
                newCanvas.setAttribute('width', String(Constants.canvasSize));
                newCanvas.setAttribute('height', String(Constants.canvasSize));
                newCanvas.setAttribute('fill', '#000000');
                document.getElementById('outerCanvas').appendChild(newCanvas);
                return initialState();
            };
        }
    }
    class vector {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
            this.add = (b) => new vector(this.x + b.x, this.y + b.y);
            this.sub = (b) => this.add(b.scale(-1));
            this.len = () => Math.sqrt(this.x * this.x + this.y * this.y);
            this.scale = (s) => new vector(this.x * s, this.y * s);
            this.ortho = () => new vector(this.x, -this.y);
            this.rotate = (deg) => (rad => ((cos, sin, { x, y }) => new vector(x * cos - y * sin, x * sin + y * cos))(Math.cos(rad), Math.sin(rad), this))(Math.PI * deg / 180);
        }
    }
    vector.unitVectorDirection = (deg) => new vector(0, -1).rotate(deg);
    vector.Zero = new vector();
    //object state reducing function
    const reduceObjects = (s, e) => e instanceof shipMovement ? { ...s, ship: { ...s.ship, velocity: new vector(e.direction, 0) } }
        :
            e instanceof Shoot ? { ...s, bullets: s.bullets.concat([createBullets(s, s.ship, 10)]), objCount: s.objCount + 1 }
                :
                    e instanceof Restart ? e.reset()
                        :
                            tick(s, e.duration);
    //move objects of type Body
    const moveObj = (b) => ({
        ...b,
        velocity: b.velocity,
        movedDist: b.velocity.x < 0 ? b.movedDist + (-1 * b.velocity.x) : b.movedDist + b.velocity.x,
        coord: spaceBound(b.coord.add(b.velocity), b.radius)
    });
    //update score if 
    const updateScore = (b, scoreChange) => ({
        ...b,
        score: scoreChange ? b.score + scoreChange : b.score
    });
    const updateShieldDamage = (shield, damaged) => {
        const destroyed = damaged.filter(v => v.damage >= Constants.maxShieldDmg), removeDestroyed = shield.filter(negate(element(destroyed))), updateDamage = removeDestroyed.map(s => damaged.findIndex(w => w.id === s.id) >= 0 ? { ...s, damage: s.damage + 1 } : s);
        return [updateDamage, destroyed];
    };
    //handle collision
    const handleCollisions = (s) => {
        //helper functions
        const objectCollide = ([a, b]) => {
            const centrecoord = { c1: a.coord.add(new vector(a.radius, a.radius)), c2: b.coord.add(new vector(b.radius, b.radius)) };
            return centrecoord.c1.sub(centrecoord.c2).len() < a.radius + b.radius;
        }, updateAlienFiringPos = (s) => {
            const validPos = (s, pos) => {
                //if alien exists in alien array row or finish checking whole array, else check previous row
                return (s.aliens[rowGet(pos)].filter(b => b.rank === pos).length > 0 || pos < 0) ? pos : validPos(s, pos - Constants.alienPerRow);
            };
            return s.alienFireCoord.map(v => aliensDamaged.findIndex(w => w.rank === v) >= 0 ? validPos(s, v - Constants.alienPerRow) : v);
        }, shipBulletCollide = s.bullets.filter(r => objectCollide([s.ship, r])).length > 0, 
        //Aliens and bullet
        bulletsAliensCollide = s.bullets.flatMap(b => s.aliens.map(v => v.map(r => [b, r])).reduce((b, acc) => acc.concat(b), [])).filter(objectCollide), aliensDamaged = bulletsAliensCollide.map(([_, r]) => r), 
        //Shield and bullets
        shieldBulletsCollide = s.bullets.flatMap(b => s.shields.map(r => [b, r])).filter(objectCollide), shieldDamaged = shieldBulletsCollide.map(([_, r]) => r), 
        //update shield damage stats, return [notDestroyed, destroyed]
        shieldUpdated = updateShieldDamage(s.shields, shieldDamaged), 
        //concat all damaged bullets
        bulletsDamaged = bulletsAliensCollide.map(([b, _]) => b).concat(shieldBulletsCollide.map(([b, _]) => b));
        return {
            ...s,
            bullets: otherThan(s.bullets)(bulletsDamaged),
            aliens: s.aliens.map((v) => v.filter(negate(element(aliensDamaged)))),
            shields: shieldUpdated[0],
            removedObj: s.removedObj.concat(bulletsDamaged, aliensDamaged, shieldUpdated[1]),
            gameOver: !s.gameOver ? shipBulletCollide : s.gameOver,
            stats: (bulletsAliensCollide.length > 0 ? updateScore(s.stats, (Constants.pointsPerAlien * bulletsAliensCollide.length)) : updateScore(s.stats)),
            alienFireCoord: updateAlienFiringPos(s)
        };
    };
    //alien shooting
    const alienShoot = (s, duration) => {
        //enforce firing interval
        const fireInterval = (b, duration) => (duration - b.fireTime) > Math.random() * Constants.alienFireInterval, 
        //initialise firing position
        initialiseFiringPos = (s) => {
            if (s.alienFireCoord.length <= 0) {
                const currentRow = s.aliens[s.aliens.length - 1], currentRowInd = s.aliens.indexOf(currentRow), initialFiringPos = [...Array(Constants.alienPerRow)].map((_, v) => {
                    return v > currentRow.length - 1 ? s.aliens[currentRowInd - 1][v].rank :
                        s.aliens[currentRowInd][v].rank;
                });
                return { ...s, alienFireCoord: s.alienFireCoord.concat(initialFiringPos) };
            }
            else {
                return s;
            }
        };
        const updatedFiringPosState = initialiseFiringPos(s);
        const accBullets = updatedFiringPosState.alienFireCoord.filter(b => b > 0).reduce((acc, v) => {
            const currentAlienShooting = s.aliens[rowGet(v)].filter(b => b.rank === v)[0];
            return prob(0.005) && fireInterval(currentAlienShooting, duration) ?
                { ...acc,
                    objCount: acc.objCount + 1,
                    bullets: acc.bullets.concat([createBullets(acc, currentAlienShooting, -1)]),
                    aliens: acc.aliens.map(v => v.map(b => b.rank === currentAlienShooting.rank ? { ...b, fireTime: duration } : b)) }
                :
                    { ...acc };
        }, updatedFiringPosState);
        return accBullets;
    };
    //object expiration handle
    const handleObjectExpiration = (s, duration) => {
        const expiryFilter = (b) => (duration - b.startTime) > Constants.bulletExpirationDuration, expiredObj = s.bullets.filter(expiryFilter), liveObj = s.bullets.filter(negate(expiryFilter));
        return {
            ...s,
            bullets: liveObj,
            removedObj: expiredObj,
            time: duration
        };
    };
    //object movement
    const handleObjectMovement = (s) => {
        //alien moving in svg at random
        const alienMovement = (s) => {
            const maxDistFilter = (b) => b.movedDist >= Constants.alienMaxMove, aliensMovedMax = s.aliens.map(v => v.filter(maxDistFilter).map(f => ({ ...f, movedDist: -Constants.alienMaxMove, velocity: new vector(-1 * f.velocity.x, 10) }))), aliensStillMoving = s.aliens.map(v => v.filter(negate(maxDistFilter)).map(f => ({ ...f, velocity: new vector(f.velocity.x, 0) }))), allAliens = aliensMovedMax.map((b) => {
                const ind = aliensMovedMax.indexOf(b);
                return b.concat(aliensStillMoving[ind]);
            });
            return { ...s, aliens: allAliens.map(v => v.map(moveObj)) };
        };
        //move ship and bullets
        return alienMovement({ ...s, ship: moveObj(s.ship), bullets: s.bullets.map(moveObj) });
    };
    //tick function for time passage
    const tick = (s, duration) => {
        const alienFired = alienShoot(s, duration), objectExpirationHandled = handleObjectExpiration(alienFired, duration), objectMovementHandled = handleObjectMovement(objectExpirationHandled), collisionHandled = handleCollisions(objectMovementHandled);
        return collisionHandled;
    };
    function updateCharacters(s) {
        const canvas = document.getElementById('canvas');
        const updateView = (b) => {
            function createView(b) {
                if (b.type === 'ship') {
                    const v = document.createElementNS(canvas.namespaceURI, 'image');
                    v.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'svg/space-ship.png');
                    v.setAttributeNS(null, 'width', String(2 * Constants.shipRadius));
                    v.setAttributeNS(null, 'height', String(2 * Constants.shipRadius));
                    v.setAttributeNS(null, 'id', 'ship');
                    canvas.appendChild(v);
                    return v;
                }
                else if (b.type === 'alien') {
                    const v = document.createElementNS(canvas.namespaceURI, 'image');
                    v.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'svg/alien.png');
                    v.setAttributeNS(null, 'width', String(2 * b.radius));
                    v.setAttributeNS(null, 'height', String(2 * b.radius));
                    v.setAttributeNS(null, 'id', b.id);
                    canvas.appendChild(v);
                    return v;
                }
                else if (b.type === 'shield') {
                    const v = document.createElementNS(canvas.namespaceURI, 'image');
                    v.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'svg/1.png');
                    v.setAttributeNS(null, 'width', String(2 * b.radius));
                    v.setAttributeNS(null, 'height', String(2 * b.radius));
                    v.setAttributeNS(null, 'id', b.id);
                    canvas.appendChild(v);
                    return v;
                }
                else if (b.type === 'bullet') {
                    const v = document.createElementNS(canvas.namespaceURI, "ellipse");
                    v.setAttribute("id", b.id);
                    v.setAttribute('rx', String(b.radius));
                    v.setAttribute('ry', String(b.radius));
                    v.classList.add("bullet");
                    canvas.appendChild(v);
                    return v;
                }
            }
            const v = document.getElementById(b.id) || createView(b);
            if (b.type === 'shield') {
                v.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `svg/${b.damage}.png`);
            }
            if (b.type === 'bullet') {
                v.setAttribute('cx', String(b.coord.x));
                v.setAttribute('cy', String(b.coord.y));
            }
            v.setAttribute('x', String(b.coord.x));
            v.setAttribute('y', String(b.coord.y));
        }, updateStats = (b) => {
            function createStatsView(b, type) {
                if (type === 'scoreboard') {
                    const scoreboard = document.createElementNS(canvas.namespaceURI, "text");
                    scoreboard.setAttribute('id', 'scoreboard');
                    scoreboard.setAttribute('x', '20');
                    scoreboard.setAttribute('y', '50');
                    scoreboard.textContent = Constants.scoreLabel.concat(b.toString());
                    canvas.appendChild(scoreboard);
                    return scoreboard;
                }
                else if (type === 'level') {
                    //level display
                    const levelDisplay = document.createElementNS(canvas.namespaceURI, 'text');
                    levelDisplay.setAttribute('id', 'leveldisplay');
                    levelDisplay.setAttribute('x', '440');
                    levelDisplay.setAttribute('y', '50');
                    levelDisplay.textContent = Constants.levelLabel.concat(String(b.level));
                    canvas.appendChild(levelDisplay);
                    return levelDisplay;
                }
            }
            const v = document.getElementById('scoreboard') || createStatsView(b, 'scoreboard');
            v.textContent = Constants.scoreLabel.concat(b.score.toString());
            const c = document.getElementById('level') || createStatsView(b, 'level');
            c.textContent = Constants.levelLabel.concat(String(b.level));
        };
        if (!s.gameOver) {
            //update ship view
            updateView(s.ship);
            //update bullet view
            s.bullets.forEach(updateView);
            s.removedObj.forEach(o => {
                const v = document.getElementById(o.id);
                if (v)
                    canvas.removeChild(v);
            });
            //update stats
            updateStats(s.stats);
            // update alien move horizontally
            s.aliens.forEach(v => v.forEach(updateView));
            // update shields
            s.shields.forEach(updateView);
            //update 
            if (levelCleared(s.stats.score)) {
                const r = document.createElementNS(canvas.namespaceURI, "text");
                r.setAttribute('x', String(Number(canvas.getAttribute('width')) / 13));
                r.setAttribute('y', String(Number(canvas.getAttribute('height')) / 2));
                r.setAttribute('id', 'levelcleared');
                r.textContent = "Level Cleared!";
                canvas.appendChild(r);
            }
        }
        //if GameOver
        if (s.gameOver) {
            const b = document.createElementNS(canvas.namespaceURI, "text");
            b.setAttribute('x', String(Number(canvas.getAttribute('width')) / 6));
            b.setAttribute('y', String(Number(canvas.getAttribute('height')) / 2));
            b.setAttribute('id', 'gameover');
            b.textContent = "Game Over";
            canvas.appendChild(b);
            const c = document.createElementNS(canvas.namespaceURI, "text");
            c.setAttribute('x', String(Number(canvas.getAttribute('width')) / 4));
            c.setAttribute('y', String(Number(canvas.getAttribute('height')) / 2 + 50));
            c.setAttribute('id', 'restart');
            c.textContent = "Press 'R' to restart";
            canvas.appendChild(c);
        }
    }
    //Initialization
    const initialState = () => {
        return {
            time: 0,
            ship: createShip(),
            bullets: [],
            aliens: createAlienArray(Constants.alienCount, Constants.alienPerRow),
            alienFireCoord: [],
            shields: createShields(),
            removedObj: [],
            objCount: 0,
            gameOver: false,
            stats: createStats(0, 1)
        };
    };
    //Main
    //observable stream for each keyevent and key
    const moveLeftStart = keyAction('keydown', 'ArrowLeft', () => new shipMovement(-1)), moveLeftStop = keyAction('keyup', 'ArrowLeft', () => new shipMovement(0)), moveRightStart = keyAction('keydown', 'ArrowRight', () => new shipMovement(1)), moveRightStop = keyAction('keyup', 'ArrowRight', () => new shipMovement(0)), shoot = keyAction('keydown', ' ', () => new Shoot()), restart = keyAction('keydown', 'r', () => new Restart());
    const mainStream = rxjs_1.interval(5).pipe(operators_1.map(duration => new Tick(duration)), operators_1.merge(moveLeftStart, moveRightStart, moveLeftStop, moveRightStop, shoot, restart), operators_1.scan(reduceObjects, initialState())).subscribe(updateCharacters);
}
// the following simply runs your pong function on window load.  Make sure to leave it in place.
if (typeof window != 'undefined')
    window.onload = () => {
        spaceinvaders();
    };
//# sourceMappingURL=spaceinvaders.js.map