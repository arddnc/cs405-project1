// WebGPU renderer: device setup, pipelines, per-draw uniforms (dynamic offsets),
// a streaming line buffer and multi-viewport rendering.
import * as mat4 from '../math/mat4.js';
import { meshWGSL, paintingWGSL, lineWGSL } from './shaders.js';

const SLOT = 256;            // minUniformBufferOffsetAlignment
const MAX_SLOTS = 4096;
const MAX_LINE_VERTS = 400000;
const LINE_STRIDE = 7;       // x y z r g b a
// 4× MSAA; open the page with ?nomsaa to disable it (some software rasterisers lose the device with MSAA)
const SAMPLES = new URLSearchParams(location.search).has('nomsaa') ? 1 : 4;

export class Renderer {
  static async create(canvas) {
    if (!navigator.gpu) throw new Error('WebGPU is not available in this browser.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter found.');
    const device = await adapter.requestDevice();
    return new Renderer(canvas, adapter, device);
  }

  constructor(canvas, adapter, device) {
    this.canvas = canvas;
    this.device = device;
    device.addEventListener('uncapturederror', e => console.error('WebGPU error:', e.error.message));
    let leaving = false;
    window.addEventListener('pagehide', () => { leaving = true; });
    device.lost.then(info => {
      console.error('WebGPU device lost:', info.reason, info.message);
      if (SAMPLES > 1 && !leaving) location.search = '?nomsaa';   // retry once without MSAA
    });
    const info = adapter.info || {};
    this.gpuName = [info.vendor, info.architecture, info.description, info.device].filter(Boolean).join(' ') || 'unknown GPU';
    this.context = canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();             // e.g. bgra8unorm
    this.viewFormat = this.format + '-srgb';                              // write through an sRGB view
    this.context.configure({ device, format: this.format, viewFormats: [this.viewFormat], alphaMode: 'opaque' });

    this.uniformData = new ArrayBuffer(SLOT * MAX_SLOTS);
    this.uniformF32 = new Float32Array(this.uniformData);
    this.uniformBuffer = device.createBuffer({ size: SLOT * MAX_SLOTS, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.lineData = new Float32Array(MAX_LINE_VERTS * LINE_STRIDE);
    this.lineBuffer = device.createBuffer({ size: this.lineData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });

    this._createPipelines();
    this.stats = { vertices: 0, drawCalls: 0 };
  }

  _createPipelines() {
    const d = this.device;
    const uniformLayout = (extra = []) => d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: true } }, ...extra] });
    const common = (layout, module, buffers, topology, cull) => d.createRenderPipeline({
      layout: d.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: { module, entryPoint: 'vs', buffers },
      fragment: { module, entryPoint: 'fs', targets: [{ format: this.viewFormat,
        blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } }] },
      primitive: { topology, cullMode: cull },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less-equal' },
      multisample: { count: SAMPLES },
    });
    const f3 = (loc) => ({ arrayStride: 12, attributes: [{ shaderLocation: loc, offset: 0, format: 'float32x3' }] });

    // meshes: position + normal
    this.meshLayout = uniformLayout();
    this.meshPipeline = common(this.meshLayout, d.createShaderModule({ code: meshWGSL }), [f3(0), f3(1)], 'triangle-list', 'back');
    this.meshBindGroup = d.createBindGroup({ layout: this.meshLayout, entries: [{ binding: 0, resource: { buffer: this.uniformBuffer, size: 144 } }] });

    // painting: position + uv + texture
    this.paintLayout = uniformLayout([
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} }]);
    this.paintPipeline = common(this.paintLayout, d.createShaderModule({ code: paintingWGSL }),
      [f3(0), { arrayStride: 8, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x2' }] }], 'triangle-list', 'none');

    // lines: interleaved position + colour
    this.lineLayout = uniformLayout();
    this.linePipeline = common(this.lineLayout, d.createShaderModule({ code: lineWGSL }),
      [{ arrayStride: LINE_STRIDE * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x4' }] }],
      'line-list', 'none');
    this.lineBindGroup = d.createBindGroup({ layout: this.lineLayout, entries: [{ binding: 0, resource: { buffer: this.uniformBuffer, size: 64 } }] });
  }

  createMesh(g) {
    const d = this.device;
    const buf = (arr, usage) => { const b = d.createBuffer({ size: Math.max(16, arr.byteLength), usage: usage | GPUBufferUsage.COPY_DST }); d.queue.writeBuffer(b, 0, arr); return b; };
    return {
      pos: buf(g.positions, GPUBufferUsage.VERTEX), nrm: buf(g.normals, GPUBufferUsage.VERTEX), uv: buf(g.uvs, GPUBufferUsage.VERTEX),
      idx: buf(g.indices, GPUBufferUsage.INDEX), indexCount: g.indices.length,
    };
  }

  async loadTexture(url) {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
    const tex = this.device.createTexture({ size: [bmp.width, bmp.height], format: 'rgba8unorm-srgb',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    this.device.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex }, [bmp.width, bmp.height]);
    const sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    this.paintBindGroup = this.device.createBindGroup({ layout: this.paintLayout, entries: [
      { binding: 0, resource: { buffer: this.uniformBuffer, size: 64 } },
      { binding: 1, resource: sampler }, { binding: 2, resource: tex.createView() }] });
    return { width: bmp.width, height: bmp.height };
  }

  /** Match the canvas backing store to its CSS size; (re)create MSAA + depth targets. */
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width === w && this.canvas.height === h && this.depth) return;
    this.canvas.width = w; this.canvas.height = h;
    this.depth?.destroy(); this.msaa?.destroy();
    this.depth = this.device.createTexture({ size: [w, h], format: 'depth24plus', sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.msaa = this.device.createTexture({ size: [w, h], format: this.viewFormat, sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  }

  /**
   * views: [{ viewport: [x, y, w, h] (pixels), viewProj, items, lines }]
   *   items: [{ kind: 'mesh', mesh, model, color } | { kind: 'painting', mesh, model }]
   *   lines: { data: Float32Array (7 floats / vertex), count }
   */
  render(views, clearColor) {
    const d = this.device;
    let slot = 0, lineVerts = 0;
    const put = (m, offsetFloats) => this.uniformF32.set(m, offsetFloats);
    const draws = [];
    let vertices = 0;

    for (const v of views) {
      const vd = { v, meshes: [], lineSlot: 0, lineFirst: 0, lineCount: 0 };
      for (const it of v.items) {
        if (slot >= MAX_SLOTS - 1) break;
        const base = slot * SLOT / 4;
        put(mat4.multiply(v.viewProj, it.model), base);
        if (it.kind === 'mesh') { put(it.model, base + 16); put(it.color, base + 32); }
        vd.meshes.push({ it, offset: slot * SLOT });
        vertices += it.mesh.indexCount;
        slot++;
      }
      if (v.lines && v.lines.count > 0) {
        const count = Math.min(v.lines.count, MAX_LINE_VERTS - lineVerts);
        this.lineData.set(v.lines.data.subarray(0, count * LINE_STRIDE), lineVerts * LINE_STRIDE);
        put(v.viewProj, slot * SLOT / 4);
        vd.lineSlot = slot * SLOT; vd.lineFirst = lineVerts; vd.lineCount = count;
        lineVerts += count; vertices += count; slot++;
      }
      draws.push(vd);
    }
    d.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData, 0, slot * SLOT);
    if (lineVerts) d.queue.writeBuffer(this.lineBuffer, 0, this.lineData, 0, lineVerts * LINE_STRIDE);

    const enc = d.createCommandEncoder();
    const target = this.context.getCurrentTexture().createView({ format: this.viewFormat });
    const pass = enc.beginRenderPass({
      colorAttachments: [SAMPLES > 1
        ? { view: this.msaa.createView(), resolveTarget: target, loadOp: 'clear', storeOp: 'discard', clearValue: clearColor }
        : { view: target, loadOp: 'clear', storeOp: 'store', clearValue: clearColor }],
      depthStencilAttachment: { view: this.depth.createView(), depthLoadOp: 'clear', depthStoreOp: 'discard', depthClearValue: 1 },
    });
    let drawCalls = 0;
    for (const vd of draws) {
      const [x, y, w, h] = vd.v.viewport;
      pass.setViewport(x, y, w, h, 0, 1);
      pass.setScissorRect(x, y, w, h);
      for (const { it, offset } of vd.meshes) {
        const m = it.mesh;
        if (it.kind === 'painting') {
          pass.setPipeline(this.paintPipeline); pass.setBindGroup(0, this.paintBindGroup, [offset]);
          pass.setVertexBuffer(0, m.pos); pass.setVertexBuffer(1, m.uv);
        } else {
          pass.setPipeline(this.meshPipeline); pass.setBindGroup(0, this.meshBindGroup, [offset]);
          pass.setVertexBuffer(0, m.pos); pass.setVertexBuffer(1, m.nrm);
        }
        pass.setIndexBuffer(m.idx, 'uint32');
        pass.drawIndexed(m.indexCount); drawCalls++;
      }
      if (vd.lineCount) {
        pass.setPipeline(this.linePipeline); pass.setBindGroup(0, this.lineBindGroup, [vd.lineSlot]);
        pass.setVertexBuffer(0, this.lineBuffer); pass.draw(vd.lineCount, 1, vd.lineFirst); drawCalls++;
      }
    }
    pass.end();
    d.queue.submit([enc.finish()]);
    this.stats = { vertices, drawCalls };
  }
}

/** Helper that collects line segments as interleaved vertices. */
export class LineBatch {
  constructor(capacity = 200000) { this.data = new Float32Array(capacity * LINE_STRIDE); this.count = 0; }
  clear() { this.count = 0; return this; }
  seg(a, b, c) {
    if (this.count + 2 > this.data.length / LINE_STRIDE) return;
    let o = this.count * LINE_STRIDE;
    this.data.set([a[0], a[1], a[2], c[0], c[1], c[2], c[3] ?? 1, b[0], b[1], b[2], c[0], c[1], c[2], c[3] ?? 1], o);
    this.count += 2;
  }
  strip(pts, c) { for (let i = 0; i + 1 < pts.length; i++) this.seg(pts[i], pts[i + 1], c); }
  loop(pts, c) { this.strip(pts, c); if (pts.length > 2) this.seg(pts[pts.length - 1], pts[0], c); }
}
