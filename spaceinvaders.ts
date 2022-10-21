// alien.png from https://www.pikpng.com/pngvi/JoTxmx_space-invaders-alien-png-image-background-8-bit-space-invaders-png-clipart/
// shield images from https://www.raspberrypi.org/blog/coding-space-invaders-disintegrating-shields-wireframe-9/
// spaceship image from https://steamcommunity.com/sharedfiles/filedetails/?id=277472506 
// font from https://www.fontspace.com/minecraft-ten-font-f40317
// code structure adapted from https://tgdwyer.github.io/asteroids/

import{interval, fromEvent} from 'rxjs'
import{map, filter, scan, merge, takeUntil, takeWhile, repeat} from 'rxjs/operators'



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
    alienPadding: [29,10],
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
  } as const


  //interface declaration
  type Body = Readonly<{
    id: string
    type: BodyType
    startTime: number
    fireTime: number
    coord: vector
    movedDist: number
    velocity: vector
    radius: number
    rank?:number
    damage?:number
  }>
  type State = Readonly<{
    time: number
    ship: Body
    bullets: ReadonlyArray<Body>
    aliens: ReadonlyArray<ReadonlyArray<Body>>
    alienFireCoord: ReadonlyArray<number>
    shields: ReadonlyArray<Body>
    removedObj: ReadonlyArray<Body>
    objCount: number
    gameOver: boolean
    stats: Stats
  }>
  type Stats = Readonly<{
    id: string,
    type: BodyType
    score: number,
    level: number
  }>
  type Event = 'keydown' | 'keyup'
  type Key = 'ArrowLeft' | 'ArrowRight' | ' ' | 'r'
  type BodyType = 'ship' | 'alien' | 'bullet' | 'shield' | 'stats'

  //Functions//
  //Body object creation
  function createShip():Body {
    return {
      id: 'ship',
      type: 'ship',
      coord: new vector((Number(document.getElementById("canvas").getAttribute('width'))-64)/2, 
      Number(document.getElementById("canvas").getAttribute('height'))-42),
      velocity: vector.Zero,
      movedDist: 0,
      radius: Constants.shipRadius,
      startTime: 0,
      fireTime: 0,
    }
  }
  function createBullets(s: State, b: Body, velocity: number): Body {
    const d = vector.unitVectorDirection(0),
          ycoord = velocity < 0? b.coord.y+2*b.radius+2 : b.coord.y
    return{
      id: `bullet${s.objCount}`,
      type: 'bullet',
      coord: new vector(b.coord.x+b.radius,ycoord),
      velocity: b.velocity.add(d.scale(velocity)),
      radius: 3,
      movedDist:0,
      startTime: s.time,
      fireTime:0,
    }
  }
  function createAlienArray(count: number, countPerRow: number): Body[][]{
    //calculate padding size based on canvas size and number of alien per row
    const alienPadding = (Constants.canvasSize-(countPerRow*2*Constants.alienRadius))/(countPerRow+1),
    //Create alien row recursively
    createAlienRow = (count: number, direction: number, nRow: number = Math.ceil(count/countPerRow), yStart: number = 70):Body[][] => {
      return nRow === 1? [createAlien(count,countPerRow, yStart, alienPadding, direction)] : [createAlien(count,countPerRow, yStart, alienPadding, direction)].concat(createAlienRow(count-countPerRow, direction, nRow-1, yStart+(2*Constants.alienRadius)+Constants.alienPadding[1]))
    },
    //create alien recursively
    createAlien = (count: number, countPerRow: number, yStart: number, xStart: number = alienPadding, direction: number): Body[] => {
      const alienBody: Body = {
        id: `alien${Constants.alienCount-count+1}`,
        type: 'alien',
        startTime: 0,
        coord: new vector(xStart, yStart),
        velocity: new vector(direction, 0),
        movedDist: 0,
        radius: Constants.alienRadius,
        fireTime:0,
        rank: Constants.alienCount-count+1
      }
      return countPerRow === 1 || count === 1? [alienBody] : [alienBody].concat(createAlien(count-1,countPerRow-1, yStart,xStart+(2*Constants.alienRadius)+alienPadding, direction))
    }
  return createAlienRow(count, 0.05)

  }
  function createShields(): Body[] {
    const shieldPadding = (Constants.canvasSize-(Constants.shieldCount*2*Constants.shieldRadius))/(Constants.shieldCount+1),
    createShieldsArray = (count: number, xStart: number = shieldPadding , yStart:number = 440) => {
      const shieldBody: Body = {
        id: `shield${count}`,
        type: 'shield',
        startTime: 0,
        coord: new vector(xStart, yStart),
        velocity: vector.Zero,
        movedDist: 0,
        radius: Constants.shieldRadius,
        fireTime:0,
        damage: 0
      }
      return count === 1? [shieldBody] : [shieldBody].concat(createShieldsArray(count-1, xStart+(2*Constants.shieldRadius)+shieldPadding, yStart))
    }
    return createShieldsArray(Constants.shieldCount)

  }
  function createStats(score: number, level: number): Stats {
    return {
      id: 'stats',
      type: 'stats',
      score: score,
      level: level
    }
  }

  //Helper functions
  const negate = <T>(f:(x:T) => boolean) => (x:T) => !f(x),
        //grab element by id
        element = (x: ReadonlyArray<Body>) => (y: Body) => x.findIndex(w => w.id === y.id) >= 0,
        //everything in x except for those in y
        otherThan = (x: ReadonlyArray<Body>) => (y: Body[]) => x.filter(negate(element(y))),
        //probability wrapper function
        prob = (probability: number):boolean => Math.random() <= probability,
        //calculate row
        rowGet = (pos: number):number => Math.ceil(pos/Constants.alienPerRow)-1 < 0? 0: Math.ceil(pos/Constants.alienPerRow)-1,
        //set boundary for moving objects
        spaceBound = ({x,y}: vector, r: number): vector => {
          const canvas = document.getElementById('canvas'),
                canvasBound = {x: Number(canvas.getAttribute('width'))-(2*r), y: Number(canvas.getAttribute('height'))},
                xBound = x >= canvasBound.x ? canvasBound.x : x <= 0 ? 0 : x,
                yBound = y >= canvasBound.y ? canvasBound.y+10 : y
          return new vector(xBound, yBound)
        },
        //create observable stream for each keyevent and key
        keyAction = <T>(eventName: Event, k: Key, result: () => T) =>  fromEvent<KeyboardEvent>(document, eventName).pipe(
          filter(({key}) => key === k),
          filter(({repeat}) => !repeat),
          map(result)),
        levelCleared = (score: number) => score === (Constants.alienCount*Constants.pointsPerAlien)
  
  
  //Actions classes
  class Tick{constructor(public readonly duration: number) {}}
  class shipMovement{constructor(public readonly direction: number) {}}
  class Shoot{constructor() {}}
  class Restart{
    constructor() {}
    reset = () => {
      document.getElementById("canvas").remove()
      const newCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      newCanvas.setAttribute('id', 'canvas')
      newCanvas.setAttribute('width', String(Constants.canvasSize))
      newCanvas.setAttribute('height', String(Constants.canvasSize))
      newCanvas.setAttribute('fill', '#000000')
      document.getElementById('outerCanvas').appendChild(newCanvas)
      return initialState()
    }
  }
  class vector{
    constructor(public readonly x: number=0, public readonly y: number = 0){}
    add = (b: vector) => new vector(this.x + b.x, this.y + b.y)
    sub = (b: vector) => this.add(b.scale(-1))
    len = () => Math.sqrt(this.x*this.x + this.y*this.y)
    scale = (s: number) => new vector(this.x*s, this.y*s)
    ortho = () => new vector(this.x, -this.y)
    rotate = (deg: number) =>
              (rad => (
                (cos,sin,{x,y}) => new vector(x*cos - y*sin, x*sin+y*cos)
              )(Math.cos(rad), Math.sin(rad), this)
              )(Math.PI * deg/180)
    static unitVectorDirection = (deg: number) => new vector(0, -1).rotate(deg)
    static Zero = new vector();
  }


  //object state reducing function
  const reduceObjects = (s: State, e: shipMovement|Tick|Shoot|Restart) =>
    e instanceof shipMovement? {...s, ship: {...s.ship, velocity: new vector(e.direction, 0)}} 
    : 
    e instanceof Shoot? {...s, bullets: s.bullets.concat([createBullets(s,s.ship, 10)]), objCount: s.objCount+1}
    :
    e instanceof Restart? e.reset()
    :
    tick(s, e.duration)
  
  //move objects of type Body
  const moveObj = (b: Body) => <Body>{
    ...b,
    velocity: b.velocity,
    movedDist: b.velocity.x < 0 ? b.movedDist+(-1*b.velocity.x) : b.movedDist+b.velocity.x,
    coord: spaceBound(b.coord.add(b.velocity), b.radius)
  }
  //update score if score changes
  const updateScore = (b: Stats, scoreChange?: number) => <Stats>{
    ...b,
    score: scoreChange? b.score+scoreChange: b.score
  }
  //update shield damage and remove those that reached max damage in to another array
  const updateShieldDamage = (shield: ReadonlyArray<Body>, damaged: Body[]) => {
    //damaged is the array that contains shield that collided with bullet
    const 
    destroyed = damaged.filter(v => v.damage >= Constants.maxShieldDmg),
    removeDestroyed = shield.filter(negate(element(destroyed))),
    //update damage caused by collision
    updateDamage = removeDestroyed.map(s => damaged.findIndex(w => w.id === s.id)>=0? {...s, damage: s.damage+1} : s)
    return [updateDamage, destroyed]
  }
  //handle collision
  const handleCollisions = (s:State) => {
    //helper functions
    //check for object collision by calculating the distance between 2 object
    const objectCollide = ([a,b]: [Body, Body]) => {
      const centrecoord = {c1: a.coord.add(new vector(a.radius, a.radius)), c2: b.coord.add(new vector(b.radius, b.radius)) }
      return centrecoord.c1.sub(centrecoord.c2).len() < a.radius + b.radius},
      //update alien firing position array if an alien that dies is in the firing array
    updateAlienFiringPos = (s: State) => {
      const validPos = (s: State, pos: number) => {
        //if alien exists in alien array row or finish checking whole array, else check previous row
        return (s.aliens[rowGet(pos)].filter(b => b.rank === pos).length>0 || pos < 0)? pos : validPos(s, pos-Constants.alienPerRow)
      }
      return s.alienFireCoord.map(v => aliensDamaged.findIndex(w => w.rank === v)>=0? validPos(s, v-Constants.alienPerRow): v)

    },

    shipBulletCollide =  s.bullets.filter(r=>objectCollide([s.ship, r])).length > 0,
    //Aliens and bullet
    bulletsAliensCollide = s.bullets.flatMap(b => s.aliens.map(v => v.map(r=> [b,r])).reduce((b: [[Body, Body]], acc:[[Body, Body]]) =>acc.concat(b), [])).filter(objectCollide),
    aliensDamaged = bulletsAliensCollide.map(([_,r]) => r),
    //Shield and bullets
    shieldBulletsCollide = s.bullets.flatMap(b => s.shields.map(r => [b,r])).filter(objectCollide),
    shieldDamaged = shieldBulletsCollide.map(([_,r]) => r),
    //update shield damage stats, return [notDestroyed, destroyed]
    shieldUpdated = updateShieldDamage(s.shields, shieldDamaged),
    //concat all damaged bullets
    bulletsDamaged = bulletsAliensCollide.map(([b,_]) => b).concat(shieldBulletsCollide.map(([b,_]) => b))

    return <State>{
      ...s,
      bullets: otherThan(s.bullets)(bulletsDamaged),
      aliens: s.aliens.map((v:Body[]):Body[] => v.filter(negate(element(aliensDamaged)))),
      shields: shieldUpdated[0],
      removedObj: s.removedObj.concat(bulletsDamaged, aliensDamaged, shieldUpdated[1]),
      gameOver: !s.gameOver? shipBulletCollide || levelCleared(s.stats.score): s.gameOver,
      stats: (bulletsAliensCollide.length > 0 ? updateScore(s.stats,(Constants.pointsPerAlien*bulletsAliensCollide.length)): updateScore(s.stats)),
      alienFireCoord: updateAlienFiringPos(s)
    }
  }

  //alien shooting
  const alienShoot = (s: State, duration: number) => {
    //enforce firing interval
    const fireInterval = (b: Body, duration:number) => (duration-b.fireTime) > Math.random()*Constants.alienFireInterval,
    //initialise firing position
    initialiseFiringPos = (s: State) => {
      if (s.alienFireCoord.length <= 0){
        const currentRow = s.aliens[s.aliens.length-1],
              currentRowInd = s.aliens.indexOf(currentRow),
              initialFiringPos = [...Array(Constants.alienPerRow)].map((_,v) => {
          return v > currentRow.length-1? s.aliens[currentRowInd-1][v].rank :
          s.aliens[currentRowInd][v].rank
        })
        return <State> {...s, alienFireCoord: s.alienFireCoord.concat(initialFiringPos)}
      } else {
        return s
      }
    }
    const updatedFiringPosState = initialiseFiringPos(s)
    const accBullets = updatedFiringPosState.alienFireCoord.filter(b => b > 0).reduce((acc, v) => {
      const currentAlienShooting = s.aliens[rowGet(v)].filter(b => b.rank === v)[0]
      return prob(0.005) && fireInterval(currentAlienShooting, duration)?
        {...acc,
        objCount: acc.objCount+1,
        bullets: acc.bullets.concat([createBullets(acc, currentAlienShooting, -1)]),
        aliens: acc.aliens.map(v => v.map(b => b.rank === currentAlienShooting.rank? {...b, fireTime: duration}: b))}
        :
        {...acc}
    }, updatedFiringPosState)
    
    return accBullets
  } 
  //object expiration handle
  const handleObjectExpiration = (s: State, duration: number) => {
    const expiryFilter = (b: Body) => (duration - b.startTime) > Constants.bulletExpirationDuration,
    expiredObj: Body[] = s.bullets.filter(expiryFilter),
    liveObj: Body[] = s.bullets.filter(negate(expiryFilter))
    return {
      ...s,
      bullets: liveObj,
      removedObj: expiredObj,
      time: duration
    }
  }
  //object movement
  const handleObjectMovement = (s: State): State => {
      //alien moving in svg at random
    const alienMovement = (s: State) => {
      const maxDistFilter = (b: Body) => b.movedDist >= Constants.alienMaxMove,
      aliensMovedMax = s.aliens.map(v => v.filter(maxDistFilter).map(f => ({...f, movedDist: -Constants.alienMaxMove, velocity: new vector(-1*f.velocity.x, 10)}))),
      aliensStillMoving = s.aliens.map(v => v.filter(negate(maxDistFilter)).map(f => ({...f, velocity: new vector(f.velocity.x, 0)}))),
      allAliens = aliensMovedMax.map((b) => {
        const ind = aliensMovedMax.indexOf(b)
        return b.concat(aliensStillMoving[ind])})
      return {...s, aliens: allAliens.map(v => v.map(moveObj))}
    }
    //move ship and bullets
    return alienMovement({...s, ship: moveObj(s.ship), bullets: s.bullets.map(moveObj)})
    
  }

  //tick function for time passage
  const tick = (s: State, duration: number) => {
    const alienFired = alienShoot(s, duration),
          objectExpirationHandled = handleObjectExpiration(alienFired, duration),
          objectMovementHandled = handleObjectMovement(objectExpirationHandled),
          collisionHandled = handleCollisions(objectMovementHandled)

    return collisionHandled
  }

  function updateCharacters(s: State): void {
    const canvas = document.getElementById('canvas')
    //helper function for creating body view or update body view
    const updateView = (b: Body) =>{
      function createView(b: Body) {
        if(b.type === 'ship'){
          const v = document.createElementNS(canvas.namespaceURI, 'image')
          v.setAttributeNS('http://www.w3.org/1999/xlink','href', 'svg/space-ship.png')
          v.setAttributeNS(null,'width', String(2*Constants.shipRadius))
          v.setAttributeNS(null, 'height', String(2*Constants.shipRadius))
          v.setAttributeNS(null, 'id', 'ship')
          canvas.appendChild(v)
          return v
        }
        else if(b.type === 'alien'){
          const v = document.createElementNS(canvas.namespaceURI, 'image')
          v.setAttributeNS('http://www.w3.org/1999/xlink','href', 'svg/alien.png')
          v.setAttributeNS(null,'width', String(2*b.radius))
          v.setAttributeNS(null, 'height', String(2*b.radius))
          v.setAttributeNS(null, 'id', b.id)
          canvas.appendChild(v)
          return v
        }
        else if (b.type === 'shield'){
          const v = document.createElementNS(canvas.namespaceURI, 'image')
          v.setAttributeNS('http://www.w3.org/1999/xlink','href', 'svg/1.png')
          v.setAttributeNS(null,'width', String(2*b.radius))
          v.setAttributeNS(null, 'height', String(2*b.radius))
          v.setAttributeNS(null, 'id', b.id)
          canvas.appendChild(v)
          return v
        }
        else if (b.type === 'bullet'){
          const v = document.createElementNS(canvas.namespaceURI,"ellipse")!;
            v.setAttribute("id", b.id);
            v.setAttribute('rx', String(b.radius))
            v.setAttribute('ry', String(b.radius))
            v.classList.add("bullet")
            canvas.appendChild(v)
            return v
          }
        
        }
      
      const v = document.getElementById(b.id) || createView(b)
      if(b.type === 'shield'){
        v.setAttributeNS('http://www.w3.org/1999/xlink','href', `svg/${b.damage}.png`)
      }
      if(b.type === 'bullet'){
        v.setAttribute('cx', String(b.coord.x))
        v.setAttribute('cy', String(b.coord.y))
      }
      v.setAttribute('x', String(b.coord.x))
      v.setAttribute('y', String(b.coord.y))
        
      

      },
      //function for creating or updating stats view
    updateStats = (b: Stats) => {
      function createStatsView(b: Stats, type: String){
        if(type === 'scoreboard'){
          const scoreboard = document.createElementNS(canvas.namespaceURI, "text")!
          scoreboard.setAttribute('id', 'scoreboard')
          scoreboard.setAttribute('x', '20')
          scoreboard.setAttribute('y', '50')
          scoreboard.textContent = Constants.scoreLabel.concat(b.toString())
          canvas.appendChild(scoreboard)
          return scoreboard
        }
        else if(type === 'level'){  
          //level display
          const levelDisplay = document.createElementNS(canvas.namespaceURI, 'text')!
          levelDisplay.setAttribute('id', 'leveldisplay')
          levelDisplay.setAttribute('x', '440')
          levelDisplay.setAttribute('y', '50')
          levelDisplay.textContent = Constants.levelLabel.concat(String(b.level))
          canvas.appendChild(levelDisplay)
          return levelDisplay
        }
      }
      const v = document.getElementById('scoreboard') || createStatsView(b, 'scoreboard')
      v.textContent = Constants.scoreLabel.concat(b.score.toString())
      const c = document.getElementById('leveldisplay') || createStatsView(b, 'level')
      c.textContent = Constants.levelLabel.concat(b.level.toString())


    }     
    if(!s.gameOver){
      //update ship view
      updateView(s.ship)

      //update bullet view
      s.bullets.forEach(updateView)
      s.removedObj.forEach(o => {
        const v = document.getElementById(o.id);
        if(v) canvas.removeChild(v)
      })
      //update view stats
      updateStats(s.stats)
      
      // update view alien move horizontally
      s.aliens.forEach(v => v.forEach(updateView))

      // update view shields
      s.shields.forEach(updateView)
    }

    //if GameOver, append text to display
    if(s.gameOver){
      //if level cleared
      if(levelCleared(s.stats.score) && !document.getElementById('levelcleared')){
        const r = document.createElementNS(canvas.namespaceURI, "text");
        r.setAttribute('x', String(Number(canvas.getAttribute('width'))/13));
        r.setAttribute('y', String(Number(canvas.getAttribute('height'))/2));
        r.setAttribute('id', 'levelcleared');
        r.textContent = "Level Cleared!";
        canvas.appendChild(r)
      }
      //if game ended before level cleared
      else if(!levelCleared(s.stats.score)){
        if(!document.getElementById('gameover')){
          const b = document.createElementNS(canvas.namespaceURI, "text");
          b.setAttribute('x', String(Number(canvas.getAttribute('width'))/6));
          b.setAttribute('y', String(Number(canvas.getAttribute('height'))/2));
          b.setAttribute('id', 'gameover');
          b.textContent = "Game Over";
          canvas.appendChild(b)}
        
        if(!document.getElementById('restart')){
          const c = document.createElementNS(canvas.namespaceURI, "text");
          c.setAttribute('x', String(Number(canvas.getAttribute('width'))/4));
          c.setAttribute('y', String(Number(canvas.getAttribute('height'))/2+50));
          c.setAttribute('id', 'restart');
          c.textContent = "Press 'R' to restart";
          canvas.appendChild(c);}
    }
  }
}

  //Initialization
  const initialState = (): State => {return{
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
  }
  }
  
  
  //Main
  //observable stream for each keyevent and key
  const moveLeftStart = keyAction('keydown', 'ArrowLeft', () => new shipMovement(-1)),
        moveLeftStop = keyAction('keyup', 'ArrowLeft', () => new shipMovement(0)),
        moveRightStart = keyAction('keydown', 'ArrowRight', () => new shipMovement(1)),
        moveRightStop = keyAction('keyup', 'ArrowRight', () => new shipMovement(0)),
        shoot = keyAction('keydown', ' ', () => new Shoot()),
        restart = keyAction('keydown', 'r', () => new Restart())
  const mainStream = interval(5).pipe(map(duration => new Tick(duration)),
                      merge(moveLeftStart,moveRightStart, moveLeftStop,  moveRightStop, shoot, restart), 
                    scan(reduceObjects, initialState())                 
  ).subscribe(updateCharacters)
}                                                       
  
  
  // the following simply runs your pong function on window load.  Make sure to leave it in place.
  if (typeof window != 'undefined')
    window.onload = ()=>{
      spaceinvaders();
    }
  

  

