// Frame data per character — Tekken-style 4-button layout.
// Heights: high (whiffs over crouchers), mid (hits crouchers, beats
// crouch-block), low (must be crouch-blocked).
// `launch` pops the victim airborne (juggle starter). `air` = jumping attack.
export const MOVES = {
  dario: {
    standLP:     { startupMs: 45,  activeMs: 50,  recoveryMs: 85,  damage: 5,  knockback: 130, hitstunMs: 220, reach: 72, height: 'high', lunge: 45,  meterGain: 5 },
    standHP:     { startupMs: 95,  activeMs: 70,  recoveryMs: 180, damage: 11, knockback: 300, hitstunMs: 330, reach: 84, height: 'mid',  lunge: 130, meterGain: 8 },
    standLK:     { startupMs: 70,  activeMs: 60,  recoveryMs: 130, damage: 7,  knockback: 190, hitstunMs: 260, reach: 66, height: 'mid',  lunge: 90,  meterGain: 6 },
    standHK:     { startupMs: 150, activeMs: 90,  recoveryMs: 250, damage: 15, knockback: 380, hitstunMs: 420, reach: 96, height: 'mid',  lunge: 170, meterGain: 10 },
    crouchPunch: { startupMs: 100, activeMs: 70,  recoveryMs: 260, damage: 9,  knockback: 120, hitstunMs: 420, reach: 64, height: 'mid',  lunge: 40,  meterGain: 9, launch: 640 },
    crouchKick:  { startupMs: 110, activeMs: 70,  recoveryMs: 240, damage: 7,  knockback: 220, hitstunMs: 280, reach: 90, height: 'low',  lunge: 60,  meterGain: 7 },
    jumpPunch:   { startupMs: 50,  activeMs: 90,  recoveryMs: 100, damage: 6,  knockback: 150, hitstunMs: 220, reach: 66, height: 'mid',  air: true,  meterGain: 5 },
    jumpKick:    { startupMs: 80,  activeMs: 110, recoveryMs: 120, damage: 10, knockback: 280, hitstunMs: 340, reach: 92, height: 'mid',  air: true,  meterGain: 8 },
  },
  sam: {
    standLP:     { startupMs: 35,  activeMs: 45,  recoveryMs: 70,  damage: 4,  knockback: 110, hitstunMs: 200, reach: 68, height: 'high', lunge: 65,  meterGain: 5 },
    standHP:     { startupMs: 80,  activeMs: 60,  recoveryMs: 150, damage: 9,  knockback: 260, hitstunMs: 300, reach: 80, height: 'mid',  lunge: 150, meterGain: 8 },
    standLK:     { startupMs: 60,  activeMs: 55,  recoveryMs: 110, damage: 6,  knockback: 170, hitstunMs: 240, reach: 62, height: 'mid',  lunge: 110, meterGain: 6 },
    standHK:     { startupMs: 130, activeMs: 80,  recoveryMs: 210, damage: 13, knockback: 340, hitstunMs: 390, reach: 92, height: 'mid',  lunge: 190, meterGain: 10 },
    crouchPunch: { startupMs: 85,  activeMs: 60,  recoveryMs: 230, damage: 8,  knockback: 110, hitstunMs: 400, reach: 60, height: 'mid',  lunge: 50,  meterGain: 9, launch: 600 },
    crouchKick:  { startupMs: 90,  activeMs: 60,  recoveryMs: 210, damage: 6,  knockback: 200, hitstunMs: 260, reach: 86, height: 'low',  lunge: 80,  meterGain: 7 },
    jumpPunch:   { startupMs: 40,  activeMs: 80,  recoveryMs: 90,  damage: 5,  knockback: 130, hitstunMs: 200, reach: 62, height: 'mid',  air: true,  meterGain: 5 },
    jumpKick:    { startupMs: 70,  activeMs: 100, recoveryMs: 110, damage: 9,  knockback: 260, hitstunMs: 320, reach: 88, height: 'mid',  air: true,  meterGain: 8 },
  },
};
