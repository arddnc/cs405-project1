from pathlib import Path
import json, math, io
import numpy as np
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.utils import ImageReader
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/pdfs'
OUT.mkdir(parents=True, exist_ok=True)
SHOTS = ROOT / 'screenshots'
pdfmetrics.registerFont(TTFont('Text', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Bold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFont(TTFont('Mono', 'C:/Windows/Fonts/consola.ttf'))
pdfmetrics.registerFontFamily('Text',normal='Text',bold='Bold',italic='Text',boldItalic='Bold')

# Recover a compatible pose, not the unknown original animation timestamp.
# The screenshot only records rounded matrix entries.
target = np.array([[-.99,.07,-.12,-.78],[-.07,-1,0,1.74],[-.12,.01,.99,1.58]])
def poses(t):
    b=.6*np.sin(.5*t); a=-.35+.3*np.sin(1.1*t)
    d=-1.9+.35*np.sin(.9*t+1); h=-.9+.25*np.sin(1.7*t)
    q=a+d+h; cb=np.cos(b); sb=np.sin(b); cq=np.cos(q); sq=np.sin(q)
    x=-1.1*np.sin(a)-.9*np.sin(a+d)+.32*np.sin(q)
    y=.06+1.1*np.cos(a)+.9*np.cos(a+d)-.32*np.cos(q)
    vals=np.stack([cb*cq,-cb*sq,sb,-1.85+cb*x,sq,cq,np.zeros_like(t),.96+y,
                   -sb*cq,sb*sq,cb,1.45-sb*x],axis=-1).reshape(-1,3,4)
    return vals
t=np.arange(0,10000,.01)
err=np.max(np.abs(poses(t)-target),axis=(1,2))
best=float(t[np.argmin(err)])
t=np.arange(max(0,best-.02),best+.02,.00001)
err=np.max(np.abs(poses(t)-target),axis=(1,2))
best=float(t[np.argmin(err)])
M=poses(np.array([best]))[0]
angles=[.6*math.sin(.5*best),-.35+.3*math.sin(1.1*best),-1.9+.35*math.sin(.9*best+1),-.9+.25*math.sin(1.7*best)]
b,a,d,h=angles
def rz(q,p):
    x,y,z=p; return np.array([math.cos(q)*x-math.sin(q)*y,math.sin(q)*x+math.cos(q)*y,z])
p0=np.array([0,-.32,0]); p1=rz(h,p0)+[0,.9,0]; p2=rz(d,p1)+[0,1.1,0]; p3=rz(a,p2)+[0,.06,0]
p4=np.array([math.cos(b)*p3[0]+math.sin(b)*p3[2],p3[1],-math.sin(b)*p3[0]+math.cos(b)*p3[2]])+[-1.85,.11,-.45]
p5=p4+[0,.85,1.9]
assert np.max(np.abs(M-target)) < .005
calc={'note':'Compatible pose reconstructed from rounded screenshot, not recovered timestamp','angles_rad':angles,'world_matrix_rows':M.tolist()+[[0,0,0,1]],'translation_steps':[p.tolist() for p in [p0,p1,p2,p3,p4,p5]]}
(OUT/'matrix_check.json').write_text(json.dumps(calc,indent=2))

W,H=595.28,841.89
c=canvas.Canvas(str(ROOT/'report.pdf'),pagesize=(W,H))
c.setTitle('CS405 Project 1 - Arda Dinç')
c.setAuthor('Arda Dinç; prepared with OpenAI Codex assistance')
transcript=[]
def text(s,x=36,y=70,w=523,size=9.2,leading=12):
    for before,after in [('⁻¹','^(-1)'),('⁻⁶','^(-6)'),('ᵀ','^T'),('ᵢ₊₁','<sub>i+1</sub>'),('ᵢ₋₁','<sub>i-1</sub>'),('ᵢ','<sub>i</sub>'),('₀','<sub>0</sub>'),('₁','<sub>1</sub>'),('₂','<sub>2</sub>'),('₃','<sub>3</sub>')]:
        s=s.replace(before,after)
    p=Paragraph(s,ParagraphStyle('p',fontName='Text',fontSize=size,leading=leading,textColor='#24323b'))
    _,height=p.wrap(w,1000)
    p.drawOn(c,x,H-y-height)
    transcript.append(s)
    return y+height
def title(s,y=56):
    c.setFillColorRGB(.13,.25,.29); c.setFont('Bold',17); c.drawString(36,H-y,s)
    transcript.append('\n## '+s)
def heading(s,y):
    c.setFillColorRGB(.13,.25,.29); c.setFont('Bold',11); c.drawString(36,H-y,s)
    transcript.append('\n### '+s)
def image(name,x,y,w,caption,crop=None):
    im=Image.open(SHOTS/name)
    if crop: im=im.crop(crop)
    # shrink: downscale + JPEG so the PDF stays a few MB
    im=im.convert('RGB')
    if im.width>1400: im=im.resize((1400,round(im.height*1400/im.width)))
    buf=io.BytesIO(); im.save(buf,'JPEG',quality=82); buf.seek(0)
    ih=w*im.height/im.width
    c.drawImage(ImageReader(buf),x,H-y-ih,width=w,height=ih)
    text(caption,x,y+ih+3,w,7.4,9)
    return y+ih+24
def mono(s,y,size=8.5,x=40):
    c.setFillColorRGB(.12,.18,.22); c.setFont('Mono',size)
    for row in s.splitlines():
        c.drawString(x,H-y,row); y+=size*1.35
    transcript.append(s)
    return y
def footer(n):
    c.setStrokeColorRGB(.75,.8,.8); c.line(36,33,559,33)
    c.setFillColorRGB(.35,.4,.43); c.setFont('Text',7.5)
    c.drawString(36,21,'CS405 · Arda Dinç · 8 November 2026')
    c.drawRightString(559,21,f'{n} / 5'); c.showPage()

title('Transformations, cameras and curves')
text('<b>CS405 Project 1 · Arda Dinç</b><br/>Şeker Ahmed Paşa · Kavunlu Natürmort · Sakıp Sabancı Museum',y=67)
text('Repository: <link href="https://github.com/arddnc/cs405-project1">github.com/arddnc/cs405-project1</link> · local tag: project1-final',y=98,size=8)
heading('1. Painting and scene',132)
text('The melon slice provides a clear organic contour for a piecewise curve. Its long lower rim makes tangent continuity visible, while the painted tabletop suggested the table, melon and articulated lamp placed in front of the painting.',y=141)
image('c_frustum.png',36,184,523,'Figure 1. Complete scene in split view; the fixed inspection camera reveals the main camera and its frustum.')
heading('2. Part A - Transformation order',510)
text('The project uses column vectors, column-major storage (index = 4c + r), and T·R·S as its normal model convention. Thus M p = T(R(S p)): scale about the local origin, rotate, then translate. S·R·T applies translation first, so rotation and scale also change the offset. The controlled object intentionally offers both orders.',y=519)
image('a_trs.png',36,580,255,'Figure 2a. T·R·S, scale 1.5.')
image('a_srt.png',304,580,255,'Figure 2b. S·R·T, scale 1.5.')
text('With t = (1, 1.25, 2.75), rotation y = 30° and s = 1.5, the last column changes from <b>(1, 1.25, 2.75)</b> to <b>(3.36154, 1.875, 2.82235)</b>, matching the displayed (3.36, 1.88, 2.82). Camera angles differ between these captures; the printed matrices provide the direct comparison.',y=755,size=8,leading=10)
footer(1)

title('3. Part B - Hierarchical transforms')
text('Each node computes world = parentWorld · local and passes that result to its children. Mesh sizing is stored separately in shape.matrix and is not inherited. Animated joints are the lamp base, arm 1, arm 2 and head.',y=70)
mono('root\n├─ painting ─┬─ frame\n│            └─ curve follower\n├─ table ───┬─ 4 legs\n│           ├─ lamp base → arm 1 → arm 2 → head → bulb\n│           ├─ melon\n│           └─ box\n└─ controlled object',125,9)
image('b_axes.png',36,230,300,'Figure 3. Paused lamp with node axes enabled.')
mono('Displayed world(bulb):\n[-0.99  0.07 -0.12 -0.78]\n[-0.07 -1.00  0.00  1.74]\n[-0.12  0.01  0.99  1.58]\n[ 0.00  0.00  0.00  1.00]',254,8,x=350)
heading('Translation-column verification',436)
text('W = M_table · M_base · M_arm1 · M_arm2 · M_head · M_bulb. The screenshot does not record joint angles or animation time. The values below reconstruct one compatible pose from the source animation and the rounded matrix; they are not a claim to have recovered the exact paused timestamp. All 12 displayed upper entries agree within 0.005.',y=446,size=8.6,leading=11)
text('Local transforms: M_table = T(0, .85, 1.9); M_base = T(-1.85, .11, -.45) Ry(β); M_arm1 = T(0, .06, 0) Rz(α); M_arm2 = T(0, 1.1, 0) Rz(δ); M_head = T(0, .9, 0) Rz(η); M_bulb = T(0, -.32, 0).',y=506,size=8.6,leading=11)
text('Compatible angles (radians): β = %.6f, α = %.6f, δ = %.6f, η = %.6f.'%tuple(angles),y=552,size=8.5)
fmt=lambda p:'('+', '.join(f'{x:.5f}' for x in p)+')'
steps=['p0 = bulb translation                 '+fmt(p0),'p1 = Rz(η)p0 + (0, .9, 0)             '+fmt(p1),'p2 = Rz(δ)p1 + (0, 1.1, 0)            '+fmt(p2),'p3 = Rz(α)p2 + (0, .06, 0)            '+fmt(p3),'p4 = Ry(β)p3 + (-1.85, .11, -.45)     '+fmt(p4),'p5 = p4 + (0, .85, 1.9)               '+fmt(p5)]
mono('\n'.join(steps),585,8)
text('Each planar rotation uses Rz(θ)(x,y,z) = (x cosθ - y sinθ, x sinθ + y cosθ, z). The final position rounds to <b>(-0.78, 1.74, 1.58)</b>, the translation column in Figure 3. This checks the hierarchy and multiplication order at screenshot precision; full-precision capture would be needed for an exact original-frame check.',y=676,size=8.7,leading=12)
footer(2)

title('4. Part C - View and projection')
text('<b>View matrix.</b> Let w = normalize(eye - target), u = normalize(up × w), v = w × u. The camera-to-world matrix is C = [R | eye], with R columns u, v, w. Because R is orthonormal, V = C⁻¹ = [Rᵀ | -Rᵀ eye]. Its rows are u, v, w; translation is (-u·eye, -v·eye, -w·eye). If |up × w| &lt; 10⁻⁶, use (0,0,1), or (1,0,0) if that is also parallel. The top-view capture demonstrates a finite view at the pole.',y=70,size=8.7,leading=11.5)
text('<b>Perspective depth.</b> For z_ndc = (Az + B)/(-z), z = -n gives -An + B = 0, so B = An. At z = -f: -Af + B = f. Substitution yields A(n - f) = f, hence A = f/(n - f), B = nf/(n - f). With g = cot(fovY/2), the matrix rows are:',y=151,size=8.7,leading=11.5)
mono('[g/aspect  0  0  0]    [0  g  0  0]    [0  0  A  B]    [0  0 -1  0]',205,8)
text('This maps depth to [0,1], unlike the conventional OpenGL [-1,1] range. Orthographic rows are [2/(r-l),0,0,-(r+l)/(r-l)], [0,2/(t-b),0,-(t+b)/(t-b)], [0,0,1/(n-f),n/(n-f)], [0,0,0,1]. No perspective divide changes scale because clip w = 1.',y=220,size=8.5,leading=11)
image('c_persp.png',36,270,255,'Figure 4a. Perspective, near .5 / far 20.')
image('c_ortho.png',304,270,255,'Figure 4b. Orthographic, same viewpoint.')
image('c_frustum.png',36,443,255,'Figure 4c. Perspective frustum in inspection view.')
image('c_topview.png',304,443,255,'Figure 4d. Top view: parallel-up fallback.')
image('c_depth_test.png',36,615,230,'Figure 4e. Near .05 / far 120 experiment.')
text('<b>Near/far experiment.</b> The usual range is n = .5, f = 20 (ratio 40). The test uses n = .05, f = 120 (ratio 2400). Perspective depth varies with 1/z, concentrating resolution near the camera. A smaller near plane worsens distant depth separation. No obvious z-fighting is visible in this captured frame; that does not prove precision is unchanged or rule out flicker during motion.',x=280,y=621,w=279,size=8.5,leading=11.5)
footer(3)

title('5. Part D - Tracing the melon slice')
text('The exported curve contains three cubic Bézier segments and ten control points in normalized painting coordinates (x right, y up). The knots and handles were manually adjusted in the application to trace the lower rim. The captured comparison keeps the same viewpoint and knots when switching curve family.',y=70,size=9,leading=12)
image('d_bezier.png',36,124,255,'Figure 5a. Edited Bézier with de Casteljau construction.')
image('d_catmull.png',304,124,255,'Figure 5b. Catmull-Rom through the same knots.')
text('<b>Bernstein basis:</b> B₀ = (1-t)³, B₁ = 3t(1-t)², B₂ = 3t²(1-t), B₃ = t³. The curve is B(t) = Σ Bᵢ(t)Pᵢ. At t = 0 the weights are (1,0,0,0), giving B(0) = P₀; at t = 1 they are (0,0,0,1), giving B(1) = P₃.',y=297,size=8.8,leading=11.5)
mono('t       B0       B1       B2       B3\n0       1        0        0        0\n0.25    .421875  .421875  .140625  .015625\n0.50    .125     .375     .375     .125\n0.75    .015625  .140625  .421875  .421875\n1       0        0        0        1',350,8)
text('<b>C¹ continuity.</b> B′(1) = 3(K - P₂) and C′(0) = 3(Q₁ - K). Equating them gives Q₁ = 2K - P₂: opposite handles mirror about the knot. The JSON rounds to five decimals, leaving at most 0.00001 component residual in this relation. De Casteljau repeatedly interpolates neighboring points, producing levels of 4, 3, 2 and 1 points; its last point equals the Bernstein result.',y=423,size=8.6,leading=11)
text('<b>Catmull-Rom.</b> The uniform segment interpolates P₁ at t = 0 and P₂ at t = 1, with tangent (Pᵢ₊₁ - Pᵢ₋₁)/2 at an interior knot. This application duplicates endpoint knots. Unlike Bézier handles, all four displayed knots lie on the curve; the different lower-rim shape is visible in Figure 5b.',y=481,size=8.6,leading=11)
heading('6. What went wrong and verification',538)
text('PowerShell refused to run npm (execution policy blocked npm.ps1); I fixed it with Set-ExecutionPolicy -Scope CurrentUser RemoteSigned. My first commit failed because Git had no user identity; I set user.name and user.email. A first version of src/math was generated by Codex; because that is not allowed for graded maths, I deleted those bodies and rewrote all of src/math and Node.updateWorld myself, using the 28 unit tests to check each file (vec3, mat4, camera, curves). The GPU read-out showed AMD while an NVIDIA GPU is also installed; Task Manager confirmed Chrome uses the AMD Radeon 890M.',y=548,size=8.5,leading=11)
heading('7. Performance',618)
text('Chrome / WebGPU; AMD Radeon 890M Graphics (application: “amd rdna-3”). Lamp and follower paused, Bézier and debug drawings enabled. These are screenshot samples, not a repeated benchmark. CPU time measures frame-loop work; GPU execution time was not measured.',y=628,size=8.5,leading=11)
mono('View       Interval   FPS   CPU      Vertices   Draw calls\nSplit      17.07 ms    59    0.48 ms  43,362     67\nSingle     16.67 ms    60    0.48 ms  21,646     33',677,8.8)
text('Split view roughly doubles submitted geometry and draw calls. Both samples are near a 60 Hz frame cadence, consistent with display pacing; they do not establish maximum throughput. Evidence: screenshots/perf.png, perf_single.png and gpu_amd.png. NVIDIA RTX 5070 Laptop GPU is also installed, but is not the adapter reported by this application.',y=724,size=8.5,leading=11)
footer(4)

title('Appendices - Provenance and curve data')
heading('A. AI use',83)
rows=[['Tool / date','What I asked','What I kept'],
['Claude / 8 Nov 2026','Explanation of the requirements and of the maths behind each function; debugging help while I rewrote src/math.','Explanations only.'],
['Claude / 8 Nov 2026','Generate the application scaffold (no starter repo): WebGPU renderer, WGSL shaders, geometry, scene layout, camera/curve state, picking and dragging, GUI, unit tests, README, report outline.','Kept as generated.'],
['Codex / 8 Nov 2026','Implement the function bodies in src/math (first version).','Discarded: I deleted them and rewrote all of src/math and Node.updateWorld myself before submission; the submitted maths is my own.'],
['Codex / 8 Nov 2026','Draft the report text, the PDF build script docs/build_report.py and the Part B pose reconstruction (tmp/pdfs/matrix_check.json).','Kept with my edits; Section 6 and this appendix rewritten by me.']]
sty=ParagraphStyle('cell',fontName='Text',fontSize=7.7,leading=10)
table=Table([[Paragraph(escape(v),sty) for v in row] for row in rows],colWidths=[105,205,213])
table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),'#e5edef'),('GRID',(0,0),(-1,-1),.4,'#bcc8ca'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
_,th=table.wrap(523,600); table.drawOn(c,36,H-95-th)
transcript.append('\n'.join(' | '.join(row) for row in rows))
text('<b>My contribution:</b> all of src/math and Node.updateWorld (rewritten by me), the traced curve and its export, scene settings and all screenshots.',y=95+th+10,size=8.3,leading=11)
heading('B. Exported curve (curve.json)',310)
text('Complete file contents below, compacted only for layout; values and fields are unchanged.',y=320,size=8.5)
data=json.loads((ROOT/'curve.json').read_text(encoding='utf-8-sig'))
lines=['{','  "painting": {']
for i,(k,v) in enumerate(data['painting'].items()): lines.append('    '+json.dumps(k)+': '+json.dumps(v,ensure_ascii=False)+(',' if i<2 else ''))
lines += ['  },','  "shape": '+json.dumps(data['shape'])+',', '  "coordinates":']
# JSON string fits on one line at the chosen small mono size.
lines += ['    '+json.dumps(data['coordinates'])+',','  "type": '+json.dumps(data['type'])+',','  "segments": 3,','  "controlPoints": [']
for i,p in enumerate(data['controlPoints']): lines.append('    '+json.dumps(p,separators=(', ', ': '))+(',' if i<9 else ''))
lines += ['  ],','  "knots": [']
for i,p in enumerate(data['knots']): lines.append('    '+json.dumps(p)+(',' if i<3 else ''))
lines += ['  ]','}']
compact='\n'.join(lines)
assert json.loads(compact)==data
mono(compact,350,7.1)
text('Supporting evidence: the screenshots directory preserves all 14 original captures at their original resolutions. The mathematical reconstruction is reproducible from docs/build_report.py; its intermediate values are in tmp/pdfs/matrix_check.json.',y=735,size=8.3,leading=11)
footer(5)
c.save()
(ROOT/'docs/report.md').write_text('\n\n'.join(transcript),encoding='utf-8')
print('Created report.pdf (5 pages); compatible pose error:',np.max(np.abs(M-target)))
print(json.dumps(calc,indent=2))
