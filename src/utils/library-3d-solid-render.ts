import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** Desktop contact AO is deliberately subtle; touch/mobile uses the direct renderer. */
export class LibrarySolidRender {
	private composer?: EffectComposer;
	private ao?: SSAOPass;
	private output?: OutputPass;
	private renderPass?: RenderPass;
	private environment: T.WebGLRenderTarget;
	constructor(
		private renderer: T.WebGLRenderer,
		private scene: T.Scene,
		private camera: T.PerspectiveCamera,
	) {
		const room = new RoomEnvironment();
		const generator = new T.PMREMGenerator(renderer);
		try {
			this.environment = generator.fromScene(room, 0.04);
		} finally {
			room.traverse((object) => {
				if (object instanceof T.InstancedMesh) object.dispose();
			});
			room.dispose();
			generator.dispose();
		}
		scene.environment = this.environment.texture;
		scene.environmentIntensity = 0.28;
	}
	resize(width: number, height: number, mobile: boolean): void {
		if (mobile && this.composer) this.disposePost();
		if (!mobile && !this.composer) {
			this.composer = new EffectComposer(this.renderer);
			this.renderPass = new RenderPass(this.scene, this.camera);
			this.ao = new SSAOPass(this.scene, this.camera, width, height, 12);
			this.ao.kernelRadius = 0.19;
			this.ao.minDistance = 0.001;
			this.ao.maxDistance = 0.025;
			// Mix AO towards white before its multiply blend, rather than darkening everything.
			this.ao.ssaoMaterial.fragmentShader =
				this.ao.ssaoMaterial.fragmentShader.replace(
					"gl_FragColor = vec4( vec3( 1.0 - occlusion ), 1.0 );",
					"gl_FragColor = vec4( vec3( 1.0 - occlusion * 0.25 ), 1.0 );",
				);
			this.output = new OutputPass();
			this.composer.addPass(this.renderPass);
			this.composer.addPass(this.ao);
			this.composer.addPass(this.output);
		}
		if (this.composer) {
			this.composer.setPixelRatio(Math.min(this.renderer.getPixelRatio(), 1.5));
			this.composer.setSize(width, height);
		}
	}
	render(): void {
		if (this.composer) this.composer.render();
		else this.renderer.render(this.scene, this.camera);
	}
	private disposePost(): void {
		// SSAOPass.dispose() omits its generated noise texture and SSAO material.
		this.ao?.noiseTexture?.dispose();
		this.ao?.ssaoMaterial.dispose();
		this.ao?.dispose();
		this.output?.dispose();
		this.renderPass?.dispose();
		this.composer?.dispose();
		this.ao = undefined;
		this.output = undefined;
		this.renderPass = undefined;
		this.composer = undefined;
	}
	dispose(): void {
		this.disposePost();
		this.scene.environment = null;
		this.environment.dispose();
	}
}
