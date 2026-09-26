const DEFAULT_KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyU: 'lp', KeyI: 'hp', KeyJ: 'lk', KeyK: 'hk', KeyL: 'special',
};

function blank() {
  return {
    left: false, right: false, up: false, down: false,
    lp: false, hp: false, lk: false, hk: false, special: false,
  };
}

export class Input {
  constructor(keymap = DEFAULT_KEYMAP) {
    this.keymap = keymap;
    this.held = blank();
    this.edges = blank();
  }

  _down(code) {
    const a = this.keymap[code];
    if (!a) return;
    if (!this.held[a]) this.edges[a] = true;
    this.held[a] = true;
  }

  _up(code) {
    const a = this.keymap[code];
    if (a) this.held[a] = false;
  }

  attach(target) {
    this._onDown = (e) => {
      if (this.keymap[e.code] && e.preventDefault) e.preventDefault();
      this._down(e.code);
    };
    this._onUp = (e) => { this._up(e.code); };
    target.addEventListener('keydown', this._onDown);
    target.addEventListener('keyup', this._onUp);
    this._target = target;
  }

  detach() {
    if (!this._target) return;
    this._target.removeEventListener('keydown', this._onDown);
    this._target.removeEventListener('keyup', this._onUp);
    this._target = null;
  }

  snapshot() {
    const s = { ...this.held, pressed: { ...this.edges } };
    this.edges = blank();
    return s;
  }
}
