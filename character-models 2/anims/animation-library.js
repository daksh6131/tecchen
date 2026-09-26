import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Loads converted Mixamo clips for one of the unchanged character-pack models.
 * Keep animation evaluation separate from the older procedural bone driver.
 * All animation tracks target named bones, so no skeleton replacement is needed.
 */
export class FightAnimationLibrary {
  constructor(model, character, baseURL = new URL('./', import.meta.url)) {
    if (!['sam','elon'].includes(character)) throw new Error('Expected sam or elon');
    this.model = model;
    this.character = character;
    this.baseURL = new URL(`${character}/`, baseURL);
    this.loader = new GLTFLoader();
    this.mixer = new THREE.AnimationMixer(model);
    this.cache = new Map();
    this.current = null;
    this.requestId = 0;
  }
  async init() {
    const response = await fetch(new URL('manifest.json', this.baseURL), {cache:'no-store'});
    if (!response.ok) throw new Error(`Missing animation manifest: ${response.status}`);
    this.manifest = await response.json();
    this.metadata = new Map(this.manifest.clips.map(c => [c.name,c]));
    return this;
  }
  async load(name) {
    if (!this.metadata.has(name)) throw new Error(`Unknown animation ${name}`);
    const assetURL = new URL(`${name}.glb`,this.baseURL);
    if (this.metadata.get(name).revision) assetURL.searchParams.set('v',this.metadata.get(name).revision);
    if (!this.cache.has(name)) this.cache.set(name, this.loader.loadAsync(assetURL.href).then(gltf => {
      const clip = gltf.animations[0];
      if (!clip) throw new Error(`No animation in ${name}.glb`);
      clip.name = name;
      const bones = new Set();
      this.model.traverse(o => { if (o.isBone) bones.add(o.name); });
      for (const track of clip.tracks) {
        const bone = THREE.PropertyBinding.parseTrackName(track.name).nodeName;
        if (!bones.has(bone)) throw new Error(`Clip ${name} targets missing bone ${bone}`);
      }
      return clip;
    }).catch(e => { this.cache.delete(name); throw e; }));
    return this.cache.get(name);
  }
  async play(name, {fade=.12, loop, speed=1}={}) {
    const request=++this.requestId;
    let clip=await this.load(name);
    if (request !== this.requestId) return null;
    const meta=this.metadata.get(name);
    const action=this.mixer.clipAction(clip);
    if (this.current) this.current.fadeOut(fade);
    action.reset().setLoop((loop ?? meta.loop) ? THREE.LoopRepeat : THREE.LoopOnce,Infinity);
    action.clampWhenFinished=true;
    action.setEffectiveTimeScale(speed).setEffectiveWeight(1).fadeIn(fade).play();
    this.current=action;
    return action;
  }
  update(seconds) { this.mixer.update(seconds); }
  dispose() { this.requestId++; this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); }
}

// Suggested mapping only. Cross/hook and hit variants need explicit move identity.
export const SUGGESTED_STATE_CLIPS = Object.freeze({
  idle:'idle', walk:'walk', dash:'run', jump:'jump', crouch:'crouch',
  block:'block', crouchblock:'crouch', standLP:'jab', standHP:'cross',
  standLK:'snap_kick', standHK:'roundhouse', crouchPunch:'uppercut',
  crouchKick:'sweep', jumpKick:'flying_kick', hitstun:'head_hit', ko:'knocked_down',
});
