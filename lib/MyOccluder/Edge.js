import {Vector3} from "../three/build/three.module.js";

export class Edge{
    constructor(p1,p2){
        this.p1 = p1
        this.p2 = p2
    }
    equal(that){
        if(samePoints(this.p1,that.p1) && samePoints(this.p2,that.p2))
            return true
        else if(samePoints(this.p1,that.p2) && samePoints(this.p2,that.p1))
            return true
        else return false
    }
    exchange(){
        var temp = this.p1
        this.p1 = this.p2
        this.p2 = temp
    }
    connect(point){
        return (samePoints(this.p1, point) || samePoints(this.p2, point))
    }
    intersect(point,ray){
        // console.log("point:",point)
        // console.log("edge:",this)
        // console.log("ray:",ray)
        var PA = new Vector3(this.p1.x-point.x,this.p1.y-point.y,0)
        var PB = new Vector3(this.p2.x-point.x,this.p2.y-point.y,0)
        // console.log("PA,PB:",PA,PB)
        var t1 = cross(ray,PA)
        var t2 = cross(ray,PB)
        // console.log("t1,t2:",t1,t2)
        if(t1*t2<0) {
            var BA = new Vector3(this.p2.x-this.p1.x,this.p2.y-this.p1.y,0).normalize()
            var t = cross(PA,BA)/cross(ray,BA)
            if(t<0) return false
            var intersect_x = point.x+ray.x*t
            var intersect_y = point.y+ray.y*t
            // console.log("t:",t)
            // console.log("intersect point:",intersect_x,intersect_y)
            var x1 = this.p1.x>this.p2.x?this.p1.x:this.p2.x
            var x2 = this.p1.x>this.p2.x?this.p2.x:this.p1.x
            var y1 = this.p1.y>this.p2.y?this.p1.y:this.p2.y
            var y2 = this.p1.y>this.p2.y?this.p2.y:this.p1.y
            // console.log("x1,y1,x2,y2:",x1,y1,x2,y2)
            return x1>=intersect_x && x2<=intersect_x && y1>=intersect_y && y2<=intersect_y
        } else {
            return false
        }
    }
    acrossPoint(point){
        var x1 = this.p1.x>this.p2.x?this.p1.x:this.p2.x
        var x2 = this.p1.x>this.p2.x?this.p2.x:this.p1.x
        var y1 = this.p1.y>this.p2.y?this.p1.y:this.p2.y
        var y2 = this.p1.y>this.p2.y?this.p2.y:this.p1.y
        var PA = new Vector3(this.p1.x-point.x,this.p1.y-point.y,0)
        var PB = new Vector3(this.p2.x-point.x,this.p2.y-point.y,0)
        if(PA.y/PA.x===PB.y/PB.x || (PA.x===0 && PB.x===0)){
            if(x1>=point.x && x2<=point.x && y1>=point.y && y2<=point.y){
                return true
            }
        }
        return false
    }
}

function samePoints(p1,p2){
    return Math.floor(p1.x*10000000) === Math.floor(p2.x*10000000)
        && Math.floor(p1.y*10000000) === Math.floor(p2.y*10000000)
}

function cross(a,b){
    return a.x*b.y-b.x*a.y
}
