import {
    Box3,
    BufferAttribute, BufferGeometryEx,
    Group,
    InterleavedBuffer,
    InterleavedBufferAttribute,
    Scene,
    Vector3
} from "../three/build/three.module.js";
import { GLTFExporter } from "../three/examples/jsm/exporters/GLTFExporter.js";
import { SpacePartitioning } from "./SpacePartitioning.js";

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
            let object = node.clone()
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
            for(let j=0; j<index_arr.length; j++){
                let t = pushed_index.indexOf(index_arr[j])
                if(t===-1){
                    pushed_index.push(index_arr[j])
                    updated_index_arr.push(position_arr.length/this.stride)
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
                }else{
                    updated_index_arr.push(t)
                }
            }
            let new_position_array = new Float32Array(position_arr)
            let new_normal_array = new Float32Array(normal_arr)
            let new_uv3_array = new Uint8Array(uv3_arr)
            let new_uv_array = new Uint16Array(uv_arr)
            let new_index_array = new Uint16Array(updated_index_arr)
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
            object.geometry.computeVertexNormals()
            object.name = (start+n).toString()
            // sum_group.add(object)
            this.newMeshList.push(object)
            // console.log(object)
        }
        // var scene = new Scene()
        // scene.add(sum_group)
        // // console.log(scene)
        // var self = this
        // var fileName = this.projectName+"_output"+index+".gltf"
        // new GLTFExporter().parse(scene,function(result){
        //     var myBlob=new Blob([JSON.stringify(result)], { type: 'text/plain' })
        //     let link = document.createElement('a')
        //     link.href = URL.createObjectURL(myBlob)
        //     link.download = fileName
        //     link.click()
        //     setTimeout(function(){
        //         self.splitAverage(index+1)
        //     },500)
        // })
        this.splitAverage(index+1)
    }
}

export {MeshSplitter}
