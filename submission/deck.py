#!/usr/bin/env python3
"""Aval slide deck. Renders 9 slides to a single PDF using the same design
language as the demo video. Data shown is real captured output."""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
HERE = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(HERE, 'captures')

BG, PANEL, BORDER = (7,7,11), (13,13,18), (38,38,46)
FG, DIM = (232,232,239), (138,138,152)
GREEN, SKY, ROSE, AMBER = (52,211,153), (56,189,248), (251,113,133), (251,191,36)
SANS, MONO = '/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Menlo.ttc'
F = lambda p,s: ImageFont.truetype(p,s)
T, H1, H2, BODY, SMALL = F(SANS,88), F(SANS,58), F(SANS,38), F(SANS,32), F(SANS,25)
M, MS, LAB = F(MONO,26), F(MONO,21), F(SANS,21)

slides=[]
def new():
    img=Image.new('RGB',(W,H),BG); return img, ImageDraw.Draw(img)
def foot(d,n):
    d.text((80,H-58),'Aval  ·  proof of funds in flight  ·  Midnight Buildathon Wave 1',font=LAB,fill=(70,70,82))
    d.text((W-130,H-58),f'{n}',font=LAB,fill=(70,70,82))
def wrap(d,t,f,x,y,mw,fill,lead=1.45):
    ws,l,yy=t.split(),'',y
    for w in ws:
        c=(l+' '+w).strip()
        if d.textlength(c,font=f)>mw and l:
            d.text((x,yy),l,font=f,fill=fill); yy+=int(f.size*lead); l=w
        else: l=c
    if l: d.text((x,yy),l,font=f,fill=fill); yy+=int(f.size*lead)
    return yy
def pnl(d,x,y,w,h,title=None,col=SKY):
    d.rounded_rectangle([x,y,x+w,y+h],radius=16,fill=PANEL,outline=BORDER,width=2)
    if title: d.text((x+28,y+22),title.upper(),font=LAB,fill=col)
def cap(name,limit=None):
    with open(os.path.join(CAP,name)) as fh:
        ls=[l.rstrip() for l in fh if l.strip()]
    return ls[:limit] if limit else ls

# 1 title
img,d=new()
d.text((80,360),'Aval',font=T,fill=FG)
wrap(d,'Prove money is committed but not yet arrived, so a counterparty can act now instead of waiting for settlement.',H2,80,490,1560,DIM)
d.text((80,680),'Onatola Timilehin Faruq  ·  github.com/Leihyn/aval',font=BODY,fill=GREEN)
foot(d,1); slides.append(img)

# 2 problem
img,d=new()
d.text((80,110),'The dead window',font=H1,fill=FG)
y=wrap(d,'$2M leaves Ethereum at 09:00. It arrives at 09:41. For 41 minutes the money exists, it is irrevocably committed, and it is useless.',H2,80,230,1760,FG)
y=wrap(d,'The counterparty will not release their side against a screenshot, so both desks wait. This is the largest source of idle working capital in cross-chain finance, and it exists for one reason: there is a gap between a fact being TRUE and that fact being PUBLICLY VERIFIABLE.',BODY,80,y+30,1760,DIM)
d.rounded_rectangle([80,y+80,1840,y+160],radius=12,fill=(30,12,16),outline=ROSE,width=2)
d.text((110,y+105),'Wait 41 minutes, or reveal your position. Those are the only two options today.',font=H2,fill=ROSE)
foot(d,2); slides.append(img)

# 3 solution
img,d=new()
d.text((80,110),'Prove the threshold, not the number',font=H1,fill=FG)
y=wrap(d,'Alice locks funds on a source chain. She proves to the counterparty\'s Midnight contract that the locked amount clears their threshold and is earmarked for them, without revealing the amount, the lock, or her identity.',BODY,80,220,1760,DIM)
pnl(d,80,y+50,850,290,'stays private (witness)',GREEN)
for i,t in enumerate(['lock_id','amount','salt','merkle path']): d.text((110,y+118+i*40),'· '+t,font=M,fill=FG)
pnl(d,990,y+50,850,290,'becomes public (ledger)',SKY)
for i,t in enumerate(['merkle root','nullifier','fill counter','attestor id']): d.text((1020,y+118+i*40),'· '+t,font=M,fill=FG)
d.text((80,y+385),'Six disclose() sites bridge the two. Compact refuses to compile if a witness reaches the ledger without one.',font=SMALL,fill=DIM)
foot(d,3); slides.append(img)

# 4 architecture
img,d=new()
d.text((80,100),'How it works',font=H1,fill=FG)
diag=["  SOURCE CHAIN            ATTESTOR                      MIDNIGHT",
      "  ┌──────────┐  Locked   ┌──────────┐  register_      ┌──────────────────────┐",
      "  │  escrow  │──────────▶│ watcher  │──attestation───▶│ HistoricMerkleTree   │",
      "  └──────────┘           └────┬─────┘   (leaf hash)   │ Set<nullifier>       │",
      "                              │ preimage, off-chain   │ Counter fills        │",
      "                              ▼                       └──────────┬───────────┘",
      "                         ┌──────────┐  prove_funds_in_flight     │",
      "                         │  Alice   │────────────────────────────┘",
      "                         └──────────┘  witnesses: lock_id, amount, salt, path"]
pnl(d,80,210,1760,380)
for i,l in enumerate(diag): d.text((110,250+i*36),l,font=MS,fill=FG if i%2 else SKY)
d.text((80,630),'The attestor never learns anything Alice does not already send it. The chain never learns the amount.',font=BODY,fill=DIM)
pnl(d,80,700,1760,200,'why midnight specifically',GREEN)
wrap(d,'This needs persistent private state on-chain, ZK predicate proofs over it, and a public ledger entry a counterparty contract can gate on. Midnight\'s dual ledger is that triple. On an EVM you need FHE or an off-chain prover, and you lose the persistent private state.',BODY,110,762,1700,FG)
foot(d,4); slides.append(img)

# 5 it works
img,d=new()
d.text((80,90),'It compiles, and it is tested',font=H1,fill=FG)
pnl(d,80,200,860,300,'compact compile',GREEN)
for i,l in enumerate(cap('compile.txt')[:8]): d.text((110,262+i*28),l[:52],font=MS,fill=AMBER if l.startswith('$') else FG)
pnl(d,990,200,850,300,'npm test',GREEN)
d.text((1020,275),'Tests  25 passed (25)',font=F(MONO,34),fill=GREEN)
d.text((1020,335),'Duration  1.26s',font=M,fill=DIM)
d.text((1020,385),'No Docker. No proof server.',font=M,fill=DIM)
d.text((1020,420),'No wallet. Clone and run.',font=M,fill=DIM)
pnl(d,80,540,1760,300,'ledger state after one real proof',SKY)
for i,l in enumerate(cap('seed.txt')[:8]):
    d.text((110,602+i*28),l,font=MS,fill=GREEN if 'absent' in l else (AMBER if l.startswith('$') else FG))
foot(d,5); slides.append(img)

# 6 indistinguishability
img,d=new()
d.text((80,80),'Can an observer tell 50,000 from 5,000,000?',font=H1,fill=FG)
d.text((80,160),'Same lock id. Same salt. Same counterparty. Amounts a hundredfold apart.',font=SMALL,fill=DIM)
pnl(d,80,215,1760,400,'real output, side by side',SKY)
for i,l in enumerate(cap('indistinguishability.txt')[:9]):
    col = GREEN if 'IDENTICAL' in l else (AMBER if 'DIFFERS' in l else (AMBER if l.startswith('$') else FG))
    d.text((110,277+i*32),l,font=MS,fill=col)
d.rounded_rectangle([80,650,1840,830],radius=12,fill=(8,26,20),outline=GREEN,width=2)
d.text((112,680),'Every readable field is identical except the merkle root.',font=H2,fill=GREEN)
wrap(d,'A root is a hash: it commits to the leaf without revealing it. The nullifier is byte-identical across the difference.',BODY,112,738,1660,FG)
d.text((112,792),'Not an absence you have to trust. An equality you can run.',font=BODY,fill=GREEN)
foot(d,6); slides.append(img)

# 6b the product, real screenshot
from PIL import Image as _I
_ui=_I.open(os.path.join(HERE,'video','ui-panes.png')).convert('RGB')
d=ImageDraw.Draw(_ui)
d.text((110,84),'The product, running in a browser',font=H1,fill=FG)
d.text((110,168),'Real screenshot. Circuits execute in the page against real ledger state.',font=SMALL,fill=DIM)
foot(d,7); slides.append(_ui)

# 7 security
img,d=new()
d.text((80,70),'Six attacks, six reverts from the circuit',font=H1,fill=FG)
pnl(d,80,180,1760,300,'real output',ROSE)
for i,l in enumerate(cap('attacks.txt')[2:9]): d.text((110,242+i*32),l,font=MS,fill=GREEN if 'BLOCKED' in l else FG)
rows=[('One lock backs one proof','nullifier from private lock_id + salt','4 tests'),
      ('Attestation not transferable','counterparty + expiry hashed into the leaf','3 tests'),
      ('Cannot inflate the amount','leaf recomputed in-circuit','1 test'),
      ('Attestations expire','kernel.blockTimeLessThan, ledger time','2 tests'),
      ('Amount never public','asserted against a full ledger dump','4 tests')]
yy=530
for a,b,c in rows:
    d.text((110,yy),a,font=BODY,fill=FG); d.text((740,yy+4),b,font=SMALL,fill=DIM); d.text((1660,yy),c,font=SMALL,fill=GREEN)
    yy+=54
foot(d,7); slides.append(img)

# 8 trust
img,d=new()
d.text((80,100),'The honest part',font=H1,fill=FG)
y=wrap(d,'Midnight cannot see Ethereum. There is no trustless answer without a light client, so Aval does not pretend otherwise. It makes the trusted party someone whose trust is free.',BODY,80,215,1760,DIM)
pnl(d,80,y+40,1760,150,'what ships in wave 1',GREEN)
wrap(d,'The counterparty runs the attestor themselves. Their contract cannot see Ethereum even though they can. Trust collapses to "Bob trusts Bob\'s own node", which is not a trust assumption at all.',H2,110,y+96,1700,FG)
yy=y+230
for i,(t,s) in enumerate([('k-of-n quorum','small multilateral'),('bonded + slashable','a fabricated lockId is provably contradicted on the source chain'),('light client','actual trustlessness')]):
    pnl(d,80+i*590,yy,550,150,f'roadmap {i+1}',SKY)
    d.text((110+i*590,yy+62),t,font=H2,fill=FG); wrap(d,s,SMALL,110+i*590,yy+108,500,DIM)
d.text((80,yy+200),'Residual: a malicious attestor can fabricate a lock. Same trust model as every fast-finality bridge shipping today.',font=SMALL,fill=DIM)
d.text((80,yy+232),'Aval adds privacy to that model. It does not claim to beat it.',font=SMALL,fill=DIM)
foot(d,8); slides.append(img)

# 9 market / roadmap
img,d=new()
d.text((80,100),'One predicate today. The primitive is general.',font=H1,fill=FG)
rows=[('Wave 1  SHIPPED','funds in flight','amount >= required AND beneficiary == counterparty',GREEN),
      ('Wave 2','identity preconditions','kyc_passed AND jurisdiction NOT IN sanctioned',DIM),
      ('Wave 3','private solvency','reserves >= liabilities',DIM),
      ('Wave 3','invoice factoring','invoice_valid AND unpaid AND amount >= advance',DIM)]
yy=240
for tag,name,pred,col in rows:
    pnl(d,80,yy,1760,120)
    d.text((110,yy+24),tag,font=LAB,fill=col); d.text((110,yy+56),name,font=H2,fill=FG if col==GREEN else DIM)
    d.text((760,yy+64),pred,font=M,fill=col); yy+=138
d.text((80,800),'Buyers: cross-chain treasury desks, OTC, bridge-integrated lenders, invoice factors.',font=BODY,fill=DIM)
d.text((80,845),'Midnight\'s own 2026 priorities name "institutional execution" and "programmable compliance".',font=BODY,fill=SKY)
foot(d,9); slides.append(img)

# 9b soundness
img,d=new()
d.text((80,70),'We attacked our own contract',font=H1,fill=FG)
d.text((80,150),'An adversarial review found the merkle path was never bound to the recomputed leaf.',font=SMALL,fill=DIM)
d.rounded_rectangle([80,200,1840,330],radius=12,fill=(30,12,16),outline=ROSE,width=2)
d.text((112,226),'Before the fix: a proof claiming 2^64-1 units against a real 1-unit',font=H2,fill=ROSE)
d.text((112,276),'attestation, to the wrong payee, past expiry, was ACCEPTED.',font=H2,fill=ROSE)
wrap(d,"find_path is a WITNESS: it runs on the prover's machine and is not verified. Passing the leaf into it was a hint, not a constraint.",BODY,80,368,1760,DIM)
pnl(d,80,450,1760,110,'the fix, one line',GREEN)
d.text((110,505),'assert(disclose(path.leaf == leaf), "merkle path does not open the claimed leaf");',font=MS,fill=FG)
pnl(d,80,585,1760,200,'the exploit is now a permanent regression test',GREEN)
for i,l in enumerate(cap('soundness.txt')[3:6]):
    d.text((110,645+i*34),l.strip(),font=MS,fill=GREEN)
d.text((80,815),'Disclosed rather than quietly patched. A security claim that has never been attacked is not evidence.',font=SMALL,fill=DIM)
foot(d,10); slides.append(img)

# 10 close
img,d=new()
d.text((80,330),'Aval',font=T,fill=FG)
wrap(d,'Act on a fact before that fact is public.',H1,80,460,1700,GREEN)
d.text((80,620),'github.com/Leihyn/aval',font=F(MONO,34),fill=SKY)
for i,l in enumerate(['Apache-2.0  ·  2 circuits  ·  4 proving keys  ·  25 passing tests',
                      'Compact 0.26.0  ·  compiler 0.34.0  ·  runtime 0.19.0',
                      'No Docker, no proof server, no wallet required to verify']):
    d.text((80,690+i*44),l,font=BODY,fill=DIM)
foot(d,9); slides.append(img)

slides[0].save(os.path.join(HERE,'aval-deck.pdf'),save_all=True,append_images=slides[1:],resolution=150)
for i,s in enumerate(slides,1): s.save(os.path.join(HERE,f'slide-{i:02d}.png'))
print(f'{len(slides)} slides -> aval-deck.pdf')
