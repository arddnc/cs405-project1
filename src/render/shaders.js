// WGSL shaders. All colours handled in linear space; the canvas view is *-srgb so
// the GPU encodes to sRGB on write.

export const meshWGSL = /* wgsl */`
struct U { mvp : mat4x4f, model : mat4x4f, color : vec4f };
@group(0) @binding(0) var<uniform> u : U;

struct VOut { @builtin(position) pos : vec4f, @location(0) n : vec3f };

@vertex fn vs(@location(0) p : vec3f, @location(1) n : vec3f) -> VOut {
  var o : VOut;
  o.pos = u.mvp * vec4f(p, 1.0);
  o.n = (u.model * vec4f(n, 0.0)).xyz;   // fine for uniform scale; good enough for flat shading here
  return o;
}

@fragment fn fs(i : VOut) -> @location(0) vec4f {
  let L = normalize(vec3f(0.35, 0.8, 0.55));
  let d = max(dot(normalize(i.n), L), 0.0);
  return vec4f(u.color.rgb * (0.28 + 0.72 * d), u.color.a);
}`;

export const paintingWGSL = /* wgsl */`
struct U { mvp : mat4x4f };
@group(0) @binding(0) var<uniform> u : U;
@group(0) @binding(1) var samp : sampler;
@group(0) @binding(2) var tex : texture_2d<f32>;

struct VOut { @builtin(position) pos : vec4f, @location(0) uv : vec2f };

@vertex fn vs(@location(0) p : vec3f, @location(1) uv : vec2f) -> VOut {
  var o : VOut;
  o.pos = u.mvp * vec4f(p, 1.0);
  o.uv = uv;
  return o;
}

@fragment fn fs(i : VOut) -> @location(0) vec4f {
  return textureSample(tex, samp, i.uv);   // rgba8unorm-srgb texture → linear value
}`;

export const lineWGSL = /* wgsl */`
struct U { viewProj : mat4x4f };
@group(0) @binding(0) var<uniform> u : U;

struct VOut { @builtin(position) pos : vec4f, @location(0) c : vec4f };

@vertex fn vs(@location(0) p : vec3f, @location(1) c : vec4f) -> VOut {
  var o : VOut;
  o.pos = u.viewProj * vec4f(p, 1.0);
  o.c = c;
  return o;
}

@fragment fn fs(i : VOut) -> @location(0) vec4f { return i.c; }`;
