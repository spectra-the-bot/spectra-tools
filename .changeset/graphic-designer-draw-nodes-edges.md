---
"@spectratools/graphic-designer-cli": patch
---

Accept simplified graph spec format (`{ nodes, edges }`) in the `draw` command. Nodes are mapped to `flow-node` elements, edges to `connection` elements, and layout defaults to ELK auto (layered, top-to-bottom).
