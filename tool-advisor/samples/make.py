import cadquery as cq
from cadquery import exporters
# 1 bracket block with pocket, counterbored holes, tapped holes, side hole, chamfer
b = (cq.Workplane("XY").box(100,60,25).translate((0,0,12.5))
     .edges("|Z").fillet(6)
     .faces(">Z").workplane().rect(50,30).cutBlind(-10)
     )
b = b.edges(cq.selectors.BoxSelector((-26,-16,14),(26,16,16))).fillet(1.5)  # floor fillet? (edges at floor)
b = (b.faces(">Z").workplane().rect(80,44,forConstruction=True).vertices().cboreHole(6.6,11,6.5)
     .faces(">Z").workplane().pushPoints([(-40,0),(40,0)]).hole(6.8,15))
b = b.faces("<X").workplane(centerOption="CenterOfBoundBox").hole(10.2,30)
# vertical pocket corners
b = b.faces(">Z").edges().chamfer(0.8) if False else b
exporters.export(b,"bracket.step"); exporters.export(b,"bracket.stl")
cq.occ_impl.exporters.export(b, "bracket.igs") if False else None
# 2 thin plate
p = (cq.Workplane("XY").box(200,150,8).translate((0,0,4)).edges("|Z").fillet(10)
     .faces(">Z").workplane().rarray(170,120,2,2).hole(8.5)
     .faces(">Z").workplane().rect(80,50).cutBlind(-3))
exporters.export(p,"plate.step")
# 3 round flange
f = (cq.Workplane("XY").circle(40).extrude(20).faces(">Z").workplane().hole(30)
     .faces(">Z").workplane().polarArray(30,0,360,6).hole(6.6)
     .faces(">Z").edges("not %LINE").chamfer(1))
exporters.export(f,"flange.step")
