import cadquery as cq
from cadquery import exporters
# mould-like part: block with filleted top edges, spherical dimple, and a filleted pocket
b = cq.Workplane("XY").box(90,70,30).translate((0,0,15))
b = b.edges(">Z").fillet(8)
s = cq.Workplane("XY").sphere(22).translate((-18,0,38))
b = b.cut(s)
p = cq.Workplane("XY").box(30,30,12).translate((24,0,30-6+0.01)).edges("|Z").fillet(6).edges("<Z").fillet(3)
b = b.cut(p)
exporters.export(b,"mould.step")
