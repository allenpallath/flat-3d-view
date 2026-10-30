import { describe, expect, it } from 'vitest'
import planC from '../../src/data/planC'
import { roomLinks, roomsNear, visibleRooms } from '../../src/data/visibility'

const links = roomLinks(planC)
const allOpen = () => true
const linked = (a: string, b: string) => links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))

describe('room visibility graph', () => {
  it('connects every room to the hall when all doors are open', () => {
    const all = visibleRooms(links, ['hall'], allOpen, 99)
    for (const r of planC.rooms) expect(all.has(r.id), r.id).toBe(true)
  })

  it('knows which links depend on doors', () => {
    expect(linked('hall', 'kitchen')?.doors).toEqual([]) // open kitchen
    expect(linked('master', 'dress1')?.doors).toEqual([]) // dress area is part of the room
    expect(linked('hall', 'master')?.doors).toEqual(['masterDoor'])
    expect(linked('dress1', 'toilet1')?.doors).toEqual(['t1Door']) // toilet doors open off the dress areas
    expect(linked('dress2', 'toilet2')?.doors).toEqual(['t2Door'])
    expect(linked('hall', 'toilet1')).toBeUndefined()
  })

  it('sees through glass walls even with the sliding door shut', () => {
    expect(linked('dress1', 'balcony2')?.doors).toEqual([])
  })

  it('hides rooms behind closed doors and far rooms', () => {
    const fromHall = visibleRooms(links, ['hall'], allOpen)
    expect(fromHall.has('master')).toBe(true)
    expect(fromHall.has('dress1')).toBe(true) // through the master bedroom
    expect(fromHall.has('toilet1')).toBe(false) // three rooms away
    // (with only the master door shut you'd still see in via the balcony and the bedroom window)
    const masterShut = visibleRooms(links, ['hall'], (id) => id !== 'masterDoor' && id !== 'bal1Slide')
    expect(masterShut.has('master')).toBe(false)
    expect(masterShut.has('dress1')).toBe(false)
    // the master bedroom still sees the hall balcony through its window
    expect(visibleRooms(links, ['master'], () => false).has('balcony1')).toBe(true)
  })

  it('treats a doorway as being in both rooms', () => {
    const near = roomsNear(planC, 336, 420) // inside the master door opening
    expect(near).toContain('hall')
    expect(near).toContain('master')
  })
})
