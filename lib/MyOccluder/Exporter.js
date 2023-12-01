import {
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial
} from "../threejs/build/three.module";
import {OBJExporter} from "../threejs/examples/jsm/exporters/OBJExporter";

class Exporter{
    constructor(occluderlist){
        this.occluderList = occluderlist
        this.occluderMeshList = []
    }
    createOccluderMesh(){
        for(let i=0; i<this.occluderList.length; i++){
            var occluders = this.occluderList[i]
            // console.log(occluders)
            var occluderMesh = createMesh(occluders,0xffffff)
            this.occluderMeshList.push(occluderMesh)
        }
        // console.log(this.occluderMeshList)
        this.objExport()
    }
    objExport(){
        var self = this
        var index = 0
        var obj_export = setInterval(function(){
            console.log(index+"/"+self.occluderMeshList.length)
            var group = new Group()
            var mesh = self.occluderMeshList[index].clone()
            group.add(mesh)
            var result = new OBJExporter().parse(group)
            // console.log(result)
            var fileName = 'ObjExport'+index+'.obj'
            var blob = new Blob([result])
            let link = document.createElement('a');
            link.href = URL.createObjectURL(blob)
            link.download = fileName
            link.click()
            if(++index>=self.occluderMeshList.length){
                console.log("导出obj完成")
                clearInterval(obj_export)
            }
        },200)
    }
    objExportXYZ(occluder,name){
        var axis_list = ['x','y','z']
        var index = 0
        var exporting = setInterval(function(){
            var axis = axis_list[index]
            var mesh = createMeshAxis(occluder,0xffffff,axis)
            var group = new Group()
            group.add(mesh)
            var result = new OBJExporter().parse(group)
            var fileName = name+'-'+axis+'.obj'
            var blob = new Blob([result])
            let link = document.createElement('a');
            link.href = URL.createObjectURL(blob)
            link.download = fileName
            link.click()
            if(++index===axis_list.length){
                console.log("导出obj完成")
                clearInterval(exporting)
            }
        },500)
    }
}

function createMesh(occluders, color){
    var new_position = []
    var new_index = []
    var last = occluders.length-1
    // var occluder = [occluders[last].x,occluders[last].y,occluders[last].z]
    var occluder = [occluders[last].z]
    for(let l=0; l<occluder.length; l++){
        var index = occluder[l].index
        var length = new_position.length/3
        for(let i=0; i<index.length; i++){
            new_index.push(index[i]+length)
        }
        var position = occluder[l].position
        for(let p=0; p<position.length; p++){
            new_position.push(position[p])
        }
    }
    // console.log(new_position)
    // console.log(new_index)
    var bufGeo = new BufferGeometry()
    new_position = new Float32Array(new_position)
    new_index = new Uint16Array(new_index)
    var attribute1 = new BufferAttribute(new_position,3)
    var attribute2 = new BufferAttribute(new_index,1)
    bufGeo.attributes.position = attribute1
    bufGeo.index = attribute2
    return new Mesh(bufGeo,new MeshBasicMaterial({color:color,side:DoubleSide}))
}

function createMeshAxis(occluders,color,axis){
    var new_position = []
    var new_index = []
    var occluder = occluders[axis]
    var index = occluder.index
    var length = new_position.length/3
    for(let i=0; i<index.length; i++){
        new_index.push(index[i]+length)
    }
    var position = occluder.position
    for(let p=0; p<position.length; p++){
        new_position.push(position[p])
    }
    var bufGeo = new BufferGeometry()
    new_position = new Float32Array(new_position)
    new_index = new Uint16Array(new_index)
    var attribute1 = new BufferAttribute(new_position,3)
    var attribute2 = new BufferAttribute(new_index,1)
    bufGeo.attributes.position = attribute1
    bufGeo.index = attribute2
    return new Mesh(bufGeo,new MeshBasicMaterial({color:color,side:DoubleSide}))
}

export {Exporter}