import {
	FloatType,
	NearestFilter,
	Vector3,
	WebGLRendererEx,
	WebGLRenderTarget,
	Color,
	TextureLoader,
	SphereGeometry,
	MeshBasicMaterial,
	PerspectiveCamera,
	DataTexture,
	RGBAFormat,
	LinearFilter,
	AmbientLight,
	Scene,
	sRGBEncoding,
	DoubleSide,
	MeshStandardMaterial,
	Mesh,
	LinearEncoding,
	DataTextureLoader,
	FileLoader,
	Vector2,
	DirectionalLight
  } from './three/build/three.module.js';

import { SLMConstansts } from './SLMLoader.js';

import { RGBELoader } from '../lib/three/examples/jsm/loaders/RGBELoader.js';

const { ipcRenderer } = require('electron');

function ConsoleOutput(logString)
{
	ipcRenderer.send("debug", logString);
}

var SLMBaker = function(options)
{
	var scope = this;

	this.scene = (options && options.scene !== undefined) ? options.scene : null;

	this.el = (options && options.el !== undefined) ? options.el : null;

	this.DEBUG_OFFLINE_RT = false;

	this.DEBUG_OFFLINE_RT_BAKING = false;

	this.srcShadingMaterials = [];

	this.curProcess = 1;

	this.externalBakeConfig = options.bakeConfig;

	scope.config =
	{
		atlasWidth: 1024,
		atlasHeight: 512,

		mainLight:
		{
			enabled: true,
			direction: new Vector3(-0.5, 0.8, -0.7).normalize(),
			color: new Color(0xffffff),
			intensity: 3.0,
		},

		ambientLightIntensity: 1.0,
		ambientLightColor: new Vector3(1, 1, 1),

		aoIntensity: 3.0,

		aoRange: 3.0,

		indirectIntensity: 1.0,

		samplingRatio: 0.2,
	}

	function PreInitialize(options)
	{
		if (!scope.options)
		{
			scope.options = options;

			var normalMapFileUrl = scope.sceneName ? scope.sceneName.replace('.zip', '/atlas_0_norm.png') : 'assets/models/' + scope.options.id + '/atlas_0_norm.png';

			var normalMapLoader = new TextureLoader();
			normalMapLoader.load(normalMapFileUrl,
				function(texture)
				{
					scope.atlasAspect = texture.image.width / texture.image.height;

					Initialize(options);
				}
			)
		}
	}

	function Initialize(options)
	{
		SLMConstansts.SceneLayerMaskBaking = 29;

		scope.pmjSamplingRatio = 0.3;

		scope.bakingFOV = 90;

		scope.maxOfflineBufferSize = 32;

		options.bakeConfig = scope.externalBakeConfig;

		if(options.bakeConfig)
		{
			if (options.bakeConfig.samplingRatio != undefined)
			{
				scope.pmjSamplingRatio = options.bakeConfig.samplingRatio;
			}

			if (options.bakeConfig.atlasSize != undefined)
			{
				scope.config.atlasSize = options.bakeConfig.atlasSize;
			}

			if (options.bakeConfig.atlasWidth != undefined)
			{
				scope.config.atlasWidth = options.bakeConfig.atlasWidth;
			}

			if (options.bakeConfig.atlasHeight != undefined)
			{
				scope.config.atlasHeight = options.bakeConfig.atlasHeight;
			}

			if (options.bakeConfig.mainLight != undefined && options.bakeConfig.mainLight.enabled != undefined)
			{
				scope.config.mainLight.enabled = options.bakeConfig.mainLight.enabled;
			}

			if (options.bakeConfig.mainLight != undefined && options.bakeConfig.mainLight.intensity != undefined)
			{
				scope.config.mainLight.intensity = options.bakeConfig.mainLight.intensity;
			}

			if (options.bakeConfig.mainLight != undefined && options.bakeConfig.mainLight.direction != undefined)
			{
				scope.config.mainLight.direction =  new Vector3(options.bakeConfig.mainLight.direction[0],options.bakeConfig.mainLight.direction[1],options.bakeConfig.mainLight.direction[2]).normalize();
			}

			if (options.bakeConfig.mainLight != undefined && options.bakeConfig.mainLight.color != undefined)
			{
				scope.config.mainLight.color =  new Color(options.bakeConfig.mainLight.color[0],options.bakeConfig.mainLight.color[1],options.bakeConfig.mainLight.color[2]);
			}

			if (options.bakeConfig.ambientLightIntensity != undefined)
			{
				scope.config.ambientLightIntensity =  options.bakeConfig.ambientLightIntensity;
			}

			if (options.bakeConfig.ambientLightColor != undefined)
			{
				scope.config.ambientLightColor = new Color(options.bakeConfig.ambientLightColor[0], options.bakeConfig.ambientLightColor[1], options.bakeConfig.ambientLightColor[2]);
			}

			if (options.bakeConfig.aoIntensity != undefined)
			{
				scope.config.aoIntensity =  options.bakeConfig.aoIntensity;
			}

			if (options.bakeConfig.aoRange != undefined)
			{
				scope.config.aoRange =  options.bakeConfig.aoRange;
			}

			if (options.bakeConfig.indirectIntensity != undefined)
			{
				scope.config.indirectIntensity =  options.bakeConfig.indirectIntensity;
			}
		}

		var maxAtlasSize = scope.config.atlasSize ? scope.config.atlasSize : Math.max(scope.config.atlasWidth, scope.config.atlasHeight);
		scope.offlineWidth = scope.atlasAspect > 1 ? maxAtlasSize : Math.round(scope.atlasAspect * maxAtlasSize);
		scope.offlineHeight = scope.atlasAspect > 1 ? Math.round(maxAtlasSize / scope.atlasAspect) : maxAtlasSize;

		console.log('atlas size: ' + scope.offlineWidth + ", " + scope.offlineHeight);

		scope.positionRenderer = new WebGLRendererEx();
		scope.positionRenderer.setPixelRatio(window.devicePixelRatio);
		scope.positionRenderer.setSize(scope.offlineWidth, scope.offlineHeight);
		scope.positionRenderer.setClearColor(0x0000000);
		scope.positionRenderer.setClearAlpha(0);
		scope.positionRenderer.autoClear = false;

		// DEBUG
		if (scope.DEBUG_OFFLINE_RT)
		{
			scope.positionRenderer.domElement.style.position = "absolute";
			scope.positionRenderer.domElement.style.bottom = "0px";
			scope.positionRenderer.domElement.style.left = "0px";
		}
		else
		{
			scope.positionRenderer.domElement.style.display = 'none';
		}

		scope.el.appendChild(scope.positionRenderer.domElement);

		scope.normalRenderer = new WebGLRendererEx();
		scope.normalRenderer.setPixelRatio(window.devicePixelRatio);
		scope.normalRenderer.setSize(scope.offlineWidth, scope.offlineHeight);
		scope.normalRenderer.setClearColor(0x0000000);
		scope.normalRenderer.setClearAlpha(0);
		scope.normalRenderer.autoClear = false;

		// DEBUG
		if (scope.DEBUG_OFFLINE_RT)
		{
			scope.normalRenderer.domElement.style.position = "absolute";
			scope.normalRenderer.domElement.style.bottom = "0px";
			scope.normalRenderer.domElement.style.right = "0px";
		}
		else
		{
			scope.normalRenderer.domElement.style.display = 'none';
		}

		scope.el.appendChild(scope.normalRenderer.domElement);

		scope.positionRenderTarget = new WebGLRenderTarget(scope.offlineWidth, scope.offlineHeight, {type: FloatType});
		scope.positionRenderTarget.texture.generateMipmaps = false;
		scope.positionRenderTarget.texture.minFilter = NearestFilter;
		scope.positionRenderTarget.texture.magFilter = NearestFilter;
		scope.positionRenderTarget.stencilBuffer = false;

		scope.normalRenderTarget = new WebGLRenderTarget(scope.offlineWidth, scope.offlineHeight, {type: FloatType});
		scope.normalRenderTarget.texture.generateMipmaps = false;
		scope.normalRenderTarget.texture.minFilter = NearestFilter;
		scope.normalRenderTarget.texture.magFilter = NearestFilter;
		scope.normalRenderTarget.stencilBuffer = false;

		scope.positionPixelBuffer = new Float32Array(4 * scope.offlineWidth * scope.offlineHeight);
		scope.normalPixelBuffer = new Float32Array(4 * scope.offlineWidth * scope.offlineHeight);

		scope.bakingBufferWidth = scope.maxOfflineBufferSize;
		scope.bakingBufferHeight = scope.maxOfflineBufferSize;
		scope.bakingCamera = new PerspectiveCamera(scope.bakingFOV, scope.bakingBufferWidth / scope.bakingBufferHeight, 0.01, 7000);

		scope.bakingRenderer = new WebGLRendererEx();
		//scope.bakingRenderer.physicallyCorrectLights = true;
		//scope.bakingRenderer.outputEncoding = sRGBEncoding;
		scope.bakingRenderer.setPixelRatio(window.devicePixelRatio);
		scope.bakingRenderer.setSize(scope.bakingBufferWidth, scope.bakingBufferHeight);
		scope.bakingRenderer.setClearColor(new Color(0, 0, 0));
		scope.bakingRenderer.setClearAlpha(0.0);//scope.config.skybox.alpha);
		scope.bakingRenderer.autoClear = false;

		// DEBUG
		if (scope.DEBUG_OFFLINE_RT_BAKING)
		{
			scope.bakingRenderer.domElement.style.position = "absolute";
			scope.bakingRenderer.domElement.style.bottom = "0px";
			scope.bakingRenderer.domElement.style.left = "256px";
		}
		else
		{
			scope.bakingRenderer.domElement.style.display = 'none';
		}

		scope.el.appendChild(scope.bakingRenderer.domElement);

		scope.bakingRenderTarget = new WebGLRenderTarget(scope.bakingBufferWidth, scope.bakingBufferHeight);
		scope.bakingRenderTarget.texture.generateMipmaps = false;
		scope.bakingRenderTarget.texture.minFilter = NearestFilter;
		scope.bakingRenderTarget.texture.magFilter = NearestFilter;
		scope.bakingRenderTarget.stencilBuffer = false;

		scope.bakingPixelBuffer = new Uint8Array(4 * scope.bakingBufferWidth * scope.bakingBufferHeight);

		scope.cosineweightRenderTarget = new WebGLRenderTarget(scope.bakingBufferWidth, scope.bakingBufferHeight);
		scope.cosineweightRenderTarget.texture.generateMipmaps = false;
		scope.cosineweightRenderTarget.texture.minFilter = NearestFilter;
		scope.cosineweightRenderTarget.texture.magFilter = NearestFilter;
		scope.cosineweightRenderTarget.stencilBuffer = false;

		scope.cosineweightPixelBuffer = new Uint8Array(4 * scope.bakingBufferWidth * scope.bakingBufferHeight);

		scope.cosineWeights = new Float32Array(scope.bakingBufferWidth * scope.bakingBufferHeight);
	}

	function SetupBakedmapTexture()
	{
		const size = scope.offlineWidth * scope.offlineHeight;
		scope.bakedmapBuffer = new Float32Array(4 * size);

		for ( let i = 0; i < size; i ++ )
		{
			const stride = i * 4;

			scope.bakedmapBuffer[stride + 0] = 0;
			scope.bakedmapBuffer[stride + 1] = 0;
			scope.bakedmapBuffer[stride + 2] = 0;
			scope.bakedmapBuffer[stride + 3] = 0;
		}

		// used the buffer to create a DataTexture
		scope.bakedmapTexture = new DataTexture(scope.bakedmapBuffer, scope.offlineWidth, scope.offlineHeight, RGBAFormat, FloatType);
		scope.bakedmapTexture.flipY = true;
	}

	function DiffuseBuffer(srcBuffer, dstBuffer, width, height, refBuffer)
	{
		for (var i = 0; i < height; ++i)
		{
			for (var j = 0; j < width; ++j)
			{
				var offset = i * width + j;

				if (refBuffer)
				{
					var refValue = refBuffer[offset * 4 + 3];

					if (refValue != 0)
					{
						continue;
					}
				}

				var c = [srcBuffer[offset * 4 + 0], srcBuffer[offset * 4 + 1], srcBuffer[offset * 4 + 2], srcBuffer[offset * 4 + 3]];

				if (c[3] > 0.0)
				{
					dstBuffer[offset * 4 + 0] = srcBuffer[offset * 4 + 0];
					dstBuffer[offset * 4 + 1] = srcBuffer[offset * 4 + 1];
					dstBuffer[offset * 4 + 2] = srcBuffer[offset * 4 + 2];
					dstBuffer[offset * 4 + 3] = srcBuffer[offset * 4 + 3];

					continue;
				}

				var neighborOffsets =
				[
					i * width + Math.min(width - 1, j + 1),
					Math.min(height - 1, i + 1) * width + j,
					i* width + Math.max(0, j - 1),
					Math.max(0, i - 1) * width + j,
				];

				var neighborColors =
				[
					[srcBuffer[neighborOffsets[0] * 4 + 0], srcBuffer[neighborOffsets[0] * 4 + 1], srcBuffer[neighborOffsets[0] * 4 + 2], srcBuffer[neighborOffsets[0] * 4 + 3]],
					[srcBuffer[neighborOffsets[1] * 4 + 0], srcBuffer[neighborOffsets[1] * 4 + 1], srcBuffer[neighborOffsets[1] * 4 + 2], srcBuffer[neighborOffsets[1] * 4 + 3]],
					[srcBuffer[neighborOffsets[2] * 4 + 0], srcBuffer[neighborOffsets[2] * 4 + 1], srcBuffer[neighborOffsets[2] * 4 + 2], srcBuffer[neighborOffsets[2] * 4 + 3]],
					[srcBuffer[neighborOffsets[3] * 4 + 0], srcBuffer[neighborOffsets[3] * 4 + 1], srcBuffer[neighborOffsets[3] * 4 + 2], srcBuffer[neighborOffsets[3] * 4 + 3]],
				];

				var neighborAlphas =
				[
					Math.ceil(neighborColors[0][3]),
					Math.ceil(neighborColors[1][3]),
					Math.ceil(neighborColors[2][3]),
					Math.ceil(neighborColors[3][3])
				];

				var sumAlpha = neighborAlphas[0] + neighborAlphas[1] + neighborAlphas[2] + neighborAlphas[3];

				if (sumAlpha <= 0.0)
				{
					dstBuffer[offset * 4 + 0] = srcBuffer[offset * 4 + 0];
					dstBuffer[offset * 4 + 1] = srcBuffer[offset * 4 + 1];
					dstBuffer[offset * 4 + 2] = srcBuffer[offset * 4 + 2];
					dstBuffer[offset * 4 + 3] = srcBuffer[offset * 4 + 3];

					continue;
				}

				var finalColor =
				[
					(neighborAlphas[0] * neighborColors[0][0] + neighborAlphas[1] * neighborColors[1][0] + neighborAlphas[2] * neighborColors[2][0] + neighborAlphas[3] * neighborColors[3][0]) / sumAlpha,
					(neighborAlphas[0] * neighborColors[0][1] + neighborAlphas[1] * neighborColors[1][1] + neighborAlphas[2] * neighborColors[2][1] + neighborAlphas[3] * neighborColors[3][1]) / sumAlpha,
					(neighborAlphas[0] * neighborColors[0][2] + neighborAlphas[1] * neighborColors[1][2] + neighborAlphas[2] * neighborColors[2][2] + neighborAlphas[3] * neighborColors[3][2]) / sumAlpha,
					1.0
				];

				dstBuffer[offset * 4 + 0] = finalColor[0];
				dstBuffer[offset * 4 + 1] = finalColor[1];
				dstBuffer[offset * 4 + 2] = finalColor[2];
				dstBuffer[offset * 4 + 3] = finalColor[3];
			}
		}
	}

	function DiffusePixelBuffer(srcBuffer, refBuffer)
	{
		const size = scope.offlineWidth * scope.offlineHeight;
		var mBuffers = [srcBuffer, new Float32Array(4 * size)];

		var width = scope.offlineWidth, height = scope.offlineHeight;

		for (var i = 0; i < height; ++i)
		{
			for (var j = 0; j < width; ++j)
			{
				var offset = i * width + j;

				mBuffers[1][offset * 4 + 0] = mBuffers[0][offset * 4 + 0];
				mBuffers[1][offset * 4 + 1] = mBuffers[0][offset * 4 + 1];
				mBuffers[1][offset * 4 + 2] = mBuffers[0][offset * 4 + 2];
				mBuffers[1][offset * 4 + 3] = mBuffers[0][offset * 4 + 3];
			}
		}

		var iteTimes = 3;
		for (var iteIdx = 0; iteIdx < iteTimes; ++iteIdx)
		{
			if (iteIdx % 2 == 0)
			{
				DiffuseBuffer(mBuffers[0], mBuffers[1], width, height, refBuffer);
			}
			else
			{
				DiffuseBuffer(mBuffers[1], mBuffers[0], width, height, refBuffer);
			}
		}

		srcBuffer = mBuffers[iteTimes % 2];
	}

	function ProgressiveUpdateBakedmap()
	{
		scope.bakedmapTexture.magFilter = LinearFilter;
		scope.bakedmapTexture.minFilter = LinearFilter;

		scope.bakedmapTexture.needsUpdate = true;
	}

	function UpdateBakedmapTexture()
	{
		if (scope.useRandomSampling)
		{
			NeutralizeNoise();
		}
		else
		{
			DiffusePixelBuffer(scope.bakedmapBuffer);
		}

		scope.bakedmapTexture.magFilter = LinearFilter;
		scope.bakedmapTexture.minFilter = LinearFilter;

		scope.bakedmapTexture.needsUpdate = true;
	}

	function NeutralizeNoise()
	{
		var neutralizeRatio = 1.0 / scope.pmjSamplingRatio * 1.2;

		var srcIndex = 0;
		for (var curPixelNum = 0; curPixelNum < scope.offlineWidth * scope.offlineHeight;  curPixelNum++)
		{
			scope.bakedmapBuffer[srcIndex + 0] = scope.bakedmapBuffer[srcIndex + 0] * neutralizeRatio;
			scope.bakedmapBuffer[srcIndex + 1] = scope.bakedmapBuffer[srcIndex + 1] * neutralizeRatio;
			scope.bakedmapBuffer[srcIndex + 2] = scope.bakedmapBuffer[srcIndex + 2] * neutralizeRatio;

			srcIndex += 4;
		}
	}

	function BeginBaking()
	{
		for (var i = 0; i < scope.srcShadingMaterials.length; ++i)
		{
			//console.log(scope.srcShadingMaterials[i].userData);

			if (scope.srcShadingMaterials[i].userData.lightMap)
			{
				scope.srcShadingMaterials[i].userData.lightMap.value = scope.bakedmapTexture;
			}
			else if (scope.srcShadingMaterials[i].lightMap)
			{
				scope.srcShadingMaterials[i].lightMap = scope.bakedmapTexture;
				scope.srcShadingMaterials[i].lightMap.encoding = LinearEncoding;
				scope.srcShadingMaterials[i].lightMap.needsUpdate = true;
			}

		}

		SwitchBakeingMaterial();
	}

	function SwitchBakeingMaterial()
	{
		// var shadingState = new Vector3(0.0, 1.0);

		// for (var i = 0; i < scope.srcShadingMaterials.length; ++i)
		// {
		// 	scope.srcShadingMaterials[i].userData.shadingState.value = shadingState;
		// }
	}


	function FinishBaking()
	{
		console.log('finish baking: ' + scope.bakingIteIndex);

		UpdateBakedmapTexture();
	}

	function SaveStringToFile(filename, text) {
		var pom = document.createElement('a');
		pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
		pom.setAttribute('download', filename);

		if (document.createEvent) {
			var event = document.createEvent('MouseEvents');
			event.initEvent('click', true, true);
			pom.dispatchEvent(event);
		}
		else {
			pom.click();
		}
	}

	function SaveBakedmapToBin(fileName)
	{
		var binDataString = '';
		binDataString += scope.offlineWidth + '\n';
		binDataString += scope.offlineHeight + '\n';

		var commponents = 3;
		binDataString += commponents + '\n';

		var srcIndex = 0;
		for (var curPixelNum = 0; curPixelNum < scope.offlineWidth * scope.offlineHeight;  curPixelNum++)
		{
			binDataString += scope.bakedmapBuffer[srcIndex + 0] + '\n';
			binDataString += scope.bakedmapBuffer[srcIndex + 1] + '\n';
			binDataString += scope.bakedmapBuffer[srcIndex + 2] + '\n';

			srcIndex += 4;
		}

		//SaveStringToFile(fileName, binDataString);
		ipcRenderer.send('saveBin', binDataString);
	}

	function ScaleBakedmapPixelColor(x, y, scalar)
	{
		var bufferPixelOffset = (x * scope.offlineHeight + y) * 4;

		scope.bakedmapBuffer[bufferPixelOffset + 0] = scope.bakedmapBuffer[bufferPixelOffset + 0] * scalar;
		scope.bakedmapBuffer[bufferPixelOffset + 1] = scope.bakedmapBuffer[bufferPixelOffset + 1] * scalar;
		scope.bakedmapBuffer[bufferPixelOffset + 2] = scope.bakedmapBuffer[bufferPixelOffset + 2] * scalar;
	}

	function AccumBakedmapPixelColor(x, y, color, isAccumulated)
	{
		var bufferPixelOffset = (x * scope.offlineHeight + y) * 4;

		if (isAccumulated)
		{
			scope.bakedmapBuffer[bufferPixelOffset + 0] = scope.bakedmapBuffer[bufferPixelOffset + 0] + color.x;
			scope.bakedmapBuffer[bufferPixelOffset + 1] = scope.bakedmapBuffer[bufferPixelOffset + 1] + color.y;
			scope.bakedmapBuffer[bufferPixelOffset + 2] = scope.bakedmapBuffer[bufferPixelOffset + 2] + color.z;
			scope.bakedmapBuffer[bufferPixelOffset + 3] = 1.0;
		}
		else
		{
			scope.bakedmapBuffer[bufferPixelOffset + 0] = color.x;
			scope.bakedmapBuffer[bufferPixelOffset + 1] = color.y;
			scope.bakedmapBuffer[bufferPixelOffset + 2] = color.z;
			scope.bakedmapBuffer[bufferPixelOffset + 3] = 1.0;
		}
	}

	this.SetupInstancedShaderForBaking = function(srcMaterial, options)
	{
		//scope.options = options;

		PreInitialize(options);

		scope.instancedShadingMaterial = srcMaterial.clone();

		var colorParsChunk = [
			'varying vec2 vLightingTexcoord;',
			'attribute vec4 instanceTexcoord;',
			'varying vec4 vInstanceTexcoord;',
			'#include <common>'
		].join( '\n' );

		var uv2TransformChunk = [
			'#include <fog_vertex>',
			'float signFlag = sign(vInstanceTexcoord.z) * 0.5 + 0.5, atlasAspect = abs(vInstanceTexcoord.z), heightAspect = fract(vInstanceTexcoord.w);',
			'vUv2 = vec2(vInstanceTexcoord.x + vLightingTexcoord.x * signFlag + (1.0 - signFlag) * (heightAspect - vLightingTexcoord.y * atlasAspect) , vInstanceTexcoord.y + vLightingTexcoord.y * signFlag + (1.0 - signFlag) * (vLightingTexcoord.x / atlasAspect));',
			'vUv2 = vec2(vUv2.x, 1.0 - vUv2.y);',
		].join('\n');

		var instanceColorChunk = [
			'#include <begin_vertex>',
			'vLightingTexcoord = uv2.xy;',
			'vInstanceTexcoord = instanceTexcoord;',
		].join( '\n' );

		var fragmentParsChunk = [
			'varying vec2 vLightingTexcoord;',
			'varying vec4 vInstanceTexcoord;',
			'#include <common>',
		].join( '\n' );

		var fragColorChunk = [
			'gl_FragColor = vec4(outgoingLight, diffuseColor.a );',
		].join( '\n' );

		srcMaterial.lightMap = new DataTexture();

		//srcMaterial.lightMapIntensity = 0.5;

		srcMaterial.onBeforeCompile = function ( shader )
		{
			shader.vertexShader = shader.vertexShader
				.replace( '#include <common>', colorParsChunk )
				.replace( '#include <begin_vertex>', instanceColorChunk )
				.replace( '#include <fog_vertex>', uv2TransformChunk );

			shader.fragmentShader = shader.fragmentShader
				.replace( '#include <common>', fragmentParsChunk )
				.replace( 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );', fragColorChunk );
		};

		scope.srcShadingMaterials.push(srcMaterial);

		setTimeout(function()
		{
			scope.isShaderCompiled = true;
		}, 1000);
	}

	this.SetupSceneInfo = function(sceneName)
	{
		scope.sceneName = sceneName;
	}

	this.SetupMaterials = function()
	{
		console.log(scope.options);

		if (scope.options.lighting && scope.options.id != null)
		{
			scope.isNormalPrepared = false;

			var loadNormal = true;

			if (loadNormal)
			{
				var lmFileUrl = scope.sceneName ? scope.sceneName.replace('.zip', '/atlas_0_norm.png') : 'assets/models/' + scope.options.id + '/atlas_0_norm.png';

				var lightMapLoader = new TextureLoader();
				lightMapLoader.load(lmFileUrl,
					function(texture)
					{
						texture.flipY = true;
						texture.minFilter = NearestFilter;
						texture.magFilter = NearestFilter;

						scope.normalAtlas = texture;

						for (var i = 0; i < scope.srcShadingMaterials.length; ++i)
						{
							scope.srcShadingMaterials[i].lightMap = texture;
						}

						scope.isNormalPrepared = true;
					}
				)
			}
			else
			{
				var lmFileUrl = 'assets/models/' + scope.options.id + '/output.hdr';
				var hdrLoader = new RGBELoader( this.options.manager);
				hdrLoader.setDataType( FloatType );

				hdrLoader.load(lmFileUrl,
					function(texture)
					{
						for (var i = 0; i < scope.srcShadingMaterials.length; ++i)
						{
							scope.srcShadingMaterials[i].lightMap = texture;
						}
					}
				)
			}
		}
	}

	function RenderPositionToRT(orthographicCamera)
	{
		if (!scope.positionOverrideMaterial)
		scope.positionOverrideMaterial = scope.instancedShadingMaterial.clone();

		// Must call! Different render context need to recomple materials shader
		if (scope.positionOverrideMaterial)
		{
			var colorParsChunk = [
				'attribute vec2 uv2;',
				'varying vec2 vLightingTexcoord;',
				'attribute vec4 instanceTexcoord;',
				'varying vec4 vInstanceTexcoord;',
				'varying vec4 worldPosition;',
				'#include <common>'
			].join( '\n' );

			var instanceColorChunk = [
				'#include <begin_vertex>',
				'vLightingTexcoord = uv2.xy;',
				'vInstanceTexcoord = instanceTexcoord;',
			].join( '\n' );

			var unwrapVertexChunk = [

				'#include <clipping_planes_vertex>',
				'#include <fog_vertex>',
				'worldPosition = (modelMatrix * instanceMatrix) * vec4(position, 1.0);',
				'float signFlag = sign(vInstanceTexcoord.z) * 0.5 + 0.5, atlasAspect = abs(vInstanceTexcoord.z), heightAspect = fract(vInstanceTexcoord.w);',
				'vec2 texCoord = vec2(vInstanceTexcoord.x + vLightingTexcoord.x * signFlag + (1.0 - signFlag) * (heightAspect - vLightingTexcoord.y * atlasAspect) , vInstanceTexcoord.y + vLightingTexcoord.y * signFlag + (1.0 - signFlag) * (vLightingTexcoord.x / atlasAspect));',
				'gl_Position = vec4((texCoord.xy * 2.0 - 1.0), 0.0, 1.0);',
			].join( '\n' );

			var fragmentParsChunk = [
				'varying vec4 worldPosition;',
				'#include <common>',
			].join( '\n' );

			var fragColorChunk = [
				'gl_FragColor = vec4(worldPosition.xyz, 1.0);',
			].join( '\n' );

			scope.positionOverrideMaterial.side = DoubleSide;
			scope.positionOverrideMaterial.flatShading = true;
			scope.positionOverrideMaterial.needsUpdate = true;

			scope.positionOverrideMaterial.onBeforeCompile = function ( shader )
			{
				shader.vertexShader = shader.vertexShader
				.replace( '#include <common>', colorParsChunk)
				.replace( '#include <begin_vertex>', instanceColorChunk)
				.replace( '#include <fog_vertex>', unwrapVertexChunk);

				shader.fragmentShader = shader.fragmentShader
				.replace( '#include <common>', fragmentParsChunk )
				.replace( 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );', fragColorChunk);
			};
		}

		scope.scene.overrideMaterial = scope.positionOverrideMaterial;

		if (scope.DEBUG_OFFLINE_RT)
		{
			scope.positionRenderer.setRenderTarget(null);
		}
		else
		{
			scope.positionRenderer.setRenderTarget(scope.positionRenderTarget);
		}

		scope.positionRenderer.clear();
		scope.positionRenderer.clearDepth();

		scope.positionRenderer.render( scope.scene, orthographicCamera);
		scope.scene.overrideMaterial = null;
	}

	function RenderNormalToRT(orthographicCamera)
	{
		if (!scope.normalOverrideMaterial)
		scope.normalOverrideMaterial = new MeshStandardMaterial({flatShading: true});

		// Must call! Different render context need to recomple materials shader
		if (scope.normalOverrideMaterial)
		{
			///*
			var colorParsChunk = [
				'varying vec2 vLightingTexcoord;',
				'attribute vec4 instanceTexcoord;',
				'varying vec4 vInstanceTexcoord;',
				'#include <common>'
			].join( '\n' );

			var instanceColorChunk = [
				'#include <begin_vertex>',
				'vLightingTexcoord = uv2.xy;',
				'vInstanceTexcoord = instanceTexcoord;',
			].join( '\n' );

			var unwrapVertexChunk = [
				'#include <clipping_planes_vertex>',
				'#include <fog_vertex>',
				'float signFlag = sign(vInstanceTexcoord.z) * 0.5 + 0.5, atlasAspect = abs(vInstanceTexcoord.z), heightAspect = fract(vInstanceTexcoord.w);',
				'vec2 texCoord = vec2(vInstanceTexcoord.x + vLightingTexcoord.x * signFlag + (1.0 - signFlag) * (heightAspect - vLightingTexcoord.y * atlasAspect) , vInstanceTexcoord.y + vLightingTexcoord.y * signFlag + (1.0 - signFlag) * (vLightingTexcoord.x / atlasAspect));',
				'vLightingTexcoord = (texCoord.xy);',
				'gl_Position = vec4((texCoord.xy * 2.0 - 1.0), 0.0, 1.0);',
			].join( '\n' );

			var fragmentParsChunk = [
				'#include <common>',
				'varying vec2 vLightingTexcoord;',
				'uniform sampler2D normalTexture;'
			].join( '\n' );

			var fragColorChunk = [
				'vec3 bakedNormal = texture2D(normalTexture, vec2(vLightingTexcoord.x, 1.0 - vLightingTexcoord.y)).rgb * 2.0 - 1.0;',
				'gl_FragColor = vec4(-bakedNormal.x, bakedNormal.y, -bakedNormal.z, 1.0);', // Left to Right hand coordinate change
			].join( '\n' );

			scope.normalOverrideMaterial.lightMap = scope.normalAtlas;

			scope.normalOverrideMaterial.side = DoubleSide;
			scope.normalOverrideMaterial.flatShading = true;
			scope.normalOverrideMaterial.needsUpdate = true;

			scope.normalOverrideMaterial.onBeforeCompile = function ( shader )
			{
				shader.vertexShader = shader.vertexShader
				.replace( '#include <common>', colorParsChunk)
				.replace( '#include <begin_vertex>', instanceColorChunk)
				.replace( '#include <fog_vertex>', unwrapVertexChunk);

				shader.fragmentShader = shader.fragmentShader
				.replace( '#include <common>', fragmentParsChunk )
				.replace( 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );', fragColorChunk);

				shader.uniforms.normalTexture = scope.normalOverrideMaterial.userData.normalTexture;
			};
			//*/
		}

		scope.normalOverrideMaterial.userData =
		{
			normalTexture : {type: 't', value: scope.normalAtlas}
		};

		scope.scene.overrideMaterial = scope.normalOverrideMaterial;

		if (scope.DEBUG_OFFLINE_RT)
		{
			scope.normalRenderer.setRenderTarget(null);
		}
		else
		{
			scope.normalRenderer.setRenderTarget(scope.normalRenderTarget);
		}

		scope.normalRenderer.clear();
		scope.normalRenderer.clearDepth();

		scope.normalRenderer.render( scope.scene, orthographicCamera);

		scope.scene.overrideMaterial = null;
	}

	function RenderCosweightToRt(bakingCamera)
	{
		scope.cosineweightScene = new Scene();

		var geometry = new SphereGeometry(1, 32, 16);
		var material = new MeshStandardMaterial({color: 0xffffff, side: DoubleSide});
		var sphereMesh = new Mesh(geometry, material);
		scope.cosineweightScene.add(sphereMesh);

		var colorParsChunk = [
			'varying vec3 worldNormal;',
			'#include <common>'
		].join( '\n' );

		var unwrapVertexChunk = [
			'#include <clipping_planes_vertex>',
			'worldNormal = inverseTransformDirection(transformedNormal, viewMatrix);',
		].join( '\n' );

		var fragmentParsChunk = [
			'varying vec3 worldNormal;',
			'#include <common>',
		].join( '\n' );

		var fragColorChunk = [
			'float dotValue = dot(worldNormal, vec3(0.0, 1.0, 0.0));',
			'gl_FragColor = vec4(dotValue, dotValue, dotValue, dotValue);',
		].join( '\n' );

		material.onBeforeCompile = function ( shader )
		{
			shader.vertexShader = shader.vertexShader
			.replace( '#include <common>', colorParsChunk)
			.replace( '#include <fog_vertex>', unwrapVertexChunk);

			shader.fragmentShader = shader.fragmentShader
			.replace( '#include <common>', fragmentParsChunk )
			.replace( 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );', fragColorChunk);
		};

		scope.scene.overrideMaterial = null;

		if (scope.DEBUG_OFFLINE_RT_BAKING)
		{
			scope.bakingRenderer.setRenderTarget(null);
		}
		else
		{
			scope.bakingRenderer.setRenderTarget(scope.cosineweightRenderTarget);
		}

		scope.bakingRenderer.clear();
		scope.bakingRenderer.clearDepth();

		scope.bakingRenderer.render(scope.cosineweightScene, bakingCamera);

		bakingCamera.layers.enableAll();
	}

	function RenderLightToRT(bakingCamera)
	{
		scope.scene.overrideMaterial = null;

		//bakingCamera.layers.set(SLMConstansts.SceneLayerMask | SLMConstansts.SceneLayerMaskBaking);

		//bakingCamera.layers.set(SLMConstansts.SceneLayerMask);// | SLMConstansts.SceneLayerMaskBaking);

		if (scope.DEBUG_OFFLINE_RT_BAKING)
		{
			scope.bakingRenderer.setRenderTarget(null);
		}
		else
		{
			scope.bakingRenderer.setRenderTarget(scope.bakingRenderTarget);
		}

		scope.bakingRenderer.clear();
		scope.bakingRenderer.clearDepth();

		scope.bakingRenderer.render(scope.scene, bakingCamera);

		bakingCamera.layers.enableAll();
	}

	function BakeAtlasPixel(atlasPixelX, atlasPixelY, worldPosition, worldNormal)
	{
		var DEBUG_SAMPLING_POINT = false;
		if (DEBUG_SAMPLING_POINT)
		{
			//if (!scope.deubgSphere0)
			{
				const geometry = new SphereGeometry(0.2, 32, 16);
				const material = new MeshBasicMaterial({color: 0xffff00});
				scope.deubgSphere0 = new Mesh(geometry, material);
				scope.debugScene.add(scope.deubgSphere0);
			}

			//if (!scope.deubgSphere1)
			{
				const geometry1 = new SphereGeometry(0.2, 32, 16);
				const material1 = new MeshBasicMaterial({color: 0x0000ff });
				scope.deubgSphere1 = new Mesh(geometry1, material1);
			}

			scope.deubgSphere0.position.copy(worldPosition);
			scope.deubgSphere1.position.copy(new Vector3().addVectors(worldPosition, worldNormal));
		}

		{
			if (scope.bakingIteIndex == 0)
			{
				var ambientLightIntensity = scope.config.ambientLightIntensity;
				var ambientLightColor = new Vector3(scope.config.ambientLightColor.r, scope.config.ambientLightColor.g, scope.config.ambientLightColor.b);

				var aoIntensity = scope.config.aoIntensity;

				var indirectIntensity = scope.config.indirectIntensity;

				var directLightColor = new Vector3(scope.config.mainLight.color.r, scope.config.mainLight.color.g, scope.config.mainLight.color.b);
				var directLightIntensity = scope.config.mainLight.intensity;

				var minDirectIntensity = 0.1;

				var isDirectLightEnabled = scope.config.mainLight.enabled;

				var isIndirectLightEnabled = true;

				// Direct lighting shading
				if (isDirectLightEnabled)
				{
					var directIntensity = 0.0;

					if (worldNormal.dot(scope.config.mainLight.direction) > 0.01) // Only check viewed face
					{
						scope.bakingCamera.position.copy(worldPosition);
						scope.bakingCamera.lookAt(new Vector3().addVectors(worldPosition, scope.config.mainLight.direction));
						scope.bakingCamera.fov = 3;
						scope.bakingCamera.updateProjectionMatrix();

						RenderLightToRT(scope.bakingCamera);

						// Read baking pixels
						scope.bakingRenderer.readRenderTargetPixels(scope.bakingRenderTarget, 0, 0, scope.bakingBufferWidth, scope.bakingBufferHeight, scope.bakingPixelBuffer);

						var bakingBufferSize = scope.bakingBufferWidth * scope.bakingBufferHeight;
						var lightAccum = 0;
						for (var i = 0 ; i < bakingBufferSize; ++i)
						{
							if (scope.bakingPixelBuffer[i * 4 + 3] == 0)
							{
								lightAccum++;
							}
						}

						directIntensity = lightAccum / bakingBufferSize;
					}

					// Adjust to three.js color space
					directIntensity *= 0.83;

					var lightColor = new Vector3(
						directLightColor.x * directIntensity * directLightIntensity,
						directLightColor.y * directIntensity * directLightIntensity,
						directLightColor.z * directIntensity * directLightIntensity);

					AccumBakedmapPixelColor(atlasPixelX, atlasPixelY, lightColor, true);

					ScaleBakedmapPixelColor(atlasPixelX, atlasPixelY, Math.max(minDirectIntensity, directIntensity));

					// Ambient enhancement
					var ambientColor = new Vector3(
						(ambientLightColor.x * ambientLightIntensity) ,
						(ambientLightColor.y * ambientLightIntensity) ,
						(ambientLightColor.z * ambientLightIntensity));

					AccumBakedmapPixelColor(atlasPixelX, atlasPixelY, ambientColor, true);
				}

				// Indirect light shading
				if (isIndirectLightEnabled)
				{
					var bakingCameraFar = scope.bakingCamera.far;
					scope.bakingCamera.position.copy(worldPosition);
					scope.bakingCamera.lookAt(new Vector3().addVectors(worldPosition, worldNormal));
					scope.bakingCamera.far = scope.config.aoRange;
					scope.bakingCamera.fov = scope.bakingFOV;
					scope.bakingCamera.updateProjectionMatrix();

					RenderLightToRT(scope.bakingCamera);

					// Read baking pixels
					scope.bakingRenderer.readRenderTargetPixels(scope.bakingRenderTarget, 0, 0, scope.bakingBufferWidth, scope.bakingBufferHeight, scope.bakingPixelBuffer);

					var bakingBufferSize = scope.bakingBufferWidth * scope.bakingBufferHeight;

					var occlusionLight = new Vector3(0, 0, 0);

					var occlusionCounter = 0;

					for (var i = 0 ; i < bakingBufferSize; ++i)
					{
						var cosineWeight = scope.cosineWeights[i];

						var bkIndex = i * 4;

						if (scope.bakingPixelBuffer[bkIndex + 3] != 0)
						{
							var cwEpsilon = cosineWeight / 255;
							occlusionLight.x += (scope.bakingPixelBuffer[bkIndex + 0] * cwEpsilon);
							occlusionLight.y += (scope.bakingPixelBuffer[bkIndex + 1] * cwEpsilon);
							occlusionLight.z += (scope.bakingPixelBuffer[bkIndex + 2] * cwEpsilon);

							//occlusionCounter++;

							occlusionCounter += cosineWeight;
						}
					}

					var aoScalar = Math.pow((1.0 - occlusionCounter), aoIntensity);//0.1);

					ScaleBakedmapPixelColor(atlasPixelX, atlasPixelY, aoScalar);

					// Reset baking camera params
					scope.bakingCamera.far = bakingCameraFar;
				}

			}
		}
	}

	this.BakeScene = function()
	{
		scope.isBakingStarted = true;
	}

	this.AnimateBaking = function(orthographicCamera, scene)
	{
		scope.debugScene = scene;

		if (!scope.isBakingStarted)
		{
			return;
		}

		if (!scope.isShaderCompiled)
		{
			return;
		}

		if (scope.isBakingCompleted)
		{
			return;
		}

		if (!scope.isNormalPrepared)
		{
			return;
		}

		PrepareBaking(orthographicCamera);

		if (scope.isSamplingPrepared == undefined && scope.useRandomSampling)
		{
			return;
		}

		// Shading each pixel in lightmap
		var MaxBakingBounces = scope.maxBakingBounces;

		if (scope.bakingIteIndex < MaxBakingBounces)
		{
			if (scope.useRandomSampling)
			{
				if (scope.samplingCounter < scope.sampleCount * scope.pmjSamplingRatio)
				{
					var maxYSteps = 1024;
					for (var i = 0; i < maxYSteps && scope.samplingCounter < scope.sampleCount; i++,scope.samplingCounter++)
					{
						var samplePoint = scope.samplePoints[scope.samplingCounter];

						scope.activeBakingPixelX = Math.min(scope.offlineWidth - 1, Math.round(samplePoint.x * scope.offlineWidth));
						scope.activeBakingPixelY = Math.min(scope.offlineHeight - 1, Math.round(samplePoint.y * scope.offlineHeight));

						//console.log(xPos  + ', ' + yPos);

						var pixelIndex = (scope.activeBakingPixelX * scope.offlineHeight + scope.activeBakingPixelY) * 4;

						if (scope.positionPixelBuffer[pixelIndex + 3] > 0|| scope.normalPixelBuffer[pixelIndex + 3] > 0)
						{
							var worldPosition = new Vector3(scope.positionPixelBuffer[pixelIndex + 0], scope.positionPixelBuffer[pixelIndex + 1], scope.positionPixelBuffer[pixelIndex + 2]);
							var worldNormal = new Vector3(scope.normalPixelBuffer[pixelIndex + 0], scope.normalPixelBuffer[pixelIndex + 1], scope.normalPixelBuffer[pixelIndex + 2]).normalize();

							BakeAtlasPixel(scope.activeBakingPixelX, scope.activeBakingPixelY, worldPosition, worldNormal);
						}
					}

					//if (scope.activeBakingPixelY >= scope.offlineHeight)
					{
						//ProgressiveUpdateBakedmap();

						let p = (scope.samplingCounter / (scope.sampleCount * scope.pmjSamplingRatio));

						if (p >= 1 || p * 100 > scope.curProcess)
						{
							var progInfo = 'Baking... ' + ((p * 100 + scope.bakingIteIndex * 100) / MaxBakingBounces).toFixed(2) + "%";
							ConsoleOutput('\r' + progInfo);
							//console.log(progInfo);

							scope.curProcess = (p >= 1 ? 1: scope.curProcess + 1);
						}
					}
				}
				else
				{
					scope.bakingIteIndex++;

					FinishBaking();
				}
			}
			else
			{
				if (scope.activeBakingPixelX < scope.offlineWidth)
				{
					var maxYSteps = 1024;
					for (var i = 0; i < maxYSteps && scope.activeBakingPixelY < scope.offlineHeight; i++,scope.activeBakingPixelY++)
					{
						var pixelIndex = (scope.activeBakingPixelX * scope.offlineHeight + scope.activeBakingPixelY) * 4;

						if (scope.positionPixelBuffer[pixelIndex + 3] > 0|| scope.normalPixelBuffer[pixelIndex + 3] > 0)
						{
							var worldPosition = new Vector3(scope.positionPixelBuffer[pixelIndex + 0], scope.positionPixelBuffer[pixelIndex + 1], scope.positionPixelBuffer[pixelIndex + 2]);
							var worldNormal = new Vector3(scope.normalPixelBuffer[pixelIndex + 0], scope.normalPixelBuffer[pixelIndex + 1], scope.normalPixelBuffer[pixelIndex + 2]).normalize();

							BakeAtlasPixel(scope.activeBakingPixelX, scope.activeBakingPixelY, worldPosition, worldNormal);
						}
					}

					if (scope.activeBakingPixelY >= scope.offlineHeight)
					{
						scope.activeBakingPixelY = 0;
						scope.activeBakingPixelX++;


						let p = scope.activeBakingPixelX / scope.offlineWidth;

						if (p >= 1 || p * 100 > scope.curProcess)
						{
							var progInfo = 'Baking... ' + ((p * 100 + scope.bakingIteIndex * 100) / MaxBakingBounces).toFixed(2) + "%";
							ConsoleOutput('\r' + progInfo);
							//console.log(progInfo);

							scope.curProcess = (p >= 1 ? 1: scope.curProcess + 1);
						}
					}
				}
				else
				{
					scope.bakingIteIndex++;
					scope.activeBakingPixelX = 0;
					scope.activeBakingPixelY = 0;

					FinishBaking();
				}
			}
		}
		else
		{
			ConsoleOutput('\rBaking... Done        \n');
			scope.isBakingCompleted = true;

			SaveBakedmapToBin('hdr_' + scope.offlineWidth + "x" + scope.offlineHeight + ".bin");

			scope.scene.fog = null;

			scope.ambientLight.intensity = 0.0;

			ipcRenderer.send('quit', "quit");
		}
	}

	function LoadSamplingPoints()
	{
		scope.samplingCounter = 0;

		var samplingFile = 'assets/output_1024x1024.txt';

		var loader = new FileLoader();
		loader.load(samplingFile , function(data)
		{
			var datas = data.split('\r\n');

			var rawSampleCount = Math.round(datas.length / 2);

			scope.samplePoints = [];

			for (var i = 0; i < rawSampleCount; ++i)
			{
				var sp = new Vector2(parseFloat(datas[i * 2 + 0]), parseFloat(datas[i * 2 + 1]));

				scope.samplePoints.push(sp);
			}

			scope.isSamplingPrepared = true;

			scope.sampleCount = Math.min(rawSampleCount, scope.offlineWidth * scope.offlineHeight);

		}, null, function()
		{
			//addLoad(null);

			console.log('error');
		});
	}

	function PrepareBaking(orthographicCamera)
	{
		if (scope.isBakingPrepared)
		{
			return;
		}

		scope.useRandomSampling = scope.pmjSamplingRatio < 1.0 ? true : false;

		console.log('use sampling: ' + scope.useRandomSampling);

		LoadSamplingPoints();

		orthographicCamera.layers.set(SLMConstansts.SceneLayerMask);

		RenderPositionToRT(orthographicCamera);

		RenderNormalToRT(orthographicCamera);

		scope.positionRenderer.readRenderTargetPixels(scope.positionRenderTarget, 0, 0, scope.offlineWidth, scope.offlineHeight, scope.positionPixelBuffer);
		scope.normalRenderer.readRenderTargetPixels(scope.normalRenderTarget, 0, 0, scope.offlineWidth, scope.offlineHeight, scope.normalPixelBuffer);

		DiffusePixelBuffer(scope.positionPixelBuffer);
		DiffusePixelBuffer(scope.normalPixelBuffer);

		scope.bakingCamera.position.copy(new Vector3(0, 0, 0));
		scope.bakingCamera.lookAt(new Vector3(0, 1.0, 0.0));
		scope.bakingCamera.fov = scope.bakingFOV;
		scope.bakingCamera.updateProjectionMatrix();

		RenderCosweightToRt(scope.bakingCamera);

		scope.bakingRenderer.readRenderTargetPixels(scope.cosineweightRenderTarget, 0, 0, scope.bakingBufferWidth, scope.bakingBufferHeight, scope.cosineweightPixelBuffer);

		// Normalize
		var totalWeight = 0;

		var bakingBufferSize = scope.bakingBufferWidth * scope.bakingBufferHeight;
		for (var i = 0 ; i < bakingBufferSize; ++i)
		{
			totalWeight += scope.cosineweightPixelBuffer[i * 4 + 0];
		}

		// Normalize
		for (var i = 0 ; i < bakingBufferSize; ++i)
		{
			scope.cosineWeights[i] = scope.cosineweightPixelBuffer[i * 4 + 0] / totalWeight;
		}

		// Non linear scaling
		totalWeight = 0.0;
		for (var i = 0 ; i < bakingBufferSize; ++i)
		{
			scope.cosineWeights[i] = Math.pow(scope.cosineWeights[i], 4.0);

			totalWeight += scope.cosineWeights[i];
		}

		// Normalize
		for (var i = 0 ; i < bakingBufferSize; ++i)
		{
			scope.cosineWeights[i] = scope.cosineWeights[i] / totalWeight;
		}

		orthographicCamera.layers.enableAll();

		scope.activeBakingPixelX = 0;
		scope.activeBakingPixelY = 0;

		scope.bakingLights = [];

		scope.maxBakingBounces = 1;//scope.config.mode == 0 ? 2 : 1;

		//scope.scene.fog = new Fog(0x000000, 1, 10);

		//scope.scene.fog = new FogExp2(0x000000,0.05);

		scope.ambientLight  = new AmbientLight(new Color(0xffffff), 3.0);
		//ambientLight.layers.set(SLMConstansts.SceneLayerMaskBaking);
		//scope.scene.add(scope.ambientLight);

		if (scope.config.mainLight && scope.config.mainLight.enabled)
		{
			//console.log(scope.config.mainLight);

			//var directionalLight  = new DirectionalLight(scope.config.mainLight.color, scope.config.mainLight.intensity);
			//directionalLight.position.set(scope.config.mainLight.direction.x, scope.config.mainLight.direction.y, scope.config.mainLight.direction.z);
			//scope.scene.add(directionalLight);

			// const geometry = new SphereGeometry(0.2, 32, 16);
			// const material = new MeshBasicMaterial({color: 0xffff00});
			// scope.deubgSphere0 = new Mesh(geometry, material);
			// scope.deubgSphere0.position.set(scope.config.mainLight.direction.x * 10.0, scope.config.mainLight.direction.y * 10.0, scope.config.mainLight.direction.z * 10.0);
			// scope.debugScene.add(scope.deubgSphere0);
		}

		scope.bakingIteIndex = 0;

		scope.isBakingCompleted = false;

		scope.isBakingPrepared = true;

		SetupBakedmapTexture();

		BeginBaking();
	}

	//PreInitialize(options);
}

export { SLMBaker }
