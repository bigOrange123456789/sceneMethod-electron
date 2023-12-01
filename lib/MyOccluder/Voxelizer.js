import {
    Box3,
    Vector3
} from "../three/build/three.module.js";
import {Voxel} from "./Voxel.js";

export class Voxelizer{
    constructor(mesh){
        this.id = Number(mesh.name)
        // console.log(mesh)
        this.voxel_num = 2000   //体素数量
        this.pixel_limit = 12    //轴向像素限制
        this.geometry = mesh.geometry.clone()
        this.geometry.computeBoundingBox()
        this.Box = this.geometry.boundingBox.clone()
        // console.log(this.Box)
        // console.log(this.geometry)
        this.faces = getFaces(this.geometry)
        // console.log(this.faces)
        this.voxel_list = []
        this.initVoxelization()
    }
    initVoxelization(){
        // console.log(this.Box.min,this.Box.max)
        var x_length = this.Box.max.x-this.Box.min.x
        var y_length = this.Box.max.y-this.Box.min.y
        var z_length = this.Box.max.z-this.Box.min.z
        // console.log(x_length,y_length,z_length)
        if(x_length===0){
            this.Box.max.x+=0.5
            this.Box.min.x-=0.5
        }
        if(y_length===0){
            this.Box.max.y+=0.5
            this.Box.min.y-=0.5
        }
        if(z_length===0){
            this.Box.max.z+=0.5
            this.Box.min.z-=0.5
        }
        // var n = Math.cbrt(this.voxel_num/(x_length*y_length*z_length))
        // if(x_length*100>=y_length+z_length && y_length*100>=x_length+z_length && z_length*100>=x_length+y_length){
        //     this.x_num = Math.ceil(n*x_length)
        //     this.voxel_length = x_length/this.x_num
        // }else if(x_length*100>=y_length+z_length && y_length*100>=x_length+z_length){
        //     n = Math.sqrt((this.voxel_num/Math.cbrt(this.voxel_num))/(x_length*y_length))
        //     this.x_num = Math.ceil(n*x_length)
        //     this.voxel_length = x_length/this.x_num
        // }else if(x_length*100>=y_length+z_length && z_length*100>=x_length+y_length){
        //     n = Math.sqrt((this.voxel_num/Math.cbrt(this.voxel_num))/(x_length*z_length))
        //     this.z_num = Math.ceil(n*z_length)
        //     this.voxel_length = z_length/this.z_num
        // }else if(y_length*100>=x_length+z_length && z_length*100>=x_length+y_length){
        //     n = Math.sqrt((this.voxel_num/Math.cbrt(this.voxel_num))/(y_length*z_length))
        //     this.y_num = Math.ceil(n*y_length)
        //     this.voxel_length = y_length/this.y_num
        // }else if(x_length*100>=y_length+z_length){
        //     n = Math.cbrt(this.voxel_num)/x_length
        //     this.x_num = Math.ceil(n*x_length)
        //     this.voxel_length = x_length/this.x_num
        // }else if(y_length*100>=x_length+z_length){
        //     n = Math.cbrt(this.voxel_num)/y_length
        //     this.y_num = Math.ceil(n*y_length)
        //     this.voxel_length = y_length/this.y_num
        // }else if(z_length*100>=x_length+y_length){
        //     n = Math.cbrt(this.voxel_num)/z_length
        //     this.z_num = Math.ceil(n*z_length)
        //     this.voxel_length = z_length/this.z_num
        // }else{
        //     console.log("error!")
        //     console.log(this.Box)
        // }

        // if(x_length>=y_length && x_length>=z_length){
        //     this.voxel_length = x_length/this.pixel_limit
        // }else if(y_length>=x_length && y_length>=z_length){
        //     this.voxel_length = y_length/this.pixel_limit
        // }else{
        //     this.voxel_length = z_length/this.pixel_limit
        // }

        // console.log(this.voxel_length)
        // this.x_num = Math.ceil(x_length/this.voxel_length)+2
        // this.y_num = Math.ceil(y_length/this.voxel_length)+2
        // this.z_num = Math.ceil(z_length/this.voxel_length)+2
        // this.Box.min.x -= this.voxel_length
        // this.Box.min.y -= this.voxel_length
        // this.Box.min.z -= this.voxel_length
        // this.Box.max.x += this.voxel_length
        // this.Box.max.y += this.voxel_length
        // this.Box.max.z += this.voxel_length
        // console.log("num:",this.x_num,this.y_num,this.z_num)
        // // console.log(this.Box)
        // var voxel_three = []
        // for(let i=0; i<this.x_num; i++){
        //     var voxel_two = []
        //     for(let j=0; j<this.y_num; j++){
        //         var voxel_one = []
        //         for(let k=0; k<this.z_num; k++){
        //             var min = new Vector3(this.Box.min.x+i*this.voxel_length,this.Box.min.y+j*this.voxel_length,this.Box.min.z+k*this.voxel_length)
        //             var max = new Vector3(min.x+this.voxel_length,min.y+this.voxel_length,min.z+this.voxel_length)
        //             var box = new Box3(min,max)
        //             voxel_one.push(new Voxel(box))
        //         }
        //         voxel_two.push(voxel_one)
        //     }
        //     voxel_three.push(voxel_two)
        // }
        // console.log(voxel_three[0][0][0],voxel_three[99][93][69])
        // this.voxel_list = voxel_three

        var times = 12
        if(this.id<4326) times = 12
        else if(this.id<43265) times = 10
        else times = 8

        this.voxel_list = partition(times,this.Box)
        // console.log(this.voxel_list)
        this.voxel_length = {
            x:(this.Box.max.x-this.Box.min.x)/this.voxel_list.length,
            y:(this.Box.max.y-this.Box.min.y)/this.voxel_list[0].length,
            z:(this.Box.max.z-this.Box.min.z)/this.voxel_list[0][0].length
        }
        // console.log("空体素构建完成")
        // console.log(this.voxel_list)
        this.facesIntersect()
    }
    facesIntersect(){
        // console.log(this.voxel_list)
        // console.log(this.voxel_length)
        for(let f=0; f<this.faces.length; f++){//this.faces.length
            var face = this.faces[f]
            // console.log(face)
            var face_box = getBox(face)
            // console.log(face_box)
            var x_start = Math.floor((face_box.min.x-this.Box.min.x)/this.voxel_length.x)
            var x_end = Math.ceil((face_box.max.x-this.Box.min.x)/this.voxel_length.x)
            var y_start = Math.floor((face_box.min.y-this.Box.min.y)/this.voxel_length.y)
            var y_end = Math.ceil((face_box.max.y-this.Box.min.y)/this.voxel_length.y)
            var z_start = Math.floor((face_box.min.z-this.Box.min.z)/this.voxel_length.z)
            var z_end = Math.ceil((face_box.max.z-this.Box.min.z)/this.voxel_length.z)
            // console.log(x_start,x_end,y_start,y_end,z_start,z_end)
            for(let x=x_start; x<=x_end && x<this.voxel_list.length; x++){
                for(let y=y_start; y<=y_end && y<this.voxel_list[0].length; y++){
                    for(let z=z_start; z<=z_end && z<this.voxel_list[0][0].length; z++){
                        // console.log(x,y,z)
                        var voxel = this.voxel_list[x][y][z]
                        // console.log(voxel)
                        voxel.filled = voxel.intersectTri(face)
                    }
                }
            }
        }
        // console.log(this.voxel_list)
        // console.log("体素化计算完成")
        this.fillInside()
    }
    fillInside(){
        var x_count = this.voxel_list.length
        var y_count = this.voxel_list[0].length
        var z_count = this.voxel_list[0][0].length
        var new_Box_min = new Vector3(
            this.Box.min.x-this.voxel_length.x,
            this.Box.min.y-this.voxel_length.y,
            this.Box.min.z-this.voxel_length.z
        )
        var new_voxel_list = []
        for(let i=0; i<x_count+2; i++){
            new_voxel_list.push([])
            for(let j=0; j<y_count+2; j++){
                new_voxel_list[i].push([])
                for(let k=0; k<z_count+2; k++){
                    if(i>0 && i<x_count+1 && j>0 && j<y_count+1 && k>0 && k<z_count+1){
                        new_voxel_list[i][j].push(this.voxel_list[i-1][j-1][k-1])
                    }else{
                        new_voxel_list[i][j].push(new Voxel(new Box3(new Vector3(
                            new_Box_min.x+i*this.voxel_length.x,
                            new_Box_min.y+j*this.voxel_length.y,
                            new_Box_min.z+k*this.voxel_length.z
                        ),new Vector3(
                            new_Box_min.x+(i+1)*this.voxel_length.x,
                            new_Box_min.y+(j+1)*this.voxel_length.y,
                            new_Box_min.z+(k+1)*this.voxel_length.z
                        ))))
                    }
                }
            }
        }

        // console.log(new_voxel_list)
        this.voxel_list = new_voxel_list

        var start = getStart(this.voxel_list)
        // console.log(start)
        var x=start[0],y=start[1],z=start[2]
        this.voxel_list[x][y][z].filled = -1
        while(true){
            var unfilled_list = this.checkList()
            if(unfilled_list.length!==0){
                for(let i=0; i<unfilled_list.length; i++){
                    var uf = unfilled_list[i]
                    this.voxel_list[uf[0]][uf[1]][uf[2]].filled = -1
                }
            } else {
                break
            }
        }
        for(let i=0; i<this.voxel_list.length; i++){
            for(let j=0; j<this.voxel_list[i].length; j++){
                for(let k=0; k<this.voxel_list[i][j].length; k++){
                    var voxel = this.voxel_list[i][j][k]
                    if(voxel.filled===-1) voxel.filled = false
                    else if(voxel.filled===false) voxel.filled = true
                }
            }
        }
        // console.log(this.voxel_list)
        // console.log("体素内部填充完成")
    }
    checkList(){
        var unfilled_list = []
        for(let i=0; i<this.voxel_list.length; i++){
            for(let j=0; j<this.voxel_list[i].length; j++){
                for(let k=0; k<this.voxel_list[i][j].length; k++){
                    var voxel = this.voxel_list[i][j][k]
                    if(voxel.filled===-1){
                        if(i-1>=0&&this.voxel_list[i-1][j][k].filled===false) unfilled_list.push([i-1,j,k])
                        if(i+1<this.voxel_list.length&&this.voxel_list[i+1][j][k].filled===false) unfilled_list.push([i+1,j,k])
                        if(j-1>=0&&this.voxel_list[i][j-1][k].filled===false) unfilled_list.push([i,j-1,k])
                        if(j+1<this.voxel_list[i].length&&this.voxel_list[i][j+1][k].filled===false) unfilled_list.push([i,j+1,k])
                        if(k-1>=0&&this.voxel_list[i][j][k-1].filled===false) unfilled_list.push([i,j,k-1])
                        if(k+1<this.voxel_list[i][j].length&&this.voxel_list[i][j][k+1].filled===false) unfilled_list.push([i,j,k+1])
                    }
                }
            }
        }
        return unfilled_list
    }
    markVoxel(i,j,k){
        // console.log(i,j,k)
        this.voxel_list[i][j][k].filled = -1
        if(i-1>=0&&this.voxel_list[i-1][j][k].filled===false) this.markVoxel(i-1,j,k)
        if(i+1<this.voxel_list.length&&this.voxel_list[i+1][j][k].filled===false) this.markVoxel(i+1,j,k)
        if(j-1>=0&&this.voxel_list[i][j-1][k].filled===false) this.markVoxel(i,j-1,k)
        if(j+1<this.voxel_list[i].length&&this.voxel_list[i][j+1][k].filled===false) this.markVoxel(i,j+1,k)
        if(k-1>=0&&this.voxel_list[i][j][k-1].filled===false) this.markVoxel(i,j,k-1)
        if(k+1<this.voxel_list[i][j].length&&this.voxel_list[i][j][k+1].filled===false) this.markVoxel(i,j,k+1)
    }
}

function getFaces(geometry){
    // console.log(points)
    var faces = []
    // for(let i=0; i<points.length; i+=9){
    //     var face = []
    //     face.push(new Vector3(points[i],points[i+1],points[i+2]))
    //     face.push(new Vector3(points[i+3],points[i+4],points[i+5]))
    //     face.push(new Vector3(points[i+6],points[i+7],points[i+8]))
    //     faces.push(face)
    // }
    var indices = geometry.index.array
    var positions = geometry.attributes.position.array
    for(let i=0; i<indices.length; i+=3){
        let face = []
        face.push(new Vector3(positions[indices[i]*3],positions[indices[i]*3+1],positions[indices[i]*3+2]))
        face.push(new Vector3(positions[indices[i+1]*3],positions[indices[i+1]*3+1],positions[indices[i+1]*3+2]))
        face.push(new Vector3(positions[indices[i+2]*3],positions[indices[i+2]*3+1],positions[indices[i+2]*3+2]))
        faces.push(face)
    }
    return faces
}

function geometryBox(geometry){
    var position = geometry.attributes.position.array
    // console.log(position)
    var box = new Box3()
    box.min = new Vector3(position[0],position[1],position[2])
    box.max = new Vector3(position[0],position[1],position[2])
    // console.log(box.min,box.max)
    for(let i=3; i<position.length; i+=3){
        var vec = new Vector3(position[i],position[i+1],position[i+2])
        if(vec.x<box.min.x) box.min.x=vec.x
        if(vec.y<box.min.y) box.min.y=vec.y
        if(vec.z<box.min.z) box.min.z=vec.z
        if(vec.x>box.max.x) box.max.x=vec.x
        if(vec.y>box.max.y) box.max.y=vec.y
        if(vec.z>box.max.z) box.max.z=vec.z
    }
    // console.log(box.min,box.max)
    return box
}

function getBox(face){
    // console.log(face)
    var points = []
    for(let i=0; i<face.length; i++)
        points.push(face[i])
    var box = new Box3().setFromPoints(points)
    // console.log(box)
    return box
}

function test(){
    var voxel = new Voxel(new Box3(new Vector3(-3,-1,0),new Vector3(-2,0,1)))
    var face = [
        new Vector3(-2,0,0),
        new Vector3(0,-2,0),
        new Vector3(-3,-4,0)
    ]
    voxel.intersectTri(face)
}

function getStart(voxel_list){
    for(let i=0; i<voxel_list.length; i+=(voxel_list.length-1)){
        for(let j=0; j<voxel_list[i].length; j+=(voxel_list[i].length-1)){
            for(let k=0; k<voxel_list[i][j].length; k++){
                var voxel = voxel_list[i][j][k]
                if(voxel.filled===false){
                    return [i,j,k]
                }
            }
        }
    }
    for(let i=0; i<voxel_list.length; i+=(voxel_list.length-1)){
        for(let j=0; j<voxel_list[i].length; j++){
            for(let k=0; k<voxel_list[i][j].length; k+=(voxel_list[i][j].length-1)){
                var voxel = voxel_list[i][j][k]
                if(voxel.filled===false){
                    return [i,j,k]
                }
            }
        }
    }
    for(let i=0; i<voxel_list.length; i++){
        for(let j=0; j<voxel_list[i].length; j+=(voxel_list[i].length-1)){
            for(let k=0; k<voxel_list[i][j].length; k+=(voxel_list[i][j].length-1)){
                var voxel = voxel_list[i][j][k]
                if(voxel.filled===false){
                    return [i,j,k]
                }
            }
        }
    }
    return [0,0,0]
}

function partition(times,sceneBox){
    var node = new Voxel(sceneBox)
    while(times>0){
        let leftBox = getSubBox(node.Box,0)
        node = new Voxel(new Box3(leftBox.min,leftBox.max))
        times--
    }
    // console.log(node.box)
    var x_times = Math.round((sceneBox.max.x-sceneBox.min.x)/(node.Box.max.x-node.Box.min.x))
    var y_times = Math.round((sceneBox.max.y-sceneBox.min.y)/(node.Box.max.y-node.Box.min.y))
    var z_times = Math.round((sceneBox.max.z-sceneBox.min.z)/(node.Box.max.z-node.Box.min.z))
    // console.log(x_times,y_times,z_times)
    var x_length = (sceneBox.max.x-sceneBox.min.x)/x_times
    var y_length = (sceneBox.max.y-sceneBox.min.y)/y_times
    var z_length = (sceneBox.max.z-sceneBox.min.z)/z_times
    // console.log(x_length,y_length,z_length)
    var node_set = []
    for(let i=0; i<x_times; i++){
        let x_list = []
        for(let j=0; j<y_times; j++){
            let y_list = []
            for(let k=0; k<z_times; k++){
                let min = new Vector3(
                    sceneBox.min.x+i*x_length,
                    sceneBox.min.y+j*y_length,
                    sceneBox.min.z+k*z_length)
                let max = new Vector3(
                    sceneBox.min.x+(i+1)*x_length,
                    sceneBox.min.y+(j+1)*y_length,
                    sceneBox.min.z+(k+1)*z_length)
                let node = new Voxel(new Box3(min,max))
                y_list.push(node)
            }
            x_list.push(y_list)
        }
        node_set.push(x_list)
    }
    // console.log(node_set)
    return node_set
}

function getSubBox(box,LR){
    var boxAxis = getSize(box)
    var center = new Vector3((box.min.x+box.max.x)/2,(box.min.y+box.max.y)/2,(box.min.z+box.max.z)/2)
    if(!LR){//0-left
        if(boxAxis.x>=boxAxis.y && boxAxis.x>=boxAxis.z){//x最长
            return new Box3(box.min,new Vector3(center.x,box.max.y,box.max.z))
        }else if(boxAxis.y>=boxAxis.x && boxAxis.y>=boxAxis.z){//y最长
            return new Box3(box.min,new Vector3(box.max.x,center.y,box.max.z))
        }else{//z最长
            return new Box3(box.min,new Vector3(box.max.x,box.max.y,center.z))
        }
    }else{//1-right
        if(boxAxis.x>=boxAxis.y && boxAxis.x>=boxAxis.z){//x最长
            return new Box3(new Vector3(center.x,box.min.y,box.min.z),box.max)
        }else if(boxAxis.y>=boxAxis.x && boxAxis.y>=boxAxis.z){//y最长
            return new Box3(new Vector3(box.min.x,center.y,box.min.z),box.max)
        }else{//z最长
            return new Box3(new Vector3(box.min.x,box.min.y,center.z),box.max)
        }
    }
}

function getSize(box){
    return {
        x:box.max.x-box.min.x,
        y:box.max.y-box.min.y,
        z:box.max.z-box.min.z
    }
}
