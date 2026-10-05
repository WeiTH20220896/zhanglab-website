"""Prepare a compact, oriented M4–Gi cartoon asset from deposited structures.

Usage: python scripts/prepare_gpcr_structure.py active.pdb inactive.pdb
Requires NumPy. 7TRS is the active ACh–M4–Gi complex; 5DSG supplies the
inactive M4 backbone. No antibody, fusion protein or crystallization ligand
is included. The interpolated animation is illustrative, not an MD trajectory.
"""
import json
import sys
from pathlib import Path
import numpy as np


def atoms(path):
    result = []
    for line in Path(path).read_text().splitlines():
        if line[:6].strip() not in ("ATOM", "HETATM"):
            continue
        if line[16] not in (" ", "A"):
            continue
        result.append({"line": line, "chain": line[21], "resi": int(line[22:26]),
                       "resn": line[17:20].strip(), "name": line[12:16].strip(),
                       "xyz": np.array([float(line[30:38]), float(line[38:46]), float(line[46:54])])})
    return result


active = atoms(sys.argv[1])
inactive = atoms(sys.argv[2])
active_ca = {a["resi"]: a["xyz"] for a in active if a["chain"] == "R" and a["name"] == "CA"}
inactive_ca = {a["resi"]: a["xyz"] for a in inactive if a["chain"] == "A" and a["name"] == "CA"}
core = [(33, 60), (65, 96), (101, 136), (145, 176), (192, 221), (431, 454)]
common = sorted(r for r in active_ca.keys() & inactive_ca.keys() if any(lo <= r <= hi for lo, hi in core))
source = np.array([inactive_ca[r] for r in common])
target = np.array([active_ca[r] for r in common])
source_mean, target_mean = source.mean(0), target.mean(0)
u, _, vt = np.linalg.svd((source - source_mean).T @ (target - target_mean))
correction = np.eye(3)
correction[2, 2] = np.linalg.det(u @ vt)
rotation = u @ correction @ vt
aligned = {(a["resi"], a["name"], a["resn"]): (a["xyz"] - source_mean) @ rotation + target_mean
           for a in inactive if a["chain"] == "A"}

# Orient the extracellular side upwards, and Gβ to the left of Gα.
helix_ends = [(33, 60), (96, 65), (101, 136), (176, 145), (192, 221), (424, 393), (431, 454)]
up = np.mean([active_ca[top] - active_ca[bottom] for top, bottom in helix_ends], axis=0)
up /= np.linalg.norm(up)
alpha_mean = np.mean([a["xyz"] for a in active if a["chain"] == "A" and a["name"] == "CA"], axis=0)
beta_mean = np.mean([a["xyz"] for a in active if a["chain"] == "B" and a["name"] == "CA"], axis=0)
right = alpha_mean - beta_mean
right -= np.dot(right, up) * up
right /= np.linalg.norm(right)
front = np.cross(right, up)
basis = np.stack([right, up, front], axis=1)
center = np.mean([active_ca[r] for lo, hi in [(33, 60), (65, 96), (101, 136), (145, 176), (192, 221), (393, 424), (431, 454)]
                  for r in range(lo, hi + 1) if r in active_ca], axis=0)


def oriented(xyz):
    return (xyz - center) @ basis


headers = [line for line in Path(sys.argv[1]).read_text().splitlines()
           if line.startswith(("HELIX", "SHEET"))]
chains = {chain: [] for chain in ("R", "A", "B", "G")}
ligand = []
inactive_coords = []
matched = 0
for atom in active:
    if atom["resn"] == "ACH":
        destination = ligand
    elif atom["chain"] in chains and atom["name"] in ("N", "CA", "C", "O"):
        destination = chains[atom["chain"]]
    else:
        continue
    xyz = oriented(atom["xyz"])
    line = atom["line"]
    destination.append(line[:30] + "".join(f"{v:8.3f}" for v in xyz) + line[54:])
    if destination is chains["R"]:
        key = (atom["resi"], atom["name"], atom["resn"])
        initial = aligned.get(key, atom["xyz"])
        matched += int(key in aligned)
        inactive_coords.append(np.round(oriented(initial), 3).tolist())

payload = {"pdb": "7TRS", "inactivePdb": "5DSG",
           "source": "https://www.rcsb.org/structure/7TRS",
           "receptor": "\n".join(headers + chains["R"] + ["END"]),
           "gProtein": "\n".join(headers + chains["A"] + ["TER"] + chains["B"] + ["TER"] + chains["G"] + ["END"]),
           "ligand": "\n".join(ligand + ["END"]), "inactiveCoordinates": inactive_coords,
           "alignment": {"coreResidues": len(common), "matchedBackboneAtoms": matched,
                         "rmsdAngstrom": round(float(np.sqrt(np.mean(np.sum(((source-source_mean) @ rotation + target_mean-target)**2, axis=1)))), 3)}}
output = Path(__file__).resolve().parent.parent / "data" / "m4-gi-structure.json"
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
print(f"Prepared {output}: {len(chains['R'])} receptor backbone atoms; {sum(len(chains[c]) for c in ('A','B','G'))} G-protein backbone atoms")
print(payload["alignment"])
