import {BufferAttribute, BufferGeometryEx, Group, Vector3} from "../three/build/three.module.js";
import {SpacePartitioning} from "./SpacePartitioning.js";
import {Voxelizer} from "../MyOccluder/Voxelizer.js";
import {Sampler} from "../MyOccluder/Sampler.js";
const { ipcRenderer } = require("electron");

class MeshSplitter{
    constructor(gltfScene,structDescription,matrixDescription,projectName){
        gltfScene.visible = false
        if(structDescription.length===1)
            this.meshNodeList = gltfScene.children
        else this.meshNodeList = gltfScene.children[0].children
        this.structDescription = structDescription
        this.matrixDescription = matrixDescription
        this.projectName = projectName
        this.stride = 3
        this.retain_uv3 = false

        this.newMeshList = []

        // console.log(this.meshNodeList)
        // console.log(this.structDescription)
        // console.log(this.projectName+" 已载入")

        this.splitAverage(0)
    }
    splitAverage(index){
        const group_num = 300
        var start = index*group_num
        var start_i = 0
        var N = 0
        while(N+this.structDescription[start_i].length <= start){
            N += this.structDescription[start_i].length
            start_i++
            if(start_i >= this.structDescription.length){
                console.log("split over")
                new SpacePartitioning(this.newMeshList, this.structDescription, this.matrixDescription, this.projectName)
                return
            }
        }
        var start_j = start-N
        // console.log(index,start_i,start_j)

        var sum_group = new Group()
        var matrices = []
        for(let n=0; n<group_num; n++,start_j++){
            if(n%100===0) console.log(index,start_i,start_j)
            if(start_j>=this.structDescription[start_i].length){
                start_i++
                start_j = 0
            }
            if(start_i>=this.structDescription.length){
                break
            }
            let node = this.meshNodeList[start_i]
            // console.log(node)
            // node.geometry.boundingBox = new Box3()
            // node.geometry.computeBoundingBox()
            // console.log(node.geometry.boundingBox)

            let stride = node.geometry.attributes.position.data.stride
            let group = this.structDescription[start_i][start_j]
            matrices.push(this.matrixDescription[group.n].it)

            let object = node.clone()
            if(this.structDescription[start_i].length===1){
                let position_arr = []
                for(let i=0; i<node.geometry.attributes.position.array.length; i+=stride){
                    for(let j=0; j<this.stride; j++){
                        position_arr.push(node.geometry.attributes.position.array[i+j])
                    }
                }
                let new_position_array = new Float32Array(position_arr)
                object.geometry.setAttribute("position",new BufferAttribute(new_position_array,this.stride))
                if(!this.retain_uv3) delete object.geometry.attributes.uv3
                if(node.geometry.attributes.normal){
                    delete object.geometry.attributes.normal
                    object.geometry.computeVertexNormals()
                }
            }else{
                // object.geometry = node.geometry.clone()
                object.geometry = new BufferGeometryEx()
                let normal_exist = false
                if(node.geometry.attributes.normal) normal_exist = true
                let uv_exist = false
                if(node.geometry.attributes.uv) uv_exist = true
                let index_arr = []
                for(let j=0; j<group.c*3; j+=3){
                    for(let k=0; k<3; k++){
                        index_arr.push(node.geometry.index.array[group.s*3+j+k])
                    }
                }
                let position_arr = []
                let normal_arr = []
                let uv3_arr = []
                let uv_arr = []
                let pushed_index = []
                let updated_index_arr = []
                let old_new_index_map = {}
                for(let j=0; j<index_arr.length; j++){
                    // let t = pushed_index.indexOf(index_arr[j])
                    // if(t===-1){
                    //     pushed_index.push(index_arr[j])
                    //     updated_index_arr.push(position_arr.length/this.stride)
                    //     for(let k=0; k<this.stride; k++){
                    //         position_arr.push(node.geometry.attributes.position.array[index_arr[j]*stride+k])
                    //         if(normal_exist) normal_arr.push(node.geometry.attributes.normal.array[index_arr[j]*stride+k])
                    //         if(this.retain_uv3) uv3_arr.push(node.geometry.attributes.uv3.array[index_arr[j]*stride+k])
                    //     }
                    //     if(uv_exist){
                    //         for(let k=0; k<2; k++){
                    //             uv_arr.push(node.geometry.attributes.uv.array[index_arr[j]*2+k])
                    //         }
                    //     }
                    // }else{
                    //     updated_index_arr.push(t)
                    // }
                    if(index_arr[j].toString() in old_new_index_map){
                        updated_index_arr.push(old_new_index_map[index_arr[j].toString()])
                    }else{
                        updated_index_arr.push(position_arr.length/this.stride)
                        old_new_index_map[index_arr[j].toString()] = updated_index_arr[updated_index_arr.length-1]
                        for(let k=0; k<this.stride; k++){
                            position_arr.push(node.geometry.attributes.position.array[index_arr[j]*stride+k])
                            if(normal_exist) normal_arr.push(node.geometry.attributes.normal.array[index_arr[j]*stride+k])
                            if(this.retain_uv3) uv3_arr.push(node.geometry.attributes.uv3.array[index_arr[j]*stride+k])
                        }
                        if(uv_exist){
                            for(let k=0; k<2; k++){
                                uv_arr.push(node.geometry.attributes.uv.array[index_arr[j]*2+k])
                            }
                        }
                    }
                }
                let new_position_array = new Float32Array(position_arr)
                let new_normal_array = new Float32Array(normal_arr)
                let new_uv3_array = new Float32Array(uv3_arr)
                let new_uv_array = new Float32Array(uv_arr)
                let new_index_array = new Uint32Array(updated_index_arr)
                for(let key in object.geometry.attributes){
                    delete object.geometry.attributes[key]
                }
                object.geometry.setAttribute("position",new BufferAttribute(new_position_array,this.stride))
                // if(normal_exist) object.geometry.setAttribute("normal",new BufferAttribute(new_normal_array,this.stride))
                // if(this.retain_uv3) object.geometry.setAttribute("uv3",new BufferAttribute(new_uv3_array,this.stride))
                // object.geometry.setAttribute("position",
                //     new InterleavedBufferAttribute(
                //         new InterleavedBuffer(new_position_array,this.stride),
                //         3,0))
                // if(normal_exist) object.geometry.setAttribute("normal",
                //     new InterleavedBufferAttribute(
                //         new InterleavedBuffer(new_normal_array,this.stride),
                //         3,0))
                // if(this.retain_uv3) object.geometry.setAttribute("uv3",
                //     new InterleavedBufferAttribute(
                //         new InterleavedBuffer(new_uv3_array,this.stride),
                //         3,0))
                if(uv_exist) object.geometry.setAttribute("uv",new BufferAttribute(new_uv_array,2))
                // object.geometry.index = new BufferAttribute(new_index_array,1)
                object.geometry.setIndex(new BufferAttribute(new_index_array,1))
                object.geometry.computeBoundingBox()
                object.geometry.computeBoundingSphere()
                if(normal_exist) object.geometry.computeVertexNormals()
            }
            object.name = (start+n).toString()
            sum_group.add(object)
            this.newMeshList.push(object)
            // console.log(object)
        }

        var occluder_info = calculateOccluder(index, sum_group.children)
        var fileData = JSON.stringify({
            name: "occluder"+index.toString()+".json",
            data: JSON.stringify({
                occluder:occluder_info,
                matrices:matrices
            }),
        });
        ipcRenderer.send("downloadJSON", fileData);

        this.splitAverage(index+1)
    }
}

function calculateOccluder(index,meshes){
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

    var list = []
    for(let i=0; i<occluderList.length; i++){
        var occluder = occluderList[i]
        var light_occluder = {x:{},y:{},z:{},c:occluder.c}
        for(let k=0; k<axis_list.length; k++){
            var axis = axis_list[k]
            var position_arr = occluder[axis].position
            var index_arr = occluder[axis].index
            var c = position_arr[k]
            for(let l=position_arr.length-3+k; l>=0; l-=3)
                position_arr.splice(l,1)
            for(let l=0; l<position_arr.length; l++)
                position_arr[l] = position_arr[l]
            light_occluder[axis] = {p:position_arr,i:index_arr,c:c}
        }
        list.push(light_occluder)
    }
    // console.log(light_occluder_list)

    return {index: indexList, list: list};
}


export {MeshSplitter}
