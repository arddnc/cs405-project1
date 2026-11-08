import * as mat4 from '../math/mat4.js';

/**
 * Scene-graph node.
 *  local : this node's transform relative to its parent
 *  world : local-to-world matrix, recomputed every frame by updateWorld()
 *  shape : optional drawable { mesh, color, matrix } — `matrix` sizes the mesh for
 *          drawing only and is NOT inherited by the children.
 */
export class Node {
  constructor(name, { local = mat4.identity(), shape = null } = {}) {
    this.name = name;
    this.local = local;
    this.world = mat4.identity();
    this.parent = null;
    this.children = [];
    this.shape = shape;
  }

  add(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  /** Depth-first traversal: world = parentWorld · local, then recurse. */
  updateWorld(parentWorld) {
    this.world = mat4.multiply(parentWorld, this.local);
    for (const c of this.children) c.updateWorld(this.world);
  }

  /** Visit this node and all descendants. */
  traverse(fn, depth = 0) {
    fn(this, depth);
    for (const c of this.children) c.traverse(fn, depth + 1);
  }

  /** Chain of nodes from the root down to this one. */
  path() {
    const p = [];
    for (let n = this; n; n = n.parent) p.unshift(n);
    return p;
  }
}
