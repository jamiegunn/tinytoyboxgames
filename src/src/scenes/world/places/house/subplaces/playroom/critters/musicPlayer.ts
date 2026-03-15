import { BoxGeometry, Color, CylinderGeometry, Mesh, Vector3, type DirectionalLight, type Scene } from 'three';
import { createPlasticMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';
import { createSparkleBurst } from '@app/utils/particles';
import { triggerSound, triggerMusic, triggerStopMusic } from '@app/assets/audio/sceneBridge';
import gsap from 'gsap';

/**
 * Creates an interactive toy music player with spinning disc.
 * @param scene - The Three.js scene to add the music player to
 * @param _keyLight - The directional light (unused)
 */
export function createMusicPlayer(scene: Scene, _keyLight: DirectionalLight): void {
  const body = new Mesh(new BoxGeometry(1.2, 0.5, 0.8), createPlasticMaterial('musicPlayerMat', new Color(0.9, 0.75, 0.5)));
  body.name = 'musicPlayer';
  body.position.set(1.5, 0.25, -7.0);
  body.castShadow = true;
  scene.add(body);

  const disc = new Mesh(new CylinderGeometry(0.3, 0.3, 0.04, 32), createPlasticMaterial('discMat', new Color(0.15, 0.15, 0.15)));
  disc.name = 'musicDisc';
  disc.position.y = 0.27;
  body.add(disc);

  const arm = new Mesh(new CylinderGeometry(0.015, 0.015, 0.35, 6), createToyMetalMaterial('armMat', new Color(0.7, 0.65, 0.55)));
  arm.name = 'tonearm';
  arm.position.set(0.3, 0.3, -0.1);
  arm.rotation.z = -0.4;
  arm.rotation.y = 0.3;
  body.add(arm);

  // Spin animation
  gsap.to(disc.rotation, {
    y: Math.PI * 2,
    duration: 10,
    repeat: -1,
    ease: 'none',
  });

  // Click interaction — toggles background music on/off
  let musicPlaying = false;
  body.userData.onClick = () => {
    triggerSound('sfx_hub_music_player_tap');
    musicPlaying = !musicPlaying;

    if (musicPlaying) {
      // Speed up disc and start music
      gsap.killTweensOf(disc.rotation);
      gsap.to(disc.rotation, {
        y: disc.rotation.y + Math.PI * 2,
        duration: 3,
        repeat: -1,
        ease: 'none',
      });
      triggerMusic('mus_hub_background');
    } else {
      // Slow down disc and stop music
      gsap.killTweensOf(disc.rotation);
      gsap.to(disc.rotation, {
        y: disc.rotation.y + Math.PI * 2,
        duration: 10,
        repeat: -1,
        ease: 'none',
      });
      triggerStopMusic();
    }

    createSparkleBurst(scene, new Vector3(body.position.x, body.position.y + 0.4, body.position.z));
    setTimeout(() => triggerSound('sfx_hub_music_player_tune'), 300);
  };
}
