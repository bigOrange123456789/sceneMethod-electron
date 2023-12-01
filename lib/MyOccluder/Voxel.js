import {
    Triangle
} from "../three/build/three.module.js";

export class Voxel{
    constructor(box){
        this.Box = box
        this.filled = false
        this.voxel_length = {
            x:box.max.x - box.min.x,
            y:box.max.y - box.min.y,
            z:box.max.z - box.min.z
        }
    }
    intersectTri(face){
        if(this.filled===true)
            return true
        return this.Box.intersectsTriangle(new Triangle(face[0],face[1],face[2]))

        // var center = new Vector3((this.Box.min.x+this.Box.max.x)/2,(this.Box.min.y+this.Box.max.y)/2,(this.Box.min.z+this.Box.max.z)/2)
        // var v0 = face[0].clone().sub(center)
        // var v1 = face[1].clone().sub(center)
        // var v2 = face[2].clone().sub(center)
        // var e0 = v1.clone().sub(v0)
        // var e1 = v2.clone().sub(v1)
        // var e2 = v0.clone().sub(v2)
        //
        // var u0 = new Vector3(1,0,0)
        // var u1 = new Vector3(0,1,0)
        // var u2 = new Vector3(0,0,1)
        //
        // var axis = []
        // axis.push(new Vector3().crossVectors(e0,u0).normalize())
        // axis.push(new Vector3().crossVectors(e0,u1).normalize())
        // axis.push(new Vector3().crossVectors(e0,u2).normalize())
        // axis.push(new Vector3().crossVectors(e1,u0).normalize())
        // axis.push(new Vector3().crossVectors(e1,u1).normalize())
        // axis.push(new Vector3().crossVectors(e1,u2).normalize())
        // axis.push(new Vector3().crossVectors(e2,u0).normalize())
        // axis.push(new Vector3().crossVectors(e2,u1).normalize())
        // axis.push(new Vector3().crossVectors(e2,u2).normalize())
        // axis.push(new Vector3(1,0,0))
        // axis.push(new Vector3(0,1,0))
        // axis.push(new Vector3(0,0,1))
        // axis.push(new Vector3().crossVectors(e0,e1).normalize())
        //
        // // console.log(axis)
        //
        // for(let i=0; i<axis.length; i++){
        //     // console.log("a:",axis[i])
        //     // console.log("v:",v0,v1,v2)
        //     var p0 = v0.clone().dot(axis[i])
        //     var p1 = v1.clone().dot(axis[i])
        //     var p2 = v2.clone().dot(axis[i])
        //     // console.log("p:",p0,p1,p2)
        //
        //     // var r = this.voxel_length * (Math.abs(u0.clone().dot(axis[i])) + Math.abs(u1.clone().dot(axis[i])) + Math.abs(u2.clone().dot(axis[i])))
        //     var r0 = this.voxel_length * Math.abs(u0.clone().dot(axis[i]))
        //     var r1 = this.voxel_length * Math.abs(u1.clone().dot(axis[i]))
        //     var r2 = this.voxel_length * Math.abs(u2.clone().dot(axis[i]))
        //     var r = Max3(r0,r1,r2)
        //     var max = -Max3(p0,p1,p2)>Min3(p0,p1,p2)?-Max3(p0,p1,p2):Min3(p0,p1,p2)
        //     // console.log("m:",max)
        //     // console.log("r:",r0,r1,r2)
        //     if(max>r) {
        //         // console.log("false")
        //         return false
        //     }
        // }
        // // console.log("true")
        // return true
    }
}

function Max3(n1,n2,n3){
    if(n1>n2){
        if(n1>n3) return n1
        else return n3
    } else {
        if(n2>n3) return n2
        else return n3
    }
}

function Min3(n1,n2,n3){
    if(n1<n2){
        if(n1<n3) return n1
        else return n3
    } else {
        if(n2<n3) return n2
        else return n3
    }
}
