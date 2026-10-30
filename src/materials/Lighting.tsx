// OWNER: Materials & Lighting agent (A2). Stub.
import { Environment } from '@react-three/drei'

export default function Lighting() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[8, 12, -4]} intensity={2} castShadow />
      <Environment preset={undefined} files={undefined} background={false}>
        <mesh scale={50}>
          <sphereGeometry />
          <meshBasicMaterial color="#cfd8e0" side={2} />
        </mesh>
      </Environment>
    </>
  )
}
