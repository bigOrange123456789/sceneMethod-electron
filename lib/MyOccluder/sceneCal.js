import {
    AmbientLight,
    AxesHelper,
    BoxGeometry,
    Box3,
    BufferAttribute,
    DoubleSide,
    EdgesGeometry,
    FileLoader,
    LineBasicMaterial,
    LineSegments,
    LoadingManager,
    MeshBasicMaterial,
    PerspectiveCamera,
    Scene,
    Vector3,
    WebGLRenderer
} from "../threejs/build/three.min";
import {GLTFLoader} from "../threejs/examples/jsm/loaders/GLTFLoader";
import {Voxelizer} from "./Voxelizer";
import {Sampler} from "./Sampler";

// var sceneBox = new Box3()
// var matrixList = new Array(432665)
// var meshList = new Array(432665)

loadTreeInfo()

function loadTreeInfo(){
    // var url = "assets/treeInfo-10.27.zip"
    // var loader = new LoadingManager()
    // new Promise(function(resolve,reject){
    //     new ZipLoader().load(url,()=>{},()=>{
    //         console.log("treeInfo加载失败")
    //     }).then((zip)=>{
    //         loader.setURLModifier(zip.urlResolver)
    //         resolve(zip.find(/\.(json)$/i)[0])
    //     })
    // }).then(function(fileUrl){
    //     new FileLoader(loader).load(fileUrl,(json)=> {
    //         var units = Object.keys(JSON.parse(json))
    //
    //         loadUnit(0,units)
    //     })
    // })
    var units = []
    for(let i=0; i<3; i++)
        units.push(i)
    loadUnit(0, units)
}

function loadUnit(index, units){
    if(index===units.length) {
        console.log("load over")
        // console.log(sceneBox)
        return
    }else{
        console.log("load "+index+"/"+units.length)
    }
    var url = "assets/models/BistroExterior/BistroExterior_output"+units[index]+".gltf"
    new GLTFLoader().load(url, (gltf)=>{
        var meshes = gltf.scene.children[0].children
        // for(let i=0; i<meshes.length; i++){
        //     meshList[Number(meshes[i].name)] = meshes[i]
        //     sceneBox.expandByObject(meshes[i])
        // }
        calculateOccluder(index,units,meshes)
    })

}

function calculateOccluder(index,units,meshes){
    var indexList = []
    var occluderList = []
    var axis_list = ['x','y','z']
    for(let i=0; i<meshes.length; i++){
        let sample_res = {}
        let sample_dir = [      //采样方向
            new Vector3(1,0,0),
            new Vector3(0,1,0),
            new Vector3(0,0,1)
        ]
        let voxelizer = new Voxelizer(meshes[i])
        let voxel_list = voxelizer.voxel_list
        for(let j=0; j<3; j++){
            // console.log(voxel_list)
            let sampler = new Sampler(voxel_list,16)
            sample_res[axis_list[j]] = sampler.sampling(sample_dir[j])
        }
        sample_res.c = [meshes[i].material.color.r,meshes[i].material.color.g,meshes[i].material.color.b]
        indexList.push(meshes[i].name)
        occluderList.push(sample_res)
    }
    // console.log(occluderList)

    const precision = 1000

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

    var json = {index:indexList,list:list}
    // console.log(json)

    var jsonStr = JSON.stringify(json)
    var blob = new Blob([jsonStr])
    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob)
    link.download = "occluder"+units[index]+".json"
    link.click()

    loadUnit(index+1,units)
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
    for(let i=0; i<sample_dir.length; i++){
        var sampler = new Sampler(voxel_list,sample_count[i])
        sample_res[i] = sampler.sampling(sample_dir[i])
        // console.log(res[i])
    }
    return { x:sample_res[0], y:sample_res[1], z:sample_res[2] }
}
