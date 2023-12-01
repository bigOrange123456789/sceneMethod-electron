import {
    Vector3
} from "../three/build/three.module.js";
import {Edge} from "./Edge.js";

class Point{
    constructor(vec){
        this.x = vec.x
        this.y = vec.y
        this.z = vec.z
        this.convex = false
        this.dividable = false
    }
}

export class TriRebuilder{
    constructor(edges){
        this.points = []
        for(let i=0; i<edges.length-1; i++){
            this.points.push(new Point(edges[i]))
        }
        // console.log(this.points)
    }
    rebuild(){
        var triangles = []
        var concave = true
        while(concave){
            // outputPoints(this.points,1)
            this.judgeConcavity()
            // outputPoints(this.points,2)
            concave = false
            for(let i=0; i<this.points.length; i++){
                if(this.points[i].convex === false){
                    concave = true
                    break
                }
            }
            if(!concave) break
            this.judgeDividability()
            // outputPoints(this.points,3)
            var div_i = 0
            for(let i=0; i<this.points.length; i++){
                if(this.points[i].dividable){
                    div_i = i
                    break
                }
            }
            var p1 = this.points[(div_i-1+this.points.length)%this.points.length]
            var p2 = this.points[div_i]
            var p3 = this.points[(div_i+1)%this.points.length]
            var tri = [
                new Vector3(p1.x,p1.y,p1.z),
                new Vector3(p2.x,p2.y,p2.z),
                new Vector3(p3.x,p3.y,p3.z)
            ]
            triangles.push(tri)
            // console.log(tri)
            // console.log(p2)
            this.points.splice(div_i,1)
            // outputPoints(this.points,4)
            for(let i=0; i<this.points.length; i++){
                this.points[i].convex = false
                this.points[i].dividable = false
            }
        }
        // console.log(this.points)
        for(let i=1; i<this.points.length-1; i++){
            var tri_1 = [
                new Vector3(this.points[0].x,this.points[0].y,this.points[0].z),
                new Vector3(this.points[i].x,this.points[i].y,this.points[i].z),
                new Vector3(this.points[i+1].x,this.points[i+1].y,this.points[i+1].z)
            ]
            triangles.push(tri_1)
        }
        // console.log(triangles)
        return triangles
    }
    judgeConcavity(){       //判断凹凸性
        for(let i=0; i<this.points.length; i++){
            var p = this.points[i]
            var new_points = []
            for(let j=0; j<this.points.length; j++)
                if(j!==i)
                    new_points.push(this.points[j])
            var polygon = []
            for(let j=0; j<new_points.length; j++){
                var p1 = new_points[j]
                var p2 = new_points[(j+1)%new_points.length]
                polygon.push(new Edge(p1,p2))
            }
            // console.log(p)
            // console.log(polygon)
            if(!pointInPolygon(p,polygon)){
                // console.log("true")
                p.convex = true
            }
        }
        // console.log(this.points)
    }
    judgeDividability(){    //判断可分性
        for(let i=0; i<this.points.length; i++){
            if(this.points[i].convex===false)
                continue
            var tri = [
                this.points[(i-1+this.points.length)%this.points.length],
                this.points[i],
                this.points[(i+1)%this.points.length]
            ]
            this.points[i].dividable = true
            for(let j=0; j<this.points.length; j++){
                if (j!==i&&j!==(i-1+this.points.length)%this.points.length&&j!==(i+1)%this.points.length){
                    var p = this.points[j]
                    var PA = new Vector3(p.x-tri[0].x,p.y-tri[0].y,0)
                    var PB = new Vector3(p.x-tri[1].x,p.y-tri[1].y,0)
                    var PC = new Vector3(p.x-tri[2].x,p.y-tri[2].y,0)
                    var t1 = cross(PA,PB)
                    var t2 = cross(PB,PC)
                    var t3 = cross(PC,PA)
                    if(t1*t2>0&&t1*t3>0){
                        this.points[i].dividable = false
                        break
                    }
                }
            }
        }
        // console.log(this.points)
    }
}

function pointInPolygon(point,polygon){//1.射线方向是x轴正方向  2.修改：判断夹角之和为360度  3.随机方向正负方向两条射线
    var count = 0
    var ray = new Vector3(Math.random()-0.5,Math.random()-0.5,0).normalize()
    // console.log("ray:",ray)
    for(let i=0; i<polygon.length; i++){
        var edge = polygon[i]
        // console.log(edge)
        if(edge.acrossPoint(point)){
            return true
        }
        if(edge.intersect(point,ray)){
            // console.log("intersect")
            count++
        }
    }
    // console.log(count)
    return count % 2 === 1
}

function outputPoints(points,n){
    var ps = []
    for(let i=0; i<points.length; i++){
        var p = new Point(new Vector3(points[i].x,points[i].y,points[i].z))
        p.convex = points[i].convex
        p.dividable = points[i].dividable
        ps.push(p)
    }
    console.log(n,ps)
    // var string = ""
    // for(let i=0; i<points.length; i++){
    //     string += "new Vector3("+points[i].x+","+points[i].y+","+points[i].z+"),"
    // }
    // console.log(string)
}

function cross(a,b){
    return a.x*b.y-b.x*a.y
}
