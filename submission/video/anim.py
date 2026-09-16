#!/usr/bin/env python3
"""Animated scene library for the Aval demo video.

The first cut was 14 static cards held ~11s each: a PDF on a timer. These scenes
ANIMATE the ideas that are temporal or structural, which is most of them. Data
shown is still real; motion is used for explanation, never to invent a result.
"""
import math
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1920, 1080, 30
BG=(7,7,11); PANEL=(13,13,18); BORDER=(38,38,46)
FG=(232,232,239); DIM=(138,138,152); GREEN=(52,211,153); SKY=(86,182,240)
ROSE=(251,113,133); AMBER=(251,191,36)
SANS='/System/Library/Fonts/SFNS.ttf'; MONO='/System/Library/Fonts/Menlo.ttc'
F=lambda p,s: ImageFont.truetype(p,s)
H1=F(SANS,64); H2=F(SANS,40); BODY=F(SANS,30); SMALL=F(SANS,24); LAB=F(SANS,20)
M=F(MONO,26); MS=F(MONO,22)

def frame():
    im=Image.new('RGB',(W,H),BG); return im, ImageDraw.Draw(im)

def foot(d):
    d.text((80,H-58),'Aval  ·  proof of funds in flight  ·  built on Midnight',font=LAB,fill=(70,70,82))

def ease(t):                      # smooth in/out
    return t*t*(3-2*t)

def clamp01(x): return 0.0 if x<0 else (1.0 if x>1 else x)

def seg(i, n, a, b):
    """progress of sub-animation spanning frames a..b of an n-frame scene"""
    return clamp01((i-a)/max(1,(b-a)))


# ── SCENE: the dead window, animated ────────────────────────────────────────
def dead_window(secs=13):
    n=int(secs*FPS); out=[]
    x0,x1,y = 200, 1720, 520
    for i in range(n):
        im,d=frame()
        d.text((80,90),'The dead window',font=H1,fill=FG)
        d.text((80,176),'$2M leaves Ethereum at 09:00. It arrives at 09:41.',font=H2,fill=DIM)
        # rail
        d.line([x0,y,x1,y],fill=BORDER,width=4)
        for lbl,fx in (('09:00',0.0),('09:41',1.0)):
            px=x0+(x1-x0)*fx
            d.line([px,y-22,px,y+22],fill=(90,95,115),width=3)
            d.text((px-44,y+40),lbl,font=M,fill=DIM)
        p=ease(seg(i,n,int(.10*n),int(.55*n)))          # money travels
        px=x0+(x1-x0)*p
        # the unusable bar grows behind it
        if p>0:
            d.rounded_rectangle([x0,y-16,max(x0+2,px),y+16],radius=8,fill=(58,18,28))
            d.rounded_rectangle([x0,y-16,max(x0+2,px),y+16],radius=8,outline=ROSE,width=2)
        # the money token
        d.ellipse([px-26,y-26,px+26,y+26],fill=GREEN)
        d.text((px-34,y-58),'$2M',font=SMALL,fill=GREEN)
        if p>0.06:
            d.text((x0+20,y+92),'committed · irrevocable · unusable',font=BODY,fill=ROSE)
        if p>=1.0:
            d.text((x0,y+150),'41 minutes of capital that exists and cannot be used.',font=H2,fill=ROSE)
        # the collapse
        q=ease(seg(i,n,int(.70*n),int(.92*n)))
        if q>0:
            d.rectangle([0,y+130,W,y+230],fill=BG)
            cw=(x1-x0)*(1-q)
            d.rounded_rectangle([x0,y-16,x0+max(2,cw),y+16],radius=8,fill=(6,40,30),outline=GREEN,width=2)
            d.text((x0,y+150),'With Aval: the counterparty releases now.',font=H2,fill=GREEN)
        foot(d); out.append(im)
    return out


# ── SCENE: the dual ledger, animated ────────────────────────────────────────
def dual_ledger(secs=13):
    n=int(secs*FPS); out=[]
    priv=['lock_id','amount','salt','merkle path','identity']
    pub=[('merkle root',SKY),('nullifier',SKY),('fill count',SKY)]
    for i in range(n):
        im,d=frame()
        d.text((80,80),'What crosses, and what never does',font=H1,fill=FG)
        d.text((80,166),'Compact refuses to compile if a witness reaches the ledger without disclose().',font=SMALL,fill=DIM)
        lx,rx,ty=140,1080,280
        d.rounded_rectangle([lx,ty,lx+640,ty+520],radius=16,fill=PANEL,outline=(20,70,55),width=2)
        d.text((lx+28,ty+24),'PRIVATE · WITNESS',font=LAB,fill=GREEN)
        d.rounded_rectangle([rx,ty,rx+700,ty+520],radius=16,fill=PANEL,outline=(16,54,82),width=2)
        d.text((rx+28,ty+24),'PUBLIC · LEDGER',font=LAB,fill=SKY)
        # the membrane
        mx=lx+640+((rx-(lx+640))//2)
        for yy in range(ty+30, ty+500, 22):
            d.line([mx,yy,mx,yy+10],fill=(46,50,66),width=3)
        for k,name in enumerate(priv):
            yy=ty+96+k*84
            d.rounded_rectangle([lx+28,yy,lx+400,yy+56],radius=10,fill=(10,30,24),outline=(24,84,64),width=2)
            d.text((lx+50,yy+14),name,font=M,fill=GREEN)
            # each tries to cross, and is stopped
            p=ease(seg(i,n,int((.12+k*.09)*n),int((.30+k*.09)*n)))
            if p>0:
                bx=lx+400+(mx-(lx+400))*p
                d.ellipse([bx-9,yy+19,bx+9,yy+37],fill=GREEN)
                if p>=1.0:
                    d.line([mx-16,yy+12,mx+16,yy+44],fill=ROSE,width=4)
                    d.line([mx+16,yy+12,mx-16,yy+44],fill=ROSE,width=4)
        q=ease(seg(i,n,int(.62*n),int(.86*n)))
        if q>0:
            d.text((mx-110,ty+544),'disclose()',font=M,fill=AMBER)
            for k,(name,col) in enumerate(pub):
                yy=ty+120+k*110
                bx=mx+(rx+40-mx)*q
                d.ellipse([bx-9,yy+19,bx+9,yy+37],fill=AMBER)
                if q>=1.0:
                    d.rounded_rectangle([rx+28,yy,rx+520,yy+56],radius=10,fill=(8,26,40),outline=(20,74,110),width=2)
                    d.text((rx+50,yy+14),name,font=M,fill=col)
        if q>=1.0:
            d.text((140,ty+560),'The amount is not among them. It never crosses.',font=H2,fill=GREEN)
        foot(d); out.append(im)
    return out


# ── SCENE: the soundness attack, animated ───────────────────────────────────
def soundness(secs=18):
    """The attack, drawn. The story is that the PATH is swapped, so the path is
    what gets highlighted, with the honest leaf left visible so the swap reads."""
    n=int(secs*FPS); out=[]
    TOP=270; DY=118

    def layout(cx=960):
        lv=[[cx]]
        for depth in range(3):
            nxt=[]
            for x in lv[-1]:
                sp=300//(depth+1)
                nxt += [x-sp, x+sp]
            lv.append(nxt)
        return lv

    def path_nodes(leaf_idx):
        """indices from leaf up to root"""
        out=[]; idx=leaf_idx
        for depth in range(3,-1,-1):
            out.append((depth, idx)); idx//=2
        return out

    def draw_tree(d, lv, paths):
        # base edges
        for depth in range(3):
            for i,a in enumerate(lv[depth]):
                for j,b in enumerate((a-300//(depth+1), a+300//(depth+1))):
                    d.line([a,TOP+depth*DY+16,b,TOP+(depth+1)*DY-16],fill=(34,38,52),width=2)
        # highlighted paths
        for leaf_idx,col,wd in paths:
            pn=path_nodes(leaf_idx)
            for k in range(len(pn)-1):
                (d1,i1),(d2,i2)=pn[k],pn[k+1]
                d.line([lv[d1][i1],TOP+d1*DY-16, lv[d2][i2],TOP+d2*DY+16],fill=col,width=wd)
        # nodes
        for depth,row in enumerate(lv):
            for idx,x in enumerate(row):
                yy=TOP+depth*DY
                col=(52,58,76); fill=PANEL
                for leaf_idx,c,_ in paths:
                    if (depth,idx) in path_nodes(leaf_idx): col=c
                for leaf_idx,c,_ in paths:
                    if depth==3 and idx==leaf_idx: fill=c
                d.ellipse([x-15,yy-15,x+15,yy+15],fill=fill,outline=col,width=3)
        d.text((lv[0][0]-34,TOP-58),'root',font=LAB,fill=DIM)

    for i in range(n):
        im,d=frame()
        d.text((80,66),'We attacked our own contract',font=H1,fill=FG)
        lv=layout()
        a=seg(i,n,0,int(.28*n)); b=seg(i,n,int(.30*n),int(.60*n)); c=seg(i,n,int(.64*n),int(.95*n))
        if b<=0:
            d.text((80,150),'find_path is a WITNESS: it runs on the prover machine and is not verified.',font=SMALL,fill=DIM)
            draw_tree(d,lv,[(2,GREEN,4)] if a>.25 else [])
            if a>.35: d.text((760,TOP+3*DY+58),'the honest leaf',font=BODY,fill=GREEN)
        elif c<=0:
            d.text((80,150),'So it can return the path of a DIFFERENT registered leaf.',font=SMALL,fill=DIM)
            k=5 if b>.45 else 2
            paths=[(2,(28,74,60),3)] + ([(5,ROSE,5)] if b>.45 else [])
            draw_tree(d,lv,paths)
            if b>.45:
                d.text((470,TOP+3*DY+58),'while the circuit checks amount, payee and expiry',font=BODY,fill=DIM)
                d.text((470,TOP+3*DY+100),'against values the attestor never authorised',font=BODY,fill=DIM)
            if b>.80:
                d.rounded_rectangle([540,TOP+3*DY+150,1380,TOP+3*DY+226],radius=12,fill=(40,12,20),outline=ROSE,width=2)
                d.text((575,TOP+3*DY+172),'2^64-1 units · wrong payee · past expiry  →  ACCEPTED',font=H2,fill=ROSE)
        else:
            d.text((80,150),'One line binds the path to the leaf the circuit recomputed.',font=SMALL,fill=DIM)
            draw_tree(d,lv,[(5,(70,30,44),3)])
            d.rounded_rectangle([150,TOP+3*DY+60,1770,TOP+3*DY+140],radius=12,fill=PANEL,outline=GREEN,width=2)
            d.text((182,TOP+3*DY+84),'assert(disclose(path.leaf == leaf), "merkle path does not open the claimed leaf");',font=MS,fill=FG)
            if c>.5:
                d.rounded_rectangle([540,TOP+3*DY+164,1380,TOP+3*DY+240],radius=12,fill=(6,36,26),outline=GREEN,width=2)
                d.text((640,TOP+3*DY+186),'the same forged proof  →  REJECTED',font=H2,fill=GREEN)
            if c>.78:
                d.text((470,TOP+3*DY+266),'the exploit is now a permanent regression test',font=BODY,fill=DIM)
        foot(d); out.append(im)
    return out


# ── SCENE: single-use nullifier, animated ───────────────────────────────────
def nullifier(secs=10):
    """One lock, one proof. The second proof is turned away at the door.

    Staging matters here: proof #1 is ABSORBED (the chip disappears, a row
    appears inside the spent set). Proof #2 reaches the door and is pushed back
    out. A chip left resting on the panel would cover the very row that is the
    reason the second proof was rejected.
    """
    n = int(secs*FPS); out = []
    sx, sy = 300, 470
    bx, by = 1520, 470
    door = bx - 210
    for i in range(n):
        im, d = frame()
        d.text((80, 90), 'A proof you spend, not one you show', font=H1, fill=FG)
        d.text((80, 176), 'The nullifier comes from the private lock_id and salt. One lock, one proof, ever.',
               font=SMALL, fill=DIM)

        p = ease(seg(i, n, int(.08*n), int(.34*n)))
        q = ease(seg(i, n, int(.46*n), int(.74*n)))
        r = ease(seg(i, n, int(.74*n), int(.88*n)))

        d.rounded_rectangle([door, by-110, bx+210, by+110], radius=14,
                            fill=PANEL, outline=BORDER, width=2)
        d.text((door+28, by-86), 'SPENT NULLIFIERS', font=LAB, fill=SKY)
        if p >= 1.0:
            d.rounded_rectangle([door+24, by-36, bx+186, by+30], radius=8,
                                fill=(8, 24, 34), outline=SKY, width=1)
            d.text((door+44, by-22), '0016a476e0c3f1b8\u2026', font=MS, fill=SKY)
            d.text((door+28, by+48), '1 of 1 used', font=SMALL, fill=DIM)

        d.line([sx, sy, door-30, sy], fill=(34, 40, 52), width=2)
        d.line([sx, sy+150, door-30, sy+150], fill=(34, 40, 52), width=2)

        if 0 < p < 1.0:
            x = sx + (door-30-sx)*p
            d.rounded_rectangle([x-92, sy-32, x+92, sy+32], radius=10,
                                fill=(6, 40, 30), outline=GREEN, width=2)
            d.text((x-64, sy-13), 'proof #1', font=M, fill=GREEN)
        if p >= 1.0:
            d.text((sx, sy-78), 'accepted', font=H2, fill=GREEN)

        if q > 0:
            reach = (door-30-sx)
            x = sx + reach*q - reach*0.34*r
            d.rounded_rectangle([x-92, sy+150-32, x+92, sy+150+32], radius=10,
                                fill=(40, 14, 22), outline=ROSE, width=2)
            d.text((x-64, sy+150-13), 'proof #2', font=M, fill=ROSE)
        if r > 0.35:
            d.text((80, 770), 'rejected: this lock has already backed a proof',
                   font=H2, fill=ROSE)
            d.text((80, 822), 'the nullifier is the same, so the set already holds it',
                   font=BODY, fill=DIM)
        foot(d); out.append(im)
    return out
