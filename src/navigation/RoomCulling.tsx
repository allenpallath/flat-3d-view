// Room culling (walk mode): objects in rooms that can't be seen from where you stand — walls and
// closed doors in between — are moved to a hidden layer, so they're neither drawn nor clickable.
// Walls and the outdoors always stay. Dollhouse / plan views show everything.
// The visible set comes from the room graph in data/visibility.ts (rooms within two open-door hops).
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import planC from '../data/planC'
import { roomAt } from '../data/geometry'
import { roomLinks, roomsNear, visibleRooms } from '../data/visibility'
import { isDoorOpen, useStore } from '../store'
import { markShadowsDirty } from '../materials/shadows'

/** A layer the camera never renders and raycasters never test (both use layer 0 only). */
const HIDDEN_LAYER = 5
const CULLED_KINDS = new Set(['floor', 'ceiling', 'fixture', 'furniture', 'point'])
const RESCAN_MS = 600 // pick up meshes that mount later (new furniture, LOD swaps)

const fixtureRoom = new Map(planC.fixtures.map((f) => [f.id, f.room]))

/** Room of a tagged object, or undefined to always keep it. */
function roomOf(u: Record<string, unknown>): string | undefined {
  const s = useStore.getState()
  switch (u.kind) {
    case 'floor':
    case 'ceiling':
      return u.roomId as string
    case 'fixture':
      return fixtureRoom.get(u.fixtureId as string)
    case 'furniture': {
      const it = s.items.find((i) => i.id === u.itemId)
      return it ? roomAt(planC, it.x, it.z)?.id : undefined
    }
    case 'point': {
      const p = s.points.find((q) => q.id === u.pointId)
      return p ? (p.roomId ?? roomAt(planC, p.x, p.z)?.id) : undefined
    }
  }
  return undefined
}

function setLayer(o: THREE.Object3D, layer: number) {
  o.traverse((c) => c.layers.set(layer))
}

/** Walk the scene; for each tagged object decide its room once and set its whole subtree's layer. */
function apply(root: THREE.Object3D, visible: Set<string> | null) {
  const visit = (o: THREE.Object3D) => {
    const u = o.userData as Record<string, unknown>
    if (u && CULLED_KINDS.has(u.kind as string)) {
      const room = visible ? roomOf(u) : undefined
      setLayer(o, room && !visible!.has(room) ? HIDDEN_LAYER : 0)
      return
    }
    for (const c of o.children) visit(c)
  }
  visit(root)
}

/** Inert component: keeps the culling layers in sync with the walker, doors, items and mode. */
export default function RoomCulling() {
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const links = useMemo(() => roomLinks(planC), [])

  useEffect(() => {
    let key = ''
    let visible: Set<string> | null = null
    /** `rescan`: walk the scene even if the visible set is unchanged (new meshes, moved items). */
    const recompute = (rescan: boolean) => {
      const s = useStore.getState()
      if (s.mode !== 'walk') visible = null
      else {
        const from = roomsNear(planC, s.player.x, s.player.z)
        visible = from.length ? visibleRooms(links, from, (id) => isDoorOpen(s.doorsOpen, id)) : null
      }
      const k = visible ? [...visible].sort().join(',') : '*'
      if (k === key && !rescan) return
      apply(scene, visible)
      if (k !== key) {
        key = k
        markShadowsDirty() // hidden objects drop out of the shadow pass too
        invalidate()
      }
    }
    recompute(true)
    const unsub = useStore.subscribe((s, p) => {
      if (s.items !== p.items || s.points !== p.points || s.mode !== p.mode) recompute(true)
      else if (s.player !== p.player || s.doorsOpen !== p.doorsOpen) recompute(false)
    })
    const timer = window.setInterval(() => recompute(true), RESCAN_MS)
    return () => {
      unsub()
      window.clearInterval(timer)
      apply(scene, null)
    }
  }, [scene, links, invalidate])

  return null
}
