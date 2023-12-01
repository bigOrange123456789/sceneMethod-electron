import {
	FloatType,
	NearestFilter,
	Vector3,
	WebGLRendererEx,
	WebGLRenderTarget,
	DepthTexture,
	UnsignedIntType,
	MeshNormalMaterial,
	Vector4,
	Vector2,
	MeshBasicMaterial,
	Frustum,
	Box3,
	Matrix4,
	RedFormat,
	DoubleSide,
	HalfFloatType,
  } from '../lib/three/build/three.module.js';

import { SLMConstansts } from './SLMLoader.js';

import { BVHTree } from './BVHTree.mjs';
  
var SLMCuller = function(options)
{
	var scope = this;

	this.scene = (options && options.sceneOccluder !== undefined) ? options.sceneOccluder : null;

	this.el = (options && options.el !== undefined) ? options.el : null;

	this.enabled = (options && options.EnableCulling !== undefined) ? options.EnableCulling : false;

	this.enableOcclusion = (options && options.cullingOptions !== undefined) ? options.cullingOptions.occlusion : false;

	this.enableContribution = (options && options.cullingOptions !== undefined) ? options.cullingOptions.contribution : false;

	this.enableFrustum = (options && options.cullingOptions !== undefined) ? options.cullingOptions.frustum : false;

	this.enableGroupOp = true;

	this.bvhTree = null;

	this.managedGroups = null;

	this.unmanagedGroups = null;

	this.ocGroups = null;

	this.lastVisibleGroups = null;

	this.outputStats = true;

	this.DEBUG_OFFLINE_RT = false;

	function initialize(options) 
	{
		var MAX_OFFSCREEN_WIDTH = 128;
		scope.offlineWidth = MAX_OFFSCREEN_WIDTH;
		scope.offlineHeight = scope.el.clientHeight / scope.el.clientWidth * scope.offlineWidth;

		scope.offlineRenderer = new WebGLRendererEx();
		scope.offlineRenderer.setPixelRatio(window.devicePixelRatio);
		scope.offlineRenderer.setSize(scope.offlineWidth, scope.offlineHeight);
		scope.offlineRenderer.setClearColor( 0xffffff );
		//scope.offlineRenderer.autoClear = false;

		// DEBUG
		if (scope.DEBUG_OFFLINE_RT)
		{
			scope.offlineRenderer.domElement.style.position = "absolute";
			scope.offlineRenderer.domElement.style.bottom = "0px";
			scope.offlineRenderer.domElement.style.left = "0px";
		}
		else
		{
			scope.offlineRenderer.domElement.style.display = 'none';
		}

		//scope.el = document.createElement('div');

		scope.el.appendChild(scope.offlineRenderer.domElement);

		//scope.offlineRendererContext = scope.offlineRenderer.domElement.getContext('2d');

		scope.cullingRenderTarget = new WebGLRenderTarget(scope.offlineWidth, scope.offlineHeight, {type: FloatType, format: RedFormat});
		scope.cullingRenderTarget.texture.generateMipmaps = false;
		scope.cullingRenderTarget.texture.minFilter = NearestFilter;
		scope.cullingRenderTarget.texture.magFilter = NearestFilter;
		scope.cullingRenderTarget.stencilBuffer = false;
		scope.cullingRenderTarget.depthBuffer = false;

		scope.pixelBuffers = [];

		for (var i = 0 ; i < 1; ++i)
		{
			var width = Math.round(scope.offlineWidth / (1<<i));
			var height = Math.round(scope.offlineHeight / (1<<i));

			scope.pixelBuffers.push( 
			{
				width: width,
				height: height,
				buffer: new Float32Array(width * height)
			});
		}
	}

	function renderOcclusionMask(camera, DEBUG = false)
	{
		var USE_INSTANCED_OC = true;

		if (USE_INSTANCED_OC)
		{
			if (DEBUG)
			{
				for (var i = 0; i < scope.managedGroups.length; ++i)
				{
					setGroupVisibility(i, false);
				}
			}

			for (var i = 0; i < scope.unmanagedGroups.length; ++i)
			{
				setUmGroupVisibility(i, false);
			}

			for (var i = 0; i < scope.ocGroups.length; ++i)
			{
				setOcGroupVisibility(i, true);
			}

			camera.layers.set(SLMConstansts.SceneLayerMask);
		}
		else
		{
			camera.layers.set(SLMConstansts.OccluderLayerMask);
		}

		if (!scope.occluderOverrideMaterial)
		{
			if (USE_INSTANCED_OC)
			{
				scope.occluderOverrideMaterial = scope.ocGroups[0].mesh.material[0].clone();
			}
			else
			{
				scope.occluderOverrideMaterial = new MeshBasicMaterial({side: DoubleSide});
			}

			if (scope.occluderOverrideMaterial)
			{
				var vertexDefChunk = [
					'attribute vec4 instanceColor;',
					'varying vec4 vInstanceColor;',
					'varying vec4 projectionPosition;',
					'#include <common>'
				].join('\n');

				var vertexShaderChunk = [
					'vInstanceColor = instanceColor;',
					'projectionPosition = projectionMatrix * mvPosition;',
					'#include <fog_vertex>',
				].join('\n');

				var fragmentDefChunk = [
					'varying vec4 vInstanceColor;',
					'varying vec4 projectionPosition;',
					'#include <common>',
				].join('\n');

				var fragmentShaderChunk = [
					'if (vInstanceColor.w == 0.0)discard;',
					'if (diffuseColor.a < 1.0)discard;',
					'float projectionDepth = projectionPosition.z / projectionPosition.w;',
					'gl_FragColor = vec4(projectionDepth,projectionDepth,projectionDepth, 1.0);',
				].join('\n');

				scope.occluderOverrideMaterial.onBeforeCompile = function ( shader ) 
				{
					shader.vertexShader = shader.vertexShader
						.replace('#include <common>', vertexDefChunk)
						.replace('#include <fog_vertex>', vertexShaderChunk);

					shader.fragmentShader = shader.fragmentShader
						.replace( '#include <common>', fragmentDefChunk )
						.replace( 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );', fragmentShaderChunk );
				};
			}
		}

		scope.scene.overrideMaterial = scope.occluderOverrideMaterial;

		if (scope.DEBUG_OFFLINE_RT)
		{
			scope.offlineRenderer.setRenderTarget(null);
		}
		else
		{
			if (scope.offlineRenderer.getRenderTarget() == null)
			{
				scope.offlineRenderer.setRenderTarget(scope.cullingRenderTarget);
			}
		}

		//scope.offlineRenderer.clear();
		//scope.offlineRenderer.clearDepth();

		scope.offlineRenderer.render(scope.scene, camera);
		scope.scene.overrideMaterial = null;

		// Copy occlusion mask to data buffer. Avoid single pixel reading
		scope.offlineRenderer.readRenderTargetPixels(scope.cullingRenderTarget, 0, 0, scope.offlineWidth, scope.offlineHeight, scope.pixelBuffers[0].buffer);

		if (USE_INSTANCED_OC)
		{
			for (var i = 0; i < scope.ocGroups.length; ++i)
			{
				setOcGroupVisibility(i, false);
			}

			for (var i = 0; i < scope.unmanagedGroups.length; ++i)
			{
				setUmGroupVisibility(i, true);
			}

			camera.layers.enableAll();
		}
		else
		{
			camera.layers.enableAll();
		}
	}

	function setGroupVisibility(groupIndex, visible)
	{
		if (groupIndex < scope.managedGroups.length)
		{
			scope.managedGroups[groupIndex].mesh.geometry.setGroupInvisible(scope.managedGroups[groupIndex].index, !visible);
			scope.managedGroups[groupIndex].visible = visible;
		}

		
	}

	function setUmGroupVisibility(groupIndex, visible)
	{
		scope.unmanagedGroups[groupIndex].mesh.geometry.setGroupInvisible(scope.unmanagedGroups[groupIndex].index, !visible);
	}

	function setOcGroupVisibility(groupIndex, visible)
	{
		//if (scope.ocGroups[groupIndex].bounds != null) // Ingored un-managed group
		{
			scope.ocGroups[groupIndex].mesh.geometry.setGroupInvisible(scope.ocGroups[groupIndex].index, !visible);
			scope.ocGroups[groupIndex].visible = visible;
		}
	}

	// Debug function
	this.frustumCulling = function(camrea, modelToWorldMatrix)
	{
		var frustum = new Frustum();
		frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(camrea.projectionMatrix, new Matrix4().multiplyMatrices(camrea.matrixWorldInverse, modelToWorldMatrix )));

		var filteredList = [];

		for (var i = 0; i < this.managedGroups.length; ++i)
		{
			var box3 = new Box3(new Vector3(this.managedGroups[i].bounds.min[0], this.managedGroups[i].bounds.min[1], this.managedGroups[i].bounds.min[2]),
								new Vector3(this.managedGroups[i].bounds.max[0], this.managedGroups[i].bounds.max[1], this.managedGroups[i].bounds.max[2]));

			if (frustum.intersectsBox(box3))
			{
				setGroupVisibility(i, true);

				filteredList.push(i);
			}
			else
			{
				setGroupVisibility(i, false);
			}
		}

		console.log(frustum);
		console.log(filteredList);

		console.log(scope.frustum);
		console.log(scope.filteredGroups);
	}

	// Debug function
	this.contributionCulling = function(camera, modelToWorldMatrix)
	{
		console.log(scope.bvh._rootNode);

		var rootSize = {
			x: scope.bvh._rootNode._extentsMax.x - scope.bvh._rootNode._extentsMin.x,
			y: scope.bvh._rootNode._extentsMax.y - scope.bvh._rootNode._extentsMin.y,
			z: scope.bvh._rootNode._extentsMax.z - scope.bvh._rootNode._extentsMin.z,
		}

		var maxSceneSize = Math.max(rootSize.x, Math.max(rootSize.y, rootSize.z));

		var maxSceneSizeSquared = maxSceneSize * maxSceneSize;

		var sceneResolution = 1000;

		var sceneBlockSize = maxSceneSize / sceneResolution;

		var cameraPosition = new Vector3();
		camera.getWorldPosition(cameraPosition);
		cameraPosition.applyMatrix4(modelToWorldMatrix.invert());

		var culledCounter = 0;

		for (var i = 0; i < this.managedGroups.length; ++i)
		{
			var curGroup = scope.managedGroups[i];

			var center = new Vector3((curGroup.bounds.min[0] + curGroup.bounds.max[0]) * 0.5, 
									 (curGroup.bounds.min[1] + curGroup.bounds.max[1]) * 0.5, 
									 (curGroup.bounds.min[2] + curGroup.bounds.max[2]) * 0.5);

			var maxGroupSize = Math.max(curGroup.bounds.max[0] - curGroup.bounds.min[0],
										Math.max(curGroup.bounds.max[1] - curGroup.bounds.min[1], curGroup.bounds.max[2] - curGroup.bounds.min[2]));

			var normalizedDistanceSquared = (center.distanceToSquared(cameraPosition) / maxSceneSizeSquared);

			var normalizedGroupSize = (maxGroupSize / sceneBlockSize) * (maxGroupSize / sceneBlockSize);

			var contributionValue =  normalizedGroupSize / normalizedDistanceSquared;

			if (contributionValue < sceneBlockSize)
			{
				culledCounter++;
				setGroupVisibility(i, false);
			}
			else
			{
				setGroupVisibility(i, true);
			}
		}
		console.log('culled: ' + culledCounter);
	}

	// Debug function
	this.occlusionCulling = function(camera, modelToWorldMatrix)
	{
		renderOcclusionMask(camera, true);

		var transMat = new Matrix4().multiplyMatrices(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), modelToWorldMatrix);

		var aggresive_mode = false;
		if (aggresive_mode)
		{
			for (var i = 0; i < this.managedGroups.length; ++i)
			{
				var curGroup = scope.managedGroups[i];
	
				var center = new Vector3().copy(curGroup.center);
	
				center.applyMatrix4(transMat);

				var offsetX = Math.round((center.x * 0.5 + 0.5) * scope.offlineWidth);
				var offsetY = Math.round((center.y * 0.5 + 0.5) * scope.offlineHeight);
	
				var pixelIndex = offsetY * scope.offlineWidth + offsetX;
				var depth = scope.pixelBuffers[0].buffer[pixelIndex];
	
				if (center.z > (depth + scope.sceneConfig.depthDistanceEpsilon))
				{
					setGroupVisibility(i, false);
				}
				else
				{
					setGroupVisibility(i, true);
				}
			}
		}
		else
		{
			// Build hierarcchy z map
			//buildHierarchyZ();

			for (var i = 0; i < this.managedGroups.length; ++i)
			{
				setGroupVisibility(i, true);
			}

			for (var i = 0; i < this.managedGroups.length; ++i)
			{
				setGroupVisibility(i, false);

				var curGroup = scope.managedGroups[i];

				// Get screen AABB
				var minNormX = Number.MAX_VALUE;
				var maxNormX = Number.MIN_VALUE;
				var minNormY = Number.MAX_VALUE;
				var maxNormY = Number.MIN_VALUE;

				var minDepth = Number.MAX_VALUE;

				for (var abpIdx = 0; abpIdx < curGroup.aabbs.length; ++abpIdx)
				{
					var ap = new Vector3().copy(curGroup.aabbs[abpIdx]);
					ap.applyMatrix4(transMat);

					minNormX = Math.min(ap.x, minNormX);
					minNormY = Math.min(ap.y, minNormY);

					maxNormX = Math.max(ap.x, maxNormX);
					maxNormY = Math.max(ap.y, maxNormY);

					minDepth = Math.min(ap.z, minDepth);
				}

				minNormX = Math.min(Math.max(-1.0, minNormX), 1.0);
				maxNormX = Math.min(Math.max(-1.0, maxNormX), 1.0);
				minNormY = Math.min(Math.max(-1.0, minNormY), 1.0);
				maxNormY = Math.min(Math.max(-1.0, maxNormY), 1.0);

				var isVisible = false;

				for (var hzIdx = 0; hzIdx >= 0; --hzIdx)
				{
					var minX = Math.round((minNormX * 0.5 + 0.5) * scope.pixelBuffers[hzIdx].width);
					var maxX = Math.round((maxNormX * 0.5 + 0.5) * scope.pixelBuffers[hzIdx].width);

					var minY = Math.round((minNormY * 0.5 + 0.5) * scope.pixelBuffers[hzIdx].height);
					var maxY = Math.round((maxNormY * 0.5 + 0.5) * scope.pixelBuffers[hzIdx].height);

					for (var xIdx = minX; xIdx <= maxX; ++xIdx)
					{
						for (var yIdx = minY; yIdx <= maxY; ++yIdx)
						{
							var pixelIndex = yIdx * scope.pixelBuffers[hzIdx].width + xIdx;
		
							var depth = scope.pixelBuffers[hzIdx].buffer[pixelIndex];
				
							if (!(minDepth > (depth + scope.sceneConfig.depthDistanceEpsilon)))
							{
								setGroupVisibility(i, true);
		
								isVisible = true;

								break; // Early return
							}
						}

						if (isVisible) break;
					}

					if (isVisible) break;
				}
			}
		}
	}

	this.showCullingStats = function()
	{
		scope.outputStats = true;
	}

	function getFrustum(camera, sceneModelToWorldMatrix)
	{
		var frustum = new Frustum();
		frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, new Matrix4().multiplyMatrices(camera.matrixWorldInverse, sceneModelToWorldMatrix)));

		return frustum;
	}

	function performCulling(camera, sceneModelToWorldMatrix)
	{
		if (!scope.managedGroups)
		{
			return;
		}

		scope.enableFrustum = true;
		scope.enableContribution = false;
		scope.enableOcclusion = false;

		var cullStats = {
			groups: scope.managedGroups.length,
			frustumCulledGroups: 0,
			contribution: 0,
			occlusion: 0
		};

		for (var i = 0; i < scope.managedGroups.length; ++i)
		{
			setGroupVisibility(i, false);
		}

		if (scope.enableOcclusion)
		{
			renderOcclusionMask(camera);
		}

		scope.filteredGroups = [];

		// Stage 1
		if (scope.enableFrustum)
		{
			scope.frustum = getFrustum(camera, sceneModelToWorldMatrix);

			scope.filteredGroups = scope.bvh.intersectFrustum(scope.frustum);

			for (var i = 0; i < scope.filteredGroups.length; ++i)
			{
				setGroupVisibility(scope.filteredGroups[i], true);
			}

			cullStats.frustumCulledGroups = scope.managedGroups.length - scope.filteredGroups.length;
		}

		// Stage 2
		if (scope.enableContribution)
		{
			var cameraPosition = new Vector3();
			camera.getWorldPosition(cameraPosition);

			if (!scope.invertSceneModelToWorldMatrix)
			{
				scope.invertSceneModelToWorldMatrix = sceneModelToWorldMatrix.invert();
			}
			cameraPosition.applyMatrix4(scope.invertSceneModelToWorldMatrix);

			for (var i = 0; i < scope.filteredGroups.length; ++i)
			{
				var groupIndex = scope.filteredGroups[i];
				var curGroup = scope.managedGroups[groupIndex];

				if (curGroup && curGroup.normalizedGroupSize < scope.sceneConfig.normalizedGroupSizeThreshold) // Ignroe large size objects
				{
					var normalizedDistanceSquared = (curGroup.center.distanceToSquared(cameraPosition) / scope.sceneConfig.maxSceneSizeSquared);
		
					var contributionValue =  curGroup.normalizedGroupSizePowered / normalizedDistanceSquared;

					if (contributionValue < scope.sceneConfig.contributionThreshold)
					{
						setGroupVisibility(groupIndex, false);

						cullStats.contribution++;
					}
				}
			}
		}

		// Stage 3
		if (scope.enableOcclusion)
		{
			var transMat = new Matrix4().multiplyMatrices(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), sceneModelToWorldMatrix);
			var aggresive_mode = false;
			if (aggresive_mode)
			{
				for (var i = 0; i < scope.filteredGroups.length; ++i)
				{
					var groupIndex = scope.filteredGroups[i];
					var curGroup = scope.managedGroups[groupIndex];
		
					if (curGroup.visible)
					{
						var center = new Vector3().copy(curGroup.center);

						center.applyMatrix4(transMat);

						var offsetX = Math.round((center.x * 0.5 + 0.5) * scope.offlineWidth);
						var offsetY = Math.round((center.y * 0.5 + 0.5) * scope.offlineHeight);
			
						var pixelIndex = offsetY * scope.offlineWidth + offsetX;
			
						var depth = scope.pixelBuffers[0].buffer[pixelIndex];
			
						if (center.z > (depth + scope.sceneConfig.depthDistanceEpsilon))
						{
							setGroupVisibility(groupIndex, false);

							cullStats.occlusion++;
						}
					}
				}
			}
			else
			{
				for (var i = 0; i < scope.filteredGroups.length; ++i)
				{
					var groupIndex = scope.filteredGroups[i];
					var curGroup = scope.managedGroups[groupIndex];
		
					if (curGroup.visible)
					{
						setGroupVisibility(groupIndex, false);

						// Get screen AABB
						var minNormX = Number.MAX_VALUE;
						var maxNormX = Number.MIN_VALUE;
						var minNormY = Number.MAX_VALUE;
						var maxNormY = Number.MIN_VALUE;

						var minDepth = Number.MAX_VALUE;

						for (var abpIdx = 0; abpIdx < curGroup.aabbs.length; ++abpIdx)
						{
							var ap = new Vector3().copy(curGroup.aabbs[abpIdx]);
							ap.applyMatrix4(transMat);

							minNormX = Math.min(ap.x, minNormX);
							minNormY = Math.min(ap.y, minNormY);

							maxNormX = Math.max(ap.x, maxNormX);
							maxNormY = Math.max(ap.y, maxNormY);

							minDepth = Math.min(ap.z, minDepth);
						}

						minNormX = Math.min(Math.max(-1.0, minNormX), 1.0);
						maxNormX = Math.min(Math.max(-1.0, maxNormX), 1.0);
						minNormY = Math.min(Math.max(-1.0, minNormY), 1.0);
						maxNormY = Math.min(Math.max(-1.0, maxNormY), 1.0);

						var isVisible = false;

						for (var hzIdx = 0; hzIdx >= 0; --hzIdx)
						{
							var minX = Math.round((minNormX * 0.5 + 0.5) * scope.pixelBuffers[hzIdx].width);
							var maxX = Math.round((maxNormX * 0.5 + 0.5) * scope.pixelBuffers[hzIdx].width);

							var minY = Math.round((minNormY * 0.5 + 0.5) * scope.pixelBuffers[hzIdx].height);
							var maxY = Math.round((maxNormY * 0.5 + 0.5) * scope.pixelBuffers[hzIdx].height);

							for (var xIdx = minX; xIdx <= maxX; xIdx += 2)
							{
								for (var yIdx = minY; yIdx <= maxY; yIdx += 2)
								{
									var pixelIndex = yIdx * scope.pixelBuffers[hzIdx].width + xIdx;
				
									var depth = scope.pixelBuffers[hzIdx].buffer[pixelIndex];
						
									if (!(minDepth > (depth + scope.sceneConfig.depthDistanceEpsilon)))
									{
										setGroupVisibility(groupIndex, true);

										isVisible = true;

										break; // Early return
									}
								}

								if (isVisible) break;
							}

							if (isVisible) break;
						}

						if (curGroup.visible == false)
						{
							cullStats.occlusion++;
						}
					}
				}
			}
		}

		// Optimize group dynamically
		if (scope.enableGroupOp && scope.filteredGroups)
		{
			for (var i = 0; i < scope.filteredGroups.length; i++)
			{
				var curGroup = scope.managedGroups[scope.filteredGroups[i]];

				if (curGroup && curGroup.visible == true)
				{
					// Reset last state
					if (curGroup.mesh.dynMultiCounts[curGroup.index] != -1)
					{
						curGroup.mesh.multiCounts[curGroup.index] = curGroup.mesh.dynMultiCounts[curGroup.index];
						curGroup.mesh.dynMultiCounts[curGroup.index] = -1;
					}
	
					var megeredCount = curGroup.mesh.multiCounts[curGroup.index];
	
					for(var j = i + 1; j < scope.filteredGroups.length; ++j)
					{
						var nextGroup = scope.managedGroups[scope.filteredGroups[j]];
	
						if (nextGroup && nextGroup.visible && 
							curGroup.mesh == nextGroup.mesh && 
							curGroup.s == nextGroup.s)
						{
							megeredCount += nextGroup.mesh.multiCounts[nextGroup.index];
	
							setGroupVisibility(scope.filteredGroups[j], false);
						}
						else
						{
							break;
						}
					}
	
					if (megeredCount > curGroup.mesh.multiCounts[curGroup.index])
					{
						curGroup.mesh.dynMultiCounts[curGroup.index] = curGroup.mesh.multiCounts[curGroup.index];
						curGroup.mesh.multiCounts[curGroup.index] = megeredCount;
					}
	
					// Jump to next group
					i = j;
				}
			}
		}

		if (scope.outputStats)
		{
			console.log(cullStats);

			scope.outputStats = false;
		}
		
	}

	this.setup = function(cullerOptions)
	{
		this.managedGroups = cullerOptions.managedGroups;

		this.unmanagedGroups = cullerOptions.unmanagedGroups;

		this.ocGroups = cullerOptions.ocGroups;

		// Serialization has some problems
		this.bvh = new BVHTree.BVH();
		this.bvh.deserializeFromJson(cullerOptions.bvhJson);

		if (cullerOptions.sceneOccluder)
		{
			this.scene = cullerOptions.sceneOccluder;
		}

		console.log(cullerOptions);

		{
			var rootSize = {
				x: scope.bvh._rootNode._extentsMax.x - scope.bvh._rootNode._extentsMin.x,
				y: scope.bvh._rootNode._extentsMax.y - scope.bvh._rootNode._extentsMin.y,
				z: scope.bvh._rootNode._extentsMax.z - scope.bvh._rootNode._extentsMin.z,
			}
			var maxSceneSize = Math.max(rootSize.x, Math.max(rootSize.y, rootSize.z));
			var maxSceneSizeSquared = maxSceneSize * maxSceneSize;
	
			this.sceneConfig =
			{
				rootSize: rootSize,
				maxSceneSize: maxSceneSize,
				maxSceneSizeSquared: maxSceneSizeSquared,
				normalizedGroupSizeThreshold: 0.25,
				contributionThreshold: 0.001,
				depthDistanceEpsilon: -0.002,
			};
	
			for (var i = 0; i < this.managedGroups.length; ++i)
			{
				var curGroup = this.managedGroups[i];
				var center = new Vector3((curGroup.bounds.min[0] + curGroup.bounds.max[0]) * 0.5, (curGroup.bounds.min[1] + curGroup.bounds.max[1]) * 0.5, (curGroup.bounds.min[2] + curGroup.bounds.max[2]) * 0.5);
				var halfSize = new Vector3((curGroup.bounds.max[0] - curGroup.bounds.min[0]) * 0.5, (curGroup.bounds.max[1] - curGroup.bounds.min[1]) * 0.5, (curGroup.bounds.max[2] - curGroup.bounds.min[2]) * 0.5);
				var maxGroupSize = Math.max(curGroup.bounds.max[0] - curGroup.bounds.min[0], Math.max(curGroup.bounds.max[1] - curGroup.bounds.min[1], curGroup.bounds.max[2] - curGroup.bounds.min[2]));
				var normalizedGroupSize = maxGroupSize / this.sceneConfig.maxSceneSize;
				var normalizedGroupSizePowered = Math.pow((maxGroupSize / this.sceneConfig.maxSceneSize), 2.0);
	
				this.managedGroups[i].center = center;
				this.managedGroups[i].maxGroupSize = maxGroupSize;
				this.managedGroups[i].normalizedGroupSize = normalizedGroupSize;
				this.managedGroups[i].normalizedGroupSizePowered = normalizedGroupSizePowered;

				this.managedGroups[i].aabbs = [
					new Vector3(center.x + halfSize.x, center.y + halfSize.y, center.z - halfSize.z),
					new Vector3(center.x + halfSize.x, center.y - halfSize.y, center.z + halfSize.z),
					new Vector3(center.x - halfSize.x, center.y + halfSize.y, center.z - halfSize.z),
					new Vector3(center.x - halfSize.x, center.y - halfSize.y, center.z + halfSize.z),
					];
			}

			console.log(this.sceneConfig);
		}
	}

	this.render = function(camera, sceneModelToWorldMatrix)
	{
		if (camera && sceneModelToWorldMatrix)
		{
			//performCulling(camera, sceneModelToWorldMatrix);
		}
	}

	if (options.EnableCulling)
	{
		initialize(options);
	}
}

export { SLMCuller }