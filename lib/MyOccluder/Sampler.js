import {
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    Line,
    LineBasicMaterial,
    Mesh,
    MeshBasicMaterial,
    Plane,
    Vector3
} from "../three/build/three.module.js";
import {Edge} from "./Edge.js";
import {TriRebuilder} from "./TriRebuilder.js";

export class Sampler{
    constructor(voxel_list,sample_count){
        this.voxel_list = voxel_list
        this.sample_count = sample_count
        this.simplified_standard = 0.1
    }
    sampling(direction){
        // console.log("direction:",direction)
        var cont_p = contactPoint(direction)
        var closest = cont_p[0]
        var furthest = cont_p[1]
        // console.log(closest)
        // console.log(furthest)
        var range = this.calculateRange(direction, closest, furthest)
        // console.log(range)
        // console.log("切面范围计算完成")

        // var sample_plane = new Plane()
        // sample_plane.normal = direction
        // sample_plane.constant = range[0]+(range[1]-range[0])*(49.5)/this.sample_count
        // var points_list = this.planeCut(sample_plane, closest, furthest)
        // var area = cutAreas(points_list)
        // console.log(points_list,area)
        // console.log(this.voxel_list)
        var points_res = []
        var area_res = []
        for(let i=0; i<this.sample_count; i++){
            var sample_plane = new Plane()
            sample_plane.normal = direction
            sample_plane.constant = range[0]+(range[1]-range[0])*(i+0.5)/this.sample_count
            var points_list = this.planeCut(sample_plane, closest, furthest)
            var area = cutAreas(points_list)
            points_res.push(points_list)
            area_res.push(area)
        }
        // console.log(points_res)
        // console.log(area_res)
        var max_area = area_res[0]
        var max_i1 = 0
        for(let i=0; i<area_res.length; i++){
            if(area_res[i]>max_area){
                max_area = area_res[i]
                max_i1 = i
            }
        }
        var max_i2 = max_i1
        for(let i=max_i1; i<area_res.length; i++){
            if(area_res[i]===max_area){
                max_i2 = i
            }else{
                break
            }
        }
        var max_i = Math.floor((max_i1+max_i2)/2)
        // showSlice(points_res[max_i])
        // console.log("切面采样完成")
        // console.log(points_res[max_i])

        return this.simplify(points_res[max_i], direction)
    }
    calculateRange(direction, closest, furthest){
        var min_i = closest[0][1] * (this.voxel_list.length-1)
        var min_j = closest[1][1] * (this.voxel_list[min_i].length-1)
        var min_k = closest[2][1] * (this.voxel_list[min_i][min_j].length-1)
        var max_i = furthest[0][1] * (this.voxel_list.length-1)
        var max_j = furthest[1][1] * (this.voxel_list[max_i].length-1)
        var max_k = furthest[2][1] * (this.voxel_list[max_i][max_j].length-1)
        // console.log(min_i,min_j,min_k)
        // console.log(max_i,max_j,max_k)
        var closest_voxel = this.voxel_list[min_i][min_j][min_k]
        var furthest_voxel = this.voxel_list[max_i][max_j][max_k]
        var closest_point = new Vector3(
            closest[0][0] * closest_voxel.Box.min.x + closest[0][1] * closest_voxel.Box.max.x,
            closest[1][0] * closest_voxel.Box.min.y + closest[1][1] * closest_voxel.Box.max.y,
            closest[2][0] * closest_voxel.Box.min.z + closest[2][1] * closest_voxel.Box.max.z
        )
        var furthest_point = new Vector3(
            furthest[0][0] * furthest_voxel.Box.min.x + furthest[0][1] * furthest_voxel.Box.max.x,
            furthest[1][0] * furthest_voxel.Box.min.y + furthest[1][1] * furthest_voxel.Box.max.y,
            furthest[2][0] * furthest_voxel.Box.min.z + furthest[2][1] * furthest_voxel.Box.max.z
        )
        // console.log(closest_point)
        // console.log(furthest_point)
        var original_plane = new Plane()
        original_plane.normal = direction
        original_plane.constant = 0
        var closest_distance = original_plane.distanceToPoint(closest_point)
        var furthest_distance = original_plane.distanceToPoint(furthest_point)
        // console.log(closest_distance)
        // console.log(furthest_distance)

        // var cp = new Plane()
        // cp.normal = direction
        // cp.constant = -closest_distance
        // console.log(cp.distanceToPoint(closest_point))
        // var fp = new Plane()
        // fp.normal = direction
        // fp.constant = -furthest_distance
        // console.log(fp.distanceToPoint(furthest_point))
        return [-furthest_distance, -closest_distance]
    }
    planeCut(plane, closest, furthest){
        // console.log(plane)
        // console.log(closest, furthest)
        var cut_points = []
        for(let i=0; i<this.voxel_list.length; i++){
            for(let j=0; j<this.voxel_list[i].length; j++){
                for(let k=0; k<this.voxel_list[i][j].length; k++){
                    var voxel = this.voxel_list[i][j][k]
                    if(voxel.filled === true){
                        var closest_point = new Vector3(
                            closest[0][0] * voxel.Box.min.x + closest[0][1] * voxel.Box.max.x,
                            closest[1][0] * voxel.Box.min.y + closest[1][1] * voxel.Box.max.y,
                            closest[2][0] * voxel.Box.min.z + closest[2][1] * voxel.Box.max.z
                        )
                        var furthest_point = new Vector3(
                            furthest[0][0] * voxel.Box.min.x + furthest[0][1] * voxel.Box.max.x,
                            furthest[1][0] * voxel.Box.min.y + furthest[1][1] * voxel.Box.max.y,
                            furthest[2][0] * voxel.Box.min.z + furthest[2][1] * voxel.Box.max.z
                        )
                        var closest_distance = plane.distanceToPoint(closest_point)
                        var furthest_distance = plane.distanceToPoint(furthest_point)
                        if(closest_distance * furthest_distance <= 0){
                            // voxel.filled = true
                            var points = intersectPoint(voxel,plane)
                            cut_points.push(pointSort(points))
                        } else {
                            // voxel.filled = false
                        }
                    }
                }
            }
        }
        // console.log(cut_points)
        // showSlice(cut_points)
        return cut_points
    }
    simplify(cut_points, direction){
        // console.log(cut_points)
        var new_cut_points = pointsProjection(cut_points, direction)
        // console.log(new_cut_points)
        // showSlice(new_cut_points)
        if(new_cut_points.length===0)
            return {position:[],index:[]}
        var edges = edgeLoop(new_cut_points)
        // console.log(edges)
        edges = connectEdges(edges)
        // console.log(edges)
        // console.log("边缘环提取完成")
        // showEdges(edges)
        if(edges.length>5)
            edges = Douglas(edges,this.simplified_standard)
        // console.log(edges)
        // console.log("边缘环简化完成")
        // showEdges(edges)
        var triRebuilder = new TriRebuilder(edges)
        var triangles = triRebuilder.rebuild()
        // console.log(triangles)
        // console.log("三角剖分完成")
        // showSlice(triangles)
        var result = restoreProjection(triangles, direction)
        // console.log(result)
        // showSlice(result)
        var position = []
        var index = []
        var vectors = []
        for(let i=0; i<result.length; i++){
            for(let j=0; j<result[i].length; j++){
                vectors.push(result[i][j])
            }
        }
        // console.log(vectors)
        for(let i=0; i<vectors.length; i++){
            var exist = -1
            for(let j=0; j<position.length; j+=3){
                if(vectors[i].x===position[j]&&vectors[i].y===position[j+1]&&vectors[i].z===position[j+2]){
                    exist = j/3
                    break
                }
            }
            if(exist===-1){
                exist = position.length/3
                position.push(vectors[i].x)
                position.push(vectors[i].y)
                position.push(vectors[i].z)
            }
            index.push(exist)
        }
        // console.log(position)
        // console.log(index)
        // return [position,index]
        return { position:position, index:index }
    }
}

function contactPoint(direction){
    var dir_arr = [direction.x,direction.y,direction.z]
    var closest_p = []
    var furthest_p = []
    for(let i=0; i<dir_arr.length; i++){
        if(dir_arr[i]>=0) {
            closest_p.push([1, 0])
            furthest_p.push([0, 1])
        }
        else {
            closest_p.push([0, 1])
            furthest_p.push([1, 0])
        }
    }
    return [closest_p,furthest_p]
}

function intersectPoint(voxel, plane){
    // console.log(voxel,plane)
    var intersect_points = []
    var min = voxel.Box.min
    var max = voxel.Box.max
    var x_lines = [
        [new Vector3(min.x,min.y,min.z), new Vector3(max.x,min.y,min.z)],
        [new Vector3(min.x,max.y,min.z), new Vector3(max.x,max.y,min.z)],
        [new Vector3(min.x,min.y,max.z), new Vector3(max.x,min.y,max.z)],
        [new Vector3(min.x,max.y,max.z), new Vector3(max.x,max.y,max.z)]
    ]
    for(let l=0; l<x_lines.length; l++){
        var d1 = plane.distanceToPoint(x_lines[l][0])
        var d2 = plane.distanceToPoint(x_lines[l][1])
        // console.log(d1,d2)
        if(d1 * d2 < 0){
            var point = new Vector3(
                min.x+(max.x-min.x)*Math.abs(d1)/(Math.abs(d1)+Math.abs(d2)),
                x_lines[l][0].y,
                x_lines[l][0].z
            )
            // console.log("x:",point)
            intersect_points.push(point)
        }
    }
    var y_lines = [
        [new Vector3(min.x,min.y,min.z), new Vector3(min.x,max.y,min.z)],
        [new Vector3(max.x,min.y,min.z), new Vector3(max.x,max.y,min.z)],
        [new Vector3(min.x,min.y,max.z), new Vector3(min.x,max.y,max.z)],
        [new Vector3(max.x,min.y,max.z), new Vector3(max.x,max.y,max.z)]
    ]
    for(let l=0; l<y_lines.length; l++){
        var d1 = plane.distanceToPoint(y_lines[l][0])
        var d2 = plane.distanceToPoint(y_lines[l][1])
        // console.log(d1,d2)
        if(d1 * d2 < 0){
            var point = new Vector3(
                y_lines[l][0].x,
                min.y+(max.y-min.y)*Math.abs(d1)/(Math.abs(d1)+Math.abs(d2)),
                y_lines[l][0].z
            )
            // console.log("y:",point)
            intersect_points.push(point)
        }
    }
    var z_lines = [
        [new Vector3(min.x,min.y,min.z), new Vector3(min.x,min.y,max.z)],
        [new Vector3(max.x,min.y,min.z), new Vector3(max.x,min.y,max.z)],
        [new Vector3(min.x,max.y,min.z), new Vector3(min.x,max.y,max.z)],
        [new Vector3(max.x,max.y,min.z), new Vector3(max.x,max.y,max.z)]
    ]
    for(let l=0; l<z_lines.length; l++){
        var d1 = plane.distanceToPoint(z_lines[l][0])
        var d2 = plane.distanceToPoint(z_lines[l][1])
        // console.log(d1,d2)
        if(d1 * d2 < 0){
            var point = new Vector3(
                z_lines[l][0].x,
                z_lines[l][0].y,
                min.z+(max.z-min.z)*Math.abs(d1)/(Math.abs(d1)+Math.abs(d2))
            )
            // console.log("z:",point)
            intersect_points.push(point)
        }
    }
    // console.log(intersect_points)
    return deleteSamePoint(intersect_points)
}

function deleteSamePoint(points){
    var result = []
    for(let i=0; i<points.length; i++){
        var exist_same = false
        for(let j=i+1; j<points.length; j++){
            var p1 = points[i]
            var p2 = points[j]
            if( p1.x===p2.x && p1.y===p2.y && p1.z===p2.z){
                exist_same = true
            }
        }
        if(!exist_same){
            result.push(points[i])
        }
    }
    return result
}

function pointSort(points){
    var result = []
    if(points.length<4)
        return points
    result.push(points[0])
    var point_arr = []
    var angle_arr = []
    var closest_i = closestPoint(points[0],points)
    result.push(points[closest_i])
    var v_base = points[0].clone().sub(points[closest_i])
    for(let i=1; i<points.length; i++){
        if(i!==closest_i){
            var v = points[0].clone().sub(points[i])
            var cos_value = v_base.clone().dot(v)/(v_base.length()*v.length())
            var angle = Math.acos(cos_value)
            point_arr.push(points[i])
            angle_arr.push(angle)
        }
    }
    quickSort(point_arr,angle_arr,0,point_arr.length-1)
    for(let i=0; i<point_arr.length; i++){
        result.push(point_arr[i])
    }
    return result
}

function closestPoint(p,points){
    var min_distance = p.clone().sub(points[1]).length()
    var min_i = 1
    for(let i=2; i<points.length; i++){
        var d = p.clone().sub(points[i]).length()
        if(d<min_distance){
            min_distance = d
            min_i = i
        }
    }
    return min_i
}

function quickSort(arr, judge_arr, begin, end) {
    if(begin >= end)
        return;
    var l = begin;
    var r = end;
    var temp = judge_arr[begin];
    while(l < r) {
        while(l < r && judge_arr[r] >= temp)
            r --;
        while(l < r && judge_arr[l] <= temp)
            l ++;
        [arr[l], arr[r]] = [arr[r], arr[l]];
        [judge_arr[l], judge_arr[r]] = [judge_arr[r], judge_arr[l]];
    }
    [arr[begin], arr[l]] = [arr[l], arr[begin]];
    [judge_arr[begin], judge_arr[l]] = [judge_arr[l], judge_arr[begin]];
    quickSort(arr, judge_arr, begin, l - 1);
    quickSort(arr, judge_arr, l + 1, end);
}

function pointsProjection(cut_points, normal){
    // console.log(cut_points)
    // var assist_vec = new Vector3(normal.x,normal.y,0)
    // if(normal.x===0&&normal.z===0) assist_vec.z = -assist_vec.y
    // if(normal.y===0&&normal.z===0) assist_vec.z = -assist_vec.x
    // var axis = new Vector3().crossVectors(normal,assist_vec).normalize()
    // var XY_normal = new Vector3(0,0,-1*normal.z/Math.abs(normal.z)).normalize()
    // var CosineValue = normal.clone().dot(XY_normal)/(normal.length()*XY_normal.length())
    // var angle = Math.acos(CosineValue)
    // console.log(axis)
    // if(isNaN(angle)) angle = -Math.PI/2
    // for(let i=0; i<cut_points.length; i++){
    //     for(let j=0; j<cut_points[i].length; j++){
    //         cut_points[i][j].applyAxisAngle(axis,angle)
    //     }
    // }
    var target_normal = new Vector3(0,0,1)
    var axis = new Vector3().crossVectors(normal,target_normal).normalize()
    var CosineValue = normal.clone().dot(target_normal)/(normal.length()*target_normal.length())
    var angle = Math.acos(CosineValue)
    for(let i=0; i<cut_points.length; i++){
        for(let j=0; j<cut_points[i].length; j++){
            cut_points[i][j].applyAxisAngle(axis,angle)
        }
    }
    // console.log(cut_points)
    return cut_points
}

function restoreProjection(cut_points, normal){
    var target_normal = new Vector3(0,0,1)
    var axis = new Vector3().crossVectors(normal,target_normal).normalize()
    var CosineValue = normal.clone().dot(target_normal)/(normal.length()*target_normal.length())
    var angle = Math.acos(CosineValue)
    for(let i=0; i<cut_points.length; i++){
        for(let j=0; j<cut_points[i].length; j++){
            cut_points[i][j].applyAxisAngle(axis,-angle)
        }
    }
    return cut_points
}

function showSlice(cut_points){
    // console.log(cut_points)
    var vertices_arr = createTri(cut_points)
    // console.log(vertices_arr)
    for(let i=0; i<vertices_arr.length; i++){
        var vertices = new Float32Array(vertices_arr[i])
        var attribute = new BufferAttribute(vertices,3)
        var geo = new BufferGeometry()
        geo.attributes.position = attribute
        var mat = new MeshBasicMaterial({ color:getColor(),side:DoubleSide })
        var mesh = new Mesh(geo,mat)
        // console.log(geo)
        window.scene.add(mesh)
    }
}

function getColor(){
    var r = Math.floor(256*Math.random());
    var g = Math.floor(256*Math.random());
    var b = Math.floor(256*Math.random());
    var color = `rgb(${r},${g},${b})`;
    return new Color(color)
}

function createTri(points_list){
    var vertices_arr = []
    for(let i=0; i<points_list.length; i++){
        var tri = []
        for(let j=1; j<points_list[i].length-1; j++){
            tri.push(points_list[i][0].x)
            tri.push(points_list[i][0].y)
            tri.push(points_list[i][0].z)
            tri.push(points_list[i][j].x)
            tri.push(points_list[i][j].y)
            tri.push(points_list[i][j].z)
            tri.push(points_list[i][j+1].x)
            tri.push(points_list[i][j+1].y)
            tri.push(points_list[i][j+1].z)
        }
        vertices_arr.push(tri)
    }
    return vertices_arr
}

function cutAreas(points_list){
    var areas = 0
    for(let i=0; i<points_list.length; i++){
        for(let j=1; j<points_list[i].length-1; j++){
            var s = AreaOfTriangle(points_list[i][0], points_list[i][j], points_list[i][j+1])
            areas += s
        }
    }
    return areas
}

function AreaOfTriangle(p1, p2, p3){
    var v1 = p1.clone().sub(p2);
    var v2 = p1.clone().sub(p3);

    var v3 = new Vector3().crossVectors(v1,v2)
    return v3.length() / 2
}

function edgeLoop(points_list){
    // console.log(points_list)
    var edges_list = []
    for(let i=0; i<points_list.length; i++){
        for(let j=0; j<points_list[i].length; j++){
            var p1 = points_list[i][j]
            var p2 = points_list[i][(j+1)%points_list[i].length]
            var edge = new Edge(p1,p2)
            edges_list.push(edge)
        }
    }
    // console.log(edges_list)
    var edges = []
    for(let i=0; i<edges_list.length; i++){
        var exist_same = false
        for(let j=i+1; j<edges_list.length; j++){
            if(edges_list[i].equal(edges_list[j])){
                exist_same = true
                edges_list.splice(j,1)
                j--
            }
        }
        if(!exist_same) edges.push(edges_list[i])
        else edges_list.splice(i--,1)
    }
    // console.log(edges)
    var sorted_edges = [[edges[0].p1,edges[0].p2]]
    var sorted_i = 0
    var last_point = edges[0].p2
    edges.splice(0,1)
    while(edges.length>0){
        var c = connectedEdge(last_point, edges)
        if(c===-1){
            var edge_c = edges[0]
            if( Math.floor(last_point.x*10000000)===Math.floor(edge_c.p2.x*10000000)&&
                Math.floor(last_point.y*10000000)===Math.floor(edge_c.p2.y*10000000))
                edge_c.exchange()
            sorted_edges.push([edge_c.p1,edge_c.p2])
            sorted_i++
            last_point = edge_c.p2
            edges.splice(0,1)
        } else {
            var edge_c = edges[c]
            if( Math.floor(last_point.x*10000000)===Math.floor(edge_c.p2.x*10000000)&&
                Math.floor(last_point.y*10000000)===Math.floor(edge_c.p2.y*10000000))
                edge_c.exchange()
            sorted_edges[sorted_i].push(edge_c.p2)
            last_point = edge_c.p2
            edges.splice(c,1)
        }
    }
    for(let i=0; i<sorted_edges.length; i++){
        for(let j=1; j<sorted_edges[i].length-1; j++){
            var p = sorted_edges[i][j]
            var same = 0
            for(let k=j+1; k<sorted_edges[i].length; k++){
                if(p.x===sorted_edges[i][k].x && p.y===sorted_edges[i][k].y){
                    same = k
                    break
                }
            }
            if(same){
                var del_edges = sorted_edges[i].splice(j,same-j)
                del_edges.push(del_edges[0])
                sorted_edges.push(del_edges)
            }
        }
    }
    // console.log(sorted_edges)
    return sorted_edges
}

function connectedEdge(last_point, edges){
    for(let i=0; i<edges.length; i++){
        if(edges[i].connect(last_point)){
            return i
        }
    }
    return -1
}

function Douglas(points,simplified_standard){
    // console.log(points)
    if(points.length<4) return points
    var compressed_points = points
    var cp_1 = compressed_points.slice(0,Math.floor(compressed_points.length/3)+1)
    var cp_2 = compressed_points.slice(Math.floor(compressed_points.length/3),Math.floor(2*compressed_points.length/3)+1)
    var cp_3 = compressed_points.slice(Math.floor(2*compressed_points.length/3))
    // console.log("cp_1:",cp_1)
    // console.log("cp_2:",cp_2)
    // console.log("cp_3:",cp_3)
    cp_1 = compression(cp_1,simplified_standard)
    cp_2 = compression(cp_2,simplified_standard)
    cp_3 = compression(cp_3,simplified_standard)

    cp_1 = Douglas(cp_1,simplified_standard)
    cp_2 = Douglas(cp_2,simplified_standard)
    cp_3 = Douglas(cp_3,simplified_standard)
    cp_1.splice(cp_1.length-1,1)
    cp_2.splice(cp_2.length-1,1)
    compressed_points = cp_1.concat(cp_2).concat(cp_3)
    return compressed_points
}

function compression(points,simplified_standard){
    var link_base = points[0].clone().sub(points[points.length-1])
    var length = link_base.length()
    var dMax = length * simplified_standard
    // console.log("dMax:",dMax)
    for(let i=1; i<points.length-1; i++){
        var link = points[0].clone().sub(points[i])
        var d = new Vector3().crossVectors(link_base,link).length()/length
        // console.log("d:",d)
        if(d<dMax){
            // console.log("splice")
            points.splice(i,1)
            i--
        }
    }
    return points
}

function showEdges(edges){
    var vertices = []
    for(let i=0; i<edges.length; i++){
        vertices.push(edges[i].x)
        vertices.push(edges[i].y)
        vertices.push(edges[i].z)
    }
    vertices = new Float32Array(vertices)
    var attribute = new BufferAttribute(vertices,3)
    var geo = new BufferGeometry()
    geo.attributes.position = attribute
    var mat = new LineBasicMaterial({color:getColor()})
    var line = new Line(geo, mat)
    window.scene.add(line)
}

function connectEdges(edges){
    if(edges.length===1) return Planarization(edges[0])
    var new_edges = edges[0]
    for(let i=1; i<edges.length; i++){
        edges[i].reverse()
        var p = edges[i][0]
        var min_dis = new_edges[0].clone().sub(p).length()
        var min_j = 0
        for(let j=0; j<new_edges.length; j++){
            var dis = new_edges[j].clone().sub(p).length()
            if(dis<min_dis){
                min_dis = dis
                min_j = j
            }
        }
        for(let k=0; k<edges[i].length; k++){
            new_edges.splice(min_j+k+1,0,edges[i][k])
        }
        new_edges.splice(min_j+edges[i].length+1,0,new_edges[min_j])
    }
    // console.log(new_edges)
    return Planarization(new_edges)
}

function Planarization(edges){
    var new_edges = edges
    new_edges.splice(new_edges.length-1,1)
    // console.log(new_edges)
    var exist = -1
    while(exist===-1){
        for(let i=0; i<new_edges.length; i++){
            var p1 = new_edges[(i-1+new_edges.length)%new_edges.length]
            var p2 = new_edges[i]
            var p3 = new_edges[(i+1)%new_edges.length]
            var l1 = p2.clone().sub(p1)
            var l2 = p3.clone().sub(p2)
            if(l1.y*l2.x===l1.x*l2.y){
                exist = i
                break
            }
        }
        if(exist!==-1){
            new_edges.splice(exist,1)
            exist = -1
        }else{
            exist = 0
        }
    }
    new_edges.push(edges[0])
    // console.log(new_edges)
    return new_edges
}
