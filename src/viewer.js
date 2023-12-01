import {
  Box3,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRendererEx,
  sRGBEncoding,
  Object3D,
  BufferGeometry,
  BufferAttribute,
  MeshBasicMaterial,
  Mesh,
  BoxHelper,
  Matrix4,
  BoxGeometry,
  CameraHelper,
  Color,
  Frustum,
  SphereGeometry,
  OrthographicCamera
} from '../lib/three/build/three.module.js';

import Stats from '../lib/three/examples/jsm/libs/stats.module.js';
import {OrbitControls} from '../lib/three/examples/jsm/controls/OrbitControls.js';

// import { GUI } from '../lib/datgui/dat.gui.module.js';

import { SLMLoader } from '../lib/SLMLoader.js';

export class Viewer
{
  constructor (el, options)
  {
    this.el = el;
    this.options = options;

    this.lights = [];
    this.content = null;

    this.gui = null;

    this.prevTime = 0;

    this.stats = new Stats();
    this.stats.dom.height = '48px';
    [].forEach.call(this.stats.dom.children, (child) => (child.style.display = ''));

    this.scene = new Scene();

    const fov = 60;
    this.defaultCamera = new PerspectiveCamera(fov, el.clientWidth / el.clientHeight, 0.1, 700);
    this.activeCamera = this.defaultCamera;
    this.scene.add(this.defaultCamera);
    this.activeCamera.layers.enableAll();

    this.sceneEx = new Scene();
    this.sceneEx.add(this.defaultCamera);

    this.renderer = window.renderer = new WebGLRendererEx({antialias: true});
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = sRGBEncoding;
    this.renderer.setClearColor(0xeeeeee);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    this.renderer.autoClear = false;

    this.controls = new OrbitControls(this.defaultCamera, this.renderer.domElement);
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = -10;
    this.controls.screenSpacePanning = true;

    this.el.appendChild(this.renderer.domElement);

    this.slmLoader = new SLMLoader(
        {
          EnablePicking: true,
          renderer: this.renderer,
          scene: this.scene,
          sceneOccluder: this.scene,
          el: this.el,
          EnableCulling: true,
        }
    );

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
    window.addEventListener('resize', this.resize.bind(this), false);

    this.setupScene();

    /**************************************************************/
    var _self = this;
    this.onKeyDown = function (event)
    {
      // console.log('keycode: ' + event.keyCode);

      switch (event.keyCode)
      {
        case 16: // Shift
        {
          _self.isShiftKeyPressed = true;
        }
          break;

        case 65: // A
        {
          _self.isAKeyPressed=true;
        }
          break;
        case 66: // B
        {
          _self.isBKeyPressed=true;
        }
          break;
        case 67: // C
        {
          //console.log( _self.slmLoader.GetElementBounds(50));
        }
          break;

        case 37:
        {
          if (!_self.testSphere)
          {
            var max = [92860, 74828, 5e-324];
            var min = [-35085, -42798, -140];

            var center = new Vector3((min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5);

            const geometry = new SphereGeometry( 50000.0, 32, 16 );
            const material = new MeshBasicMaterial( { color: 0xffff00 } );
            const sphere = new Mesh( geometry, material );
            sphere.position.copy(center);

            //var mat = _self.sceneRootNodeEx.matrixWorld.clone();
            //sphere.applyMatrix4(mat);

            _self.sceneRootNodeEx.add( sphere );

            _self.testSphere = sphere;

            _self.testSphere.geometry.computeBoundingSphere();
            console.log('--------------------------');
          }
          else
          {
            _self.testSphere.position.x += 1000.0;

            if (_self.testCamera)
            {
              var frustum = new Frustum();
              frustum.setFromMatrix(new Matrix4().multiplyMatrices(_self.testCamera.projectionMatrix, _self.testCamera.matrixWorldInverse ));

              var rt = frustum.intersectsObject(_self.testSphere);

              if (rt)
              {
                _self.testSphere.material.color = new Color(0xff0000);
              }
              else
              {
                _self.testSphere.material.color = new Color(0xffff00);
              }
            }
          }
        }
          break;

        case 39:
        {
          if (_self.testSphere)
          {
            _self.testSphere.position.x -= 1000.0;

            if (_self.testCamera)
            {
              var frustum = new Frustum();
              frustum.setFromMatrix(new Matrix4().multiplyMatrices(_self.testCamera.projectionMatrix, _self.testCamera.matrixWorldInverse ));

              var rt = frustum.intersectsObject(_self.testSphere);

              if (rt)
              {
                _self.testSphere.material.color = new Color(0xff0000);
              }
              else
              {
                _self.testSphere.material.color = new Color(0xffff00);
              }
            }
          }

        }
          break;

        case 70:
        {
          if (!_self.testCamera)
          {
            _self.testCamera = _self.activeCamera.clone();

            console.log(_self.testCamera)
          }

          var camera = _self.activeCamera.clone();
          var mat = _self.sceneRootNodeEx.matrixWorld.clone().invert();
          var helper = new CameraHelper(camera);
          //helper.applyMatrix4(mat);
          _self.scene.add(helper);

          const geometry = new BoxGeometry(1, 1, 1);
          const material = new MeshBasicMaterial( { color: 0xff00ff } );
          const sphere = new Mesh( geometry, material );
          sphere.position.copy(_self.activeCamera.position);
          //sphere.applyMatrix4(mat);
          _self.scene.add(sphere);

          //_self.slmLoader.sceneCullers[0].frustumCulling(_self.activeCamera, _self.sceneRootNodeEx.matrixWorld);
          //_self.slmLoader.sceneCullers[0].contributionCulling(_self.activeCamera, _self.sceneRootNodeEx.matrixWorld);
          //_self.slmLoader.sceneCullers[0].occlusionCulling(_self.activeCamera, _self.sceneRootNodeEx.matrixWorld);
          _self.slmLoader.sceneCullers[0].showCullingStats();
        }
          break;

        case 32:
        {
          var allGroups = _self.slmLoader.getAllSceneGroups();

          for (var i = 0; i < allGroups.length; ++i)
          {
            _self.slmLoader.setGroupVisible(i, false);
          }

          console.log('group Count: ' + allGroups.length);

          console.log(allGroups);
        }
          break;

        case 38:// up
        {
          /*
          _self.bvhTreeObject.children[_self.bvhActiveNodeIndex].visible = false;

          _self.bvhActiveNodeIndex = (_self.bvhActiveNodeIndex + 1) % _self.bvhTreeObject.children.length;

          _self.bvhTreeObject.children[_self.bvhActiveNodeIndex].visible = true;
          */

          if (!_self.activeGroupIndex) _self.activeGroupIndex = 0;

          _self.slmLoader.setGroupVisible(_self.activeGroupIndex, true);

          var groupDesc = _self.slmLoader.getSceneGroup(_self.activeGroupIndex);
          console.log(groupDesc);

          if (groupDesc.bounds)
          {
            var verticesArray = [];
            verticesArray.push(groupDesc.bounds.min[0]);
            verticesArray.push(groupDesc.bounds.min[1]);
            verticesArray.push(groupDesc.bounds.min[2]);

            verticesArray.push(groupDesc.bounds.max[0]);
            verticesArray.push(groupDesc.bounds.max[1]);
            verticesArray.push(groupDesc.bounds.max[2]);

            const vertices = new Float32Array(verticesArray);
            const geometry = new BufferGeometry();
            geometry.setAttribute( 'position', new BufferAttribute( vertices, 3 ) );
            const material = new MeshBasicMaterial( { color: 0xffff00 } );
            var mesh = new Mesh( geometry, material );

            const box = new BoxHelper( mesh, 0xffff00 );

            var mat = _self.sceneRootNodeEx.matrixWorld.clone();
            box.applyMatrix4(mat);

            _self.scene.add(box);

            console.log(groupDesc.bounds);
          }

          var allGroups = _self.slmLoader.getAllSceneGroups();
          _self.activeGroupIndex = (_self.activeGroupIndex + 1) % allGroups.length;

        }
          break;

        case 40: // down
        {
          /*
          _self.bvhTreeObject.children[_self.bvhActiveNodeIndex].visible = false;

          _self.bvhActiveNodeIndex = (Math.max(0, _self.bvhActiveNodeIndex - 1)) % _self.bvhTreeObject.children.length;

          _self.bvhTreeObject.children[_self.bvhActiveNodeIndex].visible = true;
          */

          if (!_self.activeGroupIndex) _self.activeGroupIndex = 0;

          _self.slmLoader.setGroupVisible(_self.activeGroupIndex, false);
          var allGroups = _self.slmLoader.getAllSceneGroups();
          _self.activeGroupIndex = (Math.max(0, _self.activeGroupIndex - 1)) % allGroups.length;


        }
          break;

        case 81: // Q
        {
          _self.slmLoader.SetGlobalEdgeColor(new Color(0.2, 0.5, 0.8));
        }
          break;

        case 69: // E
        {
          _self.slmLoader.SetGlobalEdgeThickness(1.0);
        }
          break;
      }
    }

    this.onKeyUp = function (event)
    {
      switch (event.keyCode)
      {
        case 16: // Shift
        {
          _self.isShiftKeyPressed = false;

        }
          break;
        case 65: // A
        {
          _self.isAKeyPressed=false;

        }
          break;
        case 66: // B
        {
          _self.isBKeyPressed=false;
        }
          break;
      }
    }

    this.onMouseMove = function(event)
    {
      if (_self.isShiftKeyPressed)
      {
        var rect = this.renderer.domElement.getBoundingClientRect();

        var mouseX = ( event.clientX - rect.left ) / rect.width;
        var mouseY = ( event.clientY - rect.top ) / rect.height;

        var rt = _self.slmLoader.PickElementByMouseEx(mouseX, mouseY, _self.activeCamera);

        var elementPickingId = rt.pickingId;

        /************************************************************************/
        if (true)
        {
          const geometry = new BoxGeometry(0.3, 0.3, 0.3);
          const material = new MeshBasicMaterial( { color: 0xff00ff } );
          const sphere = new Mesh( geometry, material );

          sphere.position.copy(rt.position);

          _self.scene.add(sphere);
        }

        var singleSelected = true;
        if (singleSelected)
        {
          if (_self.slmLoader.lastSelectedElemPickId != undefined)
          {
            _self.slmLoader.SetElementMaterialState(_self.slmLoader.lastSelectedElemPickId, true, false, new Color(0, 0, 0));
          }

          _self.slmLoader.SetElementMaterialState(elementPickingId, true, false, new Color(255, 0, 0));

          /****************************************************************/
          console.log('elemId: ' + elementPickingId);
          var elemKey = _self.slmLoader.GetElementKeyByPickingId(elementPickingId);
          console.log('elemKey: ' + elemKey);

          var elemIds = _self.slmLoader.GetElementPickingIdByKey(elemKey);
          console.log(elemIds);

          // EXAMPLE: get element geometry example
          var elemIds = _self.slmLoader.GetElementPickingIdByKey(elemKey);
          for (var subElemIdx = 0 ; elemIds != null && subElemIdx < elemIds.length; ++subElemIdx)
          {
            var geometryDesc = _self.slmLoader.GetElementGeometryDesc(elemIds[subElemIdx]);

            var verticesArray = [];

            for (var i = 0 ; i < geometryDesc.triangleCount; ++i)
            {
              var baseIndex = geometryDesc.indexOffset;

              var index0 = geometryDesc.indexBuffer.array[baseIndex + i * 3 + 0];
              var index1 = geometryDesc.indexBuffer.array[baseIndex + i * 3 + 1];
              var index2 = geometryDesc.indexBuffer.array[baseIndex + i * 3 + 2];

              var stride = geometryDesc.positionBuffer.stride;

              verticesArray.push(geometryDesc.positionBuffer.array[index0 * stride + 0]);
              verticesArray.push(geometryDesc.positionBuffer.array[index0 * stride + 1]);
              verticesArray.push(geometryDesc.positionBuffer.array[index0 * stride + 2]);

              verticesArray.push(geometryDesc.positionBuffer.array[index1 * stride + 0]);
              verticesArray.push(geometryDesc.positionBuffer.array[index1 * stride + 1]);
              verticesArray.push(geometryDesc.positionBuffer.array[index1 * stride + 2]);

              verticesArray.push(geometryDesc.positionBuffer.array[index2 * stride + 0]);
              verticesArray.push(geometryDesc.positionBuffer.array[index2 * stride + 1]);
              verticesArray.push(geometryDesc.positionBuffer.array[index2 * stride + 2]);
            }

            const vertices = new Float32Array(verticesArray);
            const geometry = new BufferGeometry();
            geometry.setAttribute( 'position', new BufferAttribute( vertices, 3 ) );
            const material = new MeshBasicMaterial( { color: 0xffff00 } );
            var mesh = new Mesh( geometry, material );

            mesh.applyMatrix4(geometryDesc.matrix);

            //_self.sceneRootNodeEx.add(mesh);
          }

          // EXAMPLE: get element bounding box
          {
            var bounds = _self.slmLoader.GetElementBounds(elementPickingId);

            if (bounds && bounds.min && bounds.max)
            {
              var verticesArray = [];

              verticesArray.push(bounds.min.x);
              verticesArray.push(bounds.min.y);
              verticesArray.push(bounds.min.z);

              verticesArray.push(bounds.max.x);
              verticesArray.push(bounds.max.y);
              verticesArray.push(bounds.max.z);

              const vertices = new Float32Array(verticesArray);
              const geometry = new BufferGeometry();
              geometry.setAttribute( 'position', new BufferAttribute( vertices, 3 ) );
              const material = new MeshBasicMaterial( { color: 0xffff00 } );
              var mesh = new Mesh( geometry, material );

              const box = new BoxHelper( mesh, 0xffff00 );
              _self.sceneRootNodeEx.add( box );
            }
          }
          /****************************************************************/


          _self.slmLoader.lastSelectedElemPickId = elementPickingId;
        }
      }
      else if(_self.isBKeyPressed)
      {

        var rect = this.renderer.domElement.getBoundingClientRect();

        var mouseX = ( event.clientX - rect.left ) / rect.width;
        var mouseY = ( event.clientY - rect.top ) / rect.height;

        var elementPickingId = _self.slmLoader.PickElementByMouse(mouseX, mouseY, _self.activeCamera);

        var singleSelected = true;
        if (singleSelected)
        {
          if (_self.slmLoader.lastSelectedElemPickId != undefined)
          {
            _self.slmLoader.SetElementMaterialState(_self.slmLoader.lastSelectedElemPickId, true, false, 0);
          }
          _self.slmLoader.SetElementMaterialState(elementPickingId, true, false, 1);
          var matrix=new Matrix4().makeRotationY(1);
          _self.SetComponentMatrix(elementPickingId,matrix)
          _self.slmLoader.lastSelectedElemPickId = elementPickingId;
        }
      }
      else if(_self.isAKeyPressed)
      {
        var rect = this.renderer.domElement.getBoundingClientRect();

        var mouseX = ( event.clientX - rect.left ) / rect.width;
        var mouseY = ( event.clientY - rect.top ) / rect.height;

        var elementPickingId = _self.slmLoader.PickElementByMouse(mouseX, mouseY, _self.activeCamera);

        var singleSelected = true;
        if (singleSelected)
        {
          if (_self.slmLoader.lastSelectedElemPickId != undefined)
          {
            _self.slmLoader.SetElementMaterialState(_self.slmLoader.lastSelectedElemPickId, true, false, 0);
          }
          _self.slmLoader.SetElementMaterialState(elementPickingId, true, false, 1);
          _self.slmLoader.ShowElement(elementPickingId,false,1)
          _self.slmLoader.lastSelectedElemPickId = elementPickingId;
        }
      }
    }

    window.addEventListener('keydown', this.onKeyDown, false);
    window.addEventListener('keyup', this.onKeyUp, false);
    window.addEventListener('click', this.onMouseMove, true);
  }

  animate(time)
  {
    requestAnimationFrame(this.animate);

    this.controls.update();
    this.stats.update();

    this.render();

    this.prevTime = time;
  }

  render()
  {
    this.slmLoader.render(this.activeCamera, this.sceneRootNodeEx ? this.sceneRootNodeEx.matrixWorld: null);

    this.renderer.clear();

    this.renderer.render(this.scene, this.activeCamera);

    this.renderer.render(this.sceneEx, this.activeCamera);
  }

  resize()
  {
    const {clientHeight, clientWidth} = this.el.parentElement;

    this.defaultCamera.aspect = clientWidth / clientHeight;
    this.defaultCamera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  load(scenes, finishCallback)
  {
    var scope = this;
    this.slmLoader.LoadScene(scenes, function(slmScene, _tag, bvhScene)
    {
      // console.log('get scene: ' + _tag);

      // console.log(slmScene);

      scope.addSceneModel(slmScene,_tag);
    }, function()
    {
      console.log('all scene loaded');

      if (finishCallback)
      {
        finishCallback();
      }
    }, function(slmScene, _tag)
    {
      // console.log(slmScene);

    });
  }

  addSceneModel(sceneModel,tag)
  {
    if (!this.sceneRootNode)
    {
      this.sceneRootNode = new Object3D();
      this.sceneRootNode2 = new Object3D();
      this.sceneRootNodeEx = new Object3D();

      this.scene.add(this.sceneRootNode);
      this.scene.add(this.sceneRootNode2);
      this.sceneEx.add(this.sceneRootNodeEx);
    }

    if(tag==1)
    {
      // console.log('tag  1');
      this.uniformScene(sceneModel, 50,this.sceneRootNode);
      this.uniformScene(sceneModel, 50,this.sceneRootNodeEx);

      //this.sceneRootNodeEx.position.x += 3.6;
      //this.sceneRootNodeEx.position.y += 8.8;
      //this.sceneRootNodeEx.scale.copy(this.sceneRootNode.scale);

      // console.log(this.sceneRootNodeEx);

      this.sceneRootNode.add(sceneModel);
    }
    else if(tag==2)
    {
      this.uniformScene(sceneModel, 50,this.sceneRootNode2);
      this.sceneRootNode2.add(sceneModel);
    }
  }

  uniformScene(sceneModel, _uniforSize, sceneRootNode)
  {
    // Uniform model
    var uniformSize = _uniforSize ? _uniforSize : 20;

    var objBox3 = new Box3().setFromObject(sceneModel);

    var centerOffset = new Vector3();
    centerOffset.x = -(objBox3.min.x + objBox3.max.x) * 0.5;
    centerOffset.y = -(objBox3.min.y + objBox3.max.y) * 0.5;
    centerOffset.z = -(objBox3.min.z + objBox3.max.z) * 0.5;

    var maxSize = Math.max((objBox3.max.x - objBox3.min.x), Math.max((objBox3.max.y - objBox3.min.y), (objBox3.max.z - objBox3.min.z)));
    var scale = uniformSize / maxSize;

    sceneRootNode.scale.x = scale;
    sceneRootNode.scale.y = scale;
    sceneRootNode.scale.z = scale;

    sceneRootNode.translateX(centerOffset.x * scale);
    sceneRootNode.translateY(centerOffset.y * scale);
    sceneRootNode.translateZ(centerOffset.z * scale);

    // console.log(sceneRootNode);
  }

  setupScene()
  {
    this.setCamera();

    this.addLights();

    window.content = this.content;
  }

  setCamera()
  {
    this.controls.reset();

    this.defaultCamera.position.copy(new Vector3(60.0, 0.0, 0.0));
    this.defaultCamera.lookAt(new Vector3());

    this.controls.target = new Vector3(0.0, 0.0, 0.0);

    this.controls.enabled = true;
    this.activeCamera = this.defaultCamera;

    this.controls.saveState();
  }

  addLights ()
  {
    if (!this.options || !this.options.baked)
    {
      const directionalLight  = new DirectionalLight(0xFFFFFF, 3.5);
      directionalLight.position.set(0.5, 1.2, 1.5);

      this.scene.add(directionalLight);
    }
  }

  SetComponentMatrix(componentKey,matrix){
    //  let componentID=this.slmLoader.GetElementPickingIdByKey(componentKey);
    let componentID=componentKey;
    if(componentID!=null){
      var mat0 = new Matrix4();
      mat0.multiply(this.slmLoader.GetElementMatrix(componentID)).multiply(this.slmLoader.GetElementGroupMatrix(componentID));

      var center = this.slmLoader.GetElementBoundsCenter(componentID);
      var trans0 = new Matrix4().makeTranslation(center.x, center.y, center.z);
      var rot = matrix;
      var trans1 = new Matrix4().makeTranslation(-center.x, -center.y, -center.z)

      var mat1 = new Matrix4();
      mat1.multiply(trans0).multiply(rot).multiply(trans1);

      var finalMat = new Matrix4();
      finalMat.multiply(mat1).multiply(mat0);

      var elemDesc = this.slmLoader.GetElementDesc(componentID);
      elemDesc.mesh.setInstanceMatrixAt(elemDesc.gId, elemDesc.iId, finalMat);
      elemDesc.mesh.instanceMatrices[elemDesc.gId].needsUpdate = true;
      // console.log("设置构件变化矩阵成功");
    }
    else{
      // console.log("设置构件变化矩阵失败,当前key值无效");
      return false;
    }
  }
}
