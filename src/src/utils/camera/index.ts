/**
 * Camera system — public surface.
 *
 * See architecture-standards.md#cameradescriptor.
 */

export { createCamera, sphericalPosition, fovRadiansToDegrees, DEFAULT_GAME_CAMERA, CAMERA_NEAR, CAMERA_FAR } from './cameraDescriptor';
export type { CameraDescriptor, FixedCameraDescriptor, OrbitCameraDescriptor } from './cameraDescriptor';
