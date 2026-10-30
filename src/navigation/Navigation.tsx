// OWNER: Navigation agent (A3). Stub: orbit camera.
import { OrbitControls } from '@react-three/drei'

export default function Navigation() {
  return <OrbitControls target={[4, 0, 4.5]} makeDefault />
}
