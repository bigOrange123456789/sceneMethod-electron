import {
    AmbientLight,
    AxesHelper,
    Box3,
    Box3Helper,
    BoxGeometry,
    BufferAttribute,
    Color,
    DirectionalLight,
    DoubleSide,
    EdgesGeometry,
    FileLoader,
    LineBasicMaterial,
    LineSegments,
    MeshBasicMaterial,
    PerspectiveCamera,
    Scene,
    Vector3,
    WebGLRenderer
} from "../threejs/build/three.min";
import {GLTFLoader} from "../threejs/examples/jsm/loaders/GLTFLoader";
import {BufferGeometry, Matrix4, Mesh} from "../threejs/build/three.module";
import {OrbitControls} from "../threejs/examples/jsm/controls/OrbitControls";
import {Voxelizer} from "./Voxelizer";
import {Sampler} from "./Sampler";

var projectName = ["changdi","jidian","15li","16wang","16wang2","B1Fzhang","B12F","Bli","Renzhang"]
var projectNum = [41,14,5,5,3,18,7,5,3]

export class Instance{
    constructor(){
        this.Mesh = []
        this.instanceMesh = []
        this.group_num = 6030
        this.mesh_num = 16800
        this.struct_desc = []
        this.matrix_desc = []

        for(let i=0; i<this.mesh_num; i++)
            this.Mesh.push(null)
    }
    loadResource(){
        var self = this
        var folder = "./assets/models/group/oufei/"
        var loader = new FileLoader()
        loader.load(folder+"structdesc.json", function(data){
            self.struct_desc = JSON.parse(data)
            // console.log(self.struct_desc)
            loader.load(folder+"smatrix.json", function(data){
                self.matrix_desc = JSON.parse(data)
                // console.log(self.matrix_desc)
                self.loadGroup(0)
            })
        })
    }
    instantiate(meshNodeList,struct_desc,matrix_desc,index){
        var instanceMesh = []
        for(let i=0; i<meshNodeList.length; i++){ //this.Mesh.length
            var instantiation = []
            var groupStruct = struct_desc[i][0]
            var groupName = parseInt(groupStruct.n)
            // console.log(groupStruct)
            // console.log(groupName)
            matrix_desc[groupName].id.push(groupName)
            matrix_desc[groupName].it.push([1,0,0,0,0,1,0,0,0,0,1,0])
            var instanceInfo = matrix_desc[groupName]
            // console.log(instanceInfo)
            for(let j=0; j<instanceInfo.id.length; j++){
                var mat = instanceInfo.it[j]
                var instanceMatrix = new Matrix4()
                instanceMatrix.set(
                    mat[0], mat[1], mat[2], mat[3],
                    mat[4], mat[5], mat[6], mat[7],
                    mat[8], mat[9], mat[10], mat[11],
                    0, 0, 0, 1)
                // console.log(instanceMatrix)
                var mesh = meshNodeList[i].clone()
                mesh.geometry = mesh.geometry.clone()
                // mesh.applyMatrix4(instanceMatrix)
                var position_arr = mesh.geometry.attributes.position.array
                var new_position_arr = []
                // console.log(position_arr)
                for(let k=0; k<position_arr.length; k+=3){
                    var vector = new Vector3(position_arr[k],position_arr[k+1],position_arr[k+2])
                    vector.applyMatrix4(instanceMatrix)
                    new_position_arr.push(vector.x)
                    new_position_arr.push(vector.y)
                    new_position_arr.push(vector.z)
                }
                new_position_arr = new Float32Array(new_position_arr)
                // console.log(new_position_arr)
                mesh.geometry.attributes.position.array = new_position_arr
                mesh.geometry.computeBoundingBox()
                mesh.geometry.computeBoundingSphere()
                // console.log(mesh)
                // window.scene.add(mesh)
                // var box = new Box3().setFromObject(mesh)
                // console.log(box)
                // window.scene.add(new Box3Helper(box))
                instantiation.push(mesh)
            }
            instanceMesh.push(instantiation)
        }
        // console.log("模型格式转换完毕")
        // console.log(instanceMesh)
        this.occluderCal(instanceMesh,index)
    }
    occluderCal(meshNodeList,id,index){
        console.log(index+"/"+projectNum[id])
        var occluderList = []
        var index_list = []
        for(let i=0; i<meshNodeList.length; i++){//this.instanceMesh.length
            var mesh = meshNodeList[i]
            index_list.push(Number(mesh.name))
            var new_mesh = calculateMesh(mesh.geometry)
            var voxel_list = voxelize(new_mesh)
            // console.log("体素构建完成")
            var res = sampling(voxel_list)
            res.c = [mesh.material.color.r,mesh.material.color.g,mesh.material.color.b]
            occluderList.push(res)
        }
        // console.log("occluder计算完成")
        // console.log(occluderList)

        const precision = 1000

        var axis_list = ['x','y','z']
        var list = []
        for(let i=0; i<occluderList.length; i++){
            var occluder = occluderList[i]
            var light_occluder = {x:{},y:{},z:{},c:occluder.c}
            for(let k=0; k<axis_list.length; k++){
                var axis = axis_list[k]
                var position_arr = occluder[axis].position
                var index_arr = occluder[axis].index
                var c = Math.round(position_arr[k]*precision)/precision
                for(let l=position_arr.length-3+k; l>=0; l-=3)
                    position_arr.splice(l,1)
                for(let l=0; l<position_arr.length; l++)
                    position_arr[l] = Math.round(position_arr[l]*precision)/precision
                light_occluder[axis] = {p:position_arr,i:index_arr,c:c}
            }
            list.push(light_occluder)
        }
        // console.log(light_occluder_list)

        var json = {index:index_list,list:list}
        var jsonStr = JSON.stringify(json)
        var blob = new Blob([jsonStr])
        let link = document.createElement('a');
        link.href = URL.createObjectURL(blob)
        link.download = projectName[id]+"_occluder"+index+".json"
        link.click()
        var self = this
        setTimeout(function(){
            self.loadGroup(id,index+1)
        },200)
    }
    loadGroup(id,index){
        if(index===projectNum[id]){
            if(id===projectName.length){
                console.log("occluder计算完成")
            }else{
                this.loadGroup(id+1,0)
            }
        }else{
            var self = this
            new GLTFLoader().load("./assets/models/"+projectName[id]+"/"+projectName[id]+"_output"+index+".gltf",(gltf)=>{
                var meshNodeList = gltf.scene.children[0].children
                self.occluderCal(meshNodeList,id,index)
            })
        }
    }
}

function createScene(){
    var scene = new Scene()
    window.scene = scene
    var camera = new PerspectiveCamera(60,document.body.clientWidth/document.body.clientHeight,0.1,10000)
    var renderer = new WebGLRenderer({
        alpha:true,
        antialias:false,
        canvas:document.getElementById('myCanvas'),
        preserveDrawingBuffer:true});
    renderer.setSize(document.body.clientWidth,document.body.clientHeight);
    document.body.appendChild(renderer.domElement);
    camera.position.set(20,20,20)
    camera.lookAt(0,0,0)
    scene.add(camera)
    var ambLight = new AmbientLight(0xffffff,1)
    scene.add(ambLight)
    var axes = new AxesHelper(100);
    scene.add(axes);
    var orbit = new OrbitControls(camera,renderer.domElement);
    // orbit.target.set(162.3675537109375,103.64779663085938,44.03192138671875)
    // renderer.render(scene,camera)
    // console.log(renderer.info.render)
    requestAnimationFrame(animate)
    function animate(){
        requestAnimationFrame(animate);
        renderer.render(scene,camera);
    }
}

function calculateMesh(geometry){
    // console.log(geometry)
    var point_arr = geometry.attributes.position.array
    // var stride = geometry.attributes.position.data.stride
    var stride = 3
    var face_arr = geometry.index.array
    // console.log(point_arr)
    // console.log(face_arr)
    var vertices_arr = []
    for(let i=0; i<face_arr.length; i++){
        vertices_arr.push(point_arr[face_arr[i]*stride])
        vertices_arr.push(point_arr[face_arr[i]*stride+1])
        vertices_arr.push(point_arr[face_arr[i]*stride+2])
    }
    var vertices = new Float32Array(vertices_arr)
    // console.log(vertices)
    var attribute = new BufferAttribute(vertices,3)
    var geo = new BufferGeometry()
    geo.attributes.position = attribute
    var mat = new MeshBasicMaterial({ color:0x00ff00,side:DoubleSide })
    var mesh = new Mesh(geo,mat)
    // console.log(mesh)
    // var box = new Box3().setFromObject(mesh)
    // console.log(box)
    // window.scene.add(new Box3Helper(box))
    // window.scene.add(mesh)

    // return voxelize(mesh)
    return mesh
}

function voxelize(mesh){
    // console.log(mesh)
    var voxelizer = new Voxelizer(mesh)
    // console.log(voxelizer.voxel_list)
    // showVoxel(voxelizer.voxel_list)
    return voxelizer.voxel_list
}

function sampling(voxel_list){
    var sample_res = [[],[],[]]
    var sample_dir = [      //采样方向
        new Vector3(1,0,0),
        new Vector3(0,1,0),
        new Vector3(0,0,1)
    ]
    var sample_count = [voxel_list.length, voxel_list[0].length, voxel_list[0][0].length]
    for(let i=0; i<sample_dir.length; i++){//sample_dir.length
        var sampler = new Sampler(voxel_list,sample_count[i])
        sample_res[i] = sampler.sampling(sample_dir[i])
        // console.log(res[i])
    }
    return { x:sample_res[0], y:sample_res[1], z:sample_res[2] }
}

function showVoxel(voxel_list){
    for(let i=0; i<voxel_list.length; i++){
        for(let j=0; j<voxel_list[i].length; j++){
            for(let k=0; k<voxel_list[i][j].length; k++){
                var voxel = voxel_list[i][j][k]
                // console.log(voxel)
                if(voxel.filled===true){
                    var cube = new BoxGeometry(voxel.voxel_length,voxel.voxel_length,voxel.voxel_length,1,1,1)
                    var edge = new EdgesGeometry(cube,60);
                    var line = new LineSegments( edge, new LineBasicMaterial( { color: 0x000000 } ) )
                    var r = Math.floor(256*Math.random());
                    var g = Math.floor(256*Math.random());
                    var b = Math.floor(256*Math.random());
                    var color = `rgb(${r},${g},${b})`;
                    var mat = new MeshBasicMaterial({ color:new Color(color) })//color:new Color(color)
                    var mesh = new Mesh(cube, mat)
                    mesh.position.set((voxel.Box.min.x+voxel.Box.max.x)/2,(voxel.Box.min.y+voxel.Box.max.y)/2,(voxel.Box.min.z+voxel.Box.max.z)/2)
                    // mesh.add(line)
                    window.scene.add(mesh)
                }
            }
        }
    }
}
