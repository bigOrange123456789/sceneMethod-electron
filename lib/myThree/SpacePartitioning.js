import {
  Box3,
  Box3Helper,
  BufferAttribute,
  Group,
  InstancedMeshEx,
  Matrix4,
  Quaternion,
  Scene,
  Vector3,
} from "../three/build/three.module.js";
import { GLTFLoaderEx } from "../three/examples/jsm/loaders/GLTFLoaderEx.js";
import { GLTFExporter } from "../three/examples/jsm/exporters/GLTFExporter.js";
const { ipcRenderer } = require("electron");

var instanceBoxList = []
var instanceSphereList = []
const max_size = 150

export class SpacePartitioning {
  constructor(meshList, structDesc, matrixDesc, projectName) {
    this.structList = [];
    for (let i = 0; i < structDesc.length; i++)
      for (let j = 0; j < structDesc[i].length; j++)
        this.structList.push(structDesc[i][j]);
    this.matrixList = matrixDesc;
    this.meshList = meshList;
    instanceBoxList = new Array(this.structList.length);
    instanceSphereList = new Array(this.structList.length);
    this.projectName = projectName;

    this.sceneBox = null;
    this.standardSize = 3000;

    download(structDesc, "structdesc.json");
    download(matrixDesc, "smatrix.json");
    // console.log(this.structList)
    // console.log(this.matrixList)
    // console.log(this.projectName)

    this.loadFiles();
  }
  loadFiles() {
    // 加载模型
    for (let i = 0; i < this.meshList.length; i++) {
      this.readModel(
        i,
        this.meshList[i],
        this.matrixList[this.structList[i].n].it
      );
    }
    // console.log(instanceBoxList)
    this.uniformScene();
  }
  readModel(meshIndex, mesh, matrices) {
    // console.log(mesh)
    // console.log(matrices)
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    var instance_boxes = [];
    var instance_spheres = [];
    matrices.push([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
    for (let i = 0; i < matrices.length; i++) {
      let mat = matrices[i];
      let instance_matrix = new Matrix4().set(
        mat[0],
        mat[1],
        mat[2],
        mat[3],
        mat[4],
        mat[5],
        mat[6],
        mat[7],
        mat[8],
        mat[9],
        mat[10],
        mat[11],
        0,
        0,
        0,
        1
      );
      let box = mesh.geometry.boundingBox.clone().applyMatrix4(instance_matrix);
      let sphere = mesh.geometry.boundingSphere
        .clone()
        .applyMatrix4(instance_matrix);
      if (this.sceneBox) this.sceneBox.union(box);
      else this.sceneBox = box.clone();
      instance_boxes.push(box);
      instance_spheres.push(sphere);
    }
    instanceBoxList[meshIndex] = instance_boxes;
    instanceSphereList[meshIndex] = instance_spheres;
  }
  uniformScene() {
    var temp = new Group();

    var maxEdge = Math.max(
      this.sceneBox.max.x - this.sceneBox.min.x,
      this.sceneBox.max.y - this.sceneBox.min.y,
      this.sceneBox.max.z - this.sceneBox.min.z
    );
    var scalar = this.standardSize / maxEdge;
    this.sceneBox.min.multiplyScalar(scalar);
    this.sceneBox.max.multiplyScalar(scalar);
    temp.scale.multiplyScalar(scalar);

    var center = this.sceneBox.getCenter(new Vector3());
    this.sceneBox.min.sub(center);
    this.sceneBox.max.sub(center);
    temp.position.sub(center);

    temp.updateWorldMatrix();
    this.matrixWorld = temp.matrixWorld;
    for (let i = 0; i < instanceBoxList.length; i++)
      for (let j = 0; j < instanceBoxList[i].length; j++) {
        instanceBoxList[i][j].applyMatrix4(this.matrixWorld);
        instanceSphereList[i][j].applyMatrix4(this.matrixWorld);
      }

    this.buildTree();
  }
  buildTree() {
    var meshList = []
    var meshSurfaceList = []
    for(let i=0; i<instanceBoxList.length; i++){
      if(instanceBoxList[i]){
        meshList.push(i)
        var surface = 0
        for(let j=0; j<instanceBoxList[i].length; j++){
          var Size = getSize(instanceBoxList[i][j])
          surface += (Size.x*Size.y+Size.x*Size.z+Size.y*Size.z)
        }
        meshSurfaceList.push(surface)
      }
    }
    quickSort(meshSurfaceList,meshList,0,meshList.length-1)


    this.times = 12
    var node_list1 = partition(this.times,this.sceneBox)
    var x_times1 = node_list1.length
    var y_times1 = node_list1[0].length
    var z_times1 = node_list1[0][0].length
    var x_length1 = (this.sceneBox.max.x-this.sceneBox.min.x)/x_times1
    var y_length1 = (this.sceneBox.max.y-this.sceneBox.min.y)/y_times1
    var z_length1 = (this.sceneBox.max.z-this.sceneBox.min.z)/z_times1
    for(let m=0; m<Math.floor(meshList.length/100); m++){
      let i = meshList[m]
      for(let j=0; j<instanceBoxList[i].length; j++){
        let box = instanceBoxList[i][j]
        let x_start,x_end,y_start,y_end,z_start,z_end
        [x_start,x_end] = computeSE(box.min.x,box.max.x,this.sceneBox.min.x,x_length1,x_times1);
        [y_start,y_end] = computeSE(box.min.y,box.max.y,this.sceneBox.min.y,y_length1,y_times1);
        [z_start,z_end] = computeSE(box.min.z,box.max.z,this.sceneBox.min.z,z_length1,z_times1);
        for(let x=x_start; x<x_end; x++)
          for(let y=y_start; y<y_end; y++)
            for(let z=z_start; z<z_end; z++)
              if(!node_list1[x][y][z].meshIndex.includes(i))
                node_list1[x][y][z].meshIndex.push(i)
      }
    }

    this.times = 15
    var node_list2 = partition(this.times,this.sceneBox)
    var x_times2 = node_list2.length
    var y_times2 = node_list2[0].length
    var z_times2 = node_list2[0][0].length
    var x_length2 = (this.sceneBox.max.x-this.sceneBox.min.x)/x_times2
    var y_length2 = (this.sceneBox.max.y-this.sceneBox.min.y)/y_times2
    var z_length2 = (this.sceneBox.max.z-this.sceneBox.min.z)/z_times2
    for(let m=Math.floor(meshList.length/100); m<Math.floor(meshList.length/10); m++){
      let i = meshList[m]
      for(let j=0; j<instanceBoxList[i].length; j++){
        let box = instanceBoxList[i][j]
        let x_start,x_end,y_start,y_end,z_start,z_end
        [x_start,x_end] = computeSE(box.min.x,box.max.x,this.sceneBox.min.x,x_length2,x_times2);
        [y_start,y_end] = computeSE(box.min.y,box.max.y,this.sceneBox.min.y,y_length2,y_times2);
        [z_start,z_end] = computeSE(box.min.z,box.max.z,this.sceneBox.min.z,z_length2,z_times2);
        for(let x=x_start; x<x_end; x++)
          for(let y=y_start; y<y_end; y++)
            for(let z=z_start; z<z_end; z++)
              if(!node_list2[x][y][z].meshIndex.includes(i))
                node_list2[x][y][z].meshIndex.push(i)
      }
    }

    this.times = 18
    var node_list3 = partition(this.times,this.sceneBox)
    var x_times3 = node_list3.length
    var y_times3 = node_list3[0].length
    var z_times3 = node_list3[0][0].length
    var x_length3 = (this.sceneBox.max.x-this.sceneBox.min.x)/x_times3
    var y_length3 = (this.sceneBox.max.y-this.sceneBox.min.y)/y_times3
    var z_length3 = (this.sceneBox.max.z-this.sceneBox.min.z)/z_times3
    for(let m=Math.floor(meshList.length/10); m<meshList.length; m++){
      let i = meshList[m]
      for(let j=0; j<instanceBoxList[i].length; j++){
        let box = instanceBoxList[i][j]
        let x_start,x_end,y_start,y_end,z_start,z_end
        [x_start,x_end] = computeSE(box.min.x,box.max.x,this.sceneBox.min.x,x_length3,x_times3);
        [y_start,y_end] = computeSE(box.min.y,box.max.y,this.sceneBox.min.y,y_length3,y_times3);
        [z_start,z_end] = computeSE(box.min.z,box.max.z,this.sceneBox.min.z,z_length3,z_times3);
        for(let x=x_start; x<x_end; x++)
          for(let y=y_start; y<y_end; y++)
            for(let z=z_start; z<z_end; z++)
              if(!node_list3[x][y][z].meshIndex.includes(i))
                node_list3[x][y][z].meshIndex.push(i)
      }
    }

    var n1 = 0
    var n2 = 0
    var n3 = 0

    for(let i=0; i<node_list3.length; i++)
      for(let j=0; j<node_list3[i].length; j++)
        for(let k=0; k<node_list3[i][j].length; k++){
          if(node_list3[i][j][k].meshIndex.length){
            let pi = Math.floor(i/2)
            let pj = Math.floor(j/2)
            let pk = Math.floor(k/2)
            node_list2[pi][pj][pk].children.push(node_list3[i][j][k])
            n3++
          }
        }

    for(let i=0; i<node_list2.length; i++)
      for(let j=0; j<node_list2[i].length; j++)
        for(let k=0; k<node_list2[i][j].length; k++){
          if(node_list2[i][j][k].meshIndex.length || node_list2[i][j][k].children.length){
            let pi = Math.floor(i/2)
            let pj = Math.floor(j/2)
            let pk = Math.floor(k/2)
            node_list1[pi][pj][pk].children.push(node_list2[i][j][k])
            n2++
          }
        }

    var result = []
    for(let i=0; i<node_list1.length; i++)
      for(let j=0; j<node_list1[i].length; j++)
        for(let k=0; k<node_list1[i][j].length; k++){
          if(node_list1[i][j][k].meshIndex.length || node_list1[i][j][k].children.length){
            let node = node_list1[i][j][k].transformResult()
            result.push(node)
            n1++
          }
        }

    var scene_graph = { graph:result, matrix: this.matrixWorld.elements };

    download(scene_graph, "sceneGraph.json");

    var self = this;
    // setTimeout(function () {
    download(instanceSphereList, "boundingSphere.json");
    //  }, 200);

    // setTimeout(function () {
    download(instanceBoxList, "boundingBox.json");
    //  }, 400);

    //setTimeout(function () {
    self.exportGLTF();
    //  }, 600);
  }
  async exportGLTF() {
    const export_start = 0;
    const export_end = this.meshList.length;
    var self = this;

    let exportFun = (index) => {
      let scene = new Scene();
      let group = new Group();
      let object = self.meshList[index].clone();
      group.add(object);
      scene.add(group);
      let fileName = "model" + index + ".gltf";
      new GLTFExporter().parse(scene, async function (result) {
        let fileData = JSON.stringify({
          name: fileName,
          data: JSON.stringify(result),
        });
        await ipcRenderer.invoke("exportGltf", fileData);
        index++;
        if (index === export_end) {
          console.log("export end");
          ipcRenderer.send("quit", "export end");
        } else {
          exportFun(index);
        }
      });
    };

    exportFun(export_start);
  }
}

class Node{
  constructor(id,min,max){
    this.id = id
    this.meshIndex = []
    this.meshMatrices = []
    this.children = []
    this.box = new Box3(min,max)
    this.center = new Vector3((min.x+max.x)/2,(min.y+max.y)/2,(min.z+max.z)/2)
    this.radius = max.clone().sub(min).length()/2
    this.leftNode = null
    this.rightNode = null
  }
  addData(index){
    this.meshIndex.push(index)
  }
  splitNode(){
    for(let i=max_size; i<this.meshIndex.length; i++){
      var instanceBox = instanceBoxList[this.meshIndex[i]]
      var leftBox = getSubBox(this.box,0)
      var rightBox = getSubBox(this.box,1)
      var leftIntersect = getSize(instanceBox.clone().intersect(leftBox))
      var rightIntersect = getSize(instanceBox.clone().intersect(rightBox))
      var leftIntersectV = leftIntersect.x*leftIntersect.y*leftIntersect.z
      var rightIntersectV = rightIntersect.x*rightIntersect.y*rightIntersect.z
      if(leftIntersectV>rightIntersectV){
        if(!this.leftNode) this.createLeftNode(leftBox)
        this.leftNode.addData(this.meshIndex[i])
      }else if(leftIntersectV<rightIntersectV){
        if(!this.rightNode) this.createRightNode(rightBox)
        this.rightNode.addData(this.meshIndex[i])
      }else{
        if(Math.random()<0.5){
          if(!this.leftNode) this.createLeftNode(leftBox)
          this.leftNode.addData(this.meshIndex[i])
        }else{
          if(!this.rightNode) this.createRightNode(rightBox)
          this.rightNode.addData(this.meshIndex[i])
        }
      }
    }
    this.meshIndex.splice(max_size)
    if(this.leftNode) this.leftNode.matchBox()
    if(this.rightNode) this.rightNode.matchBox()
  }
  fillJudge(){
    return this.meshIndex.length>max_size
  }
  createLeftNode(box){
    this.leftNode = new Node(this.id*2,box.min,box.max)
  }
  createRightNode(box){
    this.rightNode = new Node(this.id*2+1,box.min,box.max)
  }
  matchBox(){
    // console.log(this.id,this.meshIndex.length)
    var boxes = []
    for(let i=0; i<this.meshIndex.length; i++)
      boxes.push(instanceBoxList[this.meshIndex[i]])
    this.box = getBoundingBox(boxes)
    if(this.fillJudge())
      this.splitNode()
  }
  containPoint(pos){
    return this.box.containsPoint(pos)
  }
  transformResult(){
    let result = {
      meshIndex:this.meshIndex,
      nodeBox:[[this.box.min.x,this.box.min.y,this.box.min.z],[this.box.max.x,this.box.max.y,this.box.max.z]],
      children:[]
    }
    for(let i=0; i<this.children.length; i++)
      result.children.push(this.children[i].transformResult())

    return result
  }
}

function partition(times, sceneBox) {
  var node = new Node(0, sceneBox.min, sceneBox.max);
  while (times > 0) {
    let leftBox = getSubBox(node.box, 0);
    node = new Node(node.id * 2, leftBox.min, leftBox.max);
    times--;
  }
  // console.log(node.box)
  var x_times = Math.round(
    (sceneBox.max.x - sceneBox.min.x) / (node.box.max.x - node.box.min.x)
  );
  var y_times = Math.round(
    (sceneBox.max.y - sceneBox.min.y) / (node.box.max.y - node.box.min.y)
  );
  var z_times = Math.round(
    (sceneBox.max.z - sceneBox.min.z) / (node.box.max.z - node.box.min.z)
  );
  // console.log(x_times,y_times,z_times)
  var x_length = (sceneBox.max.x - sceneBox.min.x) / x_times;
  var y_length = (sceneBox.max.y - sceneBox.min.y) / y_times;
  var z_length = (sceneBox.max.z - sceneBox.min.z) / z_times;
  // console.log(x_length,y_length,z_length)
  var node_set = [];
  for (let i = 0; i < x_times; i++) {
    let x_list = [];
    for (let j = 0; j < y_times; j++) {
      let y_list = [];
      for (let k = 0; k < z_times; k++) {
        let min = new Vector3(
          sceneBox.min.x + i * x_length,
          sceneBox.min.y + j * y_length,
          sceneBox.min.z + k * z_length
        );
        let max = new Vector3(
          sceneBox.min.x + (i + 1) * x_length,
          sceneBox.min.y + (j + 1) * y_length,
          sceneBox.min.z + (k + 1) * z_length
        );
        let node = new Node(i * y_times * z_times + j * z_times + k, min, max);
        y_list.push(node);
      }
      x_list.push(y_list);
    }
    node_set.push(x_list);
  }
  // console.log(node_set)
  return node_set;
}

function getSize(box) {
  return {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z,
  };
}

function getSubBox(box, LR) {
  var boxAxis = getSize(box);
  var center = new Vector3(
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2
  );
  if (!LR) {
    //0-left
    if (boxAxis.x >= boxAxis.y && boxAxis.x >= boxAxis.z) {
      //x最长
      return new Box3(box.min, new Vector3(center.x, box.max.y, box.max.z));
    } else if (boxAxis.y >= boxAxis.x && boxAxis.y >= boxAxis.z) {
      //y最长
      return new Box3(box.min, new Vector3(box.max.x, center.y, box.max.z));
    } else {
      //z最长
      return new Box3(box.min, new Vector3(box.max.x, box.max.y, center.z));
    }
  } else {
    //1-right
    if (boxAxis.x >= boxAxis.y && boxAxis.x >= boxAxis.z) {
      //x最长
      return new Box3(new Vector3(center.x, box.min.y, box.min.z), box.max);
    } else if (boxAxis.y >= boxAxis.x && boxAxis.y >= boxAxis.z) {
      //y最长
      return new Box3(new Vector3(box.min.x, center.y, box.min.z), box.max);
    } else {
      //z最长
      return new Box3(new Vector3(box.min.x, box.min.y, center.z), box.max);
    }
  }
}

function getBoundingBox(boxes) {
  var boundingBox = boxes[0].clone();
  for (let i = 1; i < boxes.length; i++) {
    boundingBox.min.min(boxes[i].min);
    boundingBox.max.max(boxes[i].max);
  }
  return boundingBox;
}

function quickSort(arr_1, arr_2, begin, end) {
  if (begin >= end) return;
  var l = begin;
  var r = end;
  var temp = arr_1[begin];
  while (l < r) {
    while (l < r && arr_1[r] <= temp) r--;
    while (l < r && arr_1[l] >= temp) l++;
    [arr_1[l], arr_1[r]] = [arr_1[r], arr_1[l]];
    [arr_2[l], arr_2[r]] = [arr_2[r], arr_2[l]];
  }
  [arr_1[begin], arr_1[l]] = [arr_1[l], arr_1[begin]];
  [arr_2[begin], arr_2[l]] = [arr_2[l], arr_2[begin]];
  quickSort(arr_1, arr_2, begin, l - 1);
  quickSort(arr_1, arr_2, l + 1, end);
}

function computeSE(min, max, scene_min, scene_length, times) {
  var start = Math.max(Math.floor((min - scene_min) / scene_length), 0);
  var end = Math.min(Math.ceil((max - scene_min) / scene_length), times);
  return [start, end];
}

async function download(data, name) {
  var fileData = JSON.stringify({
    name: name,
    data: JSON.stringify(data),
  });
  ipcRenderer.send("downloadJSON", fileData);
}
