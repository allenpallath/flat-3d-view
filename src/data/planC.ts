import type { Plan } from './schema'

// Flat type "C". All values in cm, traced from the developer's drawing
// (≈1.12 px per cm) and snapped to the printed room sizes.
// Wall thickness: exterior 23 cm, interior 12 cm. Clear ceiling 285 cm.

const H = 285
const DOOR_HEAD = 210

export const planC: Plan = {
  name: 'Type C – 2BHK',
  ceilingHeight: H,
  spawn: { x: 70, z: 70, yawDeg: -120 },

  rooms: [
    { id: 'hall', name: 'Hall (Living + Dining)', label: '330X622', rect: { x1: 0, z1: 0, x2: 330, z2: 622 }, floor: 'hallTile' },
    { id: 'kitchen', name: 'Kitchen (open)', label: '330X266', rect: { x1: 0, z1: 634, x2: 330, z2: 900 }, floor: 'hallTile' },
    { id: 'washNiche', name: 'Wash Basin', rect: { x1: -55, z1: 490, x2: 0, z2: 622 }, floor: 'hallTile' },
    { id: 'balcony1', name: 'Balcony (Hall)', label: '150X150', rect: { x1: 343, z1: 0, x2: 493, z2: 150 }, floor: 'balconyTile', outdoor: true },
    { id: 'master', name: 'Master Bedroom', label: '300X300', rect: { x1: 343, z1: 170, x2: 643, z2: 470 }, floor: 'hallTile' },
    { id: 'dress1', name: 'Dress (Master)', label: '136X150', rect: { x1: 643, z1: 170, x2: 773, z2: 326 }, floor: 'hallTile' },
    { id: 'balcony2', name: 'Balcony (Master)', label: '114X168', rect: { x1: 785, z1: 158, x2: 899, z2: 326 }, floor: 'balconyTile', outdoor: true },
    { id: 'toilet1', name: 'Toilet (Master)', label: '232X132', rect: { x1: 655, z1: 338, x2: 887, z2: 470 }, floor: 'toiletTile' },
    { id: 'toilet2', name: 'Toilet (Bedroom)', label: '232X132', rect: { x1: 655, z1: 482, x2: 887, z2: 614 }, floor: 'toiletTile' },
    { id: 'bedroom', name: 'Bedroom 2', label: '300X300', rect: { x1: 343, z1: 482, x2: 643, z2: 782 }, floor: 'hallTile' },
    { id: 'dress2', name: 'Dress (Bedroom 2)', label: '136X150', rect: { x1: 643, z1: 626, x2: 773, z2: 782 }, floor: 'hallTile' },
    { id: 'balcony3', name: 'Balcony (Bedroom 2)', label: '114X168', rect: { x1: 785, z1: 626, x2: 899, z2: 794 }, floor: 'balconyTile', outdoor: true },
    { id: 'workArea', name: 'Work Area', label: '150X102', rect: { x1: 343, z1: 798, x2: 493, z2: 900 }, floor: 'balconyTile' },
  ],

  walls: [
    // ---- Hall / kitchen west (entrance side) ----
    {
      id: 'westA', kind: 'exterior', height: H, rect: { x1: -23, z1: -23, x2: 0, z2: 490 },
      openings: [{ id: 'mainDoor', kind: 'mainDoor', from: 20, to: 120, sill: 0, head: DOOR_HEAD, hinge: 'from', swing: 1 }],
    },
    { id: 'nicheN', kind: 'interior', height: H, rect: { x1: -78, z1: 478, x2: -23, z2: 490 } },
    { id: 'nicheW', kind: 'exterior', height: H, rect: { x1: -78, z1: 478, x2: -55, z2: 634 } },
    { id: 'nicheS', kind: 'interior', height: H, rect: { x1: -78, z1: 622, x2: -23, z2: 634 } },
    {
      id: 'westB', kind: 'exterior', height: H, rect: { x1: -23, z1: 622, x2: 0, z2: 923 },
      openings: [{ id: 'kitchenWin', kind: 'window', from: 775, to: 865, sill: 105, head: DOOR_HEAD }],
    },

    // ---- North ----
    {
      id: 'north', kind: 'exterior', height: H, rect: { x1: -23, z1: -23, x2: 505, z2: 0 },
      openings: [{ id: 'livingWin', kind: 'window', from: 90, to: 250, sill: 90, head: DOOR_HEAD }],
    },
    { id: 'bal1Rail', kind: 'railing', height: 110, rect: { x1: 493, z1: 0, x2: 505, z2: 150 } },

    // ---- Hall east (TV wall) – balcony, bedroom doors, work area ----
    {
      id: 'hallEast', kind: 'interior', height: H, rect: { x1: 330, z1: 0, x2: 343, z2: 900 },
      openings: [
        { id: 'bal1Slide', kind: 'sliding', from: 12, to: 140, sill: 0, head: DOOR_HEAD },
        { id: 'masterDoor', kind: 'door', from: 375, to: 465, sill: 0, head: DOOR_HEAD, hinge: 'to', swing: 1 },
        { id: 'bedDoor', kind: 'door', from: 492, to: 582, sill: 0, head: DOOR_HEAD, hinge: 'from', swing: 1 },
        { id: 'workDoor', kind: 'door', from: 808, to: 888, sill: 0, head: DOOR_HEAD, hinge: 'to', swing: 1 },
      ],
    },

    // ---- Bedroom wing ----
    {
      id: 'masterN', kind: 'exterior', height: H, rect: { x1: 343, z1: 150, x2: 785, z2: 170 },
      openings: [{ id: 'masterWin', kind: 'window', from: 400, to: 545, sill: 90, head: DOOR_HEAD }],
    },
    {
      id: 'dress1Glass', kind: 'glass', height: H, rect: { x1: 773, z1: 170, x2: 785, z2: 326 },
      openings: [{ id: 'bal2Slide', kind: 'sliding', from: 180, to: 316, sill: 0, head: DOOR_HEAD }],
    },
    { id: 'bal2N', kind: 'parapet', height: 110, rect: { x1: 785, z1: 146, x2: 905, z2: 158 } },
    { id: 'bal2Rail', kind: 'railing', height: 110, rect: { x1: 899, z1: 158, x2: 905, z2: 326 } },

    { id: 't1N', kind: 'interior', height: H, rect: { x1: 643, z1: 326, x2: 910, z2: 338 } },
    {
      id: 'toiletW', kind: 'interior', height: H, rect: { x1: 643, z1: 338, x2: 655, z2: 614 },
      openings: [
        { id: 't1Door', kind: 'door', from: 350, to: 425, sill: 0, head: DOOR_HEAD, hinge: 'from', swing: 1 },
        { id: 't2Door', kind: 'door', from: 530, to: 605, sill: 0, head: DOOR_HEAD, hinge: 'to', swing: 1 },
      ],
    },
    { id: 'midWall', kind: 'interior', height: H, rect: { x1: 343, z1: 470, x2: 643, z2: 482 } },
    { id: 'toiletMid', kind: 'interior', height: H, rect: { x1: 655, z1: 470, x2: 910, z2: 482 } },
    {
      id: 'toiletE', kind: 'exterior', height: H, rect: { x1: 887, z1: 338, x2: 910, z2: 614 },
      openings: [
        { id: 't1Vent', kind: 'ventilator', from: 375, to: 435, sill: 180, head: 225 },
        { id: 't2Vent', kind: 'ventilator', from: 520, to: 580, sill: 180, head: 225 },
      ],
    },
    { id: 't2S', kind: 'interior', height: H, rect: { x1: 643, z1: 614, x2: 910, z2: 626 } },
    {
      id: 'dress2Glass', kind: 'glass', height: H, rect: { x1: 773, z1: 626, x2: 785, z2: 782 },
      openings: [{ id: 'bal3Slide', kind: 'sliding', from: 636, to: 772, sill: 0, head: DOOR_HEAD }],
    },
    { id: 'bal3Rail', kind: 'railing', height: 110, rect: { x1: 899, z1: 626, x2: 905, z2: 794 } },
    { id: 'bal3S', kind: 'parapet', height: 110, rect: { x1: 785, z1: 794, x2: 905, z2: 806 } },
    {
      id: 'bedS', kind: 'exterior', height: H, rect: { x1: 343, z1: 782, x2: 785, z2: 798 },
      openings: [{ id: 'bedWin', kind: 'window', from: 420, to: 620, sill: 90, head: DOOR_HEAD }],
    },

    // ---- Work area / south ----
    {
      id: 'workE', kind: 'exterior', height: H, rect: { x1: 493, z1: 798, x2: 505, z2: 923 },
      openings: [{ id: 'workWin', kind: 'window', from: 812, to: 888, sill: 90, head: DOOR_HEAD }],
    },
    { id: 'south', kind: 'exterior', height: H, rect: { x1: -23, z1: 900, x2: 505, z2: 923 } },

    // ---- Open kitchen: short stub beside the wash niche (rest is a breakfast counter) ----
    { id: 'kitchenStub', kind: 'interior', height: H, rect: { x1: 0, z1: 622, x2: 76, z2: 634 } },
  ],

  fixtures: [
    // Open kitchen
    { id: 'breakfast', type: 'breakfastCounter', room: 'kitchen', rect: { x1: 76, z1: 622, x2: 245, z2: 667 }, height: 100 },
    { id: 'counterW', type: 'kitchenCounter', room: 'kitchen', rect: { x1: 0, z1: 640, x2: 60, z2: 900 }, height: 90 },
    { id: 'counterS', type: 'kitchenCounter', room: 'kitchen', rect: { x1: 60, z1: 840, x2: 165, z2: 900 }, height: 90 },
    { id: 'hob', type: 'hob', room: 'kitchen', rect: { x1: 5, z1: 690, x2: 55, z2: 760 }, y: 90, height: 2 },
    { id: 'chimney', type: 'chimney', room: 'kitchen', rect: { x1: 0, z1: 685, x2: 55, z2: 765 }, y: 165, height: 70 },
    { id: 'kSink', type: 'sink', room: 'kitchen', rect: { x1: 92, z1: 848, x2: 152, z2: 893 }, y: 90, height: 1 },
    // Wash basin niche
    { id: 'nicheVanity', type: 'vanity', room: 'washNiche', rect: { x1: -55, z1: 520, x2: -5, z2: 600 }, height: 85 },
    // Toilet 1 (master)
    { id: 't1Vanity', type: 'vanity', room: 'toilet1', rect: { x1: 662, z1: 425, x2: 712, z2: 470 }, height: 85 },
    { id: 't1Wc', type: 'wc', room: 'toilet1', rect: { x1: 725, z1: 405, x2: 765, z2: 470 }, height: 40 },
    { id: 't1Glass', type: 'showerGlass', room: 'toilet1', rect: { x1: 799, z1: 338, x2: 801, z2: 430 }, height: 200 },
    { id: 't1Drain', type: 'showerDrain', room: 'toilet1', rect: { x1: 836, z1: 396, x2: 850, z2: 410 }, height: 0.3 },
    // Toilet 2 (bedroom)
    { id: 't2Vanity', type: 'vanity', room: 'toilet2', rect: { x1: 662, z1: 482, x2: 712, z2: 527 }, height: 85 },
    { id: 't2Wc', type: 'wc', room: 'toilet2', rect: { x1: 725, z1: 482, x2: 765, z2: 547 }, height: 40 },
    { id: 't2Glass', type: 'showerGlass', room: 'toilet2', rect: { x1: 799, z1: 522, x2: 801, z2: 614 }, height: 200 },
    { id: 't2Drain', type: 'showerDrain', room: 'toilet2', rect: { x1: 836, z1: 541, x2: 850, z2: 555 }, height: 0.3 },
    // Planters outside the east balconies
    { id: 'planter2', type: 'planter', room: 'balcony2', rect: { x1: 905, z1: 150, x2: 960, z2: 330 }, height: 60 },
    { id: 'planter3', type: 'planter', room: 'balcony3', rect: { x1: 905, z1: 622, x2: 960, z2: 806 }, height: 60 },
  ],
}

export default planC
