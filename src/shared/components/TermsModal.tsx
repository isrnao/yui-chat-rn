/// <reference types="@webgpu/types" />
import { useEffect, useCallback, useRef, useState } from 'react';
import Modal from './Modal';
import TermsContent from '../../content/terms.mdx';

export default function TermsModal({ open, onAgree }: { open: boolean; onAgree: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gpuSupported, setGpuSupported] = useState(true);
  const attackingRef = useRef(false);
  const agreedRef = useRef(false);

  const callOnAgreeOnce = useCallback(() => {
    if (!agreedRef.current) {
      agreedRef.current = true;
      onAgree();
    }
  }, [onAgree]);

  const setupResize = (canvas: HTMLCanvasElement) => {
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  };

  const setupWebGPU = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (!navigator.gpu) {
        setGpuSupported(false);
        return () => {};
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return () => {};

      const device = await adapter.requestDevice();
      const context = canvas.getContext('webgpu') as GPUCanvasContext;
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'premultiplied' });

      const uniformBuffer = device.createBuffer({
        size: 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // ...existing code...
      const shaderModule = device.createShaderModule({
        code: `
        struct Uniforms {
          u_time: f32,
          u_attack: f32,
          u_width: f32,
          u_height: f32,
        };
        @group(0) @binding(0) var<uniform> u: Uniforms;
        fn random2(st: vec2<f32>) -> f32 {
          return fract(sin(dot(st, vec2<f32>(12.9898,78.233))) * 43758.5453123);
        }
        fn noise(st: vec2<f32>) -> f32 {
          let i = floor(st);
          let f = fract(st);
          let u_ = f * f * (3.0 - 2.0 * f);
          return mix(mix(random2(i), random2(i + vec2<f32>(1.0,0.0)), u_.x),
            mix(random2(i + vec2<f32>(0.0,1.0)), random2(i + vec2<f32>(1.0,1.0)), u_.x),
            u_.y);
        }
        fn tear(uv: vec2<f32>, origin: vec2<f32>, angle: f32, width: f32, jag: f32) -> f32 {
          let o = uv - origin;
          let s = sin(angle);
          let c = cos(angle);
          let r = vec2<f32>(o.x * c - o.y * s, o.x * s + o.y * c);
          let j = noise(r * jag) * 0.02;
          return smoothstep(width, width * 0.5, abs(r.y + j));
        }
        @vertex
        fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
          var pos = array<vec2<f32>, 6>(
            vec2<f32>(-1.0,-1.0), vec2<f32>(1.0,-1.0), vec2<f32>(-1.0,1.0),
            vec2<f32>(-1.0,1.0), vec2<f32>(1.0,-1.0), vec2<f32>(1.0,1.0)
          );
          return vec4<f32>(pos[i], 0.0, 1.0);
        }
        @fragment
        fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
          let uv = fragCoord.xy / vec2<f32>(u.u_width, u.u_height);
          var col = vec3<f32>(1.0);
          var a = 1.0;
          let atk = smoothstep(0.0, 1.0, u.u_attack);
          var claw = 0.0;
          claw += tear(uv, vec2<f32>(0.4,0.3), 1.0, 0.015, 50.0);
          claw += tear(uv, vec2<f32>(0.5,0.5), 0.9, 0.015, 60.0);
          claw += tear(uv, vec2<f32>(0.6,0.7), 0.8, 0.015, 70.0);
          let visible = smoothstep(0.1, 0.4, atk);
          col = mix(col, mix(vec3<f32>(0.6,0.0,0.0), vec3<f32>(0.1,0.02,0.01), atk), claw * visible);
          let collapse = smoothstep(0.4, 1.0, atk);
          let crumble = clamp(claw * collapse * 5.0, 0.0, 1.0);
          a *= 1.0 - crumble;
          if (a < 0.01) { discard; }
          return vec4<f32>(col, a);
        }
      `,
      });

      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vs' },
        fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });

      const uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      let start = 0;
      let u_attack = 0;
      let raf = 0;
      let stopped = false;

      const render = (ts: number) => {
        if (stopped) return;
        if (!start) start = ts;
        const t = (ts - start) / 1000;

        if (attackingRef.current && u_attack < 1) {
          u_attack = Math.min(u_attack + 0.02, 1);
        }

        device.queue.writeBuffer(
          uniformBuffer,
          0,
          new Float32Array([t, u_attack, canvas.width, canvas.height])
        );

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, uniformBindGroup);
        pass.draw(6);
        pass.end();
        device.queue.submit([encoder.finish()]);

        if (u_attack < 1) {
          raf = requestAnimationFrame(render);
        } else {
          callOnAgreeOnce();
        }
      };

      raf = requestAnimationFrame(render);

      return () => {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
      };
    },
    [callOnAgreeOnce]
  );

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('canvasが見つかりません');

    const cleanupResize = setupResize(canvas);
    let cleanupWebGPU = () => {};

    setupWebGPU(canvas).then((cleanup) => {
      if (cleanup) cleanupWebGPU = cleanup;
    });

    return () => {
      cleanupResize();
      cleanupWebGPU();
    };
  }, [open, setupWebGPU]);

  return (
    <Modal
      open={open}
      ariaLabel="利用規約への同意"
      className="w-[80%] h-[80%] bg-white/90 text-black p-4 rounded"
      onClose={gpuSupported ? undefined : onAgree}
    >
      {gpuSupported && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />}
      <div className="relative z-10 max-h-[65vh] overflow-y-auto prose prose-sm">
        <TermsContent />
      </div>
      <div className="relative z-10 mt-4">
        <button
          type="button"
          onClick={() => {
            if (!navigator.gpu) {
              callOnAgreeOnce();
            } else {
              attackingRef.current = true;
            }
          }}
          className="px-4 py-2 bg-red-700 text-white rounded"
        >
          同意して開始
        </button>
      </div>
    </Modal>
  );
}
