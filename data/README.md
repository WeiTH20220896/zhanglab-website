# Homepage molecular structure

`m4-gi-structure.json` is a compact coordinate asset for the homepage.

- Active receptor and bound acetylcholine: RCSB PDB **7TRS**, chain R.
- Gi complex: 7TRS, Gαi1 chain A, Gβ1 chain B, Gγ2 chain G.
- Inactive receptor: RCSB PDB **5DSG**, chain A, aligned to matching
  M4 backbone residues from TM1–5 and TM7 by least-squares superposition.
- Gα α5: residues 329–354, in the deposited receptor-coupled pose.

Only protein backbone atoms, ACh heavy atoms and the D112 (D3.32)
side chain for the binding-site close-up are retained. The scFv
antibody, fusion proteins, crystallization ligands and waters are excluded.
Secondary structure comes from the PDB HELIX/SHEET records. Resolved loops
are rendered as part of the same cartoon as their adjacent helices;
unresolved residues are not reconstructed or presented as measured atoms.

The renderer interpolates matching inactive and active backbone coordinates
and translates the intact Gi complex into its deposited position. This is
an educational illustration, **not** a measured trajectory or an MD result.
The ligand translates to its deposited pose without rotation.

The animation uses the pinned renderer's cached geometry buffers. Active
and inactive cartoon meshes are checked for identical topology before
their positions and normals are interpolated. Gi recruitment translates
its cached scene group, preserving subunit interfaces. The animation
targets 60 Hz and adapts to 30 Hz when rendering exceeds its frame budget.
Camera quaternion interpolation provides receptor, orthosteric-pocket,
intracellular-interface and whole-complex views.

Regenerate with NumPy installed:

```bash
curl -L https://files.rcsb.org/download/7TRS.pdb -o /tmp/7TRS.pdb
curl -L https://files.rcsb.org/download/5DSG.pdb -o /tmp/5DSG.pdb
python scripts/prepare_gpcr_structure.py /tmp/7TRS.pdb /tmp/5DSG.pdb
```

Sources: https://www.rcsb.org/structure/7TRS and
https://www.rcsb.org/structure/5DSG.

The local 3Dmol.js v2.5.5 renderer was downloaded from
https://3dmol.org/build/3Dmol-min.js; its notices are included at
`js/vendor/3Dmol-min.js.LICENSE.txt`.
