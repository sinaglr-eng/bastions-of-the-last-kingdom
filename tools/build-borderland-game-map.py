"""Prepare the approved local Blender assembly for the playfield.

Run with Python 3, NumPy and Pillow. Only a game-ready mesh stream is emitted.
The review scene and individual authoring assets remain in the local gallery.
"""
import copy
import io
import json
import math
import struct
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "blender/scenes/borderland-meadow/battlefield-review/battlefield.glb"
OUTPUT = ROOT / "public/assets/scenery/borderland-meadow.glb"
WEST, EAST = -1.20, 4.25
EDGE = 18.5
CENTRES = [(-14, 0), (14, 0), (14, -14), (0, -14), (0, 14)]
TYPES = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
TREES = {"Borderland Pine", "Silver fir", "Meadow Oak", "Windbent Oak"}
BRUSH = {"Meadow wildflowers", "Riverbank Shrub", "Grass Tufts", "Low Fern", "River Boulder Cluster",
         "Dry Leaves", "Mossy Stump", "Rock Shelf", "Slate Pebbles", "Broken Twigs"}


class Source:
    def __init__(self, path):
        raw = path.read_bytes()
        size = struct.unpack_from("<I", raw, 12)[0]
        self.doc = json.loads(raw[20:20 + size])
        self.blob = memoryview(raw)[28 + size:]
        self.cache = {}

    def view(self, index):
        view = self.doc["bufferViews"][index]
        start = view.get("byteOffset", 0)
        return self.blob[start:start + view["byteLength"]]

    def array(self, index):
        if index in self.cache:
            return self.cache[index]
        a = self.doc["accessors"][index]
        width = WIDTHS[a["type"]]
        dtype = TYPES[a["componentType"]]
        shape = (a["count"], width)
        if "bufferView" in a:
            view = self.doc["bufferViews"][a["bufferView"]]
            assert "byteStride" not in view, "Unexpected interleaved source stream"
            result = np.frombuffer(self.view(a["bufferView"]), dtype=dtype,
                                   offset=a.get("byteOffset", 0), count=a["count"]*width).reshape(shape)
        else:
            result = np.zeros(shape, dtype=dtype)
        if "sparse" in a:
            s = a["sparse"]; idx = s["indices"]; val = s["values"]
            rows = np.frombuffer(self.view(idx["bufferView"]), dtype=TYPES[idx["componentType"]],
                                 offset=idx.get("byteOffset", 0), count=s["count"])
            result = result.copy()
            result[rows] = np.frombuffer(self.view(val["bufferView"]), dtype=dtype,
                                          offset=val.get("byteOffset", 0), count=len(rows)*width).reshape(-1,width)
        self.cache[index] = result
        return result


class Stream:
    def __init__(self, source):
        self.doc = {key: copy.deepcopy(source.doc[key]) for key in ("textures","samplers")}
        self.doc.update(asset={"version":"2.0","generator":"Forged Alliances terrain exporter"},
                        scene=0, scenes=[{"name":"Borderland Meadow","nodes":[]}], nodes=[], meshes=[],
                        materials=[], images=[], animations=[], bufferViews=[], accessors=[],
                        extensionsUsed=["EXT_mesh_gpu_instancing"], extensionsRequired=["EXT_mesh_gpu_instancing"])
        self.blob = bytearray()
        self.accessor_keys = {}
        self.material_keys = {}

    def view(self, data, target=None):
        self.blob.extend(bytes((-len(self.blob))%4))
        record = {"buffer":0,"byteOffset":len(self.blob),"byteLength":len(data)}
        if target:
            record["target"] = target
        self.blob.extend(data)
        self.doc["bufferViews"].append(record)
        return len(self.doc["bufferViews"])-1

    def array(self, arr, typ, component=5126, *, bounds=False, normalized=False, sparse=False, target=None):
        arr = np.ascontiguousarray(arr, dtype=TYPES[component]).reshape(-1,WIDTHS[typ])
        data = arr.tobytes()
        key = (typ,component,bounds,normalized,sparse,target,data)
        if key in self.accessor_keys:
            return self.accessor_keys[key]
        a = {"count":len(arr),"type":typ,"componentType":component}
        if normalized:
            a["normalized"] = True
        if bounds:
            a.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
        affected = np.flatnonzero(arr.any(axis=1)) if sparse else None
        if sparse and len(affected) == 0:
            pass  # glTF permits an implicit zero-filled accessor.
        elif sparse and len(affected) < len(arr)*.60:
            it = 5125 if affected[-1]>65535 else 5123 if affected[-1]>255 else 5121
            a["sparse"] = {"count":len(affected),
                "indices":{"bufferView":self.view(affected.astype(TYPES[it]).tobytes()),"componentType":it},
                "values":{"bufferView":self.view(arr[affected].tobytes())}}
        else:
            a["bufferView"] = self.view(data,target)
        index = len(self.doc["accessors"]); self.doc["accessors"].append(a)
        self.accessor_keys[key] = index
        return index

    def material(self, original):
        data = copy.deepcopy(original)
        pbr = data["pbrMetallicRoughness"]
        paint = None
        if not any("Texture" in k for k in list(data)+list(pbr)) and not data.get("emissiveFactor") and "alphaMode" not in data:
            paint = pbr.pop("baseColorFactor",[1,1,1,1])
            data["name"] = "Meadow turf" if original["name"].startswith("Sward") else "Meadow mineral and foliage palette"
        key = json.dumps(data,sort_keys=True)
        if key not in self.material_keys:
            self.material_keys[key] = len(self.doc["materials"])
            self.doc["materials"].append(data)
        return self.material_keys[key],paint

    def node(self, data, root=False):
        index = len(self.doc["nodes"])
        self.doc["nodes"].append(data)
        if root:
            self.doc["scenes"][0]["nodes"].append(index)
        return index

    def write(self, path):
        self.doc["buffers"] = [{"byteLength":len(self.blob)}]
        content=json.dumps(self.doc,separators=(",",":"),allow_nan=False).encode()
        content+=b" "*((-len(content))%4)
        self.blob.extend(bytes((-len(self.blob))%4))
        path.parent.mkdir(parents=True,exist_ok=True)
        staging=path.with_suffix(".partial")
        with staging.open("wb") as out:
            out.write(struct.pack("<4sIII4s",b"glTF",2,28+len(content)+len(self.blob),len(content),b"JSON"))
            out.write(content);out.write(struct.pack("<I4s",len(self.blob),b"BIN\0"));out.write(self.blob)
        staging.replace(path)


def shift_x(x):
    return WEST+(EAST-WEST)*np.clip((x+14)/28,0,1)


def meadow_colors(positions):
    """Continuous ground cover. Adjacent triangles share color at every seam."""
    xz = positions[:, [0, 2]]
    def patches(spacing, seed):
        lattice = np.random.default_rng(seed).uniform(-1, 1, (40, 40))
        coords = xz / spacing + 16
        ij = np.floor(coords).astype(int)
        f = coords - ij
        u, v = (f*f*(3-2*f)).T
        x, z = ij.T
        return ((1-u)*(1-v)*lattice[x,z] + u*(1-v)*lattice[x+1,z]
                + (1-u)*v*lattice[x,z+1] + u*v*lattice[x+1,z+1])

    growth = patches(6.3, 218) * .72 + patches(3.2, 514) * .28
    # Keep the approved olive meadow under the game's direct sunlight.
    color = np.ones((len(positions), 4))
    color[:, :3] = [0.140, 0.216, 0.035] + growth[:, None] * [0.065, 0.066, 0.017]
    return color


def geometry(source, stream):
    doc=source.doc
    samples=[]
    for mesh in doc["meshes"]:
        name=mesh["name"];batches=defaultdict(list);extremes=[]
        for p in mesh["primitives"]:
            attr=p["attributes"];pos=source.array(attr["POSITION"]).copy()
            original=doc["materials"][p["material"]]
            # Only flat grass triangles stretch to cover the full placement grid.
            if name=="Meadow, banks and river":
                original_x=pos[:,0].copy();pos[:,0]+=shift_x(original_x)
                if original["name"]=="Earth":
                    pos[original_x<17,0]=EDGE
            if name in ("Borderland Meadow","River current and wakes"):
                if original["name"]!="Painted alpine distance":
                    pos[:,0]+=EAST
                elif name=="Borderland Meadow":
                    pos[:,0]+=shift_x(pos[:,0])
            targets=[source.array(target["POSITION"]) for target in p.get("targets",[])]
            extremes.append((pos.min(axis=0),pos.max(axis=0)))
            for delta in targets:
                pose=pos+delta
                extremes.append((pose.min(axis=0),pose.max(axis=0)))
            mat,paint=stream.material(original)
            if original["name"].startswith("Sward"):
                paint=meadow_colors(pos)
            batches[(mat,paint is not None)].append((p,pos,targets,paint))
        output={k:copy.deepcopy(v) for k,v in mesh.items() if k in ("name","extras","weights")}
        output["primitives"]=[]
        for (mat,painted),parts in batches.items():
            positions=[];normals=[];uvs=[];colors=[];indices=[];offset=0
            deltas=[[] for _ in parts[0][2]]
            for p,pos,targets,paint in parts:
                count=len(pos);positions.append(pos);normals.append(source.array(p["attributes"]["NORMAL"]))
                idx=source.array(p["indices"]).astype(np.uint32)+offset;indices.append(idx);offset+=count
                if "TEXCOORD_0" in p["attributes"] and not painted:
                    uvs.append(source.array(p["attributes"]["TEXCOORD_0"]))
                if painted:
                    color = np.broadcast_to(paint, (count, 4))
                    colors.append(np.round(color*65535).astype("uint16"))
                for collection,delta in zip(deltas,targets):
                    collection.append(delta)
            attr={"POSITION":stream.array(np.vstack(positions),"VEC3",bounds=True,target=34962),
                  "NORMAL":stream.array(np.vstack(normals),"VEC3",target=34962)}
            if uvs:
                assert len(uvs)==len(parts)
                attr["TEXCOORD_0"]=stream.array(np.vstack(uvs),"VEC2",target=34962)
            if painted:
                attr["COLOR_0"]=stream.array(np.vstack(colors),"VEC4",5123,normalized=True,target=34962)
            primitive={"attributes":attr,"indices":stream.array(np.vstack(indices),"SCALAR",5125 if offset>65535 else 5123,target=34963),"material":mat}
            if deltas:
                primitive["targets"]=[{"POSITION":stream.array(np.vstack(delta),"VEC3",bounds=True,sparse=True)} for delta in deltas]
            output["primitives"].append(primitive)
        stream.doc["meshes"].append(output)
        samples.append((np.min([s[0] for s in extremes],axis=0),np.max([s[1] for s in extremes],axis=0)))
    return samples


def rotation_matrix(q):
    x,y,z,w=q
    return np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],
                     [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],
                     [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])


def bounds(node, samples):
    lo,hi=samples[node["mesh"]]
    corners=np.array([[x,y,z] for x in (lo[0],hi[0]) for y in (lo[1],hi[1]) for z in (lo[2],hi[2])])
    points=(corners*np.array(node.get("scale",[1,1,1])))@rotation_matrix(node.get("rotation",[0,0,0,1])).T
    points+=node.get("translation",[0,0,0])
    return points.min(axis=0),points.max(axis=0)


def label(mesh, node):
    position=node.get("translation",[0,0,0])
    for index,centre in enumerate(CENTRES,1):
        if np.max(np.abs(np.array(position)[[0,2]]-centre))<.001:
            if mesh.split()[0] in ("I","II","III","IV","V") or mesh in ("Campfire","Hanging cooking pot"):
                return index
    return None


def mark_dressing(node, samples):
    lo, hi = bounds(node, samples)
    limits = np.floor(np.array([lo[[0,2]], hi[[0,2]]]) + EDGE).astype(int)
    cells = [[x,z] for x in range(max(0,limits[0,0]),min(36,limits[1,0])+1)
                   for z in range(max(0,limits[0,1]),min(36,limits[1,1])+1)]
    x, _, z = node["translation"]
    node.setdefault("extras", {}).update(meadowCell=[math.floor(x+EDGE), math.floor(z+EDGE)], meadowCells=cells)


def place_grass(stream, samples):
    """Scatter small patches of the original tuft, each independently removable."""
    mesh = next(i for i,m in enumerate(stream.doc["meshes"]) if m["name"]=="Grass Tufts")
    rng = np.random.default_rng(8237)
    occupied = [np.array(n["translation"])[[0,2]] for n in stream.doc["nodes"] if "meadowCell" in n.get("extras", {})]
    centres = np.array(CENTRES + [(-18,-14), (18,14)])
    count = 0
    for patch in range(38):
        center = rng.uniform(-17.2, 17.2, 2)
        for tuft in range(int(rng.integers(2, 6))):
            xz = center + rng.normal(0, .58, 2)
            if np.max(np.abs(xz))>18 or np.min(np.max(np.abs(centres-xz), axis=1))<.85:
                continue
            if min(np.linalg.norm(xz-other) for other in occupied)<.55:
                continue
            yaw = rng.uniform(0, math.pi)
            size = rng.uniform(1.12, 1.76)
            node = {"name":f"Meadow grass {patch+1}.{tuft+1}", "mesh":mesh,
                    "translation":[xz[0], -.035, xz[1]], "scale":[size, size*rng.uniform(.85,1.13), size],
                    "rotation":[0, math.sin(yaw), 0, math.cos(yaw)]}
            mark_dressing(node, samples)
            stream.node(node, True)
            occupied.append(xz)
            count += 1
    return count


def placements(source,stream,samples):
    doc=source.doc;background=defaultdict(list);checkpoints=defaultdict(list)
    targets={channel["target"]["node"] for clip in doc["animations"] for channel in clip["channels"]}
    remap={};shifts={};loose=0
    for idx,original in enumerate(doc["nodes"]):
        assert "children" not in original and "matrix" not in original
        node=copy.deepcopy(original);mesh=doc["meshes"][node["mesh"]]["name"]
        x,y,z=node.get("translation",[0,0,0]);cp=label(mesh,node)
        if cp:
            remap[idx]=stream.node(node);checkpoints[cp].append(remap[idx]);shifts[idx]=0
            continue
        herb=mesh in BRUSH; tree=mesh in TREES
        riparian=herb and x>13 and y<-.045
        field=herb and abs(x)<=EDGE and abs(z)<=EDGE and not riparian
        centre_mesh=mesh in ("Borderland Meadow","Meadow, banks and river","River current and wakes")
        delta=0 if centre_mesh or field else EAST if x>=14 or riparian else WEST if x<=-17.5 else float(shift_x(x))
        node["translation"]=[x+delta,y,z]
        if tree and abs(node["translation"][0])<20 and abs(z)>16:
            lo,hi=bounds(node,samples)
            if hi[0]>-EDGE and lo[0]<EDGE:
                if z>0:node["translation"][2]+=max(0,EDGE+.08-lo[2])
                else:node["translation"][2]-=max(0,hi[2]+EDGE+.08)
        shifts[idx]=delta
        if field:
            mark_dressing(node,samples)
            loose+=1
        if idx in targets or field or node.get("extras") or centre_mesh:
            remap[idx]=stream.node(node,True)
        else:
            background[node["mesh"]].append((idx,node))
    for mesh,group in background.items():
        if len(group)<2:
            idx,node=group[0];remap[idx]=stream.node(node,True);continue
        attrs={}
        for key,typ,default in [("translation","VEC3",[0,0,0]),("rotation","VEC4",[0,0,0,1]),("scale","VEC3",[1,1,1])]:
            values=np.array([n.get(key,default) for _,n in group])
            attrs[key.upper()]=stream.array(values,typ,bounds=key=="translation",target=34962)
        stream.node({"name":doc["meshes"][mesh]["name"]+" groves and placements","mesh":mesh,
                     "extensions":{"EXT_mesh_gpu_instancing":{"attributes":attrs}}},True)
    loose+=place_grass(stream,samples)
    fitted=[]
    for number,centre in enumerate(CENTRES,1):
        group=checkpoints[number];assert len(group)==(3 if number==4 else 1)
        all_bounds=[bounds(stream.doc["nodes"][i],samples) for i in group]
        lo=np.min([p[0] for p in all_bounds],axis=0);hi=np.max([p[1] for p in all_bounds],axis=0)
        factor=.935/max((hi-lo)[[0,2]])
        pivot=(lo+hi)*.5;pivot[1]=lo[1]
        for i in group:
            node=stream.doc["nodes"][i]
            node["translation"]=(np.asarray(node["translation"])-pivot).tolist()
        stream.node({"name":f"Route checkpoint {number}","translation":[centre[0],.002,centre[1]],
                     "scale":[factor]*3,"children":group,"extras":{"checkpointIndex":number}},True)
        footprint=(hi-lo)[[0,2]]*factor
        assert max(footprint)<=.936
        fitted.append([round(float(a),4) for a in footprint])
    print("Checkpoint footprints (X/Z; all wind poses):",fitted,"loose placements:",loose)
    return remap,shifts


def animations(source,stream,remap,shifts):
    for clip in source.doc["animations"]:
        channels=[];samplers=[]
        for ch in clip["channels"]:
            idx=ch["target"]["node"];path=ch["target"]["path"];sp=clip["samplers"][ch["sampler"]]
            times=source.array(sp["input"]);vals=source.array(sp["output"])
            if path=="translation" and shifts[idx]:
                vals=vals.copy();vals[:,0]+=shifts[idx]
            input_i=stream.array(times,"SCALAR",bounds=True)
            output_i=stream.array(vals,source.doc["accessors"][sp["output"]]["type"])
            channels.append({"sampler":len(samplers),"target":{"node":remap[idx],"path":path}})
            samplers.append({"input":input_i,"output":output_i,"interpolation":sp.get("interpolation","LINEAR")})
        stream.doc["animations"].append({"name":"Meadow ambient loop","samplers":samplers,"channels":channels})


def main():
    source=Source(SOURCE);stream=Stream(source)
    for original in source.doc["images"]:
        img=original.copy();data=source.view(img["bufferView"]).tobytes()
        if img["name"]=="alpine-horizon":
            encoded=io.BytesIO();Image.open(io.BytesIO(data)).convert("RGB").save(encoded,format="JPEG",quality=94,subsampling=0)
            data=encoded.getvalue();img["mimeType"]="image/jpeg"
        img["bufferView"]=stream.view(data);stream.doc["images"].append(img)
    samples=geometry(source,stream)
    remap,shifts=placements(source,stream,samples)
    animations(source,stream,remap,shifts)
    stream.write(OUTPUT)
    print(len(stream.doc["nodes"]),"nodes;",sum(len(stream.doc["meshes"][n["mesh"]]["primitives"]) for n in stream.doc["nodes"] if "mesh" in n),
          "base draw submissions;",OUTPUT.stat().st_size,"bytes")


if __name__=="__main__":
    main()
